# AutonetGen - Terraform Variables

variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# Domain and SSL Configuration
variable "domain_name" {
  description = "Domain name for the application (optional)"
  type        = string
  default     = null
}

variable "enable_https_redirect" {
  description = "Enable automatic HTTPS redirect"
  type        = bool
  default     = true
}

# Container Images
variable "frontend_container_image" {
  description = "Frontend container image URL"
  type        = string
  default     = "gcr.io/PROJECT_ID/autonetgen-frontend:latest"
}

variable "backend_container_image" {
  description = "Backend container image URL"
  type        = string
  default     = "gcr.io/PROJECT_ID/autonetgen-backend:latest"
}

# Cloud Run Configuration
variable "frontend_config" {
  description = "Frontend service configuration"
  type = object({
    cpu_limit    = optional(string, "1")
    memory_limit = optional(string, "512Mi")
    min_scale    = optional(number, 0)
    max_scale    = optional(number, 10)
    concurrency  = optional(number, 100)
  })
  default = {}
}

variable "backend_config" {
  description = "Backend service configuration"
  type = object({
    cpu_limit    = optional(string, "2")
    memory_limit = optional(string, "2Gi")
    min_scale    = optional(number, 0)
    max_scale    = optional(number, 20)
    concurrency  = optional(number, 50)
    timeout      = optional(string, "300s")
  })
  default = {}
}

# Storage Configuration
variable "storage_location" {
  description = "Cloud Storage bucket location"
  type        = string
  default     = "US"
}

variable "storage_lifecycle_days" {
  description = "Days after which objects are deleted from storage"
  type        = number
  default     = 30
}

# Security Configuration
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_vpc_connector" {
  description = "Enable VPC connector for Cloud Run services"
  type        = bool
  default     = false
}

# Cloud Build Configuration
variable "github_repo" {
  description = "GitHub repository for Cloud Build triggers"
  type = object({
    owner = string
    name  = string
  })
  default = null
}

variable "build_trigger_branches" {
  description = "Git branches that trigger builds"
  type        = list(string)
  default     = ["main", "master"]
}

# Monitoring and Alerting
variable "enable_monitoring" {
  description = "Enable Cloud Monitoring and alerting"
  type        = bool
  default     = true
}

variable "notification_email" {
  description = "Email for monitoring notifications"
  type        = string
  default     = null
}

# Cost Control
variable "budget_amount" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 100
}

variable "enable_budget_alerts" {
  description = "Enable budget alerts"
  type        = bool
  default     = true
}