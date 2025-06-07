# variables.tf - Variabili per il modulo Terraform autonetgen

variable "project_id" {
  description = "ID del progetto Google Cloud Platform"
  type        = string
  
  validation {
    condition     = length(var.project_id) > 0
    error_message = "Il project_id non può essere vuoto."
  }
}

variable "region" {
  description = "Regione GCP per il deployment"
  type        = string
  default     = "europe-west1"
  
  validation {
    condition = contains([
      "europe-west1", "europe-west3", "europe-west4",
      "us-central1", "us-east1", "us-west1",
      "asia-east1", "asia-southeast1"
    ], var.region)
    error_message = "Seleziona una regione supportata per Cloud Run."
  }
}

variable "frontend_image_url" {
  description = "URL completo dell'immagine Docker per il frontend"
  type        = string
  default     = "gcr.io/PROJECT_ID/autonetgen-frontend:latest"
  
  validation {
    condition     = can(regex("^gcr\\.io/.+|^.*\\.pkg\\.dev/.+", var.frontend_image_url))
    error_message = "L'URL dell'immagine deve essere un repository GCR o Artifact Registry valido."
  }
}

variable "backend_image_url" {
  description = "URL completo dell'immagine Docker per il backend"
  type        = string
  default     = "gcr.io/PROJECT_ID/autonetgen-backend:latest"
  
  validation {
    condition     = can(regex("^gcr\\.io/.+|^.*\\.pkg\\.dev/.+", var.backend_image_url))
    error_message = "L'URL dell'immagine deve essere un repository GCR o Artifact Registry valido."
  }
}

variable "environment" {
  description = "Ambiente di deployment (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "L'ambiente deve essere: dev, staging, o prod."
  }
}

variable "enable_monitoring" {
  description = "Abilita il monitoring avanzato (comporta costi aggiuntivi)"
  type        = bool
  default     = false
}

variable "max_instances" {
  description = "Numero massimo di istanze Cloud Run (per controllare i costi)"
  type        = number
  default     = 3
  
  validation {
    condition     = var.max_instances >= 1 && var.max_instances <= 10
    error_message = "Il numero massimo di istanze deve essere tra 1 e 10."
  }
}

variable "cpu_limit" {
  description = "Limite CPU per i container (formato: '1', '0.5', etc.)"
  type        = string
  default     = "1"
  
  validation {
    condition = contains(["0.25", "0.5", "1", "2"], var.cpu_limit)
    error_message = "I valori CPU supportati sono: 0.25, 0.5, 1, 2."
  }
}

variable "memory_limit" {
  description = "Limite memoria per i container (formato: '512Mi', '1Gi', etc.)"
  type        = string
  default     = "1Gi"
  
  validation {
    condition = contains(["256Mi", "512Mi", "1Gi", "2Gi", "4Gi"], var.memory_limit)
    error_message = "I valori memoria supportati sono: 256Mi, 512Mi, 1Gi, 2Gi, 4Gi."
  }
}

variable "storage_retention_days" {
  description = "Numero di giorni per mantenere i file nel bucket (per controllare i costi)"
  type        = number
  default     = 30
  
  validation {
    condition     = var.storage_retention_days >= 1 && var.storage_retention_days <= 365
    error_message = "La retention deve essere tra 1 e 365 giorni."
  }
}

variable "domain_name" {
  description = "Nome di dominio personalizzato per il frontend (opzionale)"
  type        = string
  default     = ""
}

variable "enable_https_redirect" {
  description = "Forza il redirect HTTPS (raccomandato per produzione)"
  type        = bool
  default     = true
}

variable "cors_origins" {
  description = "Lista di origini permesse per CORS"
  type        = list(string)
  default     = ["*"]
}

variable "labels" {
  description = "Labels da applicare a tutte le risorse"
  type        = map(string)
  default = {
    project     = "autonetgen"
    managed_by  = "terraform"
    cost_center = "development"
  }
}