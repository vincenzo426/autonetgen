#!/usr/bin/env python3
"""
Traffic Injection Manager per testare l'infrastruttura deployata
"""

import asyncio
import aiohttp
import json
import time
import random
import socket
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from concurrent.futures import ThreadPoolExecutor
import logging
from datetime import datetime, timedelta

from config import logger

class TrafficType(Enum):
    """Tipi di traffico supportati"""
    HTTP = "http"
    HTTPS = "https"
    TCP = "tcp"
    UDP = "udp"
    MODBUS = "modbus"
    S7COMM = "s7comm"
    MQTT = "mqtt"
    DNS = "dns"

class TestStatus(Enum):
    """Stati del test"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class TrafficPattern:
    """Definisce un pattern di traffico da iniettare"""
    source_ip: str
    destination_ip: str
    destination_port: int
    traffic_type: TrafficType
    duration_seconds: int
    requests_per_second: int
    payload_size: int = 1024
    custom_headers: Dict[str, str] = None
    protocol_specific_config: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.custom_headers is None:
            self.custom_headers = {}
        if self.protocol_specific_config is None:
            self.protocol_specific_config = {}

@dataclass
class TestResult:
    """Risultato di un test di iniezione traffico"""
    pattern_id: str
    start_time: datetime
    end_time: Optional[datetime]
    status: TestStatus
    total_requests: int
    successful_requests: int
    failed_requests: int
    average_response_time: float
    min_response_time: float
    max_response_time: float
    error_messages: List[str]
    throughput_mbps: float
    connection_errors: int
    timeout_errors: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Converte il risultato in dizionario per serializzazione"""
        result = asdict(self)
        result['start_time'] = self.start_time.isoformat() if self.start_time else None
        result['end_time'] = self.end_time.isoformat() if self.end_time else None
        result['status'] = self.status.value
        return result

