# Modulo per il backend
# Gestisce i servizi Cloud Run del backend, job orchestration e network analyzer

# Variabili del modulo backend
variable "project_id" {
  description = "ID del progetto GCP"
  type        = string
}

variable "region" {
  description = "Regione di deployment"
  type        = string
}

variable "network_id" {
  description = "ID della rete VPC"
  type        = string
}

variable "backend_subnet_id" {
  description = "ID della subnet backend"
  type        = string
}

variable "service_name" {
  description = "Nome del servizio Cloud Run"
  type        = string
}

variable "container_image" {
  description = "Immagine container del backend"
  type        = string
}

variable "job_service_account" {
  description = "ID dell'account di servizio per i job"
  type        = string
}

variable "database_connection" {
  description = "Nome della connessione al database"
  type        = string
}

variable "database_user" {
  description = "Nome utente del database"
  type        = string
}

variable "database_password" {
  description = "Password del database"
  type        = string
  sensitive   = true
}

variable "database_name" {
  description = "Nome del database"
  type        = string
}

# Bucket per i file di input/output dei job
resource "google_storage_bucket" "job_data" {
  name          = "${var.project_id}-job-data"
  location      = var.region
  force_destroy = true
  
  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

# Account di servizio per il backend
resource "google_service_account" "backend_service_account" {
  account_id   = "backend-service-account"
  display_name = "Backend Service Account"
  description  = "Account di servizio per il backend Cloud Run"
}

# Permessi per l'account di servizio del backend
resource "google_project_iam_member" "backend_sa_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/storage.objectAdmin",
    "roles/cloudsql.client",
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.backend_service_account.email}"
}

# Account di servizio per i job
resource "google_service_account" "job_service_account" {
  account_id   = var.job_service_account
  display_name = "Job Service Account"
  description  = "Account di servizio per i job di Network Analyzer"
}

# Permessi per l'account di servizio dei job
resource "google_project_iam_member" "job_sa_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/storage.objectAdmin",
    "roles/cloudsql.client",
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.job_service_account.email}"
}

# Secret per le credenziali del database
resource "google_secret_manager_secret" "db_credentials" {
  secret_id = "db-credentials"
  
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "db_credentials_version" {
  secret      = google_secret_manager_secret.db_credentials.id
  secret_data = jsonencode({
    username = var.database_user
    password = var.database_password
    database = var.database_name
    connection = var.database_connection
  })
}

# Permessi per l'accesso al secret
resource "google_secret_manager_secret_iam_member" "backend_secret_access" {
  secret_id = google_secret_manager_secret.db_credentials.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_service_account.email}"
}

resource "google_secret_manager_secret_iam_member" "job_secret_access" {
  secret_id = google_secret_manager_secret.db_credentials.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.job_service_account.email}"
}

# VPC Connector per permettere a Cloud Run di accedere alla VPC
resource "google_vpc_access_connector" "backend_connector" {
  name          = "backend-vpc-connector"
  region        = var.region
  ip_cidr_range = "10.9.0.0/28"
  network       = var.network_id
}

