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