class TrafficInjector:
    """Gestisce l'iniezione del traffico per testare l'infrastruttura"""
    
    def __init__(self, max_concurrent_tests: int = 5):
        """
        Inizializza il TrafficInjector
        
        Args:
            max_concurrent_tests: Numero massimo di test simultanei
        """
        self.max_concurrent_tests = max_concurrent_tests
        self.active_tests: Dict[str, asyncio.Task] = {}
        self.test_results: Dict[str, TestResult] = {}
        self.executor = ThreadPoolExecutor(max_workers=10)
        
        # Configurazione per diversi protocolli
        self.protocol_handlers = {
            TrafficType.HTTP: self._handle_http_traffic,
            TrafficType.HTTPS: self._handle_https_traffic,
            TrafficType.TCP: self._handle_tcp_traffic,
            TrafficType.UDP: self._handle_udp_traffic,
            TrafficType.MODBUS: self._handle_modbus_traffic,
            TrafficType.MQTT: self._handle_mqtt_traffic,
            TrafficType.DNS: self._handle_dns_traffic,
        }
    
    async def start_traffic_test(self, patterns: List[TrafficPattern], test_id: str) -> str:
        """
        Avvia un test di iniezione traffico
        
        Args:
            patterns: Lista di pattern di traffico da testare
            test_id: ID univoco del test
            
        Returns:
            str: ID del test avviato
            
        Raises:
            Exception: Se ci sono troppi test attivi o errori di configurazione
        """
        if len(self.active_tests) >= self.max_concurrent_tests:
            raise Exception(f"Troppi test attivi. Massimo: {self.max_concurrent_tests}")
        
        if test_id in self.active_tests:
            raise Exception(f"Test con ID {test_id} già in corso")
        
        # Valida i pattern
        self._validate_patterns(patterns)
        
        # Crea task asincrono per il test
        task = asyncio.create_task(self._execute_traffic_test(patterns, test_id))
        self.active_tests[test_id] = task
        
        logger.info(f"Test traffico {test_id} avviato con {len(patterns)} pattern")
        return test_id
    
    async def stop_traffic_test(self, test_id: str) -> bool:
        """
        Ferma un test di traffico attivo
        
        Args:
            test_id: ID del test da fermare
            
        Returns:
            bool: True se il test è stato fermato con successo
        """
        if test_id not in self.active_tests:
            return False
        
        task = self.active_tests[test_id]
        task.cancel()
        
        try:
            await task
        except asyncio.CancelledError:
            pass
        
        # Aggiorna lo stato del risultato
        if test_id in self.test_results:
            self.test_results[test_id].status = TestStatus.CANCELLED
            self.test_results[test_id].end_time = datetime.now()
        
        del self.active_tests[test_id]
        logger.info(f"Test traffico {test_id} fermato")
        return True
    
    def get_test_status(self, test_id: str) -> Optional[Dict[str, Any]]:
        """
        Ottiene lo stato di un test
        
        Args:
            test_id: ID del test
            
        Returns:
            Dict con lo stato del test o None se non trovato
        """
        if test_id in self.test_results:
            result = self.test_results[test_id]
            return {
                'test_id': test_id,
                'status': result.status.value,
                'is_active': test_id in self.active_tests,
                'result': result.to_dict()
            }
        return None
    
    def get_all_tests_status(self) -> List[Dict[str, Any]]:
        """
        Ottiene lo stato di tutti i test
        
        Returns:
            Lista con lo stato di tutti i test
        """
        all_tests = []
        for test_id in self.test_results:
            status = self.get_test_status(test_id)
            if status:
                all_tests.append(status)
        return all_tests
    
    async def _execute_traffic_test(self, patterns: List[TrafficPattern], test_id: str):
        """
        Esegue il test di traffico
        
        Args:
            patterns: Pattern di traffico da testare
            test_id: ID del test
        """
        start_time = datetime.now()
        
        try:
            # Esegue tutti i pattern simultaneamente
            pattern_tasks = []
            for i, pattern in enumerate(patterns):
                pattern_id = f"{test_id}_pattern_{i}"
                task = asyncio.create_task(
                    self._execute_single_pattern(pattern, pattern_id)
                )
                pattern_tasks.append(task)
            
            # Attende il completamento di tutti i pattern
            pattern_results = await asyncio.gather(*pattern_tasks, return_exceptions=True)
            
            # Aggrega i risultati
            self._aggregate_results(test_id, pattern_results, start_time)
            
        except Exception as e:
            logger.error(f"Errore durante l'esecuzione del test {test_id}: {e}")
            self._create_failed_result(test_id, start_time, str(e))
        finally:
            # Rimuove il test dai test attivi
            if test_id in self.active_tests:
                del self.active_tests[test_id]
    
    async def _execute_single_pattern(self, pattern: TrafficPattern, pattern_id: str) -> TestResult:
        """
        Esegue un singolo pattern di traffico
        
        Args:
            pattern: Pattern da eseguire
            pattern_id: ID del pattern
            
        Returns:
            TestResult: Risultato del test del pattern
        """
        start_time = datetime.now()
        
        # Inizializza il risultato
        result = TestResult(
            pattern_id=pattern_id,
            start_time=start_time,
            end_time=None,
            status=TestStatus.RUNNING,
            total_requests=0,
            successful_requests=0,
            failed_requests=0,
            average_response_time=0.0,
            min_response_time=float('inf'),
            max_response_time=0.0,
            error_messages=[],
            throughput_mbps=0.0,
            connection_errors=0,
            timeout_errors=0
        )
        
        # Salva il risultato iniziale
        self.test_results[pattern_id] = result
        
        try:
            # Ottiene il gestore per il tipo di traffico
            handler = self.protocol_handlers.get(pattern.traffic_type)
            if not handler:
                raise Exception(f"Protocollo non supportato: {pattern.traffic_type}")
            
            # Esegue il test per la durata specificata
            await handler(pattern, result)
            
            result.status = TestStatus.COMPLETED
            
        except Exception as e:
            result.status = TestStatus.FAILED
            result.error_messages.append(str(e))
            logger.error(f"Errore nel pattern {pattern_id}: {e}")
        
        finally:
            result.end_time = datetime.now()
            # Calcola metriche finali
            self._calculate_final_metrics(result, pattern)
        
        return result
    
    async def _handle_http_traffic(self, pattern: TrafficPattern, result: TestResult):
        """Gestisce traffico HTTP/HTTPS"""
        url = f"http://{pattern.destination_ip}:{pattern.destination_port}"
        if pattern.traffic_type == TrafficType.HTTPS:
            url = f"https://{pattern.destination_ip}:{pattern.destination_port}"
        
        # Aggiunge path se specificato nella configurazione
        path = pattern.protocol_specific_config.get('path', '/')
        url += path
        
        timeout = aiohttp.ClientTimeout(total=30)
        connector = aiohttp.TCPConnector(limit=100)
        
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            end_time = datetime.now() + timedelta(seconds=pattern.duration_seconds)
            request_interval = 1.0 / pattern.requests_per_second if pattern.requests_per_second > 0 else 1.0
            
            while datetime.now() < end_time:
                request_start = time.time()
                
                try:
                    # Prepara payload
                    data = 'x' * pattern.payload_size if pattern.payload_size > 0 else None
                    
                    # Esegue richiesta
                    async with session.post(
                        url, 
                        data=data, 
                        headers=pattern.custom_headers
                    ) as response:
                        await response.text()
                        
                        # Registra metriche
                        response_time = time.time() - request_start
                        result.total_requests += 1
                        
                        if response.status < 400:
                            result.successful_requests += 1
                        else:
                            result.failed_requests += 1
                            result.error_messages.append(f"HTTP {response.status}")
                        
                        self._update_response_time_metrics(result, response_time)
                
                except asyncio.TimeoutError:
                    result.total_requests += 1
                    result.failed_requests += 1
                    result.timeout_errors += 1
                    result.error_messages.append("Timeout")
                
                except aiohttp.ClientConnectorError:
                    result.total_requests += 1
                    result.failed_requests += 1
                    result.connection_errors += 1
                    result.error_messages.append("Connection error")
                
                except Exception as e:
                    result.total_requests += 1
                    result.failed_requests += 1
                    result.error_messages.append(str(e))
                
                # Aspetta prima della prossima richiesta
                await asyncio.sleep(request_interval)
    
    async def _handle_https_traffic(self, pattern: TrafficPattern, result: TestResult):
        """Gestisce traffico HTTPS (delega a _handle_http_traffic)"""
        await self._handle_http_traffic(pattern, result)
    
    async def _handle_tcp_traffic(self, pattern: TrafficPattern, result: TestResult):
        """Gestisce traffico TCP generico"""
        end_time = datetime.now() + timedelta(seconds=pattern.duration_seconds)
        request_interval = 1.0 / pattern.requests_per_second if pattern.requests_per_second > 0 else 1.0
        
        while datetime.now() < end_time:
            request_start = time.time()
            
            try:
                # Apre connessione TCP
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(pattern.destination_ip, pattern.destination_port),
                    timeout=10.0
                )
                
                # Invia dati
                data = b'x' * pattern.payload_size
                writer.write(data)
                await writer.drain()
                
                # Legge risposta (opzionale)
                try:
                    response = await asyncio.wait_for(reader.read(1024), timeout=5.0)
                except asyncio.TimeoutError:
                    pass  # Non tutte le connessioni TCP rispondono
                
                writer.close()
                await writer.wait_closed()
                
                # Registra metriche
                response_time = time.time() - request_start
                result.total_requests += 1
                result.successful_requests += 1
                self._update_response_time_metrics(result, response_time)
                
            except asyncio.TimeoutError:
                result.total_requests += 1
                result.failed_requests += 1
                result.timeout_errors += 1
                
            except Exception as e:
                result.total_requests += 1
                result.failed_requests += 1
                result.connection_errors += 1
                result.error_messages.append(str(e))
            
            await asyncio.sleep(request_interval)
    
    async def _handle_udp_traffic(self, pattern: TrafficPattern, result: TestResult):
        """Gestisce traffico UDP"""
        end_time = datetime.now() + timedelta(seconds=pattern.duration_seconds)
        request_interval = 1.0 / pattern.requests_per_second if pattern.requests_per_second > 0 else 1.0
        
        # Crea socket UDP
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(5.0)
        
        try:
            while datetime.now() < end_time:
                request_start = time.time()
                
                try:
                    # Invia dati UDP
                    data = b'x' * pattern.payload_size
                    sock.sendto(data, (pattern.destination_ip, pattern.destination_port))
                    
                    # Tenta di ricevere risposta (opzionale per UDP)
                    try:
                        response, addr = sock.recvfrom(1024)
                    except socket.timeout:
                        pass  # UDP può non rispondere
                    
                    # Registra metriche
                    response_time = time.time() - request_start
                    result.total_requests += 1
                    result.successful_requests += 1
                    self._update_response_time_metrics(result, response_time)
                    
                except Exception as e:
                    result.total_requests += 1
                    result.failed_requests += 1
                    result.error_messages.append(str(e))
                
                await asyncio.sleep(request_interval)
                
        finally:
            sock.close()
    
    async def _handle_modbus_traffic(self, pattern: TrafficPattern, result: TestResult):
        """Gestisce traffico Modbus TCP"""
        try:
            from pymodbus.client.sync import ModbusTcpClient
        except ImportError:
            result.error_messages.append("pymodbus library not available")
            return
        
        end_time = datetime.now() + timedelta(seconds=pattern.duration_seconds)
        request_interval = 1.0 / pattern.requests_per_second if pattern.requests_per_second > 0 else 1.0
        
        client = ModbusTcpClient(pattern.destination_ip, port=pattern.destination_port)
        
        try:
            while datetime.now() < end_time:
                request_start = time.time()
                
                try:
                    # Connetti al client Modbus
                    if client.connect():
                        # Legge holding registers (esempio)
                        response = client.read_holding_registers(0, 10, unit=1)
                        client.close()
                        
                        response_time = time.time() - request_start
                        result.total_requests += 1
                        
                        if not response.isError():
                            result.successful_requests += 1
                        else:
                            result.failed_requests += 1
                            result.error_messages.append("Modbus error response")
                        
                        self._update_response_time_metrics(result, response_time)
                    else:
                        result.total_requests += 1
                        result.failed_requests += 1
                        result.connection_errors += 1
                        
                except Exception as e:
                    result.total_requests += 1
                    result.failed_requests += 1
                    result.error_messages.append(str(e))
                
                await asyncio.sleep(request_interval)
                
        finally:
            if client.is_socket_open():
                client.close()
    
    async def _handle_mqtt_traffic(self, pattern: TrafficPattern, result: TestResult):
        """Gestisce traffico MQTT"""
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            result.error_messages.append("paho-mqtt library not available")
            return
        
        end_time = datetime.now() + timedelta(seconds=pattern.duration_seconds)
        request_interval = 1.0 / pattern.requests_per_second if pattern.requests_per_second > 0 else 1.0
        
        # Configurazione MQTT
        topic = pattern.protocol_specific_config.get('topic', 'test/topic')
        
        while datetime.now() < end_time:
            request_start = time.time()
            
            try:
                # Crea client MQTT
                client = mqtt.Client()
                client.connect(pattern.destination_ip, pattern.destination_port, 60)
                
                # Pubblica messaggio
                payload = 'x' * pattern.payload_size
                result_code = client.publish(topic, payload)
                
                client.disconnect()
                
                response_time = time.time() - request_start
                result.total_requests += 1
                
                if result_code.rc == mqtt.MQTT_ERR_SUCCESS:
                    result.successful_requests += 1
                else:
                    result.failed_requests += 1
                    result.error_messages.append(f"MQTT error: {result_code.rc}")
                
                self._update_response_time_metrics(result, response_time)
                
            except Exception as e:
                result.total_requests += 1
                result.failed_requests += 1
                result.error_messages.append(str(e))
            
            await asyncio.sleep(request_interval)
    
    async def _handle_dns_traffic(self, pattern: TrafficPattern, result: TestResult):
        """Gestisce query DNS"""
        import socket
        
        end_time = datetime.now() + timedelta(seconds=pattern.duration_seconds)
        request_interval = 1.0 / pattern.requests_per_second if pattern.requests_per_second > 0 else 1.0
        
        # Configura DNS server
        domain = pattern.protocol_specific_config.get('domain', 'example.com')
        
        while datetime.now() < end_time:
            request_start = time.time()
            
            try:
                # Esegue query DNS
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    self.executor,
                    socket.gethostbyname,
                    domain
                )
                
                response_time = time.time() - request_start
                result.total_requests += 1
                result.successful_requests += 1
                self._update_response_time_metrics(result, response_time)
                
            except Exception as e:
                result.total_requests += 1
                result.failed_requests += 1
                result.error_messages.append(str(e))
            
            await asyncio.sleep(request_interval)
    
    def _validate_patterns(self, patterns: List[TrafficPattern]):
        """Valida i pattern di traffico"""
        if not patterns:
            raise Exception("Almeno un pattern di traffico è richiesto")
        
        for pattern in patterns:
            if not pattern.destination_ip:
                raise Exception("IP di destinazione richiesto")
            
            if not (1 <= pattern.destination_port <= 65535):
                raise Exception("Porta di destinazione deve essere tra 1 e 65535")
            
            if pattern.duration_seconds <= 0:
                raise Exception("Durata deve essere positiva")
            
            if pattern.requests_per_second <= 0:
                raise Exception("Rate di richieste deve essere positivo")
    
    def _update_response_time_metrics(self, result: TestResult, response_time: float):
        """Aggiorna le metriche dei tempi di risposta"""
        if response_time < result.min_response_time:
            result.min_response_time = response_time
        
        if response_time > result.max_response_time:
            result.max_response_time = response_time
        
        # Calcola media incrementale
        if result.successful_requests > 0:
            result.average_response_time = (
                (result.average_response_time * (result.successful_requests - 1) + response_time) /
                result.successful_requests
            )
    
    def _calculate_final_metrics(self, result: TestResult, pattern: TrafficPattern):
        """Calcola le metriche finali del test"""
        if result.successful_requests == 0:
            result.min_response_time = 0.0
        
        # Calcola throughput in Mbps
        if result.end_time and result.start_time:
            duration = (result.end_time - result.start_time).total_seconds()
            if duration > 0:
                bytes_transferred = result.successful_requests * pattern.payload_size
                result.throughput_mbps = (bytes_transferred * 8) / (duration * 1_000_000)
    
    def _aggregate_results(self, test_id: str, pattern_results: List[TestResult], start_time: datetime):
        """Aggrega i risultati di tutti i pattern in un risultato finale"""
        # Implementa logica di aggregazione se necessario
        # Per ora, salva tutti i risultati dei pattern individualmente
        pass
    
    def _create_failed_result(self, test_id: str, start_time: datetime, error_message: str):
        """Crea un risultato per un test fallito"""
        result = TestResult(
            pattern_id=test_id,
            start_time=start_time,
            end_time=datetime.now(),
            status=TestStatus.FAILED,
            total_requests=0,
            successful_requests=0,
            failed_requests=0,
            average_response_time=0.0,
            min_response_time=0.0,
            max_response_time=0.0,
            error_messages=[error_message],
            throughput_mbps=0.0,
            connection_errors=0,
            timeout_errors=0
        )
        self.test_results[test_id] = result