# Servizio Cloud Run per l'API del backend
resource "google_cloud_run_service" "backend_api" {
  name     = var.service_name
  location = var.region
  
  template {
    spec {
      containers {
        image = var.container_image
        
        env {
          name  = "DB_SECRET_ID"
          value = google_secret_manager_secret.db_credentials.id
        }
        
        env {
          name  = "JOB_BUCKET"
          value = google_storage_bucket.job_data.name
        }
        
        env {
          name  = "PROJECT_ID"
          value = var.project_id
        }
        
        resources {
          limits = {
            cpu    = "2000m"
            memory = "2Gi"
          }
        }
      }
      
      service_account_name = google_service_account.backend_service_account.email
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale"        = "1"
        "autoscaling.knative.dev/maxScale"        = "10"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.backend_connector.name
        "run.googleapis.com/vpc-access-egress"    = "private-ranges-only"
        "run.googleapis.com/cloudsql-instances"   = var.database_connection
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  autogenerate_revision_name = true
  
  depends_on = [
    google_project_iam_member.backend_sa_roles,
    google_secret_manager_secret_iam_member.backend_secret_access
  ]
}

# Servizio Cloud Run per il Network Analyzer
resource "google_cloud_run_service" "network_analyzer" {
  name     = "network-analyzer"
  location = var.region
  
  template {
    spec {
      containers {
        image = "${var.container_image}-analyzer" # Versione dell'immagine per Network Analyzer
        
        env {
          name  = "DB_SECRET_ID"
          value = google_secret_manager_secret.db_credentials.id
        }
        
        env {
          name  = "JOB_BUCKET"
          value = google_storage_bucket.job_data.name
        }
        
        env {
          name  = "API_SERVICE_URL"
          value = google_cloud_run_service.backend_api.status[0].url
        }
        
        resources {
          limits = {
            cpu    = "4000m"
            memory = "4Gi"
          }
        }
      }
      
      service_account_name = google_service_account.backend_service_account.email
      timeout_seconds      = 900 # 15 minuti
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale"        = "0"
        "autoscaling.knative.dev/maxScale"        = "5"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.backend_connector.name
        "run.googleapis.com/vpc-access-egress"    = "private-ranges-only"
        "run.googleapis.com/cloudsql-instances"   = var.database_connection
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  autogenerate_revision_name = true
  
  depends_on = [
    google_project_iam_member.backend_sa_roles,
    google_secret_manager_secret_iam_member.backend_secret_access
  ]
}

# Rendi il servizio API accessibile privatamente (solo dalla VPC)
resource "google_cloud_run_service_iam_member" "backend_api_access" {
  service  = google_cloud_run_service.backend_api.name
  location = google_cloud_run_service.backend_api.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.backend_service_account.email}"
}

# Rendi il servizio Network Analyzer accessibile privatamente
resource "google_cloud_run_service_iam_member" "network_analyzer_access" {
  service  = google_cloud_run_service.network_analyzer.name
  location = google_cloud_run_service.network_analyzer.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.backend_service_account.email}"
}

# NEG (Network Endpoint Group) per il servizio Backend
resource "google_compute_region_network_endpoint_group" "backend_neg" {
  name                  = "backend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  
  cloud_run {
    service = google_cloud_run_service.backend_api.name
  }
}

# NEG (Network Endpoint Group) per il servizio Network Analyzer
resource "google_compute_region_network_endpoint_group" "analyzer_neg" {
  name                  = "analyzer-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  
  cloud_run {
    service = google_cloud_run_service.network_analyzer.name
  }
}

# Scheduler per l'orchestrazione dei job
resource "google_cloud_scheduler_job" "cleanup_job" {
  name             = "job-cleanup"
  description      = "Pulizia di job e dati obsoleti"
  schedule         = "0 0 * * *"  # Ogni giorno a mezzanotte
  time_zone        = "Europe/Rome"
  attempt_deadline = "600s"
  
  retry_config {
    retry_count          = 3
    max_retry_duration   = "600s"
    min_backoff_duration = "60s"
    max_backoff_duration = "300s"
    max_doublings        = 3
  }
  
  http_target {
    uri         = "${google_cloud_run_service.backend_api.status[0].url}/api/jobs/cleanup"
    http_method = "POST"
    
    oidc_token {
      service_account_email = google_service_account.job_service_account.email
    }
  }
}

# Redis Memorystore per caching
resource "google_redis_instance" "cache" {
  name           = "backend-cache"
  tier           = "BASIC"
  memory_size_gb = 1
  
  region                  = var.region
  location_id             = "${var.region}-a"
  alternative_location_id = "${var.region}-c"
  
  authorized_network = var.network_id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  
  redis_version     = "REDIS_6_X"
  display_name      = "Backend Cache"
  reserved_ip_range = "10.10.0.0/29"
}