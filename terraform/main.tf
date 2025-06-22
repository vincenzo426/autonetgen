# main.tf - Configurazione principale per autonetgen su Google Cloud Platform

# Abilita le API necessarie
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "storage-api.googleapis.com",
    "storage-component.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "compute.googleapis.com",      # API Compute Engine per VPC, VM, firewall
    "vpcaccess.googleapis.com",    # API VPC Access per Cloud Run
    "servicenetworking.googleapis.com"  # API Service Networking
  ])
  
  service = each.value
  
  disable_dependent_services = false
}

# === CONFIGURAZIONE VPC E RETE ===

# VPC principale
resource "google_compute_network" "autonetgen_vpc" {
  name                    = "autonetgen-vpc"
  auto_create_subnetworks = false
  description            = "VPC per AutoNetGen"

  depends_on = [google_project_service.required_apis]
}

# Subnet per il backend (unica subnet)
resource "google_compute_subnetwork" "backend_subnet" {
  name          = "autonetgen-backend-subnet"
  ip_cidr_range = var.backend_subnet_cidr
  region        = var.region
  network       = google_compute_network.autonetgen_vpc.id
  description   = "Subnet per il backend AutoNetGen e risorse generate"

  # Configurazione per servizi Google
  private_ip_google_access = true
}

# Cloud Router per NAT Gateway
resource "google_compute_router" "autonetgen_router" {
  name    = "autonetgen-router"
  region  = var.region
  network = google_compute_network.autonetgen_vpc.id
  
  description = "Router per AutoNetGen VPC"
}

# Cloud NAT per accesso internet dalle subnet private
resource "google_compute_router_nat" "autonetgen_nat" {
  name   = "autonetgen-nat"
  router = google_compute_router.autonetgen_router.name
  region = google_compute_router.autonetgen_router.region

  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = var.nat_log_filter
  }
}

# VPC Connector per Cloud Run Backend
resource "google_vpc_access_connector" "autonetgen_connector" {
  name          = "autonetgen-connector"
  region        = var.region
  network       = google_compute_network.autonetgen_vpc.name
  ip_cidr_range = var.vpc_connector_cidr
  
  min_throughput = var.vpc_connector_min_throughput
  max_throughput = var.vpc_connector_max_throughput

  depends_on = [google_project_service.required_apis]
}

# Firewall rule per permettere health check del load balancer
resource "google_compute_firewall" "allow_lb_health_check" {
  name    = "autonetgen-allow-lb-health-check"
  network = google_compute_network.autonetgen_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["8080"]
  }

  # IP ranges per Google Load Balancer health checks
  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
  target_tags   = ["autonetgen-backend"]
}

