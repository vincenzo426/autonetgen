#!/usr/bin/env python3
"""
Base Parser - classe base per i parser di dati di rete
"""

from abc import ABC, abstractmethod
from config import logger, COMMON_PORTS

class NetworkParser(ABC):
    """Classe base astratta per i parser di dati di rete"""
    
    @abstractmethod
    def parse(self, file_path, network_data):
        """
        Metodo astratto per analizzare un file e popolare l'oggetto network_data
        
        Args:
            file_path (str): Percorso del file da analizzare
            network_data (NetworkData): Oggetto che contiene i dati di rete
            
        Returns:
            bool: True se l'analisi è riuscita, False altrimenti
        """
        pass
    
    def map_service(self, ip, port, network_data):
        """
        Mappa una porta a un servizio noto e lo associa all'indirizzo IP
        
        Args:
            ip (str): Indirizzo IP dell'host
            port (int): Numero di porta
            network_data (NetworkData): Oggetto che contiene i dati di rete
            
        Returns:
            str or None: Nome del servizio se trovato, None altrimenti
        """
        if port in COMMON_PORTS:
            service = COMMON_PORTS[port]
            return service
        return None