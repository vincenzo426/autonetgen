# terraform.tfvars.example
# Copia questo file in terraform.tfvars e personalizza i valori

# === CONFIGURAZIONE OBBLIGATORIA ===
# ID del tuo progetto Google Cloud Platform
project_id = "gruppo-10"

# === CONFIGURAZIONE IMMAGINI DOCKER ===
# Personalizza questi URL dopo aver costruito e caricato le immagini
# Formato: gcr.io/PROJECT_ID/IMAGE_NAME:TAG
frontend_image_url = "gcr.io/gruppo-10/autonetgen-frontend:latest"
backend_image_url  = "gcr.io/gruppo-10/autonetgen-backend:latest"

# === CONFIGURAZIONE REGIONALE ===
# Scegli la regione più vicina per ridurre latenza e costi
region = "europe-west1"  # Amsterdam (economica per Europa)
# region = "us-central1"  # Iowa (economica per USA)

# === CONFIGURAZIONE AMBIENTE ===
environment = "dev"  # dev, staging, prod

# === CONFIGURAZIONE RISORSE (ECONOMICA) ===
# Configurazione economica per development/testing
max_instances = 2
cpu_limit     = "1"
memory_limit  = "1Gi"

# === CONFIGURAZIONE STORAGE ===
# Cancella automaticamente i file dopo X giorni per controllare i costi
storage_retention_days = 30

# === CONFIGURAZIONE SICUREZZA ===
enable_https_redirect = true
cors_origins = ["*"]  # In produzione, specificare domini specifici

# === CONFIGURAZIONE MONITORING ===
# Disabilitato per default per ridurre i costi
enable_monitoring = false

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