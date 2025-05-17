# Outputs del modulo monitoring
output "logs_bucket" {
  description = "Nome del bucket per i log"
  value       = google_storage_bucket.logs_bucket.name
}

output "dashboard_url" {
  description = "URL della dashboard di monitoraggio"
  value       = "https://console.cloud.google.com/monitoring/dashboards/custom/${google_monitoring_dashboard.application_dashboard.id}?project=${var.project_id}"
}

output "email_notification_channel" {
  description = "ID del canale di notifica email"
  value       = google_monitoring_notification_channel.email.name
}

output "frontend_error_alert" {
  description = "ID della policy di alert per gli errori del frontend"
  value       = google_monitoring_alert_policy.frontend_error_rate.name
}

output "backend_load_alert" {
  description = "ID della policy di alert per il carico del backend"
  value       = google_monitoring_alert_policy.backend_high_load.name
}

output "database_error_alert" {
  description = "ID della policy di alert per gli errori del database"
  value       = google_monitoring_alert_policy.database_error.name
}