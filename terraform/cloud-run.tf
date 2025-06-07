# AutonetGen - Cloud Run Services Configuration

# Artifact Registry Repository for container images
resource "google_artifact_registry_repository" "container_registry" {
  provider      = google-beta
  location      = var.region
  repository_id = "${local.name_prefix}-registry"
  description   = "AutonetGen container registry"
  format        = "DOCKER"

  labels = local.labels

  depends_on = [google_project_service.required_apis]
}

# Service Account for Cloud Run services
resource "google_service_account" "cloud_run_sa" {
  account_id   = "${local.name_prefix}-run-sa-${local.suffix}"
  display_name = "AutonetGen Cloud Run Service Account"
  description  = "Service account for AutonetGen Cloud Run services"
}

# IAM bindings for Cloud Run service account
resource "google_project_iam_member" "cloud_run_permissions" {
  for_each = toset([
    "roles/storage.objectAdmin",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/cloudtrace.agent"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Frontend Cloud Run Service
resource "google_cloud_run_v2_service" "frontend" {
  provider = google-beta
  name     = "${local.name_prefix}-frontend-${local.suffix}"
  location = var.region
  
  labels = local.labels

  template {
    labels = local.labels
    
    scaling {
      min_instance_count = var.frontend_config.min_scale
      max_instance_count = var.frontend_config.max_scale
    }

    service_account = google_service_account.cloud_run_sa.email

    containers {
      image = replace(var.frontend_container_image, "PROJECT_ID", var.project_id)
      
      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.frontend_config.cpu_limit
          memory = var.frontend_config.memory_limit
        }
      }

      env {
        name  = "BACKEND_API_URL"
        value = "https://${google_cloud_run_v2_service.backend.uri}/api"
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 30
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 30
        timeout_seconds       = 5
        period_seconds        = 30
        failure_threshold     = 3
      }
    }

    max_instance_request_concurrency = var.frontend_config.concurrency
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.required_apis,
    google_service_account.cloud_run_sa
  ]
}

# Backend Cloud Run Service
resource "google_cloud_run_v2_service" "backend" {
  provider = google-beta
  name     = "${local.name_prefix}-backend-${local.suffix}"
  location = var.region
  
  labels = local.labels

  template {
    labels = local.labels
    
    scaling {
      min_instance_count = var.backend_config.min_scale
      max_instance_count = var.backend_config.max_scale
    }

    service_account = google_service_account.cloud_run_sa.email
    timeout         = var.backend_config.timeout

    containers {
      image = replace(var.backend_container_image, "PROJECT_ID", var.project_id)
      
      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.backend_config.cpu_limit
          memory = var.backend_config.memory_limit
        }
      }

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "STORAGE_BUCKET"
        value = google_storage_bucket.app_storage.name
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      env {
        name  = "DEFAULT_OUTPUT_DIR"
        value = "/tmp/output"
      }

      startup_probe {
        http_get {
          path = "/api/health"
          port = 8080
        }
        initial_delay_seconds = 60
        timeout_seconds       = 10
        period_seconds        = 15
        failure_threshold     = 5
      }

      liveness_probe {
        http_get {
          path = "/api/health"
          port = 8080
        }
        initial_delay_seconds = 60
        timeout_seconds       = 10
        period_seconds        = 60
        failure_threshold     = 3
      }
    }

    max_instance_request_concurrency = var.backend_config.concurrency
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.required_apis,
    google_service_account.cloud_run_sa,
    google_storage_bucket.app_storage
  ]
}

# Cloud Run IAM - Allow public access
resource "google_cloud_run_service_iam_member" "frontend_public" {
  provider = google-beta
  service  = google_cloud_run_v2_service.frontend.name
  location = google_cloud_run_v2_service.frontend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "backend_public" {
  provider = google-beta
  service  = google_cloud_run_v2_service.backend.name
  location = google_cloud_run_v2_service.backend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}