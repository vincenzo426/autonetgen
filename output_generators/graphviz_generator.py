#!/usr/bin/env python3
"""
GraphvizGenerator - Generatore di grafi di rete con Graphviz
"""

import os
import matplotlib.pyplot as plt
import graphviz
import networkx as nx
from collections import defaultdict
from config import logger, ROLE_COLORS, ROLE_SHAPES
from output_generators.base_generator import OutputGenerator


class GraphvizGenerator(OutputGenerator):
    """Generatore di output per i grafi di rete con Graphviz"""

    def generate(self, data, output_path):
        graph = data.get('network_graph')
        if not graph or graph.number_of_nodes() == 0:
            logger.warning("Nessun dato per visualizzare il grafo")
            return None

        logger.info("Generazione del grafo di rete con Graphviz")

        dot = self._init_graphviz()

        self._add_subnet_clusters(dot, graph)
        self._add_unknown_subnet_nodes(dot, graph)
        self._add_edges(dot, graph)
        self._add_legend(dot, graph)

        return self._render_output(dot, output_path)

    def _init_graphviz(self):
        dot = graphviz.Digraph(
            comment='Network Traffic Analysis',
            format='pdf',
            engine='dot',
            strict=True
        )
        dot.attr(rankdir='LR', size='11,8', ratio='fill', fontname='Arial',
                 label='Network Traffic Analysis', labelloc='t', fontsize='18', bgcolor='white')
        dot.attr('node', fontname='Arial', fontsize='10')
        dot.attr('edge', fontname='Arial', fontsize='8', arrowsize='0.5')
        return dot

    def _add_subnet_clusters(self, dot, graph):
        subnets = defaultdict(list)
        for node in graph.nodes():
            subnet = graph.nodes[node].get('subnet', 'UNKNOWN')
            subnets[subnet].append(node)

        for i, (subnet, nodes) in enumerate(subnets.items()):
            if subnet == 'UNKNOWN':
                continue
            with dot.subgraph(name=f'cluster_{i}') as c:
                c.attr(label=f'Subnet: {subnet}', style='filled',
                       color='lightgrey', fontname='Arial', fontsize='10')
                for node in nodes:
                    c.node(node, **self._get_node_attrs(graph, node))

    def _add_unknown_subnet_nodes(self, dot, graph):
        for node in graph.nodes():
            if graph.nodes[node].get('subnet', 'UNKNOWN') == 'UNKNOWN':
                dot.node(node, **self._get_node_attrs(graph, node))

    def _get_node_attrs(self, graph, node):
        data = graph.nodes[node]
        role = data.get('role', 'UNKNOWN')
        ports = data.get('ports', [])

        label_lines = [node, role]
        if ports:
            visible = ports[:5]
            label_lines += [f"{port} ({proto})" for port, _, proto in visible]
            if len(ports) > 5:
                label_lines.append(f"+{len(ports) - 5} altre")

        return {
            'label': "\\n".join(label_lines),
            'shape': ROLE_SHAPES.get(role, 'ellipse'),
            'style': 'filled',
            'fillcolor': ROLE_COLORS.get(role, 'lightgray'),
            'color': 'black',
            'fontcolor': 'black'
        }

    def _add_edges(self, dot, graph):
        for src, dst, data in graph.edges(data=True):
            weight = data.get('weight', 1)
            protocols = data.get('protocols', [])
            penwidth = str(0.5 + min(5, weight / 10))

            label = ", ".join(protocols[:3])
            if len(protocols) > 3:
                label += f", +{len(protocols) - 3}"
            if weight > 1:
                label += f" ({weight} conn.)"

            dot.edge(src, dst, label=label, penwidth=penwidth)

    def _add_legend(self, dot, graph):
        used_roles = {graph.nodes[n].get('role', 'UNKNOWN') for n in graph.nodes()}

        with dot.subgraph(name='cluster_legend') as legend:
            legend.attr(label='Legenda', rankdir='LR', style='filled', color='white')
            for i, role in enumerate(sorted(used_roles)):
                legend.node(f'legend_{i}',
                            label=role,
                            shape=ROLE_SHAPES.get(role, 'ellipse'),
                            style='filled',
                            fillcolor=ROLE_COLORS.get(role, 'lightgray'),
                            fontcolor='black')

    def _render_output(self, dot, output_path):
        basename = os.path.splitext(output_path)[0]
        try:
            dot.render(basename, cleanup=True)
            logger.info(f"Grafo PDF salvato in {basename}.pdf")

            dot.format = 'png'
            png_path = dot.render(basename + "_png", cleanup=True)
            logger.info(f"Grafo PNG salvato in {png_path}")

            if output_path.lower().endswith('.png'):
                os.rename(png_path, output_path)
                logger.info(f"File rinominato in {output_path}")

            return output_path

        except Exception as e:
            logger.error(f"Errore durante la generazione con Graphviz: {e}")
            return self._fallback_render(dot, output_path)

    def _fallback_render(self, graph, output_path):
        try:
            pos = nx.spring_layout(graph)
            plt.figure(figsize=(12, 8))
            nx.draw(graph, pos, with_labels=True, node_size=300, font_size=8)
            plt.savefig(output_path)
            plt.close()
            logger.info(f"Grafo salvato come PNG con fallback: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"Fallback fallito: {e}")
            return None
