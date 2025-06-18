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
    condition = contains(["0.25", "0.5", "1", "2", "4", "8", "10"], var.cpu_limit)
    error_message = "I valori CPU supportati sono: 0.25, 0.5, 1, 2."
  }
}

variable "memory_limit" {
  description = "Limite memoria per i container (formato: '512Mi', '1Gi', etc.)"
  type        = string
  default     = "1Gi"
  
  validation {
    condition = contains(["256Mi", "512Mi", "1Gi", "2Gi", "4Gi", "8Gi", "16Gi"], var.memory_limit)
    error_message = "I valori memoria supportati sono: 256Mi, 512Mi, 1Gi, 2Gi, 4Gi."
  }
}

variable "storage_retention_days" {
  description = "Giorni di retention per i file nel bucket"
  type        = number
  default     = 30
  
  validation {
    condition     = var.storage_retention_days >= 1 && var.storage_retention_days <= 365
    error_message = "I giorni di retention devono essere tra 1 e 365."
  }
}

variable "enable_https_redirect" {
  description = "Abilita il redirect automatico da HTTP a HTTPS"
  type        = bool
  default     = true
}

variable "cors_origins" {
  description = "Origini CORS consentite per il bucket storage"
  type        = list(string)
  default     = ["*"]
}

variable "labels" {
  description = "Labels da applicare alle risorse"
  type        = map(string)
  default = {
    project     = "autonetgen"
    managed_by  = "terraform"
  }
}

# === VARIABILI PER CONTROLLO ACCESSO ===

variable "enable_public_access" {
  description = "Abilita l'accesso pubblico al frontend (per utenti autenticati Google)"
  type        = bool
  default     = true
}

variable "authorized_domains" {
  description = "Domini autorizzati ad accedere al frontend (es: ['example.com', 'company.org'])"
  type        = list(string)
  default     = []
  
  validation {
    condition = alltrue([
      for domain in var.authorized_domains : can(regex("^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", domain))
    ])
    error_message = "Tutti i domini devono essere nel formato valido (es: example.com)."
  }
}

variable "authorized_users" {
  description = "Lista di utenti/gruppi autorizzati (es: ['user:nome@gmail.com', 'group:team@company.com'])"
  type        = list(string)
  default     = []
  
  validation {
    condition = alltrue([
      for user in var.authorized_users : can(regex("^(user:|group:|serviceAccount:).+", user))
    ])
    error_message = "Gli utenti devono essere nel formato: user:email@domain.com, group:group@domain.com, o serviceAccount:account@project.iam.gserviceaccount.com"
  }
}

variable "domain_name" {
  description = "Nome dominio personalizzato (opzionale)"
  type        = string
  default     = ""
}

# === NUOVE VARIABILI PER VPC E LOAD BALANCER ===

variable "enable_load_balancer" {
  description = "Abilita il Load Balancer HTTPS globale"
  type        = bool
  default     = false
}

variable "load_balancer_domain" {
  description = "Dominio per il Load Balancer (richiesto per SSL). Es: autonetgen.example.com"
  type        = string
  default     = ""
  
  validation {
    condition = var.load_balancer_domain == "" || can(regex("^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.load_balancer_domain))
    error_message = "Il dominio deve essere nel formato valido (es: autonetgen.example.com) o vuoto."
  }
}

variable "use_load_balancer" {
  description = "Se true, il frontend userà il load balancer per le chiamate API"
  type        = bool
  default     = false
}

variable "vpc_cidr_range" {
  description = "Range CIDR per la VPC principale"
  type        = string
  default     = "10.0.0.0/16"
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr_range, 0))
    error_message = "Il vpc_cidr_range deve essere un range CIDR valido."
  }
}

variable "frontend_subnet_cidr" {
  description = "Range CIDR per la subnet del frontend"
  type        = string
  default     = "10.1.0.0/24"
  
  validation {
    condition     = can(cidrhost(var.frontend_subnet_cidr, 0))
    error_message = "Il frontend_subnet_cidr deve essere un range CIDR valido."
  }
}

variable "backend_subnet_cidr" {
  description = "Range CIDR per la subnet del backend"
  type        = string
  default     = "10.2.0.0/24"
  
  validation {
    condition     = can(cidrhost(var.backend_subnet_cidr, 0))
    error_message = "Il backend_subnet_cidr deve essere un range CIDR valido."
  }
}

variable "vpc_connector_cidr" {
  description = "Range CIDR per il VPC connector (deve essere /28)"
  type        = string
  default     = "10.8.0.0/28"
  
  validation {
    condition     = can(regex("^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}/28$", var.vpc_connector_cidr))
    error_message = "Il VPC connector deve usare una subnet /28."
  }
}

variable "enable_vpc_flow_logs" {
  description = "Abilita i flow logs per la VPC (utile per debugging ma comporta costi)"
  type        = bool
  default     = false
}

variable "nat_log_filter" {
  description = "Filtro per i log del Cloud NAT (ERRORS_ONLY, TRANSLATIONS_ONLY, ALL)"
  type        = string
  default     = "ERRORS_ONLY"
  
  validation {
    condition     = contains(["ERRORS_ONLY", "TRANSLATIONS_ONLY", "ALL"], var.nat_log_filter)
    error_message = "Il filtro deve essere: ERRORS_ONLY, TRANSLATIONS_ONLY, o ALL."
  }
}

variable "vpc_connector_min_throughput" {
  description = "Throughput minimo per il VPC connector (200-1000 Mbps)"
  type        = number
  default     = 200
  
  validation {
    condition     = var.vpc_connector_min_throughput >= 200 && var.vpc_connector_min_throughput <= 1000
    error_message = "Il throughput minimo deve essere tra 200 e 1000 Mbps."
  }
}

variable "vpc_connector_max_throughput" {
  description = "Throughput massimo per il VPC connector (300-1000 Mbps)"
  type        = number
  default     = 300
  
  validation {
    condition     = var.vpc_connector_max_throughput >= 300 && var.vpc_connector_max_throughput <= 1000
    error_message = "Il throughput massimo deve essere tra 300 e 1000 Mbps."
  }
}