#!/usr/bin/env python3
"""
CSV Parser - parser specifico per i file CSV
"""

import csv
import ipaddress
from config import logger
from parsers.base_parser import NetworkParser

class CSVParser(NetworkParser):
    """Parser per i file CSV di traffico di rete"""
    
    def parse(self, file_path, network_data):
        """
        Analizza un file CSV e popola l'oggetto network_data
        
        Args:
            file_path (str): Percorso del file CSV da analizzare
            network_data (NetworkData): Oggetto che contiene i dati di rete
            
        Returns:
            bool: True se l'analisi è riuscita, False altrimenti
        """
        logger.info(f"Analisi del file CSV: {file_path}")
        
        try:
            # Rileva automaticamente il formato del file CSV
            with open(file_path, 'r') as file:
                sample = file.read(4096)
                dialect = csv.Sniffer().sniff(sample)
                file.seek(0)
                
                # Legge l'header per determinare il formato
                reader = csv.reader(file, dialect)
                header = next(reader)
                
                # Cerca colonne con indirizzi IP e porte
                src_ip_col = None
                dst_ip_col = None
                src_port_col = None
                dst_port_col = None
                proto_col = None
                
                for i, col in enumerate(header):
                    col_lower = col.lower()
                    if 'source' in col_lower and 'ip' in col_lower or 'src' in col_lower and 'ip' in col_lower:
                        src_ip_col = i
                    elif 'destination' in col_lower and 'ip' in col_lower or 'dst' in col_lower and 'ip' in col_lower:
                        dst_ip_col = i
                    elif 'source' in col_lower and 'port' in col_lower or 'src' in col_lower and 'port' in col_lower:
                        src_port_col = i
                    elif 'destination' in col_lower and 'port' in col_lower or 'dst' in col_lower and 'port' in col_lower:
                        dst_port_col = i
                    elif 'protocol' in col_lower or 'proto' in col_lower:
                        proto_col = i
                
                if src_ip_col is None or dst_ip_col is None:
                    logger.error("Impossibile trovare le colonne necessarie nel file CSV")
                    return False
                
                # Analizza il contenuto del file
                for row in reader:
                    if len(row) <= max(src_ip_col, dst_ip_col):
                        continue
                    
                    src_ip = row[src_ip_col]
                    dst_ip = row[dst_ip_col]
                    
                    # Verifica che gli indirizzi IP siano validi
                    try:
                        ipaddress.ip_address(src_ip)
                        ipaddress.ip_address(dst_ip)
                    except ValueError:
                        continue
                    
                    # Salva gli host
                    network_data.add_host(src_ip)
                    network_data.add_host(dst_ip)
                    
                    # Salva le connessioni
                    network_data.add_connection(src_ip, dst_ip)
                    
                    # Informazioni sul protocollo
                    proto = row[proto_col] if proto_col is not None and len(row) > proto_col else "UNKNOWN"
                    network_data.add_protocol(proto)
                    
                    # Informazioni sulle porte
                    if src_port_col is not None and len(row) > src_port_col:
                        try:
                            sport = int(row[src_port_col])
                            network_data.add_port(src_ip, sport, "src", proto)
                        except (ValueError, TypeError):
                            pass
                    
                    if dst_port_col is not None and len(row) > dst_port_col:
                        try:
                            dport = int(row[dst_port_col])
                            network_data.add_port(dst_ip, dport, "dst", proto)
                            
                            # Mapping dei servizi basati sulle porte di destinazione
                            self.map_service(dst_ip, dport, network_data)
                        except (ValueError, TypeError):
                            pass
            
            logger.info(f"Analisi del file CSV completata con successo")
            
        except Exception as e:
            logger.error(f"Errore nell'analisi del file CSV: {e}")
            return False
        
        return True