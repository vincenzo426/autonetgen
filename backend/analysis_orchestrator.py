#!/usr/bin/env python3
"""
AnalysisOrchestrator Aggiornato - Integra il sistema adattivo di rendering
"""

import os
import time
from config import logger, DEFAULT_OUTPUT_DIR
from network_analyzer import NetworkAnalyzer
from network_enricher import NetworkEnricher
from output_generator import OutputGenerator
from output_generators.graphviz_generator import GraphvizGenerator
from output_generators.terraform_generator import TerraformGenerator
from output_generators.json_exporter import JSONExporter


class AnalysisOrchestrator:
    """Orchestratore aggiornato con supporto per il sistema adattivo"""
    
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
        
        # Metriche di performance
        self.start_time = None
        self.file_size_mb = 0
        self.performance_metrics = {}
        
    def run(self, input_file, file_type=None, output_dir=DEFAULT_OUTPUT_DIR, 
            output_graph=None, output_analysis=None, output_terraform=None):
        """
        Esegue l'analisi completa con ottimizzazioni adattive
        
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
        self.start_time = time.time()
        
        # Calcola dimensione del file
        self.file_size_mb = self._get_file_size_mb(input_file)
        logger.info(f"=== INIZIO ANALISI ADATTIVA ===")
        logger.info(f"File: {input_file} ({self.file_size_mb}MB)")
        
        # Crea la directory di output se non esiste
        os.makedirs(output_dir, exist_ok=True)
        
        # Determina automaticamente il tipo di file se non specificato
        if file_type is None or file_type == 'auto':
            file_type = self._detect_file_type(input_file)
        
        logger.info(f"Tipo file rilevato: {file_type}")
        
        # FASE 1: Analisi del file di input
        success = self._run_analysis_phase(input_file, file_type)
        if not success:
            logger.error("=== ANALISI FALLITA ===")
            return False
        
        # FASE 2: Arricchimento dei dati
        success = self._run_enrichment_phase()
        if not success:
            logger.error("=== ARRICCHIMENTO FALLITO ===")
            return False
        
        # FASE 3: Generazione output con sistema adattivo
        success = self._run_output_generation_phase(
            output_dir, output_graph, output_analysis, output_terraform
        )
        
        # Riepilogo finale
        elapsed_total = time.time() - self.start_time
        logger.info(f"=== ANALISI COMPLETATA in {elapsed_total:.2f}s ===")
        
        if success:
            self._log_final_summary()
        
        return success
    
    def _get_file_size_mb(self, file_path):
        """Calcola la dimensione del file in MB"""
        try:
            size_bytes = os.path.getsize(file_path)
            size_mb = size_bytes / (1024 * 1024)
            return round(size_mb, 2)
        except Exception as e:
            logger.warning(f"Impossibile determinare dimensione file: {e}")
            return 0
    
    def _detect_file_type(self, input_file):
        """Rileva automaticamente il tipo di file"""
        file_ext = os.path.splitext(input_file)[1].lower()
        
        if file_ext in ['.pcap', '.pcapng']:
            return 'pcap'
        elif file_ext == '.csv':
            return 'csv'
        elif file_ext in ['.nflow', '.nfcapd']:
            return 'netflow'
        else:
            logger.warning(f"Estensione sconosciuta {file_ext}, assumendo CSV")
            return 'csv'
    
    def _run_analysis_phase(self, input_file, file_type):
        """Esegue la fase di analisi del file"""
        phase_start = time.time()
        logger.info("FASE 1: Analisi file in corso...")
        
        success = False
        if file_type == 'pcap':
            logger.info("Analisi del file PCAP in corso...")
            success = self.analyzer.analyze_pcap_file(input_file)
        elif file_type == 'csv':
            logger.info("Analisi del file CSV in corso...")
            success = self.analyzer.analyze_csv_file(input_file)
        elif file_type == 'netflow':
            logger.info("Analisi del file NetFlow in corso...")
            success = self.analyzer.analyze_netflow_file(input_file)
        
        phase_elapsed = time.time() - phase_start
        self.performance_metrics['analysis_time'] = phase_elapsed
        
        if success:
            logger.info(f"FASE 1 completata in {phase_elapsed:.2f}s")
            logger.info(f"Host rilevati: {len(self.analyzer.hosts)}")
            logger.info(f"Connessioni: {len(self.analyzer.connections)}")
        else:
            logger.error(f"FASE 1 fallita dopo {phase_elapsed:.2f}s")
        
        return success
    
    def _run_enrichment_phase(self):
        """Esegue la fase di arricchimento dati"""
        phase_start = time.time()
        logger.info("FASE 2: Arricchimento dati in corso...")
        
        try:
            # Arricchisci i dati con informazioni aggiuntive
            subnets = self.enricher.identify_subnets(list(self.analyzer.hosts))
            self.analyzer.subnets = subnets
            
            # Inferisci i ruoli degli host
            self.analyzer.infer_host_roles()
            
            # Costruisci il grafo di rete
            self.analyzer.build_network_graph()
            
            phase_elapsed = time.time() - phase_start
            self.performance_metrics['enrichment_time'] = phase_elapsed
            
            logger.info(f"FASE 2 completata in {phase_elapsed:.2f}s")
            logger.info(f"Subnet identificate: {len(subnets)}")
            logger.info(f"Grafo: {self.analyzer.network_graph.number_of_nodes()} nodi, "
                       f"{self.analyzer.network_graph.number_of_edges()} archi")
            
            return True
            
        except Exception as e:
            phase_elapsed = time.time() - phase_start
            logger.error(f"FASE 2 fallita dopo {phase_elapsed:.2f}s: {e}")
            return False
    
    def _run_output_generation_phase(self, output_dir, output_graph, output_analysis, output_terraform):
        """Esegue la fase di generazione output con sistema adattivo"""
        phase_start = time.time()
        logger.info("FASE 3: Generazione output adattiva in corso...")
        
        success = True
        data = self.analyzer.get_data()
        
        # Genera il grafo con sistema adattivo
        if output_graph:
            success &= self._generate_adaptive_graph(data, output_graph)
        
        # Genera analisi JSON
        if output_analysis:
            success &= self._generate_analysis_output(data, output_analysis)
        
        # Genera configurazione Terraform
        if output_terraform:
            success &= self._generate_terraform_output(data, output_terraform)
        
        phase_elapsed = time.time() - phase_start
        self.performance_metrics['output_time'] = phase_elapsed
        
        logger.info(f"FASE 3 completata in {phase_elapsed:.2f}s")
        return success
    
    def _generate_adaptive_graph(self, data, output_path):
        """Genera il grafo usando il sistema adattivo"""
        try:
            logger.info("Generazione grafo adattivo...")
            
            # Crea il generatore e imposta la dimensione del file
            generator = GraphvizGenerator()
            generator.set_original_file_size(self.file_size_mb)
            
            # Genera il grafo
            result = generator.generate(data, output_path)
            
            if result:
                logger.info(f"Grafo generato con successo: {result}")
                return True
            else:
                logger.error("Generazione grafo fallita")
                return False
                
        except Exception as e:
            logger.error(f"Errore nella generazione grafo: {e}")
            return False
    
    def _generate_analysis_output(self, data, output_path):
        """Genera l'output di analisi JSON"""
        try:
            logger.info("Generazione analisi JSON...")
            
            generator = JSONExporter()
            result = generator.generate(data, output_path)
            
            if result:
                logger.info(f"Analisi JSON generata: {result}")
                return True
            else:
                logger.error("Generazione analisi JSON fallita")
                return False
                
        except Exception as e:
            logger.error(f"Errore nella generazione analisi: {e}")
            return False
    
    def _generate_terraform_output(self, data, output_path):
        """Genera la configurazione Terraform"""
        try:
            logger.info("Generazione configurazione Terraform...")
            
            generator = TerraformGenerator()
            result = generator.generate(data, output_path)
            
            if result:
                logger.info(f"Terraform generato: {result}")
                return True
            else:
                logger.error("Generazione Terraform fallita")
                return False
                
        except Exception as e:
            logger.error(f"Errore nella generazione Terraform: {e}")
            return False
    
    def _log_final_summary(self):
        """Log del riepilogo finale dell'analisi"""
        total_time = time.time() - self.start_time
        
        logger.info("=== RIEPILOGO FINALE ===")
        logger.info(f"File analizzato: {self.file_size_mb}MB")
        logger.info(f"Tempo totale: {total_time:.2f}s")
        
        if 'analysis_time' in self.performance_metrics:
            logger.info(f"- Analisi file: {self.performance_metrics['analysis_time']:.2f}s")
        
        if 'enrichment_time' in self.performance_metrics:
            logger.info(f"- Arricchimento: {self.performance_metrics['enrichment_time']:.2f}s")
        
        if 'output_time' in self.performance_metrics:
            logger.info(f"- Generazione output: {self.performance_metrics['output_time']:.2f}s")
        
        # Calcola velocità di processing
        if self.file_size_mb > 0:
            speed = self.file_size_mb / total_time
            logger.info(f"Velocità di processing: {speed:.2f}MB/s")
        
        # Host e connessioni analizzati
        logger.info(f"Host analizzati: {len(self.analyzer.hosts)}")
        logger.info(f"Connessioni: {len(self.analyzer.connections)}")
        
        # Grafo finale
        if hasattr(self.analyzer, 'network_graph'):
            logger.info(f"Grafo finale: {self.analyzer.network_graph.number_of_nodes()} nodi, "
                       f"{self.analyzer.network_graph.number_of_edges()} archi")
        
        logger.info("=== ANALISI COMPLETATA CON SUCCESSO ===")


# Utilità per test e benchmark
class PerformanceBenchmark:
    """Classe per benchmark delle prestazioni"""
    
    @staticmethod
    def run_benchmark(test_files):
        """Esegue benchmark su una lista di file di test"""
        results = []
        
        for file_path in test_files:
            logger.info(f"Benchmark per {file_path}")
            
            orchestrator = AnalysisOrchestrator()
            start_time = time.time()
            
            success = orchestrator.run(
                input_file=file_path,
                output_dir=f"benchmark_output_{int(time.time())}",
                output_graph="benchmark_graph.png"
            )
            
            elapsed = time.time() - start_time
            file_size = orchestrator.file_size_mb
            
            result = {
                'file': file_path,
                'size_mb': file_size,
                'time_s': elapsed,
                'speed_mbps': file_size / elapsed if elapsed > 0 else 0,
                'success': success,
                'nodes': len(orchestrator.analyzer.hosts) if success else 0,
                'edges': len(orchestrator.analyzer.connections) if success else 0
            }
            
            results.append(result)
            logger.info(f"Risultato: {result}")
        
        return results
