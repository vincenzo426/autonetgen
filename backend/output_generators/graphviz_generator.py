#!/usr/bin/env python3
"""
GraphvizGenerator Aggiornato - Utilizza il sistema adattivo per il rendering
"""

import os
import time
from config import logger
from output_generators.base_generator import OutputGenerator
from .adaptive_graph_renderer import AdaptiveGraphRenderer


class GraphvizGenerator(OutputGenerator):
    """Generatore di output aggiornato con sistema adattivo"""

    def __init__(self):
        """Inizializza il generatore con il renderer adattivo"""
        self.adaptive_renderer = AdaptiveGraphRenderer()
        self.original_file_size = 0
        
    def set_original_file_size(self, file_size_mb: float):
        """Imposta la dimensione del file originale per ottimizzazioni"""
        self.original_file_size = file_size_mb
        logger.info(f"Dimensione file originale impostata: {file_size_mb}MB")

    def generate(self, data, output_path):
        """
        Genera il grafo di rete usando il sistema adattivo
        
        Args:
            data (dict): Dati contenenti il network_graph
            output_path (str): Percorso di output per il file
            
        Returns:
            str: Percorso del file generato o None se fallito
        """
        graph = data.get('network_graph')
        if not graph or graph.number_of_nodes() == 0:
            logger.warning("Nessun dato per visualizzare il grafo")
            return None

        logger.info("=== AVVIO GENERAZIONE GRAFO ADATTIVO ===")
        logger.info(f"Nodi: {graph.number_of_nodes()}, "
                   f"Archi: {graph.number_of_edges()}, "
                   f"File originale: {self.original_file_size}MB")

        start_time = time.time()
        
        try:
            # Usa il renderer adattivo
            result_path = self.adaptive_renderer.render_graph(
                graph=graph,
                output_path=output_path,
                file_size_mb=self.original_file_size
            )
            
            elapsed = time.time() - start_time
            
            if result_path:
                logger.info(f"=== GENERAZIONE COMPLETATA in {elapsed:.2f}s ===")
                logger.info(f"File generato: {result_path}")
                
                # Genera file aggiuntivi se richiesti
                self._generate_additional_outputs(data, result_path)
                
                return result_path
            else:
                logger.error("=== GENERAZIONE FALLITA ===")
                return None
                
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"=== ERRORE DOPO {elapsed:.2f}s: {e} ===")
            return None
    
    def _generate_additional_outputs(self, data, main_output_path):
        """Genera output aggiuntivi come metriche e logs"""
        try:
            base_path = os.path.splitext(main_output_path)[0]
            
            # Genera file di metriche
            metrics_path = f"{base_path}_metrics.json"
            self._save_performance_metrics(data, metrics_path)
            
            # Genera log dettagliato
            log_path = f"{base_path}_analysis_log.txt"
            self._save_analysis_log(data, log_path)
            
        except Exception as e:
            logger.warning(f"Errore nella generazione output aggiuntivi: {e}")
    
    def _save_performance_metrics(self, data, metrics_path):
        """Salva metriche di performance dell'analisi"""
        import json
        
        graph = data.get('network_graph')
        if not graph:
            return
            
        metrics = {
            "file_size_mb": self.original_file_size,
            "nodes_count": graph.number_of_nodes(),
            "edges_count": graph.number_of_edges(),
            "density": float(f"{graph.number_of_edges() / (graph.number_of_nodes() * (graph.number_of_nodes() - 1)):.6f}") if graph.number_of_nodes() > 1 else 0,
            "analysis_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "complexity_category": self._get_complexity_category(graph),
            "renderer_used": self._get_renderer_used(graph)
        }
        
        try:
            with open(metrics_path, 'w', encoding='utf-8') as f:
                json.dump(metrics, f, indent=2)
            logger.info(f"Metriche salvate: {metrics_path}")
        except Exception as e:
            logger.warning(f"Errore salvando metriche: {e}")
    
    def _save_analysis_log(self, data, log_path):
        """Salva log dettagliato dell'analisi"""
        graph = data.get('network_graph')
        if not graph:
            return
            
        try:
            with open(log_path, 'w', encoding='utf-8') as f:
                f.write("=== NETWORK ANALYSIS LOG ===\n")
                f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"File size: {self.original_file_size}MB\n")
                f.write(f"Nodes: {graph.number_of_nodes()}\n")
                f.write(f"Edges: {graph.number_of_edges()}\n")
                f.write(f"Complexity: {self._get_complexity_category(graph)}\n")
                f.write(f"Renderer: {self._get_renderer_used(graph)}\n\n")
                
                # Top nodi per connessioni
                f.write("=== TOP 10 NODES BY CONNECTIONS ===\n")
                top_nodes = sorted(graph.degree(), key=lambda x: x[1], reverse=True)[:10]
                for node, degree in top_nodes:
                    role = graph.nodes[node].get('role', 'UNKNOWN')
                    f.write(f"{node:20} {degree:4} connections ({role})\n")
                
                # Distribuzione ruoli
                f.write("\n=== ROLE DISTRIBUTION ===\n")
                from collections import Counter
                roles = Counter(graph.nodes[n].get('role', 'UNKNOWN') for n in graph.nodes())
                for role, count in roles.most_common():
                    f.write(f"{role:20} {count:4} hosts\n")
                    
            logger.info(f"Log di analisi salvato: {log_path}")
        except Exception as e:
            logger.warning(f"Errore salvando log: {e}")
    
    def _get_complexity_category(self, graph):
        """Determina la categoria di complessità del grafo"""
        node_count = graph.number_of_nodes()
        
        if node_count <= 100:
            return "LOW"
        elif node_count <= 500:
            return "MEDIUM"
        elif node_count <= 2000:
            return "HIGH"
        else:
            return "VERY_HIGH"
    
    def _get_renderer_used(self, graph):
        """Determina quale renderer è stato utilizzato"""
        from .adaptive_graph_renderer import PerformanceConfig
        
        config = PerformanceConfig.get_config(
            graph.number_of_nodes(),
            graph.number_of_edges(),
            self.original_file_size
        )
        
        return config.get("renderer", "unknown")