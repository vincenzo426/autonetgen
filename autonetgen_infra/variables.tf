variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "Google Cloud zone"
  type        = string
  default     = "us-central1-a"
}

variable "frontend_image" {
  description = "Container image for the frontend service"
  type        = string
  default     = "gcr.io/autonetgen/frontend:latest"
}

variable "inference_image" {
  description = "Container image for the inference engine"
  type        = string
  default     = "gcr.io/autonetgen/inference:latest"
}

variable "deployment_image" {
  description = "Container image for the deployment engine"
  type        = string
  default     = "gcr.io/autonetgen/deployment:latest"
}

variable "db_password" {
  description = "Password for the database"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "example.com"
}

variable "env" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}
