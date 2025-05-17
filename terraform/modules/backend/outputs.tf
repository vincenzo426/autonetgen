# Outputs del modulo backend
output "service_id" {
  description = "ID del servizio Cloud Run del backend"
  value       = google_cloud_run_service.backend_api.id
}

output "backend_service_url" {
  description = "URL del servizio backend"
  value       = google_cloud_run_service.backend_api.status[0].url
}

output "network_analyzer_url" {
  description = "URL del servizio Network Analyzer"
  value       = google_cloud_run_service.network_analyzer.status[0].url
}

output "backend_service_account" {
  description = "Email dell'account di servizio del backend"
  value       = google_service_account.backend_service_account.email
}

output "job_service_account" {
  description = "Email dell'account di servizio per i job"
  value       = google_service_account.job_service_account.email
}

output "job_bucket" {
  description = "Nome del bucket per i dati dei job"
  value       = google_storage_bucket.job_data.name
}

output "redis_host" {
  description = "Host dell'istanza Redis Memorystore"
  value       = google_redis_instance.cache.host
}

output "redis_port" {
  description = "Porta dell'istanza Redis Memorystore"
  value       = google_redis_instance.cache.port
}