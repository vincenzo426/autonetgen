#!/usr/bin/env python3
"""
NetworkEnricher - classe per arricchire i dati di rete con informazioni aggiuntive
"""

import json
import ipaddress
from collections import defaultdict
from config import logger, COMMON_PORTS

class NetworkEnricher:
    """Classe per arricchire i dati di rete con informazioni aggiuntive"""
    
    def __init__(self):
        """Inizializza l'arricchitore di rete"""
        self.host_data = {}
        self.subnet_data = {}
    
    def enrich_host_roles(self, network_data, host_roles_dict=None):
        """
        Arricchisce i dati di rete con informazioni sui ruoli degli host
        
        Args:
            network_data (NetworkData): Oggetto contenente i dati di rete
            host_roles_dict (dict, optional): Dizionario con i ruoli degli host preesistenti
        
        Returns:
            dict: Dizionario con i ruoli degli host
        """
        if host_roles_dict:
            self.host_data.update(host_roles_dict)
            return self.host_data
            
        # Inferenza dei ruoli degli host se non è stato fornito un dizionario
        host_roles = {}
        
        # Conta le connessioni in entrata e in uscita per ogni host
        incoming_connections = defaultdict(int)
        outgoing_connections = defaultdict(int)
        
        for (src, dst), count in network_data.connections.items():
            outgoing_connections[src] += count
            incoming_connections[dst] += count
        
        # Identificazione dei ruoli basati sui pattern di traffico e sulle porte
        for host in network_data.hosts:
            # Inizializza con un ruolo predefinito
            role = "UNKNOWN"
            
            # Host che accettano molte connessioni in entrata sono probabilmente server
            if incoming_connections[host] > outgoing_connections[host] * 2:
                role = "SERVER"
                
                # Identifica tipi specifici di server basandosi sulle porte
                for port, direction, proto in network_data.host_ports[host]:
                    if direction == "dst":
                        if port == 502:
                            role = "PLC_MODBUS"
                            break
                        elif port == 102:
                            role = "PLC_S7COMM"
                            break
                        elif port == 44818:
                            role = "PLC_ETHERNET_IP"
                            break
                        elif port == 80 or port == 443 or port == 8080 or port == 8443:
                            role = "WEB_SERVER"
                        elif port == 53:
                            role = "DNS_SERVER"
                        elif port == 25:
                            role = "MAIL_SERVER"
                        elif port == 21:
                            role = "FTP_SERVER"
                        elif port == 22:
                            role = "SSH_SERVER"
                        elif port == 3306:
                            role = "DATABASE_SERVER"
                        elif port == 1883:
                            role = "MQTT_BROKER"
            
            # Host che iniziano molte connessioni in uscita sono probabilmente client
            elif outgoing_connections[host] > incoming_connections[host] * 2:
                role = "CLIENT"
                
                # Verifica se è un client specializzato
                for port, direction, proto in network_data.host_ports[host]:
                    if direction == "src" and proto == "TCP":
                        if port == 80 or port == 443 or port == 8080 or port == 8443:
                            role = "WEB_CLIENT"
                            break
            
            # Host che hanno sia traffico in entrata che in uscita bilanciato potrebbero essere gateway o proxy
            elif incoming_connections[host] > 0 and outgoing_connections[host] > 0:
                gateway_threshold = 10  # soglia arbitraria
                if incoming_connections[host] > gateway_threshold and outgoing_connections[host] > gateway_threshold:
                    role = "GATEWAY"
            
            host_roles[host] = role
        
        self.host_data = host_roles
        logger.info(f"Ruoli inferiti per {len(host_roles)} host")
        return host_roles
    
    def identify_subnets(self, network_data):
        """
        Identifica le subnet nella rete basandosi sugli indirizzi IP
        
        Args:
            network_data (NetworkData): Oggetto contenente i dati di rete
            
        Returns:
            dict: Dizionario con le subnet identificate
        """
        subnets = {}
        
        try:
            networks = defaultdict(list)
            for ip in network_data.hosts:
                ip_obj = ipaddress.ip_address(ip)
                for prefix in [8, 16, 24]:
                    network = ipaddress.ip_network(f"{ip}/{prefix}", strict=False)
                    networks[prefix].append((ip, network))
            
            # Identifica le subnet più probabili (assumendo /24 come più comune)
            for prefix in [24, 16, 8]:
                for ip, network in networks[prefix]:
                    if ip not in subnets:
                        subnets[ip] = str(network)
            
            self.subnet_data = subnets
            return subnets
            
        except Exception as e:
            logger.warning(f"Errore nell'analisi delle subnet: {e}")
            return {}
    
    def load_external_data(self, file_path):
        """
        Carica dati di arricchimento da un file esterno
        
        Args:
            file_path (str): Percorso del file da caricare
            
        Returns:
            bool: True se il caricamento è riuscito, False altrimenti
        """
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                
                if 'host_roles' in data:
                    self.host_data.update(data['host_roles'])
                    
                if 'subnets' in data:
                    self.subnet_data.update(data['subnets'])
                    
                return True
                
        except Exception as e:
            logger.error(f"Errore nel caricamento del file di arricchimento: {e}")
            return False
            
    def save_enrichment_data(self, file_path):
        """
        Salva i dati di arricchimento su un file
        
        Args:
            file_path (str): Percorso del file in cui salvare i dati
            
        Returns:
            bool: True se il salvataggio è riuscito, False altrimenti
        """
        try:
            data = {
                'host_roles': self.host_data,
                'subnets': self.subnet_data
            }
            
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
                
            logger.info(f"Dati di arricchimento salvati in {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Errore nel salvataggio dei dati di arricchimento: {e}")
            return False