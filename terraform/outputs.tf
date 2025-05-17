# Output: VPC and Networking
output "vpc_network" {
  description = "The VPC network"
  value       = module.networking.network_id
}

output "subnets" {
  description = "Subnet information"
  value       = module.networking.subnet_ids
}

# Output: Frontend
output "frontend_url" {
  description = "URL del frontend"
  value       = module.frontend.frontend_url
}

output "load_balancer_ip" {
  description = "Indirizzo IP del load balancer"
  value       = module.frontend.load_balancer_ip
}

# Output: Backend
output "backend_service_url" {
  description = "URL del servizio backend"
  value       = module.backend.backend_service_url
}

output "network_analyzer_url" {
  description = "URL del servizio Network Analyzer"
  value       = module.backend.network_analyzer_url
}

# Output: Database
output "database_connection_name" {
  description = "Nome della connessione Cloud SQL"
  value       = module.database.connection_name
}

output "primary_db_instance" {
  description = "Istanza primaria del database"
  value       = module.database.primary_instance_id
}

output "replica_db_instance" {
  description = "Istanza replica del database"
  value       = module.database.replica_instance_id
}

# Output: Monitoring
output "monitoring_dashboard_url" {
  description = "URL della dashboard di monitoraggio"
  value       = module.monitoring.dashboard_url
}