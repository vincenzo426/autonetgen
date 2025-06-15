#!/usr/bin/env python3
"""
Sistema Adattivo di Rendering dei Grafi di Rete
Sceglie automaticamente il miglior renderer basato sulla complessità del grafo
"""

import os
import time
import math
from abc import ABC, abstractmethod
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Optional
import networkx as nx
import graphviz
import matplotlib.pyplot as plt
from config import logger, ROLE_COLORS, ROLE_SHAPES


class PerformanceConfig:
    """Configurazione adattiva basata sulle dimensioni del dataset"""
    
    @staticmethod
    def get_config(node_count: int, edge_count: int, file_size_mb: float) -> Dict:
        """
        Determina la configurazione ottimale basata sui parametri del grafo
        
        Args:
            node_count: Numero di nodi nel grafo
            edge_count: Numero di archi nel grafo  
            file_size_mb: Dimensione del file originale in MB
            
        Returns:
            Dict: Configurazione ottimizzata
        """
        configs = {
            "small": {
                "renderer": "graphviz_detailed",
                "max_label_length": 50,
                "show_ports": True,
                "clustering": True,
                "formats": ["pdf", "png"],
                "layout_engine": "dot"
            },
            "medium": {
                "renderer": "graphviz_optimized", 
                "max_label_length": 30,
                "show_ports": False,
                "clustering": True,
                "formats": ["png"],
                "layout_engine": "neato"
            },
            "large": {
                "renderer": "mermaid",
                "max_label_length": 15,
                "show_ports": False,
                "clustering": False,
                "formats": ["html", "png"],
                "simplify_threshold": 0.7
            },
            "huge": {
                "renderer": "summary_only",
                "max_nodes_displayed": 50,
                "show_statistics": True,
                "top_connections_only": True
            }
        }
        
        # Logica di selezione basata su soglie
        if node_count <= 100 and edge_count <= 200:
            category = "small"
        elif node_count <= 500 and edge_count <= 1000:
            category = "medium"  
        elif node_count <= 2000 and edge_count <= 5000:
            category = "large"
        else:
            category = "huge"
            
        # Aggiustamenti per file molto grandi
        if file_size_mb > 100:
            if category in ["small", "medium"]:
                category = "large"
            elif category == "large":
                category = "huge"
                
        config = configs[category].copy()
        config["category"] = category
        config["node_count"] = node_count
        config["edge_count"] = edge_count
        config["file_size_mb"] = file_size_mb
        
        logger.info(f"Configurazione selezionata: {category} "
                   f"(nodi: {node_count}, archi: {edge_count}, file: {file_size_mb}MB)")
        
        return config


class BaseGraphRenderer(ABC):
    """Classe base per tutti i renderer di grafi"""
    
    def __init__(self, config: Dict):
        self.config = config
        
    @abstractmethod
    def render(self, graph: nx.DiGraph, output_path: str) -> Optional[str]:
        """Renderizza il grafo e restituisce il percorso del file generato"""
        pass
        
    def _simplify_graph(self, graph: nx.DiGraph) -> nx.DiGraph:
        """Semplifica il grafo rimuovendo nodi/archi poco significativi"""
        if not self.config.get("simplify_threshold"):
            return graph
            
        simplified = graph.copy()
        
        # Rimuovi nodi con poche connessioni
        min_degree = max(1, int(graph.number_of_nodes() * 0.01))
        nodes_to_remove = [node for node, degree in simplified.degree() 
                          if degree < min_degree]
        simplified.remove_nodes_from(nodes_to_remove)
        
        # Aggrega archi multipli
        edge_weights = defaultdict(int)
        for src, dst, data in simplified.edges(data=True):
            edge_weights[(src, dst)] += data.get('weight', 1)
            
        # Rimuovi archi poco significativi  
        threshold = max(1, int(len(edge_weights) * self.config["simplify_threshold"]))
        sorted_edges = sorted(edge_weights.items(), key=lambda x: x[1], reverse=True)
        keep_edges = dict(sorted_edges[:threshold])
        
        edges_to_remove = [(src, dst) for (src, dst) in edge_weights 
                          if (src, dst) not in keep_edges]
        simplified.remove_edges_from(edges_to_remove)
        
        logger.info(f"Grafo semplificato: {simplified.number_of_nodes()} nodi, "
                   f"{simplified.number_of_edges()} archi "
                   f"(originale: {graph.number_of_nodes()}, {graph.number_of_edges()})")
        
        return simplified


