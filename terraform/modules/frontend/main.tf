# Modulo per il frontend
# Gestisce il servizio Cloud Run del frontend, static content, CDN e load balancer

# Variabili del modulo frontend
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

variable "frontend_subnet_id" {
  description = "ID della subnet frontend"
  type        = string
}

variable "service_name" {
  description = "Nome del servizio Cloud Run"
  type        = string
}

variable "container_image" {
  description = "Immagine container del frontend"
  type        = string
}

variable "backend_service_url" {
  description = "URL del servizio backend"
  type        = string
}

# Bucket per i file statici
resource "google_storage_bucket" "static_content" {
  name          = "${var.project_id}-static-content"
  location      = var.region
  force_destroy = true
  
  uniform_bucket_level_access = true
  
  website {
    main_page_suffix = "index.html"
    not_found_page   = "404.html"
  }
  
  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# Rendi il bucket accessibile pubblicamente
resource "google_storage_bucket_iam_member" "public_access" {
  bucket = google_storage_bucket.static_content.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# Account di servizio per il frontend Cloud Run
resource "google_service_account" "frontend_service_account" {
  account_id   = "frontend-service-account"
  display_name = "Frontend Service Account"
  description  = "Account di servizio per il frontend Cloud Run"
}

# Permessi per l'account di servizio
resource "google_project_iam_member" "frontend_sa_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/storage.objectViewer",
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.frontend_service_account.email}"
}

# Servizio Cloud Run per il frontend
resource "google_cloud_run_service" "frontend" {
  name     = var.service_name
  location = var.region
  
  template {
    spec {
      containers {
        image = var.container_image
        
        env {
          name  = "BACKEND_API_URL"
          value = var.backend_service_url
        }
        
        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
      }
      
      service_account_name = google_service_account.frontend_service_account.email
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale"        = "1"
        "autoscaling.knative.dev/maxScale"        = "10"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.connector.name
        "run.googleapis.com/vpc-access-egress"    = "private-ranges-only"
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  autogenerate_revision_name = true
  
  depends_on = [
    google_project_iam_member.frontend_sa_roles
  ]
}

# VPC Connector per permettere a Cloud Run di accedere alla VPC
resource "google_vpc_access_connector" "connector" {
  name          = "vpc-connector"
  region        = var.region
  ip_cidr_range = "10.8.0.0/28"
  network       = var.network_id
}

# Rendi il servizio Cloud Run accessibile pubblicamente
resource "google_cloud_run_service_iam_member" "run_all_users" {
  service  = google_cloud_run_service.frontend.name
  location = google_cloud_run_service.frontend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# NEG (Network Endpoint Group) per il servizio Cloud Run
resource "google_compute_region_network_endpoint_group" "frontend_neg" {
  name                  = "frontend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  
  cloud_run {
    service = google_cloud_run_service.frontend.name
  }
}

# Collega il NEG al backend service del load balancer
resource "google_compute_backend_service" "frontend_backend_service" {
  name        = "frontend-backend-service"
  port_name   = "http"
  protocol    = "HTTP"
  timeout_sec = 30
  
  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg.self_link
  }
  
  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

# Cloud CDN per servire i contenuti statici
resource "google_compute_backend_bucket" "static_backend" {
  name        = "static-backend-bucket"
  bucket_name = google_storage_bucket.static_content.name
  enable_cdn  = true
  
  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    client_ttl        = 3600
    default_ttl       = 3600
    max_ttl           = 86400
    negative_caching  = true
  }
}