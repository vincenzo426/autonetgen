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

# Cloud Run service per il backend
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
        
        # Configurazione risorse economica
        resources {
          limits = {
            cpu    = var.cpu_limit
            memory = var.memory_limit
          }
          requests = {
            cpu    = "0.5"
            memory = "512Mi"
          }
        }
        
        # Startup probe per evitare timeout
        startup_probe {
          http_get {
            path = "/health"
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
            path = "/health"
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
  
  depends_on = [google_project_service.required_apis]
}

# Cloud Run service per il frontend
resource "google_cloud_run_service" "frontend" {
  name     = "autonetgen-frontend"
  location = var.region
  
  template {
    spec {
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
            cpu    = "0.5"
            memory = "512Mi"
          }
          requests = {
            cpu    = "0.25"
            memory = "256Mi"
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

# Policy IAM per permettere l'accesso pubblico ai servizi Cloud Run
resource "google_cloud_run_service_iam_policy" "backend_public" {
  location = google_cloud_run_service.backend.location
  project  = google_cloud_run_service.backend.project
  service  = google_cloud_run_service.backend.name
  
  policy_data = data.google_iam_policy.public_access.policy_data
}

resource "google_cloud_run_service_iam_policy" "frontend_public" {
  location = google_cloud_run_service.frontend.location
  project  = google_cloud_run_service.frontend.project
  service  = google_cloud_run_service.frontend.name
  
  policy_data = data.google_iam_policy.public_access.policy_data
}

# Policy per accesso pubblico
data "google_iam_policy" "public_access" {
  binding {
    role = "roles/run.invoker"
    members = [
      "allUsers"
    ]
  }
}