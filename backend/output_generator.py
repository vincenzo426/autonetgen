#!/usr/bin/env python3
"""
OutputGenerator - coordinatore per i generatori di output
"""

import os
from config import logger, DEFAULT_TERRAFORM_DIR, DEFAULT_GRAPH_FILE, DEFAULT_ANALYSIS_FILE

class OutputGenerator:
    """Coordinatore per i generatori di output"""
    
    def __init__(self):
        """Inizializza il generatore di output"""
        self.generators = []
        
    def add_generator(self, generator):
        """
        Aggiunge un generatore di output
        
        Args:
            generator (OutputGenerator): Generatore da aggiungere
        """
        self.generators.append(generator)
        
    def generate(self, data, output_paths):
        """
        Genera gli output utilizzando tutti i generatori registrati
        
        Args:
            data (dict): Dizionario con i dati da utilizzare per la generazione
            output_paths (dict): Dizionario con i percorsi di output per ciascun tipo di generatore
            
        Returns:
            dict: Dizionario con i percorsi degli output generati
        """
        if not self.generators:
            logger.warning("Nessun generatore di output registrato")
            return {}
            
        results = {}
        
        for generator in self.generators:
            generator_name = generator.__class__.__name__
            
            # Ottieni il percorso di output appropriato per questo generatore
            if generator_name == "TerraformGenerator":
                output_path = output_paths.get('terraform', DEFAULT_TERRAFORM_DIR)
            elif generator_name == "GraphvizGenerator":
                output_path = output_paths.get('graph', DEFAULT_GRAPH_FILE)
            elif generator_name == "JSONExporter":
                output_path = output_paths.get('json', DEFAULT_ANALYSIS_FILE)
            else:
                output_path = output_paths.get(generator_name.lower(), None)
                
            if not output_path:
                logger.warning(f"Nessun percorso di output specificato per {generator_name}")
                continue
                
            # Genera l'output
            logger.info(f"Generazione dell'output con {generator_name}")
            
            # Assicurati che la directory di output esista
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Genera l'output
            result = generator.generate(data, output_path)
            
            if result:
                results[generator_name] = result
                logger.info(f"Output generato con {generator_name} in {result}")
            else:
                logger.warning(f"Generazione dell'output con {generator_name} fallita")
                
        return results