# Outputs del modulo networking
output "network_id" {
  description = "ID della rete VPC"
  value       = google_compute_network.vpc_network.self_link
}

output "subnet_ids" {
  description = "ID delle subnet create"
  value = {
    "frontend" = google_compute_subnetwork.frontend_subnet.self_link,
    "backend"  = google_compute_subnetwork.backend_subnet.self_link,
    "database" = google_compute_subnetwork.database_subnet.self_link
  }
}

output "lb_external_ip" {
  description = "Indirizzo IP del load balancer esterno"
  value       = google_compute_global_address.lb_ip.address
}

output "backend_lb_self_link" {
  description = "Self link del load balancer interno"
  value       = google_compute_forwarding_rule.backend_lb_forwarding_rule.self_link
}

output "frontend_health_check_id" {
  description = "ID dell'health check del frontend"
  value       = google_compute_health_check.frontend_health_check.self_link
}

output "backend_health_check_id" {
  description = "ID dell'health check del backend"
  value       = google_compute_region_health_check.backend_health_check.self_link
}

output "frontend_backend_service_id" {
  description = "ID del backend service del frontend"
  value       = google_compute_backend_service.frontend_lb_backend_service.self_link
}

output "backend_backend_service_id" {
  description = "ID del backend service del backend"
  value       = google_compute_region_backend_service.backend_lb_backend_service.self_link
}