class MermaidRenderer(BaseGraphRenderer):
    """Renderer Mermaid per grafi grandi - veloce e scalabile"""
    
    def render(self, graph: nx.DiGraph, output_path: str) -> Optional[str]:
        """Genera un diagramma Mermaid del grafo di rete"""
        try:
            start_time = time.time()
            logger.info("Generazione diagramma Mermaid in corso...")
            
            # Semplifica il grafo se necessario
            working_graph = self._simplify_graph(graph)
            
            # Genera il codice Mermaid
            mermaid_code = self._generate_mermaid_code(working_graph)
            
            # Salva i file
            mermaid_file = self._save_mermaid_file(mermaid_code, output_path)
            html_file = self._generate_html_viewer(mermaid_code, output_path)
            
            elapsed = time.time() - start_time
            logger.info(f"Diagramma Mermaid generato in {elapsed:.2f}s: {html_file}")
            
            return html_file
            
        except Exception as e:
            logger.error(f"Errore nella generazione Mermaid: {e}")
            return None
    
    def _generate_mermaid_code(self, graph: nx.DiGraph) -> str:
        """Genera il codice Mermaid per il grafo"""
        lines = ["graph TD"]
        
        # Raggruppa nodi per subnet se abilitato il clustering
        if self.config.get("clustering", False):
            lines.extend(self._generate_subnet_clusters(graph))
        else:
            lines.extend(self._generate_flat_nodes(graph))
            
        # Aggiungi gli archi
        lines.extend(self._generate_edges(graph))
        
        # Aggiungi stili per i ruoli
        lines.extend(self._generate_styles())
        
        return "\n    ".join(lines)
    
    def _generate_subnet_clusters(self, graph: nx.DiGraph) -> List[str]:
        """Genera cluster per subnet in Mermaid"""
        lines = []
        subnets = defaultdict(list)
        
        # Raggruppa nodi per subnet
        for node in graph.nodes():
            subnet = graph.nodes[node].get('subnet', 'UNKNOWN')
            subnets[subnet].append(node)
        
        cluster_id = 0
        for subnet, nodes in subnets.items():
            if len(nodes) > 1 and subnet != 'UNKNOWN':
                lines.append(f"subgraph C{cluster_id} ['{subnet}']")
                for node in nodes:
                    lines.extend(self._format_node(graph, node, indent="    "))
                lines.append("end")
                cluster_id += 1
            else:
                # Nodi singoli fuori dai cluster
                for node in nodes:
                    lines.extend(self._format_node(graph, node))
                    
        return lines
    
    def _generate_flat_nodes(self, graph: nx.DiGraph) -> List[str]:
        """Genera nodi senza clustering"""
        lines = []
        for node in graph.nodes():
            lines.extend(self._format_node(graph, node))
        return lines
    
    def _format_node(self, graph: nx.DiGraph, node: str, indent: str = "") -> List[str]:
        """Formatta un singolo nodo per Mermaid"""
        data = graph.nodes[node]
        role = data.get('role', 'UNKNOWN')
        
        # Crea label semplificato
        if self.config.get("show_ports", False):
            ports = data.get('ports', [])[:3]  # Solo prime 3 porte
            port_text = f"<br/>{'<br/>'.join([f'{p[0]}' for p in ports])}" if ports else ""
        else:
            port_text = ""
            
        max_length = self.config.get("max_label_length", 15)
        node_label = node if len(node) <= max_length else node[:max_length-3] + "..."
        
        # Determina la forma del nodo basata sul ruolo
        shape_map = {
            "SERVER": "{}",
            "CLIENT": "(())",
            "GATEWAY": "[]",
            "DATABASE_SERVER": "[()]",
            "WEB_SERVER": "{}",
            "UNKNOWN": "()"
        }
        
        shape = shape_map.get(role, "()")
        full_label = f"{node_label}<br/>{role}{port_text}"
        
        # Crea il nodo con classe CSS per lo styling
        node_safe = node.replace(".", "_").replace("-", "_")
        lines = [f"{indent}{node_safe}{shape.format(f'[{full_label}]')}"]
        lines.append(f"{indent}class {node_safe} {role.lower()}")
        
        return lines
    
    def _generate_edges(self, graph: nx.DiGraph) -> List[str]:
        """Genera gli archi del grafo"""
        lines = []
        
        for src, dst, data in graph.edges(data=True):
            weight = data.get('weight', 1)
            protocols = data.get('protocols', [])
            
            # Crea label per l'arco
            if protocols:
                protocol_text = protocols[0] if len(protocols) == 1 else f"{protocols[0]}+{len(protocols)-1}"
            else:
                protocol_text = ""
                
            if weight > 1:
                edge_label = f"{protocol_text} ({weight})" if protocol_text else f"({weight})"
            else:
                edge_label = protocol_text
            
            # Determina lo stile dell'arco basato sul peso
            if weight > 10:
                arrow_style = "==>"
            elif weight > 5:
                arrow_style = "-->"
            else:
                arrow_style = "-.->"
            
            src_safe = src.replace(".", "_").replace("-", "_")
            dst_safe = dst.replace(".", "_").replace("-", "_")
            
            if edge_label:
                lines.append(f"{src_safe} {arrow_style}|{edge_label}| {dst_safe}")
            else:
                lines.append(f"{src_safe} {arrow_style} {dst_safe}")
                
        return lines
    
    def _generate_styles(self) -> List[str]:
        """Genera gli stili CSS per i ruoli"""
        lines = []
        
        role_styles = {
            "server": "fill:#e1f5fe,stroke:#01579b,stroke-width:2px",
            "client": "fill:#f3e5f5,stroke:#4a148c,stroke-width:2px", 
            "gateway": "fill:#e8f5e8,stroke:#1b5e20,stroke-width:3px",
            "database_server": "fill:#fff3e0,stroke:#e65100,stroke-width:2px",
            "web_server": "fill:#fce4ec,stroke:#880e4f,stroke-width:2px",
            "unknown": "fill:#f5f5f5,stroke:#616161,stroke-width:1px"
        }
        
        for role, style in role_styles.items():
            lines.append(f"classDef {role} {style}")
            
        return lines
    
    def _save_mermaid_file(self, mermaid_code: str, output_path: str) -> str:
        """Salva il codice Mermaid in un file .mmd"""
        mermaid_path = os.path.splitext(output_path)[0] + ".mmd"
        
        with open(mermaid_path, 'w', encoding='utf-8') as f:
            f.write(mermaid_code)
            
        logger.info(f"File Mermaid salvato: {mermaid_path}")
        return mermaid_path
    
    def _generate_html_viewer(self, mermaid_code: str, output_path: str) -> str:
        """Genera un file HTML per visualizzare il diagramma Mermaid"""
        html_path = os.path.splitext(output_path)[0] + "_mermaid.html"
        
        html_template = f"""<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Network Analysis - Mermaid Diagram</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
    <style>
        body {{
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 100%;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
            color: #333;
        }}
        .diagram-container {{
            width: 100%;
            overflow: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
        }}
        .controls {{
            margin-bottom: 20px;
            text-align: center;
        }}
        button {{
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            margin: 0 5px;
            border-radius: 4px;
            cursor: pointer;
        }}
        button:hover {{
            background: #0056b3;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Network Traffic Analysis</h1>
            <p>Diagramma interattivo della rete analizzata</p>
        </div>
        
        <div class="controls">
            <button onclick="zoomIn()">Zoom In</button>
            <button onclick="zoomOut()">Zoom Out</button>
            <button onclick="resetZoom()">Reset Zoom</button>
            <button onclick="downloadSVG()">Download SVG</button>
        </div>
        
        <div class="diagram-container">
            <div class="mermaid" id="diagram">
{mermaid_code}
            </div>
        </div>
    </div>

    <script>
        mermaid.initialize({{
            startOnLoad: true,
            theme: 'default',
            flowchart: {{
                useMaxWidth: true,
                htmlLabels: true
            }}
        }});
        
        let currentZoom = 1;
        
        function zoomIn() {{
            currentZoom += 0.2;
            updateZoom();
        }}
        
        function zoomOut() {{
            currentZoom = Math.max(0.2, currentZoom - 0.2);
            updateZoom();
        }}
        
        function resetZoom() {{
            currentZoom = 1;
            updateZoom();
        }}
        
        function updateZoom() {{
            const diagram = document.getElementById('diagram');
            diagram.style.transform = `scale(${{currentZoom}})`;
            diagram.style.transformOrigin = 'top left';
        }}
        
        function downloadSVG() {{
            const svg = document.querySelector('#diagram svg');
            if (svg) {{
                const svgData = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([svgData], {{type: 'image/svg+xml'}});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'network_diagram.svg';
                a.click();
                URL.revokeObjectURL(url);
            }}
        }}
    </script>
</body>
</html>"""
        
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_template)
            
        logger.info(f"Viewer HTML generato: {html_path}")
        return html_path


