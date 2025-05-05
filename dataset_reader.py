#!/usr/bin/env python3
"""
DatasetReader - classe per la gestione della lettura di dataset da directory
"""

import os
from collections import defaultdict
from config import logger

class DatasetReader:
    """Classe per la lettura e gestione di dataset da directory"""
    
    def __init__(self):
        """Inizializza il lettore di dataset"""
        # Mappatura delle estensioni ai tipi di file
        self.format_mappings = {
            'pcap': ['.pcap', '.pcapng', '.cap'],
            'csv': ['.csv'],
            'netflow': ['.nflow', '.nfcapd']
        }
        
        self.extension_to_type = {}
        for file_type, extensions in self.format_mappings.items():
            for ext in extensions:
                self.extension_to_type[ext] = file_type
                
    def identify_file_type(self, file_path):
        """
        Identifica il tipo di file in base all'estensione
        
        Args:
            file_path (str): Percorso del file
            
        Returns:
            str or None: Tipo di file (pcap, csv, netflow) o None se non riconosciuto
        """
        ext = os.path.splitext(file_path)[1].lower()
        return self.extension_to_type.get(ext)
        
    def scan_directory(self, directory_path, recursive=False):
        """
        Scansiona una directory alla ricerca di file di dataset supportati
        
        Args:
            directory_path (str): Percorso della directory da scansionare
            recursive (bool): Se True, scansiona ricorsivamente le sottodirectory
            
        Returns:
            dict: Dizionario con i file raggruppati per tipo
        """
        logger.info(f"Scansione della directory {directory_path} per dataset")
        
        dataset_files = defaultdict(list)
        
        def scan_dir(current_path):
            try:
                with os.scandir(current_path) as entries:
                    for entry in entries:
                        if entry.is_file():
                            file_type = self.identify_file_type(entry.path)
                            if file_type:
                                dataset_files[file_type].append(entry.path)
                        elif entry.is_dir() and recursive:
                            scan_dir(entry.path)
            except PermissionError:
                logger.warning(f"Permesso negato per la lettura della directory: {current_path}")
            except Exception as e:
                logger.error(f"Errore durante la scansione della directory {current_path}: {str(e)}")
        
        scan_dir(directory_path)
        
        # Registro i risultati
        total_files = sum(len(files) for files in dataset_files.values())
        logger.info(f"Trovati {total_files} file di dataset supportati:")
        for file_type, files in dataset_files.items():
            logger.info(f"  - {file_type}: {len(files)} file")
            
        return dataset_files