# Firewall rule per comunicazione interna nella subnet backend
resource "google_compute_firewall" "allow_internal_backend" {
  name    = "autonetgen-allow-internal-backend"
  network = google_compute_network.autonetgen_vpc.name

  allow {
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  allow {
    protocol = "icmp"
  }

  # Permettere comunicazione interna nella subnet backend
  source_ranges = [var.backend_subnet_cidr]
  target_tags   = ["autonetgen-backend", "autonetgen-generated"]
}

# === PERMESSI AGGIUNTIVI PER TERRAFORM DEPLOYMENT SUL BACKEND ===

# Permessi aggiuntivi per il service account backend per deployment Terraform
resource "google_project_iam_member" "backend_terraform_permissions" {
  for_each = toset([
    "roles/run.admin",                    # Gestione completa Cloud Run
    "roles/iam.serviceAccountAdmin",      # Creazione e gestione service account
    "roles/iam.serviceAccountKeyAdmin",   # Gestione chiavi service account
    "roles/resourcemanager.projectIamAdmin", # Gestione IAM a livello progetto
    "roles/serviceusage.serviceUsageAdmin",  # Abilitazione/disabilitazione API
    "roles/cloudbuild.builds.editor",     # Se si usa Cloud Build per CI/CD
    "roles/logging.admin",                # Gestione logging
    "roles/monitoring.admin",             # Gestione monitoring
    "roles/compute.admin"                 # Gestione completa Compute Engine (VPC, VM, firewall)
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.autonetgen_sa.email}"
  
  depends_on = [google_service_account.autonetgen_sa]
}

# Permesso per il service account backend di gestire altri service account
resource "google_service_account_iam_member" "backend_sa_iam_admin" {
  service_account_id = google_service_account.autonetgen_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.autonetgen_sa.email}"
}

# === FINE CONFIGURAZIONE TERRAFORM DEPLOYMENT ===

# Cloud Storage bucket per file uploads e risultati
resource "google_storage_bucket" "autonetgen_storage" {
  name     = "${var.project_id}-autonetgen-storage"
  location = var.region

  force_destroy = true  # Elimina contenuto automaticamente
  
  # Configurazione economica
  storage_class = "STANDARD"
  
  # Gestione del lifecycle per ridurre i costi
  lifecycle_rule {
    condition {
      age = var.storage_retention_days
    }
    action {
      type = "Delete"
    }
  }
  
  # CORS per permettere uploads dal frontend
  cors {
    origin          = var.cors_origins
    method          = ["GET", "POST", "PUT", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
  
  uniform_bucket_level_access = true
  
  depends_on = [google_project_service.required_apis]
}

# Service Account per Cloud Run Backend
resource "google_service_account" "autonetgen_sa" {
  account_id   = "autonetgen-service"
  display_name = "AutoNetGen Service Account"
  description  = "Service account per l'applicazione AutoNetGen"
}

# Permessi per il service account per accedere al bucket
resource "google_storage_bucket_iam_member" "autonetgen_sa_storage" {
  bucket = google_storage_bucket.autonetgen_storage.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.autonetgen_sa.email}"
}

# === GESTIONE SICURA DELLE CREDENZIALI ===

# Genera una chiave per il service account
resource "google_service_account_key" "autonetgen_sa_key" {
  service_account_id = google_service_account.autonetgen_sa.name
  
  # La chiave viene generata in formato JSON
  public_key_type = "TYPE_X509_PEM_FILE"
}

# Cloud Run service per il backend (PRIVATO - con VPC)
resource "google_cloud_run_service" "backend" {
  name     = "autonetgen-backend"
  location = var.region
  
  template {
    spec {
      service_account_name = google_service_account.autonetgen_sa.email
      # Configurazione economica
      container_concurrency = 10

      timeout_seconds = 360

      containers {
        image = var.backend_image_url
        
        ports {
          container_port = 8080
        }
        
        env {
          name  = "GOOGLE_CLOUD_PROJECT"
          value = var.project_id
        }
        
        env {
          name  = "STORAGE_BUCKET"
          value = google_storage_bucket.autonetgen_storage.name
        }
        
        env {
          name  = "PYTHONUNBUFFERED"
          value = "1"
        }

        # Variabili per le risorse di rete generate
        env {
          name  = "BACKEND_SUBNET_NAME"
          value = google_compute_subnetwork.backend_subnet.name
        }
        
        env {
          name  = "BACKEND_SUBNET_CIDR"
          value = google_compute_subnetwork.backend_subnet.ip_cidr_range
        }
        
        env {
          name  = "VPC_NETWORK_NAME"
          value = google_compute_network.autonetgen_vpc.name
        }

        # Chiave del service account direttamente come variabile di ambiente
        env {
          name  = "GOOGLE_APPLICATION_CREDENTIALS_JSON"
          value = base64decode(google_service_account_key.autonetgen_sa_key.private_key)
        }
        
        # Configurazione risorse
        resources {
          limits = {
            cpu    = var.cpu_limit
            memory = var.memory_limit
          }
          requests = {
            cpu    = var.cpu_limit
            memory = var.memory_limit
          }
        }
        
        # Startup probe per evitare timeout
        startup_probe {
          http_get {
            path = "/api/health"
            port = 8080
          }
          initial_delay_seconds = 10
          timeout_seconds       = 1
          period_seconds        = 3
          failure_threshold     = 5
        }
        
        # Liveness probe
        liveness_probe {
          http_get {
            path = "/api/health"
            port = 8080
          }
          initial_delay_seconds = 30
          timeout_seconds       = 1
          period_seconds        = 10
          failure_threshold     = 3
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale"         = "0"
        "autoscaling.knative.dev/maxScale"         = tostring(var.max_instances)
        "run.googleapis.com/execution-environment" = "gen2"
        "run.googleapis.com/startup-cpu-boost"     = "true"
        "run.googleapis.com/vpc-access-connector"  = google_vpc_access_connector.autonetgen_connector.id
        "run.googleapis.com/vpc-access-egress"     = "private-ranges-only"
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  depends_on = [
    google_project_service.required_apis,
    google_service_account_key.autonetgen_sa_key,
    google_vpc_access_connector.autonetgen_connector
  ]
}

# Service Account per il frontend
resource "google_service_account" "frontend_sa" {
  account_id   = "autonetgen-frontend"
  display_name = "AutoNetGen Frontend Service Account"
  description  = "Service account per il frontend AutoNetGen"
}

# Permesso per il frontend di invocare il backend
resource "google_cloud_run_service_iam_member" "frontend_invoke_backend" {
  location = google_cloud_run_service.backend.location
  project  = google_cloud_run_service.backend.project
  service  = google_cloud_run_service.backend.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.frontend_sa.email}"
}

# Cloud Run service per il frontend (PUBBLICO - senza VPC)
resource "google_cloud_run_service" "frontend" {
  name     = "autonetgen-frontend"
  location = var.region
  
  template {
    spec {
      service_account_name = google_service_account.frontend_sa.email
      container_concurrency = 10
      timeout_seconds = 3600  
      containers {
        image = var.frontend_image_url
        
        ports {
          container_port = 8080
        }
        
        # Variabili di ambiente per il frontend
        env {
          name  = "REACT_APP_API_URL"
          value = var.use_load_balancer ? "https://${var.load_balancer_domain}/api" : google_cloud_run_service.backend.status[0].url
        }
        
        # Configurazione risorse economica
        resources {
          limits = {
            cpu    = var.cpu_limit
            memory = var.memory_limit
          }
          requests = {
            cpu    = var.cpu_limit
            memory = var.memory_limit
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "0"
        "autoscaling.knative.dev/maxScale" = tostring(var.max_instances)
        "run.googleapis.com/execution-environment" = "gen2"
        # NOTA: Frontend senza VPC connector - modalità standard Cloud Run
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  depends_on = [
    google_project_service.required_apis
  ]
}

# === CONFIGURAZIONE LOAD BALANCER ===

# IP statico globale per il load balancer
resource "google_compute_global_address" "autonetgen_ip" {
  count = var.enable_load_balancer ? 1 : 0
  name  = "autonetgen-lb-ip"
}

# Certificato SSL gestito per HTTPS
resource "google_compute_managed_ssl_certificate" "autonetgen_ssl" {
  count = var.enable_load_balancer && var.load_balancer_domain != "" ? 1 : 0
  name  = "autonetgen-ssl-cert"

  managed {
    domains = [var.load_balancer_domain]
  }
}

# Backend service per il frontend
resource "google_compute_backend_service" "frontend_backend" {
  count       = var.enable_load_balancer ? 1 : 0
  name        = "autonetgen-frontend-backend"
  description = "Backend service per il frontend AutoNetGen"
  
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg[0].id
  }

  log_config {
    enable = true
  }
}

# Backend service per il backend
resource "google_compute_backend_service" "backend_backend" {
  count       = var.enable_load_balancer ? 1 : 0
  name        = "autonetgen-backend-backend"
  description = "Backend service per il backend AutoNetGen"
  
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.backend_neg[0].id
  }

  log_config {
    enable = true
  }
}

# Network Endpoint Group per il frontend
resource "google_compute_region_network_endpoint_group" "frontend_neg" {
  count                 = var.enable_load_balancer ? 1 : 0
  name                  = "autonetgen-frontend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_service.frontend.name
  }
}

# Network Endpoint Group per il backend
resource "google_compute_region_network_endpoint_group" "backend_neg" {
  count                 = var.enable_load_balancer ? 1 : 0
  name                  = "autonetgen-backend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_service.backend.name
  }
}

# Health check per il frontend
resource "google_compute_health_check" "frontend_health_check" {
  count = var.enable_load_balancer ? 1 : 0
  name  = "autonetgen-frontend-health-check"

  http_health_check {
    port         = 8080
    request_path = "/"
  }

  timeout_sec        = 5
  check_interval_sec = 10
}

# Health check per il backend
resource "google_compute_health_check" "backend_health_check" {
  count = var.enable_load_balancer ? 1 : 0
  name  = "autonetgen-backend-health-check"

  http_health_check {
    port         = 8080
    request_path = "/api/health"
  }

  timeout_sec        = 5
  check_interval_sec = 10
}

# URL map per instradare le richieste
resource "google_compute_url_map" "autonetgen_url_map" {
  count           = var.enable_load_balancer ? 1 : 0
  name            = "autonetgen-url-map"
  default_service = google_compute_backend_service.frontend_backend[0].id

  host_rule {
    hosts        = var.load_balancer_domain != "" ? [var.load_balancer_domain] : ["*"]
    path_matcher = "allpaths"
  }

  path_matcher {
    name            = "allpaths"
    default_service = google_compute_backend_service.frontend_backend[0].id

    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.backend_backend[0].id
    }
  }
}

# Target HTTPS proxy
resource "google_compute_target_https_proxy" "autonetgen_https_proxy" {
  count   = var.enable_load_balancer && var.load_balancer_domain != "" ? 1 : 0
  name    = "autonetgen-https-proxy"
  url_map = google_compute_url_map.autonetgen_url_map[0].id

  ssl_certificates = [google_compute_managed_ssl_certificate.autonetgen_ssl[0].id]
}

# Target HTTP proxy per redirect
resource "google_compute_target_http_proxy" "autonetgen_http_proxy" {
  count   = var.enable_load_balancer ? 1 : 0
  name    = "autonetgen-http-proxy"
  url_map = var.load_balancer_domain != "" ? google_compute_url_map.autonetgen_redirect_url_map[0].id : google_compute_url_map.autonetgen_url_map[0].id
}

# URL map per redirect HTTP -> HTTPS
resource "google_compute_url_map" "autonetgen_redirect_url_map" {
  count = var.enable_load_balancer && var.load_balancer_domain != "" ? 1 : 0
  name  = "autonetgen-redirect-url-map"

  default_url_redirect {
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
    https_redirect         = true
  }
}

# Global forwarding rule per HTTPS
resource "google_compute_global_forwarding_rule" "autonetgen_https_forwarding_rule" {
  count      = var.enable_load_balancer && var.load_balancer_domain != "" ? 1 : 0
  name       = "autonetgen-https-forwarding-rule"
  target     = google_compute_target_https_proxy.autonetgen_https_proxy[0].id
  port_range = "443"
  ip_address = google_compute_global_address.autonetgen_ip[0].address
}

# Global forwarding rule per HTTP
resource "google_compute_global_forwarding_rule" "autonetgen_http_forwarding_rule" {
  count      = var.enable_load_balancer ? 1 : 0
  name       = "autonetgen-http-forwarding-rule"
  target     = google_compute_target_http_proxy.autonetgen_http_proxy[0].id
  port_range = "80"
  ip_address = google_compute_global_address.autonetgen_ip[0].address
}

# === CONFIGURAZIONE ACCESSO AI SERVIZI ===

# Accesso per il load balancer ai servizi Cloud Run
resource "google_cloud_run_service_iam_member" "lb_invoker_frontend" {
  count    = var.enable_load_balancer ? 1 : 0
  location = google_cloud_run_service.frontend.location
  project  = google_cloud_run_service.frontend.project
  service  = google_cloud_run_service.frontend.name
  role     = "roles/run.invoker"
  member   = var.authorized_users[count.index]
}

# Configurazione accesso senza load balancer
resource "google_cloud_run_service_iam_member" "frontend_specific_users" {
  count    = var.enable_load_balancer ? 0 : length(var.authorized_users)
  location = google_cloud_run_service.frontend.location
  project  = google_cloud_run_service.frontend.project
  service  = google_cloud_run_service.frontend.name
  role     = "roles/run.invoker"
  member   = var.authorized_users[count.index]
}