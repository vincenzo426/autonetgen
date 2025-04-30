terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.75.0"
    }
  }
  
  backend "gcs" {
    bucket = "autonetgen-tfstate"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Random suffix for globally unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# VPC Network
resource "google_compute_network" "autonetgen_network" {
  name                    = "autonetgen-network"
  auto_create_subnetworks = false
}

# Subnets
resource "google_compute_subnetwork" "frontend_subnet" {
  name          = "frontend-subnet"
  ip_cidr_range = "10.0.1.0/24"
  region        = var.region
  network       = google_compute_network.autonetgen_network.id
}

resource "google_compute_subnetwork" "backend_subnet" {
  name          = "backend-subnet"
  ip_cidr_range = "10.0.2.0/24"
  region        = var.region
  network       = google_compute_network.autonetgen_network.id
}

resource "google_compute_subnetwork" "data_subnet" {
  name          = "data-subnet"
  ip_cidr_range = "10.0.3.0/24"
  region        = var.region
  network       = google_compute_network.autonetgen_network.id
}

# Cloud Storage for dataset storage
resource "google_storage_bucket" "dataset_bucket" {
  name     = "autonetgen-datasets-${random_id.suffix.hex}"
  location = var.region
  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket" "output_bucket" {
  name     = "autonetgen-output-${random_id.suffix.hex}"
  location = var.region
  uniform_bucket_level_access = true
}

# Pub/Sub topics for event-driven processing
resource "google_pubsub_topic" "dataset_uploaded" {
  name = "dataset-uploaded"
}

resource "google_pubsub_topic" "inference_complete" {
  name = "inference-complete"
}

resource "google_pubsub_topic" "deployment_complete" {
  name = "deployment-complete"
}

# Service account for services
resource "google_service_account" "autonetgen_service_account" {
  account_id   = "autonetgen-service-account"
  display_name = "AutoNetGen Service Account"
}

# Grant roles to service account
resource "google_project_iam_member" "storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.autonetgen_service_account.email}"
}

resource "google_project_iam_member" "pubsub_admin" {
  project = var.project_id
  role    = "roles/pubsub.admin"
  member  = "serviceAccount:${google_service_account.autonetgen_service_account.email}"
}

resource "google_project_iam_member" "compute_admin" {
  project = var.project_id
  role    = "roles/compute.admin"
  member  = "serviceAccount:${google_service_account.autonetgen_service_account.email}"
}

# Cloud SQL instance for persistence
resource "google_sql_database_instance" "autonetgen_db" {
  name             = "autonetgen-db-instance"
  database_version = "POSTGRES_13"
  region           = var.region
  
  settings {
    tier = "db-f1-micro"
    
    backup_configuration {
      enabled = true
      start_time = "02:00"
    }
  }
  
  deletion_protection = false  # Set to true in production
}

resource "google_sql_database" "autonetgen_database" {
  name     = "autonetgen"
  instance = google_sql_database_instance.autonetgen_db.name
}

