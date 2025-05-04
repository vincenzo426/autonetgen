#!/usr/bin/env python3
"""
BaseGenerator - classe base per i generatori di output
"""

from abc import ABC, abstractmethod
from config import logger

class OutputGenerator(ABC):
    """Classe base astratta per i generatori di output"""
    
    @abstractmethod
    def generate(self, data, output_path):
        """
        Metodo astratto per generare l'output
        
        Args:
            data (dict): Dizionario con i dati da utilizzare per la generazione
            output_path (str): Percorso in cui salvare l'output
            
        Returns:
            str: Percorso del file di output generato o None in caso di errore
        """
        pass