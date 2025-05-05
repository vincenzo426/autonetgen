#!/usr/bin/env python3
"""
NetworkData module for storing and managing network analysis data
"""

from collections import defaultdict

class NetworkData:
    """Classe per memorizzare e gestire i dati di analisi della rete"""
    
    def __init__(self):
        """Inizializza la struttura dei dati di rete"""
        self.hosts = set()
        self.connections = defaultdict(int)
        self.host_ports = defaultdict(set)
        self.protocols = defaultdict(int)
        
    def add_host(self, ip):
        """Aggiunge un host alla lista degli host"""
        self.hosts.add(ip)
        
    def add_connection(self, src_ip, dst_ip):
        """Aggiunge una connessione tra due host"""
        self.connections[(src_ip, dst_ip)] += 1
        
    def add_port(self, ip, port, direction, proto):
        """Aggiunge un'informazione sulla porta utilizzata da un host"""
        self.host_ports[ip].add((port, direction, proto))
        
    def add_protocol(self, proto):
        """Aggiunge un conteggio del protocollo utilizzato"""
        self.protocols[proto] += 1
        
    def from_dict(self, data_dict):
        """Popola i dati da un dizionario"""
        if 'hosts' in data_dict:
            self.hosts = set(data_dict['hosts'])
            
        if 'connections' in data_dict:
            for conn_str, count in data_dict['connections'].items():
                src, dst = conn_str.split('->')
                self.connections[(src, dst)] = count
                
        if 'host_ports' in data_dict:
            for ip, ports in data_dict['host_ports'].items():
                for port_info in ports:
                    self.host_ports[ip].add(tuple(port_info))
                    
        if 'protocols' in data_dict:
            self.protocols = defaultdict(int, data_dict['protocols'])
            
        return self
    
    def to_dict(self):
        """Converte i dati in un dizionario"""
        connections_dict = {f"{src}->{dst}": count 
                          for (src, dst), count in self.connections.items()}
        
        host_ports_dict = {ip: [list(port_info) for port_info in ports]
                         for ip, ports in self.host_ports.items()}
        
        return {
            "hosts": list(self.hosts),
            "connections": connections_dict,
            "host_ports": host_ports_dict,
            "protocols": dict(self.protocols)
        }