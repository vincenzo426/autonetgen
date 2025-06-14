#!/usr/bin/env python3
"""
CSV Parser - parser specifico per i file CSV con gestione robusta dei delimitatori
"""

import csv
import ipaddress
from config import logger
from parsers.base_parser import NetworkParser

class CSVParser(NetworkParser):
    """Parser per i file CSV di traffico di rete con gestione robusta dei delimitatori"""
    
    def __init__(self):
        super().__init__()
        # Lista di delimitatori comuni da provare in ordine di priorità
        self.common_delimiters = [',', ';', '\t', '|', ' ']
    
    def _detect_delimiter_and_encoding(self, file_path):
        """
        Rileva il delimitatore e l'encoding del file CSV
        
        Args:
            file_path (str): Percorso del file CSV
            
        Returns:
            tuple: (delimiter, encoding) oppure (None, None) se fallisce
        """
        encodings_to_try = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        
        for encoding in encodings_to_try:
            try:
                with open(file_path, 'r', encoding=encoding) as file:
                    # Legge un campione più grande per il rilevamento
                    sample = file.read(8192)
                    if not sample.strip():
                        continue
                    
                    # Prova prima con il Sniffer
                    try:
                        dialect = csv.Sniffer().sniff(sample, delimiters=',;\t|')
                        logger.info(f"Delimitatore rilevato automaticamente: '{dialect.delimiter}' con encoding {encoding}")
                        return dialect.delimiter, encoding
                    except csv.Error as e:
                        logger.warning(f"Sniffer fallito con encoding {encoding}: {e}")
                        
                        # Se il Sniffer fallisce, prova delimitatori comuni
                        delimiter = self._try_common_delimiters(sample)
                        if delimiter:
                            logger.info(f"Delimitatore determinato manualmente: '{delimiter}' con encoding {encoding}")
                            return delimiter, encoding
            
            except UnicodeDecodeError:
                logger.debug(f"Encoding {encoding} non compatibile con il file")
                continue
            except Exception as e:
                logger.warning(f"Errore nel rilevamento con encoding {encoding}: {e}")
                continue
        
        logger.error("Impossibile determinare delimitatore ed encoding per il file")
        return None, None
    
    def _try_common_delimiters(self, sample):
        """
        Prova delimitatori comuni sul campione
        
        Args:
            sample (str): Campione del file
            
        Returns:
            str: Delimitatore trovato o None
        """
        lines = sample.split('\n')
        if len(lines) < 2:
            return None
        
        # Considera le prime righe non vuote
        valid_lines = [line.strip() for line in lines[:10] if line.strip()]
        if len(valid_lines) < 2:
            return None
        
        best_delimiter = None
        max_consistent_columns = 0
        
        for delimiter in self.common_delimiters:
            try:
                # Conta le colonne per ogni riga con questo delimitatore
                column_counts = []
                for line in valid_lines:
                    parts = line.split(delimiter)
                    if len(parts) > 1:  # Deve avere almeno 2 colonne
                        column_counts.append(len(parts))
                
                # Verifica consistenza (almeno 70% delle righe con lo stesso numero di colonne)
                if column_counts:
                    most_common_count = max(set(column_counts), key=column_counts.count)
                    consistent_lines = sum(1 for count in column_counts if count == most_common_count)
                    consistency_ratio = consistent_lines / len(column_counts)
                    
                    if (consistency_ratio >= 0.7 and 
                        most_common_count >= 2 and 
                        most_common_count > max_consistent_columns):
                        max_consistent_columns = most_common_count
                        best_delimiter = delimiter
                        
                        logger.debug(f"Delimitatore '{delimiter}': {most_common_count} colonne, "
                                   f"consistenza {consistency_ratio:.1%}")
            
            except Exception as e:
                logger.debug(f"Errore testando delimitatore '{delimiter}': {e}")
                continue
        
        return best_delimiter
    
    def _detect_columns(self, header):
        """
        Rileva automaticamente le colonne rilevanti nell'header
        
        Args:
            header (list): Lista delle colonne dell'header
            
        Returns:
            dict: Dizionario con gli indici delle colonne trovate
        """
        columns = {
            'src_ip': None,
            'dst_ip': None,
            'src_port': None,
            'dst_port': None,
            'protocol': None
        }
        
        for i, col in enumerate(header):
            col_lower = col.lower().strip()
            
            # Source IP
            if any(pattern in col_lower for pattern in [
                'source ip', 'src ip', 'source_ip', 'src_ip', 'source.ip', 'src.ip',
                'source address', 'src address', 'source_address', 'src_address'
            ]):
                columns['src_ip'] = i
            
            # Destination IP
            elif any(pattern in col_lower for pattern in [
                'destination ip', 'dst ip', 'dest ip', 'destination_ip', 'dst_ip', 'dest_ip',
                'destination.ip', 'dst.ip', 'dest.ip', 'destination address', 'dst address',
                'dest address', 'destination_address', 'dst_address', 'dest_address'
            ]):
                columns['dst_ip'] = i
            
            # Source Port
            elif any(pattern in col_lower for pattern in [
                'source port', 'src port', 'source_port', 'src_port', 'source.port', 'src.port'
            ]):
                columns['src_port'] = i
            
            # Destination Port
            elif any(pattern in col_lower for pattern in [
                'destination port', 'dst port', 'dest port', 'destination_port', 'dst_port',
                'dest_port', 'destination.port', 'dst.port', 'dest.port'
            ]):
                columns['dst_port'] = i
            
            # Protocol
            elif any(pattern in col_lower for pattern in [
                'protocol', 'proto', 'prot'
            ]):
                columns['protocol'] = i
        
        logger.info(f"Colonne rilevate: {columns}")
        return columns
    
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
            # Rileva delimitatore ed encoding
            delimiter, encoding = self._detect_delimiter_and_encoding(file_path)
            if not delimiter or not encoding:
                logger.error("Impossibile determinare delimitatore ed encoding del file CSV")
                return False
            
            processed_rows = 0
            valid_rows = 0
            
            with open(file_path, 'r', encoding=encoding) as file:
                # Crea il reader con il delimitatore rilevato
                reader = csv.reader(file, delimiter=delimiter)
                
                # Legge l'header
                try:
                    header = next(reader)
                    logger.info(f"Header CSV: {header}")
                except StopIteration:
                    logger.error("File CSV vuoto o senza header")
                    return False
                
                # Rileva le colonne
                columns = self._detect_columns(header)
                
                if columns['src_ip'] is None or columns['dst_ip'] is None:
                    logger.error("Impossibile trovare le colonne degli indirizzi IP necessarie")
                    logger.error(f"Colonne disponibili: {header}")
                    return False
                
                # Analizza il contenuto del file
                for row_num, row in enumerate(reader, start=2):  # Start=2 perché row 1 è l'header
                    processed_rows += 1
                    
                    if len(row) <= max(columns['src_ip'], columns['dst_ip']):
                        logger.debug(f"Riga {row_num}: numero di colonne insufficiente ({len(row)})")
                        continue
                    
                    try:
                        src_ip = row[columns['src_ip']].strip()
                        dst_ip = row[columns['dst_ip']].strip()
                        
                        # Verifica che gli indirizzi IP siano validi
                        ipaddress.ip_address(src_ip)
                        ipaddress.ip_address(dst_ip)
                        
                        # Salva gli host
                        network_data.add_host(src_ip)
                        network_data.add_host(dst_ip)
                        
                        # Salva le connessioni
                        network_data.add_connection(src_ip, dst_ip)
                        
                        # Informazioni sul protocollo
                        if columns['protocol'] is not None and len(row) > columns['protocol']:
                            proto = row[columns['protocol']].strip()
                        else:
                            proto = "UNKNOWN"
                        network_data.add_protocol(proto)
                        
                        # Informazioni sulle porte
                        if columns['src_port'] is not None and len(row) > columns['src_port']:
                            try:
                                sport = int(row[columns['src_port']].strip())
                                network_data.add_port(src_ip, sport, "src", proto)
                            except (ValueError, TypeError):
                                pass
                        
                        if columns['dst_port'] is not None and len(row) > columns['dst_port']:
                            try:
                                dport = int(row[columns['dst_port']].strip())
                                network_data.add_port(dst_ip, dport, "dst", proto)
                                
                                # Mapping dei servizi basati sulle porte di destinazione
                                self.map_service(dst_ip, dport, network_data)
                            except (ValueError, TypeError):
                                pass
                        
                        valid_rows += 1
                        
                    except (ValueError, ipaddress.AddressValueError) as e:
                        logger.debug(f"Riga {row_num}: indirizzi IP non validi ({src_ip}, {dst_ip}): {e}")
                        continue
                    except Exception as e:
                        logger.warning(f"Errore processando riga {row_num}: {e}")
                        continue
                    
                    # Log di progresso ogni 1000 righe
                    if processed_rows % 1000 == 0:
                        logger.info(f"Processate {processed_rows} righe, {valid_rows} valide")
            
            logger.info(f"Analisi del file CSV completata: {processed_rows} righe processate, {valid_rows} valide")
            
            if valid_rows == 0:
                logger.error("Nessuna riga valida trovata nel file CSV")
                return False
            
        except Exception as e:
            logger.error(f"Errore nell'analisi del file CSV: {e}")
            return False
        
        return True