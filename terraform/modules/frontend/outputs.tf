# Outputs del modulo frontend
output "service_id" {
  description = "ID del servizio Cloud Run"
  value       = google_cloud_run_service.frontend.id
}

output "frontend_url" {
  description = "URL del servizio frontend"
  value       = google_cloud_run_service.frontend.status[0].url
}

output "load_balancer_ip" {
  description = "Indirizzo IP del load balancer"
  value       = google_compute_backend_service.frontend_backend_service.self_link
}

output "static_bucket" {
  description = "Nome del bucket per i contenuti statici"
  value       = google_storage_bucket.static_content.name
}

output "service_account" {
  description = "Email dell'account di servizio"
  value       = google_service_account.frontend_service_account.email
}