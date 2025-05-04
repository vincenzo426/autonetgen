#!/usr/bin/env python3
"""
AnalysisOrchestrator - classe principale che coordina l'analisi e la generazione degli output
"""

import os
from config import logger, DEFAULT_OUTPUT_DIR
from network_analyzer import NetworkAnalyzer
from network_enricher import NetworkEnricher
from output_generator import OutputGenerator
from output_generators.graphviz_generator import GraphvizGenerator
from output_generators.terraform_generator import TerraformGenerator
from output_generators.json_exporter import JSONExporter

class AnalysisOrchestrator:
    """Classe principale che coordina l'analisi e la generazione degli output"""
    
    def __init__(self, config=None):
        """
        Inizializza l'orchestratore dell'analisi
        
        Args:
            config (dict, optional): Configurazione dell'orchestratore
        """
        self.config = config or {}
        self.analyzer = NetworkAnalyzer()
        self.enricher = NetworkEnricher()
        self.output_generators = []
        
    def run(self, input_file, file_type=None, output_dir=DEFAULT_OUTPUT_DIR, output_graph=None, output_analysis=None, output_terraform=None):
        """
        Esegue l'analisi completa e genera gli output
        
        Args:
            input_file (str): File di input da analizzare
            file_type (str, optional): Tipo del file di input (pcap, csv, netflow)
            output_dir (str, optional): Directory di output per i file generati
            output_graph (str, optional): Percorso del file di output per il grafo
            output_analysis (str, optional): Percorso del file di output per l'analisi
            output_terraform (str, optional): Directory di output per i file Terraform
            
        Returns:
            bool: True se l'analisi è riuscita, False altrimenti
        """
        # Crea la directory di output se non esiste
        os.makedirs(output_dir, exist_ok=True)
        
        # Determina automaticamente il tipo di file se non specificato
        if file_type is None:
            file_ext = os.path.splitext(input_file)[1].lower()
            if file_ext == '.pcap' or file_ext == '.pcapng':
                file_type = 'pcap'
            elif file_ext == '.csv':
                file_type = 'csv'
            elif file_ext == '.nflow' or file_ext == '.nfcapd':
                file_type = 'netflow'
            else:
                logger.warning(f"Impossibile determinare automaticamente il tipo di file, assumendo CSV: {input_file}")
                file_type = 'csv'
        
        logger.info(f"Avvio dell'analisi del file {input_file} di tipo {file_type}")
        
        # Analizza il file di input
        success = False
        if file_type == 'pcap':
            success = self.analyzer.analyze_pcap_file(input_file)
        elif file_type == 'csv':
            success = self.analyzer.analyze_csv_file(input_file)
        elif file_type == 'netflow':
            success = self.analyzer.analyze_netflow_file(input_file)
        
        if not success:
            logger.error("Analisi del file di input fallita")
            return False
        
        # Arricchisci i dati con informazioni aggiuntive
        subnets = self.enricher.identify_subnets(self.analyzer.network_data)
        host_roles = self.enricher.enrich_host_roles(self.analyzer.network_data)
        
        # Aggiorna l'analyzer con i dati arricchiti
        self.analyzer.subnets = subnets
        self.analyzer.host_roles = host_roles
        
        # Costruisci il grafo della rete
        self.analyzer.build_network_graph()
        
        # Prepara i percorsi di output
        if output_graph is None:
            output_graph = os.path.join(output_dir, "network_graph.pdf")
            
        if output_analysis is None:
            output_analysis = os.path.join(output_dir, "network_analysis.json")
            
        if output_terraform is None:
            output_terraform = os.path.join(output_dir, "terraform")
        
        # Prepara il generatore di output
        output_generator = OutputGenerator()
        
        # Aggiungi i generatori di output
        output_generator.add_generator(GraphvizGenerator())
        output_generator.add_generator(TerraformGenerator())
        output_generator.add_generator(JSONExporter())
        
        # Prepara i dati per i generatori
        data = self.analyzer.get_data()
        
        # Aggiorna i dati con le informazioni aggiuntive
        data.update({
            'host_roles': host_roles,
            'subnets': subnets,
            'output_path': output_dir
        })
        
        # Genera gli output
        output_paths = {
            'graph': output_graph,
            'terraform': output_terraform,
            'json': output_analysis
        }
        
        results = output_generator.generate(data, output_paths)
        
        if results:
            logger.info("Analisi completata con successo!")
            return True
        else:
            logger.error("Generazione degli output fallita")
            return False