# Cloud Run service for the frontend
resource "google_cloud_run_service" "frontend" {
  name     = "autonetgen-frontend"
  location = var.region
  
  template {
    spec {
      containers {
        image = var.frontend_image
        env {
          name  = "DATASET_BUCKET"
          value = google_storage_bucket.dataset_bucket.name
        }
        env {
          name  = "OUTPUT_BUCKET"
          value = google_storage_bucket.output_bucket.name
        }
        env {
          name  = "DATABASE_URL"
          value = "postgresql://postgres:${var.db_password}@${google_sql_database_instance.autonetgen_db.connection_name}/autonetgen"
        }
        resources {
          limits = {
            cpu    = "1000m"
            memory = "1Gi"
          }
        }
      }
      service_account_name = google_service_account.autonetgen_service_account.email
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Cloud Run service for the inference engine
resource "google_cloud_run_service" "inference_engine" {
  name     = "autonetgen-inference"
  location = var.region
  
  template {
    spec {
      containers {
        image = var.inference_image
        env {
          name  = "DATASET_BUCKET"
          value = google_storage_bucket.dataset_bucket.name
        }
        env {
          name  = "OUTPUT_BUCKET"
          value = google_storage_bucket.output_bucket.name
        }
        env {
          name  = "PUBSUB_TOPIC_COMPLETE"
          value = google_pubsub_topic.inference_complete.id
        }
        resources {
          limits = {
            cpu    = "2000m"
            memory = "4Gi"
          }
        }
      }
      service_account_name = google_service_account.autonetgen_service_account.email
      timeout_seconds      = 900  # 15 minutes for processing
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Cloud Run service for the deployment engine
resource "google_cloud_run_service" "deployment_engine" {
  name     = "autonetgen-deployment"
  location = var.region
  
  template {
    spec {
      containers {
        image = var.deployment_image
        env {
          name  = "OUTPUT_BUCKET"
          value = google_storage_bucket.output_bucket.name
        }
        env {
          name  = "PROJECT_ID"
          value = var.project_id
        }
        env {
          name  = "PUBSUB_TOPIC_COMPLETE"
          value = google_pubsub_topic.deployment_complete.id
        }
        resources {
          limits = {
            cpu    = "2000m"
            memory = "2Gi"
          }
        }
      }
      service_account_name = google_service_account.autonetgen_service_account.email
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Pub/Sub triggers for Cloud Run
resource "google_cloud_run_service_iam_member" "invoker_inference" {
  location = google_cloud_run_service.inference_engine.location
  service  = google_cloud_run_service.inference_engine.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.autonetgen_service_account.email}"
}

resource "google_cloud_run_service_iam_member" "invoker_deployment" {
  location = google_cloud_run_service.deployment_engine.location
  service  = google_cloud_run_service.deployment_engine.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.autonetgen_service_account.email}"
}

# Allow unauthenticated access to frontend
resource "google_cloud_run_service_iam_member" "frontend_public" {
  location = google_cloud_run_service.frontend.location
  service  = google_cloud_run_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Functions for dataset processing
resource "google_storage_bucket" "function_bucket" {
  name     = "autonetgen-functions-${random_id.suffix.hex}"
  location = var.region
}

# Function to trigger inference when a new dataset is uploaded
resource "google_cloudfunctions_function" "dataset_processor" {
  name        = "dataset-processor"
  description = "Process uploaded datasets and trigger inference"
  runtime     = "python39"
  
  available_memory_mb   = 1024
  source_archive_bucket = google_storage_bucket.function_bucket.name
  source_archive_object = google_storage_bucket_object.dataset_processor_zip.name
  entry_point           = "process_upload"
  
  event_trigger {
    event_type = "google.storage.object.finalize"
    resource   = google_storage_bucket.dataset_bucket.name
  }
  
  environment_variables = {
    INFERENCE_SERVICE_URL = google_cloud_run_service.inference_engine.status[0].url
  }
  
  service_account_email = google_service_account.autonetgen_service_account.email
}

# ZIP file for the Cloud Function
resource "google_storage_bucket_object" "dataset_processor_zip" {
  name   = "functions/dataset_processor.zip"
  bucket = google_storage_bucket.function_bucket.name
  source = "functions/dataset_processor.zip"  # This will be created separately
}

# Firewall rules
resource "google_compute_firewall" "allow_internal" {
  name    = "allow-internal"
  network = google_compute_network.autonetgen_network.name
  
  allow {
    protocol = "tcp"
  }
  allow {
    protocol = "udp"
  }
  allow {
    protocol = "icmp"
  }
  
  source_ranges = [
    google_compute_subnetwork.frontend_subnet.ip_cidr_range,
    google_compute_subnetwork.backend_subnet.ip_cidr_range,
    google_compute_subnetwork.data_subnet.ip_cidr_range
  ]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "allow-ssh"
  network = google_compute_network.autonetgen_network.name
  
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  
  source_ranges = ["35.235.240.0/20"]  # IAP for TCP forwarding
  target_tags   = ["ssh"]
}

# Load balancer for external access to frontend
resource "google_compute_global_address" "autonetgen_ip" {
  name = "autonetgen-ip"
}

resource "google_compute_managed_ssl_certificate" "autonetgen_cert" {
  name = "autonetgen-cert"
  
  managed {
    domains = ["autonetgen.${var.domain_name}"]
  }
}

resource "google_compute_backend_service" "frontend_backend" {
  name        = "frontend-backend"
  port_name   = "http"
  protocol    = "HTTP"
  timeout_sec = 30
  
  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg.id
  }
}

resource "google_compute_url_map" "autonetgen_url_map" {
  name            = "autonetgen-url-map"
  default_service = google_compute_backend_service.frontend_backend.id
}

resource "google_compute_target_https_proxy" "autonetgen_https_proxy" {
  name             = "autonetgen-https-proxy"
  url_map          = google_compute_url_map.autonetgen_url_map.id
  ssl_certificates = [google_compute_managed_ssl_certificate.autonetgen_cert.id]
}

resource "google_compute_global_forwarding_rule" "autonetgen_forwarding_rule" {
  name       = "autonetgen-forwarding-rule"
  target     = google_compute_target_https_proxy.autonetgen_https_proxy.id
  port_range = "443"
  ip_address = google_compute_global_address.autonetgen_ip.address
}

resource "google_compute_region_network_endpoint_group" "frontend_neg" {
  name                  = "frontend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  
  cloud_run {
    service = google_cloud_run_service.frontend.name
  }
}

# Outputs
output "frontend_url" {
  value = google_cloud_run_service.frontend.status[0].url
}

output "dataset_bucket" {
  value = google_storage_bucket.dataset_bucket.url
}

output "output_bucket" {
  value = google_storage_bucket.output_bucket.url
}
