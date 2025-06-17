#!/usr/bin/env python3
"""
Config module for Network Traffic Analyzer & Terraform Generator
"""

import logging
import os

# Configurazione logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("NetworkAnalyzer")

# Mappatura delle porte comuni ai servizi
COMMON_PORTS = {
    20: 'FTP-DATA',
    21: 'FTP',
    22: 'SSH',
    23: 'TELNET',
    25: 'SMTP',
    53: 'DNS',
    80: 'HTTP',
    102: 'S7COMM',
    123: 'NTP',
    161: 'SNMP', 
    443: 'HTTPS',
    502: 'MODBUS',
    1883: 'MQTT',
    3306: 'MYSQL',
    8080: 'HTTP-ALT',
    8443: 'HTTPS-ALT',
    44818: 'EtherNet/IP',
    47808: 'BACnet',
    # Porte industriali
    102: 'S7COMM',
    502: 'MODBUS',
    1911: 'Tridium Fox',
    2222: 'EtherCAT',
    34962: 'PROFINET',
    44818: 'EtherNet/IP',
    47808: 'BACnet'
}

# Mappatura dei ruoli ai colori per la visualizzazione
ROLE_COLORS = {
    "SERVER": "red",
    "CLIENT": "dodgerblue",
    "PLC_MODBUS": "forestgreen",
    "PLC_S7COMM": "darkgreen",
    "PLC_ETHERNET_IP": "seagreen",
    "WEB_SERVER": "darkorange",
    "DATABASE_SERVER": "purple",
    "WEB_CLIENT": "skyblue",
    "GATEWAY": "gold",
    "FIREWALL": "crimson",  # NUOVO: Colore per firewall
    "DNS_SERVER": "hotpink",
    "MAIL_SERVER": "saddlebrown",
    "SSH_SERVER": "dimgray",
    "MQTT_BROKER": "olivedrab",
    "UNKNOWN": "lightgray"
}

# Mappatura dei ruoli alle forme per la visualizzazione
ROLE_SHAPES = {
    "SERVER": "rectangle",
    "CLIENT": "ellipse",
    "PLC_MODBUS": "diamond",
    "PLC_S7COMM": "diamond",
    "PLC_ETHERNET_IP": "diamond",
    "WEB_SERVER": "rectangle",
    "DATABASE_SERVER": "cylinder",
    "WEB_CLIENT": "ellipse",
    "GATEWAY": "pentagon",
    "FIREWALL": "octagon",  # NUOVO: Forma ottagonale per firewall
    "DNS_SERVER": "rectangle",
    "MAIL_SERVER": "rectangle",
    "SSH_SERVER": "rectangle",
    "MQTT_BROKER": "hexagon",
    "UNKNOWN": "ellipse"
}

# NUOVO: Porte comuni per firewall e servizi di sicurezza
FIREWALL_PORTS = {
    22: 'SSH',           # Gestione remota firewall
    23: 'TELNET',        # Gestione remota legacy
    53: 'DNS',           # DNS filtering
    80: 'HTTP',          # Web filtering
    443: 'HTTPS',        # SSL inspection
    161: 'SNMP',         # Monitoring
    162: 'SNMP-TRAP',    # SNMP traps
    514: 'SYSLOG',       # Log management
    1812: 'RADIUS',      # Authentication
    1813: 'RADIUS-ACC',  # RADIUS accounting
    4500: 'IPSEC',       # IPSec VPN
    500: 'ISAKMP',       # IKE VPN
    1701: 'L2TP',        # L2TP VPN
    1723: 'PPTP',        # PPTP VPN
    8080: 'HTTP-PROXY',  # Proxy services
    3128: 'SQUID-PROXY', # Squid proxy
    8443: 'HTTPS-ALT'    # Alternative HTTPS
}

# Configurazioni Terraform
GCP_PROJECT_ID = "gruppo-10"
GCP_REGION = "us-central1"
GCP_ZONE = "us-central1-a"

# Configurazioni per l'analisi
DEFAULT_OUTPUT_DIR = "output"
DEFAULT_TERRAFORM_DIR = os.path.join(DEFAULT_OUTPUT_DIR, "terraform")
DEFAULT_GRAPH_FILE = os.path.join(DEFAULT_OUTPUT_DIR, "network_graph.pdf")
DEFAULT_ANALYSIS_FILE = os.path.join(DEFAULT_OUTPUT_DIR, "network_analysis.json")