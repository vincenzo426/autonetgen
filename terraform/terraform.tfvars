# terraform.tfvars - Configurazione personalizzata per AutoNetGen

# === CONFIGURAZIONE OBBLIGATORIA ===
# ID del tuo progetto Google Cloud Platform
project_id = "gruppo-10"

# === CONFIGURAZIONE IMMAGINI DOCKER ===
# Personalizza questi URL dopo aver costruito e caricato le immagini
frontend_image_url = "gcr.io/gruppo-10/autonetgen-frontend:latest"
backend_image_url  = "gcr.io/gruppo-10/autonetgen-backend:latest"

# === CONFIGURAZIONE REGIONALE ===
region = "europe-west1"  # Amsterdam (economica per Europa)

# === CONFIGURAZIONE AMBIENTE ===
environment = "dev"

# === CONFIGURAZIONE RISORSE (ECONOMICA) ===
cpu_limit     = "8"      # Era "1"
memory_limit  = "16Gi"    # Era "1Gi"  
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

# === LABELS PER GESTIONE RISORSE ===
labels = {
  project     = "autonetgen"
  environment = "dev"
  managed_by  = "terraform"
  team        = "network-team"
  cost_center = "development"
}