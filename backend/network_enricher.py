#!/usr/bin/env python3
"""
NetworkEnricher - classe per arricchire i dati di rete con informazioni aggiuntive
"""

import json
import ipaddress
from collections import defaultdict
from config import logger, COMMON_PORTS

class NetworkEnricher:
    """Classe per arricchire i dati di rete con informazioni aggiuntive"""
    
    def __init__(self):
        """Inizializza l'arricchitore di rete"""
        self.host_data = {}
        self.subnet_data = {}
    
    def enrich_host_roles(self, network_data, host_roles_dict=None):
        """
        Arricchisce i dati di rete con informazioni sui ruoli degli host
        
        Args:
            network_data (NetworkData): Oggetto contenente i dati di rete
            host_roles_dict (dict, optional): Dizionario con i ruoli degli host preesistenti
        
        Returns:
            dict: Dizionario con i ruoli degli host
        """
        if host_roles_dict:
            self.host_data.update(host_roles_dict)
            return self.host_data
            
        # Inferenza dei ruoli degli host se non è stato fornito un dizionario
        host_roles = {}
        
        # Conta le connessioni in entrata e in uscita per ogni host
        incoming_connections = defaultdict(int)
        outgoing_connections = defaultdict(int)
        unique_connections = defaultdict(set)  # NUOVO: Per contare host unici
        
        for (src, dst), count in network_data.connections.items():
            outgoing_connections[src] += count
            incoming_connections[dst] += count
            unique_connections[src].add(dst)  # NUOVO
            unique_connections[dst].add(src)  # NUOVO
        
        # Identificazione dei ruoli basati sui pattern di traffico e sulle porte
        for host in network_data.hosts:
            role = "UNKNOWN"
            
            # Contatori per analisi del traffico
            in_conn = incoming_connections[host]
            out_conn = outgoing_connections[host]
            unique_conn = len(unique_connections[host])
            
            # NUOVO: Identificazione Firewall
            # Logica per identificare firewall
            is_firewall_candidate = False
            firewall_score = 0
            
            # Accesso alle porte dell'host (assumendo che network_data abbia host_ports)
            host_ports = getattr(network_data, 'host_ports', {}).get(host, [])
            
            # Controlla se ha porte tipiche di firewall
            firewall_ports_found = []
            if hasattr(network_data, 'host_ports'):
                for port, direction, proto in host_ports:
                    if port in [22, 53, 80, 443, 161, 162, 514, 1812, 1813, 4500, 500, 1701, 1723, 8080, 3128, 8443]:
                        firewall_ports_found.append(port)
                        firewall_score += 1
            
            # Analisi del pattern di connessioni per firewall
            if in_conn > 0 and out_conn > 0:
                # Traffico bilanciato
                traffic_ratio = min(in_conn, out_conn) / max(in_conn, out_conn)
                if traffic_ratio > 0.3:
                    firewall_score += 2
                
                # Alta diversità di connessioni
                if unique_conn > 5:
                    firewall_score += 2
                
                # Rapporto connessioni uniche vs traffico totale
                connection_diversity = unique_conn / (in_conn + out_conn + 1) * 100
                if connection_diversity > 0.1:
                    firewall_score += 1
            
            # Decisione finale per firewall
            if firewall_score >= 4 or (firewall_score >= 2 and len(firewall_ports_found) >= 3):
                role = "FIREWALL"
            
            # Logica esistente per altri ruoli
            elif in_conn > out_conn * 2:
                role = "SERVER"
                
                # Server specializzati
                if hasattr(network_data, 'host_ports'):
                    for port, direction, proto in host_ports:
                        if direction == "dst":
                            if port == 502:
                                role = "PLC_MODBUS"
                                break
                            elif port == 102:
                                role = "PLC_S7COMM"
                                break
                            elif port == 44818:
                                role = "PLC_ETHERNET_IP"
                                break
                            elif port == 80 or port == 443 or port == 8080 or port == 8443:
                                role = "WEB_SERVER"
                            elif port == 53:
                                role = "DNS_SERVER"
                            elif port == 25:
                                role = "MAIL_SERVER"
                            elif port == 22:
                                role = "SSH_SERVER"
                            elif port == 3306:
                                role = "DATABASE_SERVER"
                            elif port == 1883:
                                role = "MQTT_BROKER"
            
            elif out_conn > in_conn * 2:
                role = "CLIENT"
                
                # Client specializzati
                if hasattr(network_data, 'host_ports'):
                    for port, direction, proto in host_ports:
                        if direction == "src" and proto == "TCP":
                            if port == 80 or port == 443 or port == 8080 or port == 8443:
                                role = "WEB_CLIENT"
                                break
            
            # Gateway (traffico bilanciato ma non firewall)
            elif in_conn > 0 and out_conn > 0:
                gateway_threshold = 10
                if in_conn > gateway_threshold and out_conn > gateway_threshold:
                    role = "GATEWAY"
            
            host_roles[host] = role
        
        self.host_data = host_roles
        logger.info(f"Ruoli inferiti per {len(host_roles)} host")
        
        # Log riassuntivo dei ruoli
        role_counts = defaultdict(int)
        for role in host_roles.values():
            role_counts[role] += 1
        
        logger.info("Distribuzione ruoli trovati:")
        for role, count in sorted(role_counts.items()):
            logger.info(f"  {role}: {count} host")
        
        return host_roles
    
    def identify_subnets(self, network_data):
        """
        Identifica le subnet nella rete basandosi sugli indirizzi IP
        
        Args:
            network_data (NetworkData): Oggetto contenente i dati di rete
            
        Returns:
            dict: Dizionario con le subnet identificate
        """
        subnets = {}
        
        try:
            networks = defaultdict(list)
            for ip in network_data.hosts:
                ip_obj = ipaddress.ip_address(ip)
                for prefix in [8, 16, 24]:
                    network = ipaddress.ip_network(f"{ip}/{prefix}", strict=False)
                    networks[prefix].append((ip, network))
            
            # Identifica le subnet più probabili (assumendo /24 come più comune)
            for prefix in [24, 16, 8]:
                for ip, network in networks[prefix]:
                    if ip not in subnets:
                        subnets[ip] = str(network)
            
            self.subnet_data = subnets
            return subnets
            
        except Exception as e:
            logger.warning(f"Errore nell'analisi delle subnet: {e}")
            return {}

            