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
        """Inferisce i ruoli degli host basandosi sul traffico di rete analizzato."""
        logger.info("Inferenza dei ruoli degli host")
        
        # Conta le connessioni in entrata e in uscita per ogni host
        incoming_connections = defaultdict(int)
        outgoing_connections = defaultdict(int)
        
        for (src, dst), count in self.connections.items():
            outgoing_connections[src] += count
            incoming_connections[dst] += count
        
        # Identificazione delle subnet
        try:
            networks = defaultdict(list)
            for ip in self.hosts:
                ip_obj = ipaddress.ip_address(ip)
                for prefix in [8, 16, 24]:
                    network = ipaddress.ip_network(f"{ip}/{prefix}", strict=False)
                    networks[prefix].append((ip, network))
            
            # Identifica le subnet più probabili (assumendo /24 come più comune)
            subnet_map = {}
            for prefix in [24, 16, 8]:
                for ip, network in networks[prefix]:
                    subnet_map[ip] = str(network)

            self.subnets = subnet_map
        except Exception as e:
            logger.warning(f"Errore nell'analisi delle subnet: {e}")
        
        # Identificazione dei ruoli basati sui pattern di traffico e sulle porte
        for host in self.hosts:
            # Inizializza con un ruolo predefinito
            role = "UNKNOWN"
            
            # Host che accettano molte connessioni in entrata sono probabilmente server
            if incoming_connections[host] > outgoing_connections[host] * 2:
                role = "SERVER"
                
                # Identifica tipi specifici di server basandosi sulle porte
                for port, direction, proto in self.host_ports[host]:
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
            
            # Host che iniziano molte connessioni in uscita sono probabilmente client
            elif outgoing_connections[host] > incoming_connections[host] * 2:
                role = "CLIENT"
                
                # Verifica se è un client specializzato
                for port, direction, proto in self.host_ports[host]:
                    if direction == "src" and proto == "TCP":
                        if port == 80 or port == 443 or port == 8080 or port == 8443:
                            role = "WEB_CLIENT"
                            break
            
            # Host che hanno sia traffico in entrata che in uscita bilanciato potrebbero essere gateway o proxy
            elif incoming_connections[host] > 0 and outgoing_connections[host] > 0:
                gateway_threshold = 10  # soglia arbitraria
                if incoming_connections[host] > gateway_threshold and outgoing_connections[host] > gateway_threshold:
                    role = "GATEWAY"
            
            self.host_roles[host] = role
        
        logger.info(f"Ruoli inferiti per {len(self.host_roles)} host")
    
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