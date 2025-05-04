#!/usr/bin/env python3
"""
PCAP Parser - parser specifico per i file PCAP
"""

from scapy.all import rdpcap, IP, TCP, UDP
from config import logger, COMMON_PORTS
from parsers.base_parser import NetworkParser

class PCAPParser(NetworkParser):
    """Parser per i file PCAP"""
    
    def parse(self, file_path, network_data):
        """
        Analizza un file PCAP e popola l'oggetto network_data
        
        Args:
            file_path (str): Percorso del file PCAP da analizzare
            network_data (NetworkData): Oggetto che contiene i dati di rete
            
        Returns:
            bool: True se l'analisi è riuscita, False altrimenti
        """
        logger.info(f"Analisi del file PCAP: {file_path}")
        
        try:
            packets = rdpcap(file_path)
            for packet in packets:
                if IP in packet:
                    src_ip = packet[IP].src
                    dst_ip = packet[IP].dst
                    
                    # Salva gli host
                    network_data.add_host(src_ip)
                    network_data.add_host(dst_ip)
                    
                    # Salva le connessioni
                    network_data.add_connection(src_ip, dst_ip)
                    
                    # Analisi del protocollo
                    if TCP in packet:
                        proto = "TCP"
                        sport = packet[TCP].sport
                        dport = packet[TCP].dport
                    elif UDP in packet:
                        proto = "UDP"
                        sport = packet[UDP].sport
                        dport = packet[UDP].dport
                    else:
                        proto = "OTHER"
                        sport = None
                        dport = None
                    
                    network_data.add_protocol(proto)
                    
                    # Registra le porte utilizzate dagli host
                    if sport:
                        network_data.add_port(src_ip, sport, "src", proto)
                    if dport:
                        network_data.add_port(dst_ip, dport, "dst", proto)
                        
                        # Mapping dei servizi basati sulle porte di destinazione
                        self.map_service(dst_ip, dport, network_data)
            
            logger.info(f"Analizzati {len(packets)} pacchetti dal file PCAP")
            
        except Exception as e:
            logger.error(f"Errore nell'analisi del file PCAP: {e}")
            return False
        
        return True