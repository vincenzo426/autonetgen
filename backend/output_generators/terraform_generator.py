#!/usr/bin/env python3
"""
TerraformGenerator - generatore di configurazioni Terraform per GCP
"""

import os
from config import logger, GCP_PROJECT_ID, GCP_REGION, GCP_ZONE
from output_generators.base_generator import OutputGenerator

class TerraformGenerator(OutputGenerator):
    """Generatore di configurazioni Terraform per GCP"""
    
    def generate(self, data, output_dir):
        """
        Genera i file di configurazione Terraform per GCP
        
        Args:
            data (dict): Dizionario con i dati da utilizzare per la generazione
            output_dir (str): Directory in cui salvare i file generati
            
        Returns:
            str: Percorso della directory di output o None in caso di errore
        """
        logger.info(f"Generazione della configurazione Terraform in {output_dir}")
        
        # Estrai i dati necessari
        network_graph = data['network_graph']
        host_roles = data['host_roles']
        subnets = data['subnets']
        
        # Crea la directory di output se non esiste
        os.makedirs(output_dir, exist_ok=True)
        
        # File per le configurazioni del provider
        provider_file = os.path.join(output_dir, "provider.tf")
        with open(provider_file, 'w') as f:
            f.write(f"""
provider "google" {{
  project = "{GCP_PROJECT_ID}"
  region  = "{GCP_REGION}"
  zone    = "{GCP_ZONE}"
}}

terraform {{
  required_providers {{
    google = {{
      source  = "hashicorp/google"
      version = "~> 4.0"
    }}
  }}
}}
""")
        
        # File per la rete VPC
        network_file = os.path.join(output_dir, "network.tf")
        with open(network_file, 'w') as f:
            f.write("""
# Rete VPC principale
resource "google_compute_network" "main_network" {
  name                    = "inferred-network"
  auto_create_subnetworks = false
}

# Firewall per permettere l'SSH
resource "google_compute_firewall" "allow_ssh" {
  name    = "allow-ssh"
  network = google_compute_network.main_network.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ssh"]
}
""")
        
        # Ottieni subnet uniche
        unique_subnets = set(subnets.values())
        subnet_counter = 1
        subnet_resources = []
        
        # Crea subnet CIDR non sovrapposti per GCP
        gcp_subnet_map = {}
        for subnet in unique_subnets:
            subnet_name = f"subnet-{subnet_counter}"
            gcp_cidr = f"10.{subnet_counter}.0.0/24"
            gcp_subnet_map[subnet] = {
                "name": subnet_name,
                "cidr": gcp_cidr
            }
            
            subnet_resources.append(f"""
resource "google_compute_subnetwork" "{subnet_name}" {{
  name          = "{subnet_name}"
  network       = google_compute_network.main_network.name
  ip_cidr_range = "{gcp_cidr}"
  region        = "us-central1"
}}
""")
            subnet_counter += 1
        
        # Aggiungi le subnet al file di rete
        with open(network_file, 'a') as f:
            for subnet_resource in subnet_resources:
                f.write(subnet_resource)
        
        # Crea le istanze VM per ogni host
        instances_file = os.path.join(output_dir, "instances.tf")
        with open(instances_file, 'w') as f:
            # Instanze per host
            instance_counter = 1
            firewall_rules = []
            
            for host, role in host_roles.items():
                host_safe = host.replace('.', '-')
                subnet = subnets.get(host, list(unique_subnets)[0] if unique_subnets else "unknown")
                subnet_resource = gcp_subnet_map.get(subnet, {"name": "subnet-1", "cidr": "10.1.0.0/24"})
                
                # Determina il tipo di macchina e l'immagine in base al ruolo
                machine_type = "e2-micro"  # default economico
                boot_disk_image = "debian-cloud/debian-11"
                tags = ["ssh"]
                startup_script = ""
                
                if "SERVER" in role:
                    machine_type = "e2-medium"
                    tags.append("server")
                elif "PLC" in role:
                    tags.append("plc")
                    startup_script = """
                    apt-get update
                    apt-get install -y python3-pip
                    pip3 install pymodbus
                    # Script per emulare un PLC Modbus
                    cat <<EOF > /usr/local/bin/modbus_emulator.py
#!/usr/bin/env python3
from pymodbus.server.sync import StartTcpServer
from pymodbus.datastore import ModbusSequentialDataBlock, ModbusSlaveContext, ModbusServerContext
import logging
import time

logging.basicConfig()
log = logging.getLogger()
log.setLevel(logging.DEBUG)

# Configurazione del contesto del server
store = ModbusSlaveContext(
    di=ModbusSequentialDataBlock(0, [0]*100),
    co=ModbusSequentialDataBlock(0, [0]*100),
    hr=ModbusSequentialDataBlock(0, [0]*100),
    ir=ModbusSequentialDataBlock(0, [0]*100))
context = ModbusServerContext(slaves=store, single=True)

# Avvia il server
print("Avvio server Modbus TCP su porta 502")
StartTcpServer(context, address=("0.0.0.0", 502))
EOF
                    chmod +x /usr/local/bin/modbus_emulator.py
                    nohup /usr/local/bin/modbus_emulator.py &
                    """
                elif "WEB_SERVER" in role:
                    tags.append("web")
                    startup_script = """
                    apt-get update
                    apt-get install -y nginx
                    echo '<html><body><h1>Web Server Emulato</h1></body></html>' > /var/www/html/index.html
                    systemctl enable nginx
                    systemctl start nginx
                    """
                elif "DATABASE_SERVER" in role:
                    machine_type = "e2-standard-2"
                    tags.append("database")
                    startup_script = """
                    apt-get update
                    apt-get install -y mariadb-server
                    systemctl enable mariadb
                    systemctl start mariadb
                    mysql -e "CREATE DATABASE test_db;"
                    """
                
                # Ottieni le porte utilizzate da questo host
                used_ports = set()
                host_ports = []
                for node in network_graph.nodes(data=True):
                    if node[0] == host and 'ports' in node[1]:
                        host_ports = node[1]['ports']
                
                for port_info in host_ports:
                    port, direction, proto = port_info
                    if direction == "dst":  # Solo porte in ascolto
                        used_ports.add((port, proto))
                
                # Crea regole firewall per le porte in uso
                if used_ports:
                    fw_name = f"allow-{host_safe}-ports"
                    fw_ports = {}
                    
                    for port, proto in used_ports:
                        proto_lower = proto.lower()
                        if proto_lower not in fw_ports:
                            fw_ports[proto_lower] = []
                        fw_ports[proto_lower].append(str(port))
                    
                    fw_rule = f"""
resource "google_compute_firewall" "{fw_name}" {{
  name    = "{fw_name}"
  network = google_compute_network.main_network.name
"""
                    
                    for proto, ports in fw_ports.items():
                        fw_rule += f"""
  allow {{
    protocol = "{proto}"
    ports    = [{', '.join([f'"{p}"' for p in ports])}]
  }}
"""
                    
                    fw_rule += f"""
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["{host_safe}"]
}}
"""
                    firewall_rules.append(fw_rule)
                
                # Crea l'istanza VM
                f.write(f"""
resource "google_compute_instance" "host-{host_safe}" {{
  name         = "host-{host_safe}"
  machine_type = "{machine_type}"
  zone         = "us-central1-a"
  tags         = {str(tags + [host_safe]).replace("'", '"')}

  boot_disk {{
    initialize_params {{
      image = "{boot_disk_image}"
    }}
  }}

  network_interface {{
    network    = google_compute_network.main_network.name
    subnetwork = google_compute_subnetwork.{subnet_resource['name']}.name
    
    access_config {{
      // Ephemeral IP
    }}
  }}

  metadata_startup_script = <<-EOT
{startup_script}
  EOT

  metadata = {{
    role = "{role}"
    original_ip = "{host}"
  }}
}}
""")
                
                instance_counter += 1
            
            # Aggiungi le regole firewall
            for rule in firewall_rules:
                f.write(rule)
        
        # Crea un file di output con la mappatura degli indirizzi IP originali
        outputs_file = os.path.join(output_dir, "outputs.tf")
        with open(outputs_file, 'w') as f:
            f.write("""
output "original_to_gcp_mapping" {
  value = {
""")
            
            for host in host_roles:
                host_safe = host.replace('.', '-')
                f.write(f'    "{host}" = "${{google_compute_instance.host_{host_safe}.network_interface[0].network_ip}}"\n')
            
            f.write("""
  }
  description = "Mappatura degli indirizzi IP originali agli indirizzi IP GCP"
}
""")
        
        logger.info(f"Configurazione Terraform generata in {output_dir}")
        return output_dir