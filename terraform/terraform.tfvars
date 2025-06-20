# terraform.tfvars - Configurazione personalizzata per AutoNetGen

# === CONFIGURAZIONE OBBLIGATORIA ===
# ID del tuo progetto Google Cloud Platform
project_id = "gruppo-10"

# === CONFIGURAZIONE IMMAGINI DOCKER ===
# Personalizza questi URL dopo aver costruito e caricato le immagini
frontend_image_url = "gcr.io/gruppo-10/autonetgen-frontend:latest"
backend_image_url  = "gcr.io/gruppo-10/autonetgen-backend:latest"

# === CONFIGURAZIONE REGIONALE ===
region = "us-central1"  # Amsterdam (economica per Europa)

# === CONFIGURAZIONE AMBIENTE ===
environment = "dev"

# === CONFIGURAZIONE RISORSE (ECONOMICA) ===
cpu_limit     = "8"      # Era "1"
memory_limit  = "16Gi"   # Era "1Gi"  
max_instances = 5        # Era 2

# === CONFIGURAZIONE STORAGE ===
storage_retention_days = 30

# === CONFIGURAZIONE SICUREZZA ===
enable_https_redirect = true
cors_origins = ["*"]

# === CONFIGURAZIONE MONITORING ===
enable_monitoring = false

# === CONTROLLO ACCESSO FRONTEND ===
# OPZIONE 1: Accesso per utenti con account Google (RACCOMANDATO)
enable_public_access = true

# OPZIONE 2: Accesso limitato a domini specifici (decommentare se necessario)
# authorized_domains = ["tuazienda.com", "università.edu"]

# OPZIONE 3: Accesso limitato a utenti specifici (decommentare se necessario)
authorized_users = [
  "serviceAccount:autonetgen-frontend@gruppo-10.iam.gserviceaccount.com",
]

# === CONFIGURAZIONE DOMINIO (OPZIONALE) ===
# domain_name = "autonetgen.tuodominio.com"

# === CONFIGURAZIONE VPC E LOAD BALANCER ===

# Abilita Load Balancer HTTPS globale
enable_load_balancer = true  # Cambia a true per abilitare

# Dominio per Load Balancer (obbligatorio se abiliti Load Balancer con SSL)
# IMPORTANTE: Prima di abilitare, assicurati che il dominio punti all'IP del Load Balancer
load_balancer_domain = ""  # Es: "autonetgen.example.com"

# Se true, il frontend userà il load balancer per le chiamate API
use_load_balancer = true  # Cambia a true se abiliti il Load Balancer

# === CONFIGURAZIONE NETWORKING ===

# Configurazione CIDR per VPC principale
vpc_cidr_range = "10.0.0.0/16"

# Subnet del backend - UNICA SUBNET dove vengono create tutte le risorse
# Le VM e altri componenti generati dal backend saranno posizionati qui
backend_subnet_cidr = "10.2.0.0/24"

# VPC Connector per collegare solo il backend Cloud Run alla VPC
# Il frontend rimane in modalità standard Cloud Run (senza VPC)
vpc_connector_cidr = "10.8.0.0/28"

# Configurazione VPC Connector (throughput in Mbps)
vpc_connector_min_throughput = 200
vpc_connector_max_throughput = 300

# === CONFIGURAZIONE AVANZATA NETWORKING ===

# Abilita flow logs per debugging (comporta costi aggiuntivi)
enable_vpc_flow_logs = false

# Filtro log Cloud NAT (ERRORS_ONLY per costi ridotti)
nat_log_filter = "ERRORS_ONLY"  # ERRORS_ONLY, TRANSLATIONS_ONLY, ALL

# === LABELS PER GESTIONE RISORSE ===
labels = {
  project     = "autonetgen"
  environment = "dev"
  managed_by  = "terraform"
  team        = "network-team"
  cost_center = "development"
}