class OptimizedGraphvizRenderer(BaseGraphRenderer):
    """Renderer GraphViz ottimizzato per grafi medi"""
    
    def render(self, graph: nx.DiGraph, output_path: str) -> Optional[str]:
        """Genera un grafo GraphViz ottimizzato"""
        try:
            start_time = time.time()
            logger.info("Generazione grafo GraphViz ottimizzato...")
            
            # Semplifica se necessario
            working_graph = self._simplify_graph(graph)
            
            dot = self._create_optimized_dot(working_graph)
            result_path = self._render_dot(dot, output_path)
            
            elapsed = time.time() - start_time
            logger.info(f"Grafo GraphViz ottimizzato generato in {elapsed:.2f}s")
            
            return result_path
            
        except Exception as e:
            logger.error(f"Errore nel rendering GraphViz ottimizzato: {e}")
            return None
    
    def _create_optimized_dot(self, graph: nx.DiGraph):
        """Crea un oggetto Graphviz ottimizzato"""
        dot = graphviz.Digraph(
            comment='Network Analysis - Optimized',
            format='png',  # Solo PNG per velocità
            engine=self.config.get('layout_engine', 'neato'),
            strict=True
        )
        
        # Attributi ottimizzati per performance
        dot.attr(
            rankdir='LR',
            size='10,8',
            ratio='compress',
            splines='true',
            overlap='false',
            fontname='Arial',
            fontsize='12',
            bgcolor='white',
            dpi='100'  # Ridotta per velocità
        )
        
        dot.attr('node', fontname='Arial', fontsize='8', width='0.5', height='0.3')
        dot.attr('edge', fontname='Arial', fontsize='6', arrowsize='0.3')
        
        # Aggiungi nodi
        for node in graph.nodes():
            dot.node(node, **self._get_optimized_node_attrs(graph, node))
        
        # Aggiungi archi (solo i più significativi)
        edge_weights = [(src, dst, data.get('weight', 1)) 
                       for src, dst, data in graph.edges(data=True)]
        edge_weights.sort(key=lambda x: x[2], reverse=True)
        
        # Limita il numero di archi mostrati
        max_edges = min(len(edge_weights), 500)
        for src, dst, weight in edge_weights[:max_edges]:
            dot.edge(src, dst, penwidth=str(min(3, weight/5)))
        
        return dot
    
    def _get_optimized_node_attrs(self, graph: nx.DiGraph, node: str) -> Dict:
        """Attributi ottimizzati per i nodi"""
        data = graph.nodes[node]
        role = data.get('role', 'UNKNOWN')
        
        # Label semplificato
        max_length = self.config.get("max_label_length", 30)
        label = node if len(node) <= max_length else node[:max_length-3] + "..."
        
        return {
            'label': f"{label}\\n{role}",
            'shape': ROLE_SHAPES.get(role, 'ellipse'),
            'style': 'filled',
            'fillcolor': ROLE_COLORS.get(role, 'lightgray'),
            'color': 'black',
            'fontcolor': 'black'
        }
    
    def _render_dot(self, dot, output_path: str) -> str:
        """Renderizza il grafo Graphviz"""
        basename = os.path.splitext(output_path)[0]
        
        try:
            result_path = dot.render(basename + "_optimized", cleanup=True)
            logger.info(f"Grafo ottimizzato salvato: {result_path}")
            return result_path
        except Exception as e:
            logger.error(f"Errore nel rendering: {e}")
            return self._matplotlib_fallback(output_path)
    
    def _matplotlib_fallback(self, output_path: str) -> str:
        """Fallback con matplotlib se GraphViz fallisce"""
        try:
            plt.figure(figsize=(10, 8))
            plt.text(0.5, 0.5, 'Grafo troppo complesso per la visualizzazione\n'
                               'Usa modalità Mermaid per grafi grandi', 
                    ha='center', va='center', fontsize=14)
            plt.axis('off')
            plt.savefig(output_path)
            plt.close()
            return output_path
        except Exception:
            return None


