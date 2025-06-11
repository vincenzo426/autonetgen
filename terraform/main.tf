# main.tf - Configurazione principale per autonetgen su Google Cloud Platform

# Abilita le API necessarie
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "storage-api.googleapis.com",
    "storage-component.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com"
    # Rimossa secretmanager.googleapis.com perché non la usiamo più
  ])
  
  service = each.value
  
  disable_dependent_services = false
}

# Cloud Storage bucket per file uploads e risultati
resource "google_storage_bucket" "autonetgen_storage" {
  name     = "${var.project_id}-autonetgen-storage"
  location = var.region
  
  # Configurazione economica
  storage_class = "STANDARD"
  
  # Gestione del lifecycle per ridurre i costi
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
  
  # CORS per permettere uploads dal frontend
  cors {
    origin          = ["*"]
    method          = ["GET", "POST", "PUT", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
  
  uniform_bucket_level_access = true
  
  depends_on = [google_project_service.required_apis]
}

# Service Account per Cloud Run
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

# Cloud Run service per il backend (PRIVATO)
resource "google_cloud_run_service" "backend" {
  name     = "autonetgen-backend"
  location = var.region
  
  template {
    spec {
      service_account_name = google_service_account.autonetgen_sa.email
      
      # Configurazione economica
      container_concurrency = 10

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

        # Chiave del service account direttamente come variabile di ambiente
        env {
          name  = "GOOGLE_APPLICATION_CREDENTIALS_JSON"
          value = base64decode(google_service_account_key.autonetgen_sa_key.private_key)
        }
        
        # Configurazione risorse economica
        resources {
          limits = {
            cpu    = var.cpu_limit
            memory = var.memory_limit
            timeout = 900
          }
          requests = {
            cpu    = var.cpu_limit
            memory = var.memory_limit
            timeout = 900
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
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  depends_on = [
    google_project_service.required_apis,
    google_service_account_key.autonetgen_sa_key
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

# Cloud Run service per il frontend
resource "google_cloud_run_service" "frontend" {
  name     = "autonetgen-frontend"
  location = var.region
  
  template {
    spec {
      service_account_name = google_service_account.frontend_sa.email
      
      containers {
        image = var.frontend_image_url
        
        ports {
          container_port = 8080
        }
        
        # Variabili di ambiente per il frontend
        env {
          name  = "REACT_APP_API_URL"
          value = google_cloud_run_service.backend.status[0].url
        }
        
        # Configurazione risorse economica
        resources {
          limits = {
            cpu    = var.cpu_limit
            memory = var.memory_limit
            timeout = 900
          }
          requests = {
            cpu    = var.cpu_limit
            memory = var.memory_limit
            timeout = 900
          }
        }
      }
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "0"
        "autoscaling.knative.dev/maxScale" = "2"
        "run.googleapis.com/execution-environment" = "gen2"
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  depends_on = [google_project_service.required_apis]
}

# SOLUZIONE 1: Accesso pubblico per utenti autenticati (RACCOMANDATO)
# Questo permette l'accesso a chiunque abbia un account Google
/*
resource "google_cloud_run_service_iam_member" "frontend_authenticated_users" {
  count    = var.enable_public_access ? 1 : 0
  location = google_cloud_run_service.frontend.location
  project  = google_cloud_run_service.frontend.project
  service  = google_cloud_run_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allAuthenticatedUsers"
}
*/

# SOLUZIONE 2: Accesso per domini specifici (ALTERNATIVA SICURA)
# Decommentare e personalizzare se si vuole limitare l'accesso a domini specifici
/*
resource "google_cloud_run_service_iam_member" "frontend_domain_users" {
  count    = length(var.authorized_domains)
  location = google_cloud_run_service.frontend.location
  project  = google_cloud_run_service.frontend.project
  service  = google_cloud_run_service.frontend.name
  role     = "roles/run.invoker"
  member   = "domain:${var.authorized_domains[count.index]}"
}
*/

# SOLUZIONE 3: Accesso per utenti/gruppi specifici (MASSIMA SICUREZZA)
# Decommentare e personalizzare per utenti specifici
resource "google_cloud_run_service_iam_member" "frontend_specific_users" {
  count    = length(var.authorized_users)
  location = google_cloud_run_service.frontend.location
  project  = google_cloud_run_service.frontend.project
  service  = google_cloud_run_service.frontend.name
  role     = "roles/run.invoker"
  member   = var.authorized_users[count.index]
}