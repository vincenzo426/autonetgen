#!/usr/bin/env python3
"""
NetFlow Parser - parser specifico per i file NetFlow
"""

from config import logger
from parsers.csv_parser import CSVParser

class NetFlowParser(CSVParser):
    """Parser per i file NetFlow, estende il CSVParser"""
    
    def parse(self, file_path, network_data):
        """
        Analizza un file NetFlow e popola l'oggetto network_data
        Per semplicità, utilizza l'implementazione del parser CSV
        
        Args:
            file_path (str): Percorso del file NetFlow da analizzare
            network_data (NetworkData): Oggetto che contiene i dati di rete
            
        Returns:
            bool: True se l'analisi è riuscita, False altrimenti
        """
        logger.info(f"Analisi del file NetFlow: {file_path}")
        
        try:
            # NetFlow può essere in formato CSV o specifico per NetFlow
            # Per semplicità, assumiamo che sia in un formato CSV comune
            return super().parse(file_path, network_data)
            
        except Exception as e:
            logger.error(f"Errore nell'analisi del file NetFlow: {e}")
            return False