class SummaryRenderer(BaseGraphRenderer):
    """Renderer per dataset enormi - solo statistiche"""
    
    def render(self, graph: nx.DiGraph, output_path: str) -> Optional[str]:
        """Genera un report statistico invece del grafo"""
        try:
            logger.info("Generazione report statistico per dataset grande...")
            
            summary = self._generate_summary(graph)
            html_path = self._create_summary_html(summary, output_path)
            
            logger.info(f"Report statistico generato: {html_path}")
            return html_path
            
        except Exception as e:
            logger.error(f"Errore nella generazione del report: {e}")
            return None
    
    def _generate_summary(self, graph: nx.DiGraph) -> Dict:
        """Genera statistiche del grafo"""
        # Statistiche di base
        node_count = graph.number_of_nodes()
        edge_count = graph.number_of_edges()
        
        # Analisi dei ruoli
        roles = Counter(graph.nodes[n].get('role', 'UNKNOWN') for n in graph.nodes())
        
        # Top nodi per connessioni
        top_nodes = sorted(graph.degree(), key=lambda x: x[1], reverse=True)[:10]
        
        # Subnet distribution
        subnets = Counter(graph.nodes[n].get('subnet', 'UNKNOWN') for n in graph.nodes())
        
        # Densità del grafo
        density = nx.density(graph)
        
        return {
            'node_count': node_count,
            'edge_count': edge_count,
            'density': density,
            'roles': dict(roles),
            'top_nodes': top_nodes,
            'subnets': dict(subnets)
        }
    
    def _create_summary_html(self, summary: Dict, output_path: str) -> str:
        """Crea un report HTML con le statistiche"""
        html_path = os.path.splitext(output_path)[0] + "_summary.html"
        
        html_content = f"""<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Network Analysis Summary</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        .header {{ text-align: center; color: #333; }}
        .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }}
        .card {{ background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .metric {{ font-size: 2em; font-weight: bold; color: #007bff; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Network Analysis Summary</h1>
        <p>Dataset troppo grande per la visualizzazione grafica completa</p>
    </div>
    
    <div class="stats">
        <div class="card">
            <h3>Statistiche Generali</h3>
            <p>Nodi: <span class="metric">{summary['node_count']:,}</span></p>
            <p>Connessioni: <span class="metric">{summary['edge_count']:,}</span></p>
            <p>Densità: <span class="metric">{summary['density']:.4f}</span></p>
        </div>
        
        <div class="card">
            <h3>Distribuzione Ruoli</h3>
            <table>
                <tr><th>Ruolo</th><th>Conteggio</th></tr>
                {chr(10).join(f'<tr><td>{role}</td><td>{count}</td></tr>' for role, count in summary['roles'].items())}
            </table>
        </div>
        
        <div class="card">
            <h3>Top 10 Nodi per Connessioni</h3>
            <table>
                <tr><th>Nodo</th><th>Connessioni</th></tr>
                {chr(10).join(f'<tr><td>{node}</td><td>{degree}</td></tr>' for node, degree in summary['top_nodes'])}
            </table>
        </div>
        
        <div class="card">
            <h3>Distribuzione Subnet</h3>
            <table>
                <tr><th>Subnet</th><th>Nodi</th></tr>
                {chr(10).join(f'<tr><td>{subnet}</td><td>{count}</td></tr>' for subnet, count in summary['subnets'].items())}
            </table>
        </div>
    </div>
</body>
</html>"""
        
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
            
        return html_path


class AdaptiveGraphRenderer:
    """Sistema adattivo principale per il rendering dei grafi"""
    
    def __init__(self):
        self.renderers = {
            "graphviz_detailed": OptimizedGraphvizRenderer,
            "graphviz_optimized": OptimizedGraphvizRenderer, 
            "mermaid": MermaidRenderer,
            "summary_only": SummaryRenderer
        }
    
    def render_graph(self, graph: nx.DiGraph, output_path: str, file_size_mb: float = 0) -> Optional[str]:
        """
        Renderizza il grafo usando il renderer più appropriato
        
        Args:
            graph: Grafo NetworkX da renderizzare
            output_path: Percorso di output desiderato
            file_size_mb: Dimensione del file originale in MB
            
        Returns:
            Percorso del file generato o None se fallito
        """
        # Ottieni configurazione adattiva
        config = PerformanceConfig.get_config(
            graph.number_of_nodes(),
            graph.number_of_edges(), 
            file_size_mb
        )
        
        renderer_type = config["renderer"]
        logger.info(f"Usando renderer: {renderer_type}")
        
        # Crea e usa il renderer appropriato
        renderer_class = self.renderers[renderer_type]
        renderer = renderer_class(config)
        
        start_time = time.time()
        result = renderer.render(graph, output_path)
        elapsed = time.time() - start_time
        
        if result:
            logger.info(f"Rendering completato in {elapsed:.2f}s: {result}")
        else:
            logger.error("Rendering fallito, provo fallback...")
            result = self._try_fallback_renderer(graph, output_path, config)
            
        return result
    
    def _try_fallback_renderer(self, graph: nx.DiGraph, output_path: str, config: Dict) -> Optional[str]:
        """Prova renderer alternativi se quello principale fallisce"""
        fallback_order = ["summary_only", "mermaid", "graphviz_optimized"]
        
        for renderer_type in fallback_order:
            if renderer_type == config["renderer"]:
                continue
                
            try:
                logger.info(f"Tentativo fallback con renderer: {renderer_type}")
                renderer_class = self.renderers[renderer_type]
                fallback_config = config.copy()
                fallback_config["renderer"] = renderer_type
                
                renderer = renderer_class(fallback_config)
                result = renderer.render(graph, output_path)
                
                if result:
                    logger.info(f"Fallback riuscito con {renderer_type}")
                    return result
                    
            except Exception as e:
                logger.warning(f"Fallback {renderer_type} fallito: {e}")
                continue
        
        logger.error("Tutti i renderer fallback falliti")
        return None


# Esempio di utilizzo
if __name__ == "__main__":
    # Test del sistema adattivo
    import networkx as nx
    
    # Crea un grafo di test
    G = nx.erdos_renyi_graph(100, 0.1, directed=True)
    
    # Aggiungi attributi simulati
    for node in G.nodes():
        G.nodes[node]['role'] = 'SERVER' if node % 3 == 0 else 'CLIENT'
        G.nodes[node]['subnet'] = f"192.168.{node//20}.0/24"
    
    for src, dst in G.edges():
        G.edges[src, dst]['weight'] = 1
        G.edges[src, dst]['protocols'] = ['TCP']
    
    # Test del renderer adattivo
    renderer = AdaptiveGraphRenderer()
    result = renderer.render_graph(G, "test_output.png", file_size_mb=25)
    
    if result:
        print(f"Grafo generato: {result}")
    else:
        print("Generazione fallita")