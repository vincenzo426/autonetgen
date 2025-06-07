# AutonetGen - Terraform Outputs

# Application URLs
output "application_url" {
  description = "Main application URL"
  value       = var.domain_name != null ? "https://${var.domain_name}" : "http://${google_compute_global_address.default.address}"
}

output "api_url" {
  description = "API endpoint URL"
  value       = var.domain_name != null ? "https://${var.domain_name}/api" : "http://${google_compute_global_address.default.address}/api"
}

output "load_balancer_ip" {
  description = "Global Load Balancer IP address"
  value       = google_compute_global_address.default.address
}

# Cloud Run Services
output "frontend_service_url" {
  description = "Frontend Cloud Run service URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "backend_service_url" {
  description = "Backend Cloud Run service URL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_service_name" {
  description = "Frontend Cloud Run service name"
  value       = google_cloud_run_v2_service.frontend.name
}

output "backend_service_name" {
  description = "Backend Cloud Run service name"
  value       = google_cloud_run_v2_service.backend.name
}

# Storage Buckets
output "storage_buckets" {
  description = "Cloud Storage bucket information"
  value = {
    app_storage   = google_storage_bucket.app_storage.name
    temp_uploads  = google_storage_bucket.temp_uploads.name
    outputs       = google_storage_bucket.outputs.name
  }
}

# Container Registry
output "container_registry" {
  description = "Artifact Registry repository information"
  value = {
    repository_name = google_artifact_registry_repository.container_registry.repository_id
    repository_url  = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}"
  }
}

# Service Accounts
output "service_accounts" {
  description = "Service account emails"
  value = {
    cloud_run_sa   = google_service_account.cloud_run_sa.email
    cloud_build_sa = google_service_account.cloud_build_sa.email
  }
}

# Security
output "ssl_certificate_status" {
  description = "SSL certificate status (if domain configured)"
  value       = var.domain_name != null ? google_compute_managed_ssl_certificate.default[0].name : "No domain configured"
}

# Monitoring
output "monitoring_dashboard_url" {
  description = "Cloud Monitoring dashboard URL"
  value       = var.enable_monitoring ? "https://console.cloud.google.com/monitoring/dashboards/custom/${google_monitoring_dashboard.autonetgen_dashboard[0].id}?project=${var.project_id}" : "Monitoring disabled"
}

output "uptime_checks" {
  description = "Uptime check information"
  value = var.enable_monitoring ? {
    frontend_check_id = google_monitoring_uptime_check_config.frontend_uptime[0].uptime_check_id
    backend_check_id  = google_monitoring_uptime_check_config.backend_uptime[0].uptime_check_id
  } : {}
}

# Build Information
output "build_triggers" {
  description = "Cloud Build trigger information"
  value = var.github_repo != null ? {
    frontend_trigger = google_cloudbuild_trigger.frontend_trigger[0].name
    backend_trigger  = google_cloudbuild_trigger.backend_trigger[0].name
  } : "No GitHub repository configured"
}

# Cost Information
output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown (approximate)"
  value = {
    note = "Costs are estimates based on typical usage patterns"
    cloud_run = {
      frontend = "~$5-15/month (depending on traffic)"
      backend  = "~$10-30/month (depending on analysis frequency)"
    }
    storage = {
      storage_buckets = "~$1-5/month (depending on data volume)"
    }
    networking = {
      load_balancer = "~$18/month (base cost)"
      data_transfer = "~$1-10/month (depending on traffic)"
    }
    total_estimated = "~$35-80/month for typical usage"
  }
}

# DNS Configuration Instructions
output "dns_configuration" {
  description = "DNS configuration instructions"
  value = var.domain_name != null ? {
    message = "Configure your domain's DNS to point to the load balancer IP"
    dns_record = {
      type  = "A"
      name  = var.domain_name
      value = google_compute_global_address.default.address
      ttl   = 300
    }
    ssl_note = "SSL certificate will be automatically provisioned once DNS is configured"
  } : "No domain configured - using IP address access only"
}

# Quick Start Commands
output "quick_start_commands" {
  description = "Commands to get started"
  value = {
    build_images = "cd .. && ./deploy.sh"
    view_logs = {
      frontend = "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=${google_cloud_run_v2_service.frontend.name}\" --limit 50 --project ${var.project_id}"
      backend  = "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=${google_cloud_run_v2_service.backend.name}\" --limit 50 --project ${var.project_id}"
    }
    update_service = {
      frontend = "gcloud run deploy ${google_cloud_run_v2_service.frontend.name} --image ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/frontend:latest --region ${var.region}"
      backend  = "gcloud run deploy ${google_cloud_run_v2_service.backend.name} --image ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/backend:latest --region ${var.region}"
    }
  }
}

# Resource Summary
output "resource_summary" {
  description = "Summary of created resources"
  value = {
    cloud_run_services     = 2
    storage_buckets       = 3
    load_balancer         = 1
    ssl_certificates      = var.domain_name != null ? 1 : 0
    service_accounts      = 2
    monitoring_checks     = var.enable_monitoring ? 2 : 0
    build_triggers        = var.github_repo != null ? 2 : 0
    security_policies     = 1
    notification_channels = var.notification_email != null ? 1 : 0
  }
}