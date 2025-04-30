variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region"
  type        = string
}

variable "name" {
  description = "Name for the container instance"
  type        = string
}

variable "image" {
  description = "Container image"
  type        = string
}

variable "subnet" {
  description = "Subnet self_link for the container"
  type        = string
  default     = ""
}

variable "env_vars" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "service_account" {
  description = "Service account email for the container"
  type        = string
}

variable "cpu" {
  description = "CPU limit for the container"
  type        = string
  default     = "1000m"
}

variable "memory" {
  description = "Memory limit for the container"
  type        = string
  default     = "2Gi"
}

variable "ports" {
  description = "Ports to expose"
  type        = list(number)
  default     = [8080]
}

resource "google_cloud_run_service" "container" {
  name     = var.name
  location = var.region
  project  = var.project_id
  
  template {
    spec {
      containers {
        image = var.image
        
        dynamic "env" {
          for_each = var.env_vars
          content {
            name  = env.key
            value = env.value
          }
        }
        
        ports {
          container_port = var.ports[0]
        }
        
        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
        }
      }
      
      service_account_name = var.service_account
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = "10"
        "run.googleapis.com/vpc-access-connector" = var.subnet != "" ? "vpc-connector" : null
        "run.googleapis.com/vpc-access-egress"    = var.subnet != "" ? "private-ranges-only" : null
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  autogenerate_revision_name = true
}

resource "google_cloud_run_service_iam_member" "invoker" {
  location = google_cloud_run_service.container.location
  service  = google_cloud_run_service.container.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.service_account}"
  project  = var.project_id
}

output "container_id" {
  value = google_cloud_run_service.container.id
}

output "container_url" {
  value = google_cloud_run_service.container.status[0].url
}

output "container_name" {
  value = google_cloud_run_service.container.name
}
