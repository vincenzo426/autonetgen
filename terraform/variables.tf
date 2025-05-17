# Variabili di progetto
variable "project_id" {
  description = "ID del progetto GCP"
  type        = string
}

variable "region" {
  description = "Regione predefinita per le risorse"
  type        = string
  default     = "us-central1"
}

variable "zones" {
  description = "Zone disponibili nella regione primaria"
  type        = list(string)
  default     = ["us-central1-a", "us-central1-b", "us-central1-c"]
}

variable "secondary_region" {
  description = "Regione secondaria per il disaster recovery"
  type        = string
  default     = "us-west1"
}

variable "secondary_zones" {
  description = "Zone disponibili nella regione secondaria"
  type        = list(string)
  default     = ["us-west1-a", "us-west1-b"]
}

# Variabili di rete
variable "network_name" {
  description = "Nome della rete VPC"
  type        = string
  default     = "autonetgen-vpc"
}

variable "subnet_cidr_ranges" {
  description = "Ranges CIDR per le subnet"
  type        = map(string)
  default = {
    "frontend" = "10.0.1.0/24"
    "backend"  = "10.0.2.0/24"
    "database" = "10.0.3.0/24"
  }
}

# Variabili per il frontend
variable "frontend_service_name" {
  description = "Nome del servizio Cloud Run per il frontend"
  type        = string
  default     = "autonetgen-frontend"
}

variable "frontend_container_image" {
  description = "Immagine container per il frontend"
  type        = string
  default     = "gcr.io/PROJECT_ID/autonetgen-frontend:latest"
}

# Variabili per il backend
variable "backend_service_name" {
  description = "Nome del servizio Cloud Run per il backend"
  type        = string
  default     = "autonetgen-backend"
}

variable "backend_container_image" {
  description = "Immagine container per il backend"
  type        = string
  default     = "gcr.io/PROJECT_ID/autonetgen-backend:latest"
}

variable "job_service_account_id" {
  description = "ID dell'account di servizio per i job"
  type        = string
  default     = "autonetgen-job-sa"
}

# Variabili per il database
variable "db_tier" {
  description = "Tier dell'istanza Cloud SQL"
  type        = string
  default     = "db-custom-2-4096"
}

variable "db_name" {
  description = "Nome del database PostgreSQL"
  type        = string
  default     = "autonetgen_db"
}

variable "db_user" {
  description = "Nome utente per il database"
  type        = string
  default     = "autonetgen_user"
}

variable "db_password" {
  description = "Password per il database (da non memorizzare nel codice)"
  type        = string
  sensitive   = true
}

# Variabili per il monitoring
variable "enable_monitoring" {
  description = "Abilita il monitoraggio avanzato"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Giorni di conservazione dei log"
  type        = number
  default     = 30
}