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
    "DNS_SERVER": "rectangle",
    "MAIL_SERVER": "rectangle",
    "SSH_SERVER": "rectangle",
    "MQTT_BROKER": "hexagon",
    "UNKNOWN": "ellipse"
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