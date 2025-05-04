#!/usr/bin/env python3
"""
GraphvizGenerator - generatore di output per i grafi di rete con Graphviz
"""

import os
import graphviz
import networkx as nx
import matplotlib.pyplot as plt
from collections import defaultdict
from config import logger, ROLE_COLORS, ROLE_SHAPES
from output_generators.base_generator import OutputGenerator

class GraphvizGenerator(OutputGenerator):
    """Generatore di output per i grafi di rete con Graphviz"""
    
    def generate(self, data, output_path):
        """
        Genera un grafo della rete utilizzando Graphviz
        
        Args:
            data (dict): Dizionario con i dati da utilizzare per la generazione
            output_path (str): Percorso in cui salvare l'output
            
        Returns:
            str: Percorso del file di output generato o None in caso di errore
        """
        if data['network_graph'].number_of_nodes() == 0:
            logger.warning("Nessun dato per visualizzare il grafo")
            return None
        
        logger.info("Generazione della visualizzazione del grafo di rete con Graphviz")
        
        network_graph = data['network_graph']
        
        # Crea un nuovo grafo Graphviz diretto
        dot = graphviz.Digraph(comment='Network Traffic Analysis',
                              format='pdf',
                              engine='dot',
                              strict=True)
        
        # Imposta gli attributi del grafo
        dot.attr(rankdir='LR', 
                size='11,8', 
                ratio='fill',
                fontname='Arial',
                label='Network Traffic Analysis',
                labelloc='t',
                fontsize='18',
                bgcolor='white')
        
        # Attributi per i nodi
        dot.attr('node', fontname='Arial', fontsize='10')
        
        # Attributi per gli archi
        dot.attr('edge', fontname='Arial', fontsize='8', arrowsize='0.5')
        
        # Raggruppa nodi per subnet
        subnets_nodes = defaultdict(list)
        for host in network_graph.nodes():
            subnet = network_graph.nodes[host].get('subnet', 'UNKNOWN')
            subnets_nodes[subnet].append(host)
        
        # Crea cluster per ogni subnet
        for subnet_idx, (subnet, nodes) in enumerate(subnets_nodes.items()):
            if subnet == 'UNKNOWN':
                continue
                
            with dot.subgraph(name=f'cluster_{subnet_idx}') as c:
                c.attr(label=f'Subnet: {subnet}', 
                      style='filled', 
                      color='lightgrey',
                      fontname='Arial',
                      fontsize='10')
                
                # Aggiungi nodi al cluster
                for host in nodes:
                    role = network_graph.nodes[host].get('role', 'UNKNOWN')
                    ports_list = network_graph.nodes[host].get('ports', [])
                    
                    # Formatta le porte per la visualizzazione
                    ports_text = ""
                    if ports_list:
                        # Mostra solo le prime 5 porte per chiarezza
                        visible_ports = ports_list[:5]
                        ports_text = "\\n".join([f"{port} ({proto})" for port, direction, proto in visible_ports])
                        if len(ports_list) > 5:
                            ports_text += f"\\n+{len(ports_list) - 5} altre"
                    
                    # Crea l'etichetta del nodo
                    label = f"{host}\\n{role}\\n{ports_text}"
                    
                    # Aggiungi il nodo con stile basato sul ruolo
                    c.node(host, 
                          label=label,
                          shape=ROLE_SHAPES.get(role, 'ellipse'),
                          style='filled',
                          fillcolor=ROLE_COLORS.get(role, 'lightgray'),
                          color='black',
                          fontcolor='black')
        
        # Aggiungi nodi che non hanno una subnet assegnata
        for host in network_graph.nodes():
            subnet = network_graph.nodes[host].get('subnet', 'UNKNOWN')
            if subnet == 'UNKNOWN':
                role = network_graph.nodes[host].get('role', 'UNKNOWN')
                ports_list = network_graph.nodes[host].get('ports', [])
                
                # Formatta le porte per la visualizzazione
                ports_text = ""
                if ports_list:
                    visible_ports = ports_list[:5]
                    ports_text = "\\n".join([f"{port} ({proto})" for port, direction, proto in visible_ports])
                    if len(ports_list) > 5:
                        ports_text += f"\\n+{len(ports_list) - 5} altre"
                
                label = f"{host}\\n{role}\\n{ports_text}"
                
                dot.node(host, 
                        label=label,
                        shape=ROLE_SHAPES.get(role, 'ellipse'),
                        style='filled',
                        fillcolor=ROLE_COLORS.get(role, 'lightgray'),
                        color='black',
                        fontcolor='black')
        
        # Aggiungi gli archi
        for src, dst, data in network_graph.edges(data=True):
            weight = data.get('weight', 1)
            protocols = data.get('protocols', [])
            
            # Normalizza il peso per ottenere spessori di linea sensati
            penwidth = 0.5 + min(5, weight / 10)
            
            # Crea un'etichetta per l'arco con info sui protocolli
            edge_label = ", ".join(protocols[:3])
            if len(protocols) > 3:
                edge_label += f", +{len(protocols) - 3}"
                
            if weight > 1:
                edge_label += f" ({weight} conn.)"
            
            dot.edge(src, dst, 
                    label=edge_label,
                    penwidth=str(penwidth))
        
        # Aggiungi una legenda dei ruoli
        with dot.subgraph(name='cluster_legend') as legend:
            legend.attr(label='Legenda', rankdir='LR', style='filled', color='white')
            
            # Aggiungi una leggenda per ogni ruolo presente nel grafo
            used_roles = set(network_graph.nodes[node]['role'] for node in network_graph.nodes())
            
            for i, role in enumerate(used_roles):
                if role in ROLE_COLORS:
                    legend.node(f'role_{i}', 
                              label=role,
                              shape=ROLE_SHAPES.get(role, 'ellipse'),
                              style='filled',
                              fillcolor=ROLE_COLORS.get(role, 'lightgray'),
                              fontcolor='black')
        
        # Genera il file di output
        output_basename = os.path.splitext(output_path)[0]
        try:
            dot.render(output_basename, cleanup=True)
            logger.info(f"Grafo salvato come {output_basename}.pdf")
            
            # Genera anche versione PNG per migliore compatibilità
            dot.format = 'png'
            dot.render(output_basename + "_png", cleanup=True)
            logger.info(f"Grafo salvato anche come {output_basename}_png.png")
            
            # Se l'output richiesto era PNG, rinomina il file
            if output_path.lower().endswith('.png'):
                os.rename(f"{output_basename}_png.png", output_path)
                logger.info(f"File rinominato in {output_path}")
                
            return output_path
                
        except Exception as e:
            logger.error(f"Errore nel salvataggio del grafo: {e}")
            # Fallback al salvataggio con NetworkX se Graphviz fallisce
            try:
                import matplotlib.pyplot as plt
                pos = nx.spring_layout(network_graph)
                plt.figure(figsize=(12, 8))
                nx.draw(network_graph, pos, with_labels=True, node_size=300, font_size=8)
                plt.savefig(output_path)
                logger.info(f"Grafo salvato come {output_path} (fallback)")
                plt.close()
                return output_path
            except Exception as e2:
                logger.error(f"Anche il fallback è fallito: {e2}")
                return None