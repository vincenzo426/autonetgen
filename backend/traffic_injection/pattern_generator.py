#!/usr/bin/env python3
"""
Pattern Generator per creare automaticamente pattern di traffico basati sui dati di rete analizzati
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import random
import ipaddress

from .traffic_injector import TrafficPattern, TrafficType
from network_data import NetworkData
from config import logger, COMMON_PORTS

@dataclass
class InfrastructureMapping:
    """Mappatura tra IP originali e IP dell'infrastruttura GCP"""
    original_ip: str
    gcp_ip: str
    role: str
    ports: List[int]
    protocols: List[str]

class TrafficPatternGenerator:
    """Genera pattern di traffico basati sui dati di rete analizzati"""
    
    def __init__(self):
        """Inizializza il generatore di pattern"""
        self.role_to_traffic_type = {
            'WEB_SERVER': [TrafficType.HTTP, TrafficType.HTTPS],
            'DATABASE_SERVER': [TrafficType.TCP],
            'PLC_MODBUS': [TrafficType.MODBUS],
            'PLC_S7COMM': [TrafficType.TCP],
            'PLC_ETHERNET_IP': [TrafficType.TCP],
            'MQTT_BROKER': [TrafficType.MQTT],
            'DNS_SERVER': [TrafficType.DNS],
            'SSH_SERVER': [TrafficType.TCP],
            'FTP_SERVER': [TrafficType.TCP],
            'MAIL_SERVER': [TrafficType.TCP],
            'CLIENT': [TrafficType.HTTP, TrafficType.HTTPS, TrafficType.TCP],
            'GATEWAY': [TrafficType.TCP, TrafficType.UDP],
            'UNKNOWN': [TrafficType.TCP, TrafficType.UDP]
        }
        
        self.port_to_traffic_type = {
            80: TrafficType.HTTP,
            443: TrafficType.HTTPS,
            8080: TrafficType.HTTP,
            8443: TrafficType.HTTPS,
            502: TrafficType.MODBUS,
            102: TrafficType.TCP,  # S7COMM
            1883: TrafficType.MQTT,
            53: TrafficType.DNS,
            22: TrafficType.TCP,   # SSH
            21: TrafficType.TCP,   # FTP
            25: TrafficType.TCP,   # SMTP
            3306: TrafficType.TCP, # MySQL
        }
    
    def generate_patterns_from_analysis(
        self,
        network_data: NetworkData,
        host_roles: Dict[str, str],
        infrastructure_mapping: Dict[str, str],
        test_duration: int = 60,
        base_rps: int = 10
    ) -> List[TrafficPattern]:
        """
        Genera pattern di traffico basati sui dati di analisi della rete
        
        Args:
            network_data: Dati di rete analizzati
            host_roles: Ruoli degli host inferiti
            infrastructure_mapping: Mappatura IP originali -> IP GCP
            test_duration: Durata del test in secondi
            base_rps: Rate base di richieste al secondo
            
        Returns:
            Lista di pattern di traffico
        """
        patterns = []
        
        # Mappa gli host con i loro dati
        infrastructure_hosts = self._map_infrastructure_hosts(
            network_data, host_roles, infrastructure_mapping
        )
        
        # Genera pattern basati sulle connessioni originali
        patterns.extend(self._generate_connection_based_patterns(
            network_data, infrastructure_hosts, test_duration, base_rps
        ))
        
        # Genera pattern per testare servizi specifici
        patterns.extend(self._generate_service_based_patterns(
            infrastructure_hosts, test_duration, base_rps
        ))
        
        # Genera pattern di stress test
        patterns.extend(self._generate_stress_test_patterns(
            infrastructure_hosts, test_duration, base_rps * 5
        ))
        
        logger.info(f"Generati {len(patterns)} pattern di traffico")
        return patterns
    
    def generate_custom_pattern(
        self,
        source_ip: str,
        destination_ip: str,
        destination_port: int,
        traffic_type: str,
        duration: int = 60,
        rps: int = 10,
        payload_size: int = 1024,
        custom_config: Optional[Dict[str, Any]] = None
    ) -> TrafficPattern:
        """
        Genera un pattern di traffico personalizzato
        
        Args:
            source_ip: IP sorgente
            destination_ip: IP destinazione
            destination_port: Porta destinazione
            traffic_type: Tipo di traffico
            duration: Durata in secondi
            rps: Richieste al secondo
            payload_size: Dimensione payload
            custom_config: Configurazione personalizzata
            
        Returns:
            TrafficPattern generato
        """
        try:
            traffic_enum = TrafficType(traffic_type.lower())
        except ValueError:
            raise ValueError(f"Tipo di traffico non supportato: {traffic_type}")
        
        # Configurazione specifica per protocollo
        protocol_config = custom_config or {}
        headers = {}
        
        if traffic_enum in [TrafficType.HTTP, TrafficType.HTTPS]:
            headers = {
                'User-Agent': 'AutonetGen-TrafficTester/1.0',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            if 'path' not in protocol_config:
                protocol_config['path'] = '/health'
        
        elif traffic_enum == TrafficType.MQTT:
            if 'topic' not in protocol_config:
                protocol_config['topic'] = 'autonetgen/test'
        
        elif traffic_enum == TrafficType.DNS:
            if 'domain' not in protocol_config:
                protocol_config['domain'] = 'example.com'
        
        return TrafficPattern(
            source_ip=source_ip,
            destination_ip=destination_ip,
            destination_port=destination_port,
            traffic_type=traffic_enum,
            duration_seconds=duration,
            requests_per_second=rps,
            payload_size=payload_size,
            custom_headers=headers,
            protocol_specific_config=protocol_config
        )
    
    def _map_infrastructure_hosts(
        self,
        network_data: NetworkData,
        host_roles: Dict[str, str],
        infrastructure_mapping: Dict[str, str]
    ) -> List[InfrastructureMapping]:
        """
        Mappa gli host originali con quelli dell'infrastruttura GCP
        
        Args:
            network_data: Dati di rete
            host_roles: Ruoli degli host
            infrastructure_mapping: Mappatura IP
            
        Returns:
            Lista di mappature infrastruttura
        """
        mappings = []
        
        for original_ip in network_data.hosts:
            if original_ip in infrastructure_mapping:
                gcp_ip = infrastructure_mapping[original_ip]
                role = host_roles.get(original_ip, 'UNKNOWN')
                
                # Estrae porte e protocolli per questo host
                host_ports = []
                host_protocols = []
                
                for port_info in network_data.host_ports.get(original_ip, []):
                    port, direction, proto = port_info
                    if direction == "dst":  # Porte in ascolto
                        host_ports.append(port)
                        if proto not in host_protocols:
                            host_protocols.append(proto)
                
                mapping = InfrastructureMapping(
                    original_ip=original_ip,
                    gcp_ip=gcp_ip,
                    role=role,
                    ports=host_ports,
                    protocols=host_protocols
                )
                mappings.append(mapping)
        
        return mappings
    
    def _generate_connection_based_patterns(
        self,
        network_data: NetworkData,
        infrastructure_hosts: List[InfrastructureMapping],
        test_duration: int,
        base_rps: int
    ) -> List[TrafficPattern]:
        """
        Genera pattern basati sulle connessioni originali della rete
        
        Args:
            network_data: Dati di rete
            infrastructure_hosts: Host dell'infrastruttura
            test_duration: Durata test
            base_rps: RPS base
            
        Returns:
            Lista di pattern di traffico
        """
        patterns = []
        host_map = {h.original_ip: h for h in infrastructure_hosts}
        
        # Analizza le connessioni più frequenti
        sorted_connections = sorted(
            network_data.connections.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        # Prende le top 20 connessioni
        top_connections = sorted_connections[:20]
        
        for (src_ip, dst_ip), count in top_connections:
            if src_ip in host_map and dst_ip in host_map:
                src_host = host_map[src_ip]
                dst_host = host_map[dst_ip]
                
                # Determina le porte da testare
                ports_to_test = dst_host.ports if dst_host.ports else [80]
                
                for port in ports_to_test[:3]:  # Massimo 3 porte per connessione
                    traffic_type = self._determine_traffic_type(dst_host.role, port)
                    
                    # Scala RPS basato sulla frequenza della connessione originale
                    scaled_rps = min(base_rps + (count // 10), base_rps * 3)
                    
                    pattern = TrafficPattern(
                        source_ip=src_host.gcp_ip,
                        destination_ip=dst_host.gcp_ip,
                        destination_port=port,
                        traffic_type=traffic_type,
                        duration_seconds=test_duration,
                        requests_per_second=scaled_rps,
                        payload_size=self._get_payload_size_for_protocol(traffic_type),
                        custom_headers=self._get_headers_for_protocol(traffic_type),
                        protocol_specific_config=self._get_protocol_config(traffic_type, dst_host.role)
                    )
                    patterns.append(pattern)
        
        return patterns
    
    def _generate_service_based_patterns(
        self,
        infrastructure_hosts: List[InfrastructureMapping],
        test_duration: int,
        base_rps: int
    ) -> List[TrafficPattern]:
        """
        Genera pattern per testare servizi specifici
        
        Args:
            infrastructure_hosts: Host dell'infrastruttura
            test_duration: Durata test
            base_rps: RPS base
            
        Returns:
            Lista di pattern di traffico
        """
        patterns = []
        
        # Trova un client per generare traffico
        client_hosts = [h for h in infrastructure_hosts if h.role == 'CLIENT']
        if not client_hosts:
            # Se non ci sono client, usa il primo host disponibile
            client_hosts = infrastructure_hosts[:1]
        
        if not client_hosts:
            return patterns
        
        client_host = client_hosts[0]
        
        # Testa ogni servizio
        for host in infrastructure_hosts:
            if host.role in ['SERVER', 'WEB_SERVER', 'DATABASE_SERVER', 'PLC_MODBUS', 'MQTT_BROKER']:
                service_patterns = self._create_service_test_patterns(
                    client_host, host, test_duration, base_rps
                )
                patterns.extend(service_patterns)
        
        return patterns
    
    def _generate_stress_test_patterns(
        self,
        infrastructure_hosts: List[InfrastructureMapping],
        test_duration: int,
        stress_rps: int
    ) -> List[TrafficPattern]:
        """
        Genera pattern di stress test
        
        Args:
            infrastructure_hosts: Host dell'infrastruttura
            test_duration: Durata test (ridotta per stress test)
            stress_rps: RPS elevato per stress test
            
        Returns:
            Lista di pattern di stress test
        """
        patterns = []
        
        # Trova server critici da testare sotto stress
        critical_servers = [
            h for h in infrastructure_hosts 
            if h.role in ['WEB_SERVER', 'DATABASE_SERVER', 'GATEWAY']
        ]
        
        # Trova un client per generare traffico
        client_hosts = [h for h in infrastructure_hosts if h.role == 'CLIENT']
        if not client_hosts and infrastructure_hosts:
            client_hosts = [infrastructure_hosts[0]]
        
        if not client_hosts:
            return patterns
        
        client_host = client_hosts[0]
        stress_duration = min(test_duration // 2, 30)  # Stress test più brevi
        
        for server in critical_servers:
            main_port = server.ports[0] if server.ports else 80
            traffic_type = self._determine_traffic_type(server.role, main_port)
            
            pattern = TrafficPattern(
                source_ip=client_host.gcp_ip,
                destination_ip=server.gcp_ip,
                destination_port=main_port,
                traffic_type=traffic_type,
                duration_seconds=stress_duration,
                requests_per_second=stress_rps,
                payload_size=self._get_payload_size_for_protocol(traffic_type) * 2,  # Payload più grande
                custom_headers=self._get_headers_for_protocol(traffic_type),
                protocol_specific_config=self._get_protocol_config(traffic_type, server.role)
            )
            patterns.append(pattern)
        
        return patterns
    
    def _create_service_test_patterns(
        self,
        client_host: InfrastructureMapping,
        server_host: InfrastructureMapping,
        test_duration: int,
        base_rps: int
    ) -> List[TrafficPattern]:
        """
        Crea pattern di test per un servizio specifico
        
        Args:
            client_host: Host client
            server_host: Host server
            test_duration: Durata test
            base_rps: RPS base
            
        Returns:
            Lista di pattern per il servizio
        """
        patterns = []
        
        # Testa tutte le porte principali del servizio
        ports_to_test = server_host.ports[:3] if server_host.ports else [80]
        
        for port in ports_to_test:
            traffic_type = self._determine_traffic_type(server_host.role, port)
            
            # Pattern normale
            pattern = TrafficPattern(
                source_ip=client_host.gcp_ip,
                destination_ip=server_host.gcp_ip,
                destination_port=port,
                traffic_type=traffic_type,
                duration_seconds=test_duration // 2,
                requests_per_second=base_rps,
                payload_size=self._get_payload_size_for_protocol(traffic_type),
                custom_headers=self._get_headers_for_protocol(traffic_type),
                protocol_specific_config=self._get_protocol_config(traffic_type, server_host.role)
            )
            patterns.append(pattern)
            
            # Pattern con payload più grande per testare capacità
            if traffic_type in [TrafficType.HTTP, TrafficType.HTTPS, TrafficType.TCP]:
                large_payload_pattern = TrafficPattern(
                    source_ip=client_host.gcp_ip,
                    destination_ip=server_host.gcp_ip,
                    destination_port=port,
                    traffic_type=traffic_type,
                    duration_seconds=test_duration // 4,
                    requests_per_second=base_rps // 2,
                    payload_size=self._get_payload_size_for_protocol(traffic_type) * 10,
                    custom_headers=self._get_headers_for_protocol(traffic_type),
                    protocol_specific_config=self._get_protocol_config(traffic_type, server_host.role)
                )
                patterns.append(large_payload_pattern)
        
        return patterns
    
    def _determine_traffic_type(self, role: str, port: int) -> TrafficType:
        """
        Determina il tipo di traffico basato su ruolo e porta
        
        Args:
            role: Ruolo dell'host
            port: Porta
            
        Returns:
            Tipo di traffico appropriato
        """
        # Prima controlla la mappatura specifica della porta
        if port in self.port_to_traffic_type:
            return self.port_to_traffic_type[port]
        
        # Poi controlla il ruolo
        if role in self.role_to_traffic_type:
            possible_types = self.role_to_traffic_type[role]
            return possible_types[0]  # Prende il primo tipo disponibile
        
        # Default a TCP per porte non standard
        return TrafficType.TCP
    
    def _get_payload_size_for_protocol(self, traffic_type: TrafficType) -> int:
        """Ottiene la dimensione del payload appropriata per il protocollo"""
        payload_sizes = {
            TrafficType.HTTP: 512,
            TrafficType.HTTPS: 512,
            TrafficType.TCP: 1024,
            TrafficType.UDP: 512,
            TrafficType.MODBUS: 256,
            TrafficType.MQTT: 128,
            TrafficType.DNS: 64
        }
        return payload_sizes.get(traffic_type, 512)
    
    def _get_headers_for_protocol(self, traffic_type: TrafficType) -> Dict[str, str]:
        """Ottiene gli header appropriati per il protocollo"""
        if traffic_type in [TrafficType.HTTP, TrafficType.HTTPS]:
            return {
                'User-Agent': 'AutonetGen-TrafficTester/1.0',
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        return {}
    
    def _get_protocol_config(self, traffic_type: TrafficType, role: str) -> Dict[str, Any]:
        """Ottiene la configurazione specifica del protocollo"""
        config = {}
        
        if traffic_type in [TrafficType.HTTP, TrafficType.HTTPS]:
            if role == 'WEB_SERVER':
                config['path'] = '/'
            else:
                config['path'] = '/health'
                
        elif traffic_type == TrafficType.MQTT:
            config['topic'] = f'autonetgen/test/{role.lower()}'
            
        elif traffic_type == TrafficType.DNS:
            config['domain'] = 'test.example.com'
        
        return config
    
    def generate_synthetic_load_test(
        self,
        target_hosts: List[InfrastructureMapping],
        test_scenarios: List[str],
        duration: int = 300
    ) -> List[TrafficPattern]:
        """
        Genera un test di carico sintetico completo
        
        Args:
            target_hosts: Host target del test
            test_scenarios: Scenari di test ['normal', 'peak', 'stress', 'burst']
            duration: Durata totale del test
            
        Returns:
            Lista di pattern per il test di carico
        """
        patterns = []
        
        # Trova client per generare carico
        client_hosts = [h for h in target_hosts if h.role == 'CLIENT']
        if not client_hosts and target_hosts:
            client_hosts = [target_hosts[0]]
        
        if not client_hosts:
            return patterns
        
        scenario_configs = {
            'normal': {'rps': 10, 'duration_factor': 1.0, 'payload_factor': 1.0},
            'peak': {'rps': 50, 'duration_factor': 0.8, 'payload_factor': 1.2},
            'stress': {'rps': 100, 'duration_factor': 0.5, 'payload_factor': 2.0},
            'burst': {'rps': 200, 'duration_factor': 0.2, 'payload_factor': 0.8}
        }
        
        client_host = client_hosts[0]
        server_hosts = [h for h in target_hosts if h.role in [
            'WEB_SERVER', 'DATABASE_SERVER', 'SERVER', 'PLC_MODBUS', 'MQTT_BROKER'
        ]]
        
        for scenario in test_scenarios:
            if scenario not in scenario_configs:
                continue
                
            config = scenario_configs[scenario]
            scenario_duration = int(duration * config['duration_factor'])
            
            for server in server_hosts:
                main_port = server.ports[0] if server.ports else 80
                traffic_type = self._determine_traffic_type(server.role, main_port)
                base_payload = self._get_payload_size_for_protocol(traffic_type)
                
                pattern = TrafficPattern(
                    source_ip=client_host.gcp_ip,
                    destination_ip=server.gcp_ip,
                    destination_port=main_port,
                    traffic_type=traffic_type,
                    duration_seconds=scenario_duration,
                    requests_per_second=config['rps'],
                    payload_size=int(base_payload * config['payload_factor']),
                    custom_headers=self._get_headers_for_protocol(traffic_type),
                    protocol_specific_config={
                        **self._get_protocol_config(traffic_type, server.role),
                        'test_scenario': scenario
                    }
                )
                patterns.append(pattern)
        
        logger.info(f"Generato test di carico sintetico con {len(patterns)} pattern")
        return patterns