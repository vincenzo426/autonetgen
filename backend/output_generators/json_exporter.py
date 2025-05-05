#!/usr/bin/env python3
"""
JSONExporter - generatore di output JSON per l'analisi della rete
"""

import json
from config import logger, COMMON_PORTS
from output_generators.base_generator import OutputGenerator

class JSONExporter(OutputGenerator):
    """Generatore di output JSON per l'analisi della rete"""
    
    def generate(self, data, output_path):
        """
        Genera un file JSON con l'analisi della rete
        
        Args:
            data (dict): Dizionario con i dati da utilizzare per la generazione
            output_path (str): Percorso in cui salvare l'output
            
        Returns:
            str: Percorso del file di output generato o None in caso di errore
        """
        logger.info(f"Esportazione dell'analisi in {output_path}")
        
        # Estrai i dati necessari
        network_data = data['network_data']
        host_roles = data['host_roles']
        subnets = data['subnets']
        
        # Prepara i dati per l'esportazione
        services = {}
        for host in host_roles:
            for port, direction, proto in network_data.host_ports.get(host, []):
                if direction == "dst" and port in COMMON_PORTS:
                    service = COMMON_PORTS[port]
                    if service not in services:
                        services[service] = []
                    services[service].append(host)
        
        # Crea il dizionario da esportare
        analysis = {
            "hosts": list(network_data.hosts),
            "host_roles": host_roles,
            "services": services,
            "protocols": dict(network_data.protocols),
            "subnets": subnets,
            "connections": {f"{src}->{dst}": count for (src, dst), count in network_data.connections.items()}
        }
        
        try:
            with open(output_path, 'w') as f:
                json.dump(analysis, f, indent=2)
            logger.info(f"Analisi esportata in {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"Errore nell'esportazione dell'analisi: {e}")
            return None