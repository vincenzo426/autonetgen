#!/usr/bin/env python3
"""
NetworkAnalyzer module - classe principale di analisi della rete
"""

import os
import ipaddress
from collections import defaultdict
import networkx as nx

from config import logger, COMMON_PORTS
from network_data import NetworkData

class NetworkAnalyzer:
    """Classe principale per l'analisi della rete"""
    
    def __init__(self):
        """Inizializza l'analizzatore di rete"""
        self.hosts = set()
        self.connections = defaultdict(int)
        self.host_roles = {}
        self.host_ports = defaultdict(set)
        self.services = defaultdict(set)
        self.protocols = defaultdict(int)
        self.network_graph = nx.DiGraph()
        self.subnets = {}
        self.network_data = NetworkData()
        
    def analyze_pcap_file(self, pcap_file):
        """
        Analizza un file PCAP utilizzando un parser dedicato
        Questo metodo delega l'implementazione al PCAPParser
        """
        from parsers.pcap_parser import PCAPParser
        
        parser = PCAPParser()
        result = parser.parse(pcap_file, self.network_data)
        
        if result:
            # Sincronizza i dati interni con quelli del NetworkData
            self._sync_from_network_data()
            return True
        
        return False
        
    def analyze_csv_file(self, csv_file):
        """
        Analizza un file CSV utilizzando un parser dedicato
        Questo metodo delega l'implementazione al CSVParser
        """
        from parsers.csv_parser import CSVParser
        
        parser = CSVParser()
        result = parser.parse(csv_file, self.network_data)
        
        if result:
            # Sincronizza i dati interni con quelli del NetworkData
            self._sync_from_network_data()
            return True
        
        return False
        
    def analyze_netflow_file(self, netflow_file):
        """
        Analizza un file NetFlow utilizzando un parser dedicato
        Questo metodo delega l'implementazione al NetFlowParser
        """
        from parsers.netflow_parser import NetFlowParser
        
        parser = NetFlowParser()
        result = parser.parse(netflow_file, self.network_data)
        
        if result:
            # Sincronizza i dati interni con quelli del NetworkData
            self._sync_from_network_data()
            return True
        
        return False
    
    def _sync_from_network_data(self):
        """Sincronizza i dati interni con quelli del NetworkData"""
        self.hosts = self.network_data.hosts
        self.connections = self.network_data.connections
        self.host_ports = self.network_data.host_ports
        self.protocols = self.network_data.protocols
    
    def infer_host_roles(self):
        """Inferisce i ruoli degli host basandosi sui pattern di traffico e porte utilizzate."""
        logger.info("Inferenza dei ruoli degli host")
    
        # Conta le connessioni in entrata e in uscita per ogni host
        incoming_connections = defaultdict(int)
        outgoing_connections = defaultdict(int)
        unique_connections = defaultdict(set)  # Per contare host unici connessi
        
        for (src, dst), count in self.connections.items():
            outgoing_connections[src] += count
            incoming_connections[dst] += count
            unique_connections[src].add(dst)
            unique_connections[dst].add(src)
        
        # Identificazione delle subnet (codice esistente)
        try:
            networks = defaultdict(list)
            for ip in self.hosts:
                ip_obj = ipaddress.ip_address(ip)
                for prefix in [8, 16, 24]:
                    network = ipaddress.ip_network(f"{ip}/{prefix}", strict=False)
                    networks[prefix].append((ip, network))
            
            subnet_map = {}
            for prefix in [24, 16, 8]:
                for ip, network in networks[prefix]:
                    subnet_map[ip] = str(network)

            self.subnets = subnet_map
        except Exception as e:
            logger.warning(f"Errore nell'analisi delle subnet: {e}")
        
        # Identificazione dei ruoli basati sui pattern di traffico e sulle porte
        for host in self.hosts:
            role = "UNKNOWN"
            host_ports = self.host_ports.get(host, [])
            
            # Contatori per analisi del traffico
            in_conn = incoming_connections[host]
            out_conn = outgoing_connections[host]
            unique_conn = len(unique_connections[host])
            
            # NUOVO: Identificazione Firewall
            # Un firewall tipicamente:
            # 1. Ha traffico bilanciato in entrata e uscita
            # 2. Si connette a molti host diversi (alta diversità)
            # 3. Gestisce porte tipiche di sicurezza/filtering
            # 4. Ha un rapporto alto di host unici vs traffico totale
            
            is_firewall_candidate = False
            firewall_score = 0
            
            # Controlla se ha porte tipiche di firewall
            firewall_ports_found = []
            for port, direction, proto in host_ports:
                if port in [22, 53, 80, 443, 161, 162, 514, 1812, 1813, 4500, 500, 1701, 1723, 8080, 3128, 8443]:
                    firewall_ports_found.append(port)
                    firewall_score += 1
            
            # Analisi del pattern di connessioni
            if in_conn > 0 and out_conn > 0:
                # Traffico bilanciato (né troppo server né troppo client)
                traffic_ratio = min(in_conn, out_conn) / max(in_conn, out_conn)
                if traffic_ratio > 0.3:  # Traffico relativamente bilanciato
                    firewall_score += 2
                
                # Alta diversità di connessioni (si connette a molti host diversi)
                if unique_conn > 5:  # Soglia configurabile
                    firewall_score += 2
                
                # Rapporto connessioni uniche vs traffico totale
                # Un firewall ha molti host diversi ma non necessariamente tanto traffico per host
                connection_diversity = unique_conn / (in_conn + out_conn + 1) * 100
                if connection_diversity > 0.1:  # Alta diversità relativa
                    firewall_score += 1
            
            # Decisione finale per firewall
            if firewall_score >= 4 or (firewall_score >= 2 and len(firewall_ports_found) >= 3):
                role = "FIREWALL"
                logger.info(f"Host {host} identificato come FIREWALL (score: {firewall_score}, porte: {firewall_ports_found})")
            
            # Se non è un firewall, applica la logica esistente
            elif in_conn > out_conn * 2:
                role = "SERVER"
                
                # Identifica tipi specifici di server basandosi sulle porte
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
                        elif port == 21:
                            role = "FTP_SERVER"
                        elif port == 22:
                            role = "SSH_SERVER"
                        elif port == 3306:
                            role = "DATABASE_SERVER"
                        elif port == 1883:
                            role = "MQTT_BROKER"
            
            elif out_conn > in_conn * 2:
                role = "CLIENT"
                
                # Verifica se è un client specializzato
                for port, direction, proto in host_ports:
                    if direction == "src" and proto == "TCP":
                        if port == 80 or port == 443 or port == 8080 or port == 8443:
                            role = "WEB_CLIENT"
                            break
            
            # Host che hanno traffico bilanciato ma non sono firewall -> gateway
            elif in_conn > 0 and out_conn > 0:
                gateway_threshold = 10
                if in_conn > gateway_threshold and out_conn > gateway_threshold:
                    role = "GATEWAY"
            
            self.host_roles[host] = role
        
        logger.info(f"Ruoli inferiti per {len(self.host_roles)} host")
        
        # Log riassuntivo dei ruoli trovati
        role_counts = defaultdict(int)
        for role in self.host_roles.values():
            role_counts[role] += 1
        
        logger.info("Distribuzione ruoli:")
        for role, count in sorted(role_counts.items()):
            logger.info(f"  {role}: {count} host")
        
    def build_network_graph(self):
        """Costruisce un grafo direzionato della rete."""
        logger.info("Costruzione del grafo di rete")
        
        # Crea i nodi del grafo con gli attributi degli host
        for host in self.hosts:
            self.network_graph.add_node(
                host,
                role=self.host_roles.get(host, "UNKNOWN"),
                ports=list(self.host_ports.get(host, [])),
                subnet=self.subnets.get(host, "UNKNOWN")
            )
        
        # Aggiunge gli archi con il conteggio delle connessioni
        for (src, dst), count in self.connections.items():
            # Identifica i protocolli utilizzati su questo collegamento
            protocols = set()
            for src_port, direction, proto in self.host_ports.get(src, []):
                if direction == "src":
                    protocols.add(proto)
            
            self.network_graph.add_edge(
                src, dst,
                weight=count,
                protocols=list(protocols)
            )
        
        logger.info(f"Grafo di rete costruito con {self.network_graph.number_of_nodes()} nodi e {self.network_graph.number_of_edges()} archi")
    
    def get_data(self):
        """Restituisce i dati di rete in un formato utilizzabile dai generatori di output"""
        return {
            'network_data': self.network_data,
            'network_graph': self.network_graph,
            'subnets': self.subnets,
            'host_roles': self.host_roles,
            'output_path': None
        }