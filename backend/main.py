#!/usr/bin/env python3
"""
Network Traffic Analyzer & Terraform Generator

Questo script analizza dataset di traffico di rete (PCAP, CSV, NetFlow) per inferire:
- Host IP e ruoli (client, server, PLC, ecc.)
- Protocolli utilizzati
- Servizi e mapping delle porte
- Pattern di comunicazione

Genera poi configurazioni Terraform per implementare l'infrastruttura inferita su GCP.
"""

import os
import sys
import argparse
from config import logger
from analysis_orchestrator import AnalysisOrchestrator

def main():
    parser = argparse.ArgumentParser(description='Network Traffic Analyzer & Terraform Generator')
    parser.add_argument('input_file', help='File di input (PCAP, CSV, NetFlow)')
    parser.add_argument('--type', choices=['pcap', 'csv', 'netflow'], help='Tipo di file di input (rilevato automaticamente se non specificato)')
    parser.add_argument('--output-dir', default='output', help='Directory di output per i file generati')
    parser.add_argument('--output-graph', help='File di output per il grafo di rete (PDF o PNG)')
    parser.add_argument('--output-analysis', help='File di output per analisi della rete')
    parser.add_argument('--output-terraform', help='Directory di output per i file Terraform')
    
    args = parser.parse_args()
    
    # Verifica che il file di input esista
    if not os.path.isfile(args.input_file):
        logger.error(f"File di input non trovato: {args.input_file}")
        sys.exit(1)
    
    # Inizializza l'orchestratore
    orchestrator = AnalysisOrchestrator()
    
    # Esegui l'analisi
    success = orchestrator.run(
        input_file=args.input_file,
        file_type=args.type,
        output_dir=args.output_dir,
        output_graph=args.output_graph,
        output_analysis=args.output_analysis,
        output_terraform=args.output_terraform
    )
    
    if not success:
        logger.error("Analisi fallita")
        sys.exit(1)
    
    logger.info("Script completato con successo!")

if __name__ == "__main__":
    main()