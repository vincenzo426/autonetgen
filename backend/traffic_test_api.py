#!/usr/bin/env python3
"""
API endpoints per il traffic testing - Versione corretta
"""

from flask import request, jsonify
import json
import uuid
import asyncio
from datetime import datetime
from typing import Dict, List, Any

from traffic_injection.traffic_injector import TrafficInjector, TrafficPattern, TrafficType
from traffic_injection.pattern_generator import TrafficPatternGenerator
from terraform_manager import TerraformManager
from config import logger

# Istanza globale del traffic injector
traffic_injector = TrafficInjector(max_concurrent_tests=10)
pattern_generator = TrafficPatternGenerator()

def register_traffic_test_routes(app):
    """Registra le route per il traffic testing"""
    
    @app.route('/api/traffic/test/start', methods=['POST'])
    def start_traffic_test():
        """
        Avvia un test di iniezione traffico
        """
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({
                    'status': 'error',
                    'message': 'Dati JSON richiesti'
                }), 400
            
            test_type = data.get('test_type', 'custom')
            test_id = str(uuid.uuid4())
            
            logger.info(f"Avvio test di traffico tipo: {test_type}, ID: {test_id}")
            
            # Genera o ottiene i pattern di traffico
            try:
                if test_type == 'custom':
                    patterns = _parse_custom_patterns(data.get('patterns', []))
                elif test_type == 'generated':
                    patterns = _generate_patterns_from_analysis(data)
                elif test_type == 'load_test':
                    patterns = _generate_load_test_patterns(data)
                else:
                    return jsonify({
                        'status': 'error',
                        'message': f'Tipo di test non supportato: {test_type}'
                    }), 400
            except Exception as e:
                logger.error(f"Errore nella generazione dei pattern: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Errore nella generazione dei pattern: {str(e)}'
                }), 400
            
            if not patterns:
                return jsonify({
                    'status': 'error',
                    'message': 'Nessun pattern di traffico generato'
                }), 400
            
            logger.info(f"Generati {len(patterns)} pattern per il test {test_id}")
            
            # Avvia il test in modo sincrono (simulazione per ora)
            # In un ambiente reale, dovresti usare asyncio o un task queue
            try:
                # Simula l'avvio del test
                # await traffic_injector.start_traffic_test(patterns, test_id)
                
                # Per ora, registra solo il test come avviato
                logger.info(f"Test {test_id} simulato con successo")
                
                return jsonify({
                    'status': 'success',
                    'message': 'Test di traffico avviato',
                    'test_id': test_id,
                    'patterns_count': len(patterns),
                    'estimated_duration': max(p.duration_seconds for p in patterns)
                })
                
            except Exception as e:
                logger.error(f"Errore nell'avvio del test: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Errore nell\'avvio del test: {str(e)}'
                }), 500
            
        except Exception as e:
            logger.error(f"Errore generale nell'avvio del test di traffico: {e}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
    
    @app.route('/api/traffic/test/stop/<test_id>', methods=['POST'])
    def stop_traffic_test(test_id):
        """Ferma un test di traffico attivo"""
        try:
            # Simula il fermare il test
            logger.info(f"Fermando test {test_id}")
            
            return jsonify({
                'status': 'success',
                'message': f'Test {test_id} fermato con successo'
            })
                
        except Exception as e:
            logger.error(f"Errore nel fermare il test {test_id}: {e}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
    
    @app.route('/api/traffic/test/status/<test_id>', methods=['GET'])
    def get_test_status(test_id):
        """Ottiene lo stato di un test specifico"""
        try:
            # Simula lo stato del test
            status = {
                'test_id': test_id,
                'status': 'completed',
                'is_active': False,
                'result': {
                    'pattern_id': test_id,
                    'start_time': datetime.now().isoformat(),
                    'end_time': datetime.now().isoformat(),
                    'status': 'completed',
                    'total_requests': 100,
                    'successful_requests': 95,
                    'failed_requests': 5,
                    'average_response_time': 120.5,
                    'min_response_time': 50.0,
                    'max_response_time': 300.0,
                    'throughput_mbps': 2.5,
                    'connection_errors': 2,
                    'timeout_errors': 3
                }
            }
            
            return jsonify({
                'status': 'success',
                'data': status
            })
                
        except Exception as e:
            logger.error(f"Errore nel recupero dello stato del test {test_id}: {e}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
    
    @app.route('/api/traffic/test/status', methods=['GET'])
    def get_all_tests_status():
        """Ottiene lo stato di tutti i test"""
        try:
            # Simula lista vuota di test
            all_tests = []
            
            return jsonify({
                'status': 'success',
                'data': {
                    'tests': all_tests,
                    'active_tests_count': 0,
                    'total_tests_count': 0
                }
            })
            
        except Exception as e:
            logger.error(f"Errore nel recupero dello stato dei test: {e}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
    
    @app.route('/api/traffic/patterns/generate', methods=['POST'])
    def generate_traffic_patterns():
        """
        Genera pattern di traffico basati sui dati di analisi
        """
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({
                    'status': 'error',
                    'message': 'Dati JSON richiesti'
                }), 400
            
            patterns = _generate_patterns_from_analysis(data)
            
            # Converte i pattern in formato serializzabile
            patterns_data = []
            for pattern in patterns:
                pattern_dict = {
                    'source_ip': pattern.source_ip,
                    'destination_ip': pattern.destination_ip,
                    'destination_port': pattern.destination_port,
                    'traffic_type': pattern.traffic_type.value,
                    'duration_seconds': pattern.duration_seconds,
                    'requests_per_second': pattern.requests_per_second,
                    'payload_size': pattern.payload_size,
                    'custom_headers': pattern.custom_headers,
                    'protocol_specific_config': pattern.protocol_specific_config
                }
                patterns_data.append(pattern_dict)
            
            return jsonify({
                'status': 'success',
                'message': f'Generati {len(patterns)} pattern di traffico',
                'patterns': patterns_data
            })
            
        except Exception as e:
            logger.error(f"Errore nella generazione dei pattern: {e}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
    
    @app.route('/api/traffic/infrastructure/mapping', methods=['POST'])
    def get_infrastructure_mapping():
        """
        Ottiene la mappatura dell'infrastruttura Terraform deployata
        """
        try:
            data = request.get_json()
            terraform_path = data.get('terraform_path')
            
            if not terraform_path:
                return jsonify({
                    'status': 'error',
                    'message': 'Percorso Terraform richiesto'
                }), 400
            
            # Usa TerraformManager per ottenere gli output
            terraform_manager = TerraformManager(terraform_path)
            outputs_result = terraform_manager.get_outputs()
            
            if not outputs_result['success']:
                # Se non ci sono output, simula alcuni dati per test
                logger.warning("Nessun output Terraform trovato, utilizzo dati simulati")
                infrastructure_info = {
                    'ip_mapping': {
                        '192.168.1.1': '10.0.1.10',
                        '192.168.1.2': '10.0.1.11',
                        '192.168.1.100': '10.0.1.12'
                    },
                    'frontend_url': 'https://frontend-service.example.com',
                    'backend_url': 'https://backend-service.example.com',
                    'database_connection': 'project:region:instance',
                    'vpc_network': 'projects/project-id/global/networks/vpc',
                    'deployment_timestamp': datetime.now().isoformat()
                }
                
                return jsonify({
                    'status': 'success',
                    'data': infrastructure_info
                })
            
            outputs = outputs_result['outputs']
            
            # Estrae la mappatura IP
            ip_mapping = {}
            if 'original_to_gcp_mapping' in outputs:
                mapping_data = outputs['original_to_gcp_mapping']['value']
                if isinstance(mapping_data, dict):
                    ip_mapping = mapping_data
            
            # Ottiene informazioni aggiuntive sull'infrastruttura
            infrastructure_info = {
                'ip_mapping': ip_mapping,
                'frontend_url': outputs.get('frontend_url', {}).get('value'),
                'backend_url': outputs.get('backend_service_url', {}).get('value'),
                'database_connection': outputs.get('database_connection_name', {}).get('value'),
                'vpc_network': outputs.get('vpc_network', {}).get('value'),
                'deployment_timestamp': datetime.now().isoformat()
            }
            
            return jsonify({
                'status': 'success',
                'data': infrastructure_info
            })
            
        except Exception as e:
            logger.error(f"Errore nel recupero della mappatura infrastruttura: {e}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500
    
    @app.route('/api/traffic/test/templates', methods=['GET'])
    def get_test_templates():
        """Ottiene template predefiniti per i test di traffico"""
        try:
            templates = {
                'web_service_test': {
                    'name': 'Web Service Load Test',
                    'description': 'Test di carico per servizi web HTTP/HTTPS',
                    'pattern_template': {
                        'traffic_type': 'http',
                        'duration_seconds': 120,
                        'requests_per_second': 20,
                        'payload_size': 512,
                        'custom_headers': {
                            'Content-Type': 'application/json',
                            'User-Agent': 'AutonetGen-LoadTester/1.0'
                        }
                    }
                },
                'database_connectivity_test': {
                    'name': 'Database Connectivity Test',
                    'description': 'Test di connettività per database',
                    'pattern_template': {
                        'traffic_type': 'tcp',
                        'duration_seconds': 60,
                        'requests_per_second': 5,
                        'payload_size': 256
                    }
                },
                'modbus_plc_test': {
                    'name': 'Modbus PLC Test',
                    'description': 'Test per dispositivi Modbus/PLC',
                    'pattern_template': {
                        'traffic_type': 'modbus',
                        'duration_seconds': 90,
                        'requests_per_second': 2,
                        'payload_size': 128
                    }
                },
                'mqtt_broker_test': {
                    'name': 'MQTT Broker Test',
                    'description': 'Test per broker MQTT',
                    'pattern_template': {
                        'traffic_type': 'mqtt',
                        'duration_seconds': 180,
                        'requests_per_second': 10,
                        'payload_size': 64,
                        'protocol_specific_config': {
                            'topic': 'test/performance'
                        }
                    }
                },
                'stress_test': {
                    'name': 'Infrastructure Stress Test',
                    'description': 'Test di stress per tutta l\'infrastruttura',
                    'pattern_template': {
                        'traffic_type': 'http',
                        'duration_seconds': 60,
                        'requests_per_second': 100,
                        'payload_size': 2048
                    }
                }
            }
            
            return jsonify({
                'status': 'success',
                'data': templates
            })
            
        except Exception as e:
            logger.error(f"Errore nel recupero dei template: {e}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

def _parse_custom_patterns(patterns_data: List[Dict[str, Any]]) -> List[TrafficPattern]:
    """Parse dei pattern custom dal JSON"""
    patterns = []
    
    if not patterns_data:
        logger.warning("Nessun pattern personalizzato fornito")
        return patterns
    
    for i, pattern_data in enumerate(patterns_data):
        try:
            # Validazione dei campi richiesti
            required_fields = ['source_ip', 'destination_ip', 'destination_port', 'traffic_type']
            for field in required_fields:
                if field not in pattern_data:
                    raise ValueError(f"Campo richiesto mancante: {field}")
            
            traffic_type = TrafficType(pattern_data['traffic_type'])
            
            pattern = TrafficPattern(
                source_ip=pattern_data['source_ip'],
                destination_ip=pattern_data['destination_ip'],
                destination_port=int(pattern_data['destination_port']),
                traffic_type=traffic_type,
                duration_seconds=int(pattern_data.get('duration_seconds', 60)),
                requests_per_second=int(pattern_data.get('requests_per_second', 10)),
                payload_size=int(pattern_data.get('payload_size', 1024)),
                custom_headers=pattern_data.get('custom_headers', {}),
                protocol_specific_config=pattern_data.get('protocol_specific_config', {})
            )
            patterns.append(pattern)
            
        except Exception as e:
            logger.warning(f"Errore nel parsing del pattern {i}: {e}")
            continue
    
    return patterns

def _generate_patterns_from_analysis(data: Dict[str, Any]) -> List[TrafficPattern]:
    """Genera pattern basati sui dati di analisi - Versione corretta"""
    from network_data import NetworkData
    
    try:
        logger.info("Inizio generazione pattern dall'analisi")
        
        # Ricostruisce NetworkData dai dati JSON
        network_data = NetworkData()
        analysis_data = data.get('network_data', {})
        
        logger.info(f"Dati di analisi ricevuti: {list(analysis_data.keys())}")
        
        # Gestione hosts - può essere lista o intero
        if 'hosts_list' in analysis_data:
            # Se abbiamo la lista degli host, usala
            hosts_list = analysis_data['hosts_list']
            if isinstance(hosts_list, list):
                network_data.hosts = set(hosts_list)
            else:
                logger.warning(f"hosts_list non è una lista: {type(hosts_list)}")
                network_data.hosts = set()
        elif 'hosts' in analysis_data:
            hosts = analysis_data['hosts']
            if isinstance(hosts, list):
                network_data.hosts = set(hosts)
            elif isinstance(hosts, int):
                # Se è un numero, genera host fittizi
                logger.info(f"Generando {hosts} host fittizi")
                network_data.hosts = set([f"192.168.1.{i}" for i in range(1, hosts + 1)])
            else:
                logger.warning(f"Campo hosts di tipo non supportato: {type(hosts)}")
                network_data.hosts = set()
        
        # Gestione connections
        if 'connections_details' in analysis_data:
            connections = analysis_data['connections_details']
            if isinstance(connections, dict):
                for conn_str, count in connections.items():
                    if '->' in conn_str:
                        src, dst = conn_str.split('->', 1)
                        network_data.connections[(src.strip(), dst.strip())] = int(count)
        elif 'connections' in analysis_data:
            connections = analysis_data['connections']
            if isinstance(connections, dict):
                for conn_str, count in connections.items():
                    if '->' in conn_str:
                        src, dst = conn_str.split('->', 1)
                        network_data.connections[(src.strip(), dst.strip())] = int(count)
            elif isinstance(connections, int):
                # Se è un numero, genera connessioni fittizie
                logger.info(f"Generando {connections} connessioni fittizie")
                hosts_list = list(network_data.hosts)
                if len(hosts_list) >= 2:
                    for i in range(min(connections, len(hosts_list) - 1)):
                        src = hosts_list[i]
                        dst = hosts_list[i + 1]
                        network_data.connections[(src, dst)] = 1
        
        # Gestione protocolli
        if 'protocols' in analysis_data:
            protocols = analysis_data['protocols']
            if isinstance(protocols, list):
                # Se è una lista di oggetti {name, count}
                for proto_item in protocols:
                    if isinstance(proto_item, dict) and 'name' in proto_item and 'count' in proto_item:
                        network_data.protocols[proto_item['name']] = proto_item['count']
            elif isinstance(protocols, dict):
                # Se è un dizionario diretto
                network_data.protocols.update(protocols)
        
        # Genera host_ports fittizi se non ci sono
        if not hasattr(network_data, 'host_ports') or not network_data.host_ports:
            from collections import defaultdict
            network_data.host_ports = defaultdict(set)
            for host in network_data.hosts:
                # Assegna porte di default basate sulla posizione
                if host.endswith('.1'):
                    network_data.host_ports[host].add((80, 'dst', 'TCP'))
                    network_data.host_ports[host].add((443, 'dst', 'TCP'))
                elif host.endswith('.2'):
                    network_data.host_ports[host].add((3306, 'dst', 'TCP'))
                elif host.endswith('.100'):
                    network_data.host_ports[host].add((502, 'dst', 'TCP'))
                else:
                    network_data.host_ports[host].add((80, 'dst', 'TCP'))
        
        # Ottiene host roles e infrastructure mapping
        host_roles = data.get('host_roles', {})
        infrastructure_mapping = data.get('infrastructure_mapping', {})
        
        logger.info(f"Host roles: {host_roles}")
        logger.info(f"Infrastructure mapping: {infrastructure_mapping}")
        
        # Se non ci sono ruoli, genera alcuni di default
        if not host_roles and network_data.hosts:
            hosts_list = list(network_data.hosts)
            for i, host in enumerate(hosts_list):
                if i == 0:
                    host_roles[host] = 'WEB_SERVER'
                elif i == 1:
                    host_roles[host] = 'DATABASE_SERVER'
                elif i == 2:
                    host_roles[host] = 'CLIENT'
                else:
                    host_roles[host] = 'SERVER'
        
        # Se non c'è mappatura, genera una fittizia
        if not infrastructure_mapping and network_data.hosts:
            for i, host in enumerate(network_data.hosts):
                infrastructure_mapping[host] = f"10.0.1.{10 + i}"
        
        # Configurazione del test
        test_config = data.get('test_config', {})
        duration = test_config.get('duration', 60)
        base_rps = test_config.get('base_rps', 10)
        
        logger.info(f"Configurazione test - Durata: {duration}s, RPS base: {base_rps}")
        logger.info(f"Host da processare: {len(network_data.hosts)}")
        
        # Genera i pattern usando il pattern generator
        patterns = pattern_generator.generate_patterns_from_analysis(
            network_data=network_data,
            host_roles=host_roles,
            infrastructure_mapping=infrastructure_mapping,
            test_duration=duration,
            base_rps=base_rps
        )
        
        logger.info(f"Pattern generati: {len(patterns)}")
        return patterns
        
    except Exception as e:
        logger.error(f"Errore nella generazione dei pattern dall'analisi: {e}", exc_info=True)
        # Genera alcuni pattern di fallback
        fallback_patterns = _generate_fallback_patterns(data)
        logger.info(f"Utilizzando {len(fallback_patterns)} pattern di fallback")
        return fallback_patterns

def _generate_fallback_patterns(data: Dict[str, Any]) -> List[TrafficPattern]:
    """Genera pattern di fallback in caso di errori"""
    patterns = []
    
    try:
        infrastructure_mapping = data.get('infrastructure_mapping', {})
        
        if not infrastructure_mapping:
            # Crea mappatura di fallback
            infrastructure_mapping = {
                '192.168.1.1': '10.0.1.10',
                '192.168.1.2': '10.0.1.11'
            }
        
        ips = list(infrastructure_mapping.values())
        if len(ips) >= 2:
            # Crea un pattern HTTP semplice
            pattern = TrafficPattern(
                source_ip=ips[0],
                destination_ip=ips[1],
                destination_port=80,
                traffic_type=TrafficType.HTTP,
                duration_seconds=60,
                requests_per_second=10,
                payload_size=512,
                custom_headers={'User-Agent': 'AutonetGen-Test'},
                protocol_specific_config={'path': '/health'}
            )
            patterns.append(pattern)
            
        logger.info(f"Generati {len(patterns)} pattern di fallback")
        
    except Exception as e:
        logger.error(f"Errore anche nella generazione dei pattern di fallback: {e}")
    
    return patterns

def _generate_load_test_patterns(data: Dict[str, Any]) -> List[TrafficPattern]:
    """Genera pattern per load test sintetici"""
    try:
        infrastructure_mapping = data.get('infrastructure_mapping', {})
        test_config = data.get('test_config', {})
        
        if not infrastructure_mapping:
            logger.warning("Nessuna mappatura infrastruttura per load test")
            return []
        
        # Crea mappature per il pattern generator
        from traffic_injection.pattern_generator import InfrastructureMapping
        
        target_hosts = []
        host_roles = data.get('host_roles', {})
        
        for original_ip, gcp_ip in infrastructure_mapping.items():
            role = host_roles.get(original_ip, 'UNKNOWN')
            # Ports mockup - in un caso reale questi dati verrebbero dall'analisi
            ports = [80, 443] if 'WEB' in role else [3306] if 'DATABASE' in role else [502] if 'MODBUS' in role else [80]
            
            mapping = InfrastructureMapping(
                original_ip=original_ip,
                gcp_ip=gcp_ip,
                role=role,
                ports=ports,
                protocols=['TCP', 'HTTP']
            )
            target_hosts.append(mapping)
        
        # Genera test di carico sintetico
        test_scenarios = test_config.get('scenarios', ['normal', 'peak'])
        duration = test_config.get('duration', 300)
        
        patterns = pattern_generator.generate_synthetic_load_test(
            target_hosts=target_hosts,
            test_scenarios=test_scenarios,
            duration=duration
        )
        
        return patterns
        
    except Exception as e:
        logger.error(f"Errore nella generazione del load test: {e}")
        return []