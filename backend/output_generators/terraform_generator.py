#!/usr/bin/env python3
"""
TerraformGenerator - generatore di configurazioni Terraform per GCP
Versione modificata per utilizzare l'infrastruttura VPC esistente
"""

import os
from config import logger, GCP_PROJECT_ID, GCP_REGION, GCP_ZONE
from output_generators.base_generator import OutputGenerator

class TerraformGenerator(OutputGenerator):
    """Generatore di configurazioni Terraform per GCP utilizzando infrastruttura esistente"""
    
    def __init__(self):
        """Inizializza il generatore leggendo la configurazione di rete esistente"""
        # Leggi configurazione di rete dalle variabili di ambiente
        self.vpc_network_name = os.environ.get('VPC_NETWORK_NAME', 'autonetgen-vpc')
        self.backend_subnet_name = os.environ.get('BACKEND_SUBNET_NAME', 'autonetgen-backend-subnet')
        self.backend_subnet_cidr = os.environ.get('BACKEND_SUBNET_CIDR', '10.2.0.0/24')
        self.project_id = os.environ.get('GOOGLE_CLOUD_PROJECT', GCP_PROJECT_ID)
        
        logger.info(f"TerraformGenerator configurato per:")
        logger.info(f"  - VPC: {self.vpc_network_name}")
        logger.info(f"  - Subnet: {self.backend_subnet_name}")
        logger.info(f"  - CIDR: {self.backend_subnet_cidr}")
        logger.info(f"  - Project: {self.project_id}")

    def validate_network_config(self):
        """Valida la configurazione di rete prima della generazione"""
        errors = []
        warnings = []
        
        if not self.vpc_network_name:
            errors.append("VPC_NETWORK_NAME non specificato")
        
        if not self.backend_subnet_name:
            errors.append("BACKEND_SUBNET_NAME non specificato")
            
        if not self.backend_subnet_cidr:
            warnings.append("BACKEND_SUBNET_CIDR non specificato, usando default")
            
        if not self.project_id:
            errors.append("GOOGLE_CLOUD_PROJECT non specificato")
            
        # Log warnings e errors
        for warning in warnings:
            logger.warning(f"Configurazione di rete: {warning}")
            
        for error in errors:
            logger.error(f"Configurazione di rete: {error}")
            
        if errors:
            raise ValueError(f"Errori di configurazione di rete: {', '.join(errors)}")
            
        logger.info("✅ Configurazione di rete validata correttamente")
        return True

    def sanitize_tag_name(self, ip):
        """Sanitizza un indirizzo IP per renderlo un tag valido"""
        tag = ip.replace('.', '-')
        if not tag[0].isalpha():
            tag = f"host-{tag}"  # prefix per rendere il tag valido
        return tag

    def generate(self, data, output_dir):
        """
        Genera i file di configurazione Terraform per GCP utilizzando l'infrastruttura esistente
        
        Args:
            data (dict): Dizionario con i dati da utilizzare per la generazione
            output_dir (str): Directory in cui salvare i file generati
            
        Returns:
            str: Percorso della directory di output o None in caso di errore
        """
        logger.info(f"Generazione della configurazione Terraform in {output_dir}")
        logger.info(f"Utilizzo infrastruttura esistente: VPC {self.vpc_network_name}, Subnet {self.backend_subnet_name}")
        
        # Valida la configurazione prima di procedere
        self.validate_network_config()
        
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
  project = "{self.project_id}"
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
        
        # File per la configurazione di rete (utilizzo infrastruttura esistente)
        network_file = os.path.join(output_dir, "network.tf")
        with open(network_file, 'w') as f:
            f.write(f"""
# === RIFERIMENTI ALL'INFRASTRUTTURA ESISTENTE ===
# Queste risorse esistono già e vengono solo referenziate
# IMPORTANTE: Si usa self_link invece di name per evitare errori di riferimento

# Riferimento alla VPC esistente
data "google_compute_network" "existing_vpc" {{
  name = "{self.vpc_network_name}"
}}

# Riferimento alla subnet backend esistente  
data "google_compute_subnetwork" "existing_backend_subnet" {{
  name   = "{self.backend_subnet_name}"
  region = "{GCP_REGION}"
}}

# === REGOLE FIREWALL PER LE RISORSE GENERATE ===

# Firewall per permettere l'SSH alle risorse generate
resource "google_compute_firewall" "allow_ssh_generated" {{
  name    = "allow-ssh-autonetgen-generated"
  network = data.google_compute_network.existing_vpc.name

  allow {{
    protocol = "tcp"
    ports    = ["22"]
  }}

  # Permetti SSH da tutta la subnet backend per amministrazione
  source_ranges = ["{self.backend_subnet_cidr}"]
  target_tags   = ["autonetgen-generated", "ssh-access"]
}}

# Firewall per comunicazione interna tra risorse generate
resource "google_compute_firewall" "allow_internal_generated" {{
  name    = "allow-internal-autonetgen-generated"
  network = data.google_compute_network.existing_vpc.name

  allow {{
    protocol = "tcp"
  }}

  allow {{
    protocol = "udp"
  }}

  allow {{
    protocol = "icmp"
  }}

  # Comunicazione interna nella subnet backend
  source_ranges = ["{self.backend_subnet_cidr}"]
  target_tags   = ["autonetgen-generated"]
}}
""")
        
        # Crea le istanze VM per ogni host
        instances_file = os.path.join(output_dir, "instances.tf")
        with open(instances_file, 'w') as f:
            f.write(f"""
# === VM GENERATE DA AUTONETGEN ===
# Tutte le VM vengono create nella subnet backend esistente: {self.backend_subnet_name}
# CIDR subnet: {self.backend_subnet_cidr}
# Accesso internet tramite Cloud NAT (nessun IP pubblico assegnato)

""")
            
            # Instanze per host
            instance_counter = 1
            firewall_rules = []
            
            for host, role in host_roles.items():
                host_safe = self.sanitize_tag_name(host)
                
                # Determina il tipo di macchina e l'immagine in base al ruolo
                machine_type = "e2-micro"  # default economico
                boot_disk_image = "debian-cloud/debian-11"
                tags = ["autonetgen-generated", "ssh-access"]
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
                    echo '<html><body><h1>Web Server Emulato - AutoNetGen</h1><p>Deployato nella subnet backend</p></body></html>' > /var/www/html/index.html
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
                    mysql -e "CREATE DATABASE autonetgen_test_db;"
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
                    # Raggruppa per protocollo
                    fw_ports = {}
                    for port, proto in used_ports:
                        proto_lower = proto.lower()
                        if proto_lower not in fw_ports:
                            fw_ports[proto_lower] = []
                        fw_ports[proto_lower].append(str(port))

                    for proto, ports in fw_ports.items():
                        # Spezza in chunk da massimo 100 porte
                        for i in range(0, len(ports), 100):
                            chunk_ports = ports[i:i+100]
                            chunk_index = i // 100 + 1
                            fw_name = f"allow-{host_safe}-{proto}-chunk-{chunk_index}"

                            fw_rule = f"""
# Regola firewall per {host} ({role})
resource "google_compute_firewall" "{fw_name}" {{
  name    = "{fw_name}"
  network = data.google_compute_network.existing_vpc.name

  allow {{
    protocol = "{proto}"
    ports    = [{', '.join([f'"{p}"' for p in chunk_ports])}]
  }}

  # Permetti accesso da tutta la subnet backend
  source_ranges = ["{self.backend_subnet_cidr}"]
  target_tags   = ["{host_safe}"]
}}
"""
                            firewall_rules.append(fw_rule)
                
                # Crea l'istanza VM nella subnet backend esistente
                f.write(f"""
# VM per host {host} con ruolo {role}
resource "google_compute_instance" "{host_safe}" {{
  name         = "{host_safe}"
  machine_type = "{machine_type}"
  zone         = "{GCP_ZONE}"
  tags         = {str(tags + [host_safe]).replace("'", '"')}

  boot_disk {{
    initialize_params {{
      image = "{boot_disk_image}"
    }}
  }}

  network_interface {{
    # IMPORTANTE: Per VPC custom, specificare sia network che subnetwork
    network    = data.google_compute_network.existing_vpc.self_link
    subnetwork = data.google_compute_subnetwork.existing_backend_subnet.self_link
    
    # IMPORTANTE: Nessun access_config = nessun IP pubblico
    # Accesso internet tramite Cloud NAT configurato nell'infrastruttura principale
  }}

  metadata_startup_script = <<-EOT
{startup_script}
  EOT

  metadata = {{
    role = "{role}"
    original_ip = "{host}"
    created_by = "autonetgen"
    subnet = "{self.backend_subnet_name}"
    vpc = "{self.vpc_network_name}"
  }}

  # Etichette per identificazione e gestione
  labels = {{
    created-by = "autonetgen"
    role = "{role.lower().replace('_', '-')}"
    original-host = "{host.replace('.', '-')}"
  }}
}}
""")
                
                instance_counter += 1
            
            # Aggiungi VM personalizzata con specifiche richieste
            f.write(f"""
# === VM PERSONALIZZATA ===
# VM personalizzata con specifiche richieste nella subnet backend
resource "google_compute_instance" "custom_vm" {{
  name         = "autonetgen-custom-vm"
  machine_type = "c3-standard-4-lssd"
  zone         = "{GCP_ZONE}"
  tags         = ["autonetgen-generated", "ssh-access", "custom"]

  boot_disk {{
    initialize_params {{
      image = "debian-cloud/debian-11"
      size  = 50  # GB
    }}
  }}

  network_interface {{
    # IMPORTANTE: Per VPC custom, specificare sia network che subnetwork con self_link
    network    = data.google_compute_network.existing_vpc.self_link
    subnetwork = data.google_compute_subnetwork.existing_backend_subnet.self_link
    
    # Nessun IP pubblico - accesso tramite Cloud NAT
  }}

  metadata_startup_script = <<-EOT
    apt-get update
    apt-get install -y htop wget curl git python3-pip
    echo "VM personalizzata AutoNetGen configurata correttamente" > /var/log/autonetgen-setup.log
  EOT

  metadata = {{
    role = "CUSTOM"
    description = "VM personalizzata con specifiche richieste"
    created_by = "autonetgen"
    subnet = "{self.backend_subnet_name}"
    vpc = "{self.vpc_network_name}"
  }}

  labels = {{
    created-by = "autonetgen"
    role = "custom"
    type = "high-performance"
  }}
}}
""")
            
            # Aggiungi le regole firewall
            for rule in firewall_rules:
                f.write(rule)
        
        # Crea un file di output con la mappatura degli indirizzi IP
        outputs_file = os.path.join(output_dir, "outputs.tf")
        with open(outputs_file, 'w') as f:
            f.write(f"""
# === OUTPUT DELLA CONFIGURAZIONE AUTONETGEN ===

output "deployment_info" {{
  value = {{
    vpc_network = "{self.vpc_network_name}"
    backend_subnet = "{self.backend_subnet_name}"
    subnet_cidr = "{self.backend_subnet_cidr}"
    region = "{GCP_REGION}"
    zone = "{GCP_ZONE}"
    project_id = "{self.project_id}"
  }}
  description = "Informazioni sul deployment nella subnet backend"
}}

output "original_to_gcp_mapping" {{
  value = {{
""")
            
            for host in host_roles:
                host_safe = self.sanitize_tag_name(host)
                f.write(f'    "{host}" = "${{google_compute_instance.{host_safe}.network_interface[0].network_ip}}"\n')
            
            # Aggiungi anche la VM personalizzata all'output
            f.write('    "custom-vm" = "${google_compute_instance.custom_vm.network_interface[0].network_ip}"\n')
            
            f.write(f"""
  }}
  description = "Mappatura degli indirizzi IP originali agli indirizzi IP nella subnet backend {self.backend_subnet_name}"
}}

output "vm_details" {{
  value = {{
""")
            
            for host in host_roles:
                host_safe = self.sanitize_tag_name(host)
                f.write(f"""    "{host}" = {{
      name = "${{google_compute_instance.{host_safe}.name}}"
      internal_ip = "${{google_compute_instance.{host_safe}.network_interface[0].network_ip}}"
      machine_type = "${{google_compute_instance.{host_safe}.machine_type}}"
      zone = "${{google_compute_instance.{host_safe}.zone}}"
      status = "${{google_compute_instance.{host_safe}.current_status}}"
    }}
""")
            
            f.write(f"""    "custom-vm" = {{
      name = "${{google_compute_instance.custom_vm.name}}"
      internal_ip = "${{google_compute_instance.custom_vm.network_interface[0].network_ip}}"
      machine_type = "${{google_compute_instance.custom_vm.machine_type}}"
      zone = "${{google_compute_instance.custom_vm.zone}}"
      status = "${{google_compute_instance.custom_vm.current_status}}"
    }}
  }}
  description = "Dettagli completi delle VM create nella subnet backend"
}}

output "firewall_rules_created" {{
  value = [
""")
            
            # Lista delle regole firewall create
            fw_rules = ["allow-ssh-autonetgen-generated", "allow-internal-autonetgen-generated"]
            for host in host_roles:
                host_safe = self.sanitize_tag_name(host)
                # Aggiungi eventuali regole specifiche per questo host
                # (il numero dipende dalle porte utilizzate)
            
            for rule in fw_rules:
                f.write(f'    "{rule}",\n')
            
            f.write(f"""
  ]
  description = "Lista delle regole firewall create per le risorse AutoNetGen"
}}

output "network_configuration" {{
  value = {{
    vpc_network_self_link = data.google_compute_network.existing_vpc.self_link
    backend_subnet_self_link = data.google_compute_subnetwork.existing_backend_subnet.self_link
    subnet_gateway_address = data.google_compute_subnetwork.existing_backend_subnet.gateway_address
    subnet_ip_cidr_range = data.google_compute_subnetwork.existing_backend_subnet.ip_cidr_range
  }}
  description = "Configurazione di rete utilizzata per il deployment"
}}

# Output per debugging e monitoraggio
output "ssh_connection_examples" {{
  value = {{
""")
            
            for host in host_roles:
                host_safe = self.sanitize_tag_name(host)
                f.write(f'    "{host}" = "gcloud compute ssh {host_safe} --zone={GCP_ZONE} --project={self.project_id}"\n')
            
            f.write(f"""    "custom-vm" = "gcloud compute ssh autonetgen-custom-vm --zone={GCP_ZONE} --project={self.project_id}"
  }}
  description = "Comandi per connettersi alle VM create (richiede gcloud CLI configurato)"
}}
""")
        
        logger.info(f"Configurazione Terraform generata in {output_dir}")
        logger.info(f"Le VM saranno create nella subnet esistente: {self.backend_subnet_name} ({self.backend_subnet_cidr})")
        logger.info("Le VM non avranno IP pubblici - accesso tramite Cloud NAT")
        logger.info("IMPORTANTE: Usato self_link per network/subnetwork per evitare errori di riferimento")
        
        return output_dir