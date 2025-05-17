# Outputs del modulo database
output "connection_name" {
  description = "Nome della connessione Cloud SQL primaria"
  value       = google_sql_database_instance.primary.connection_name
}

output "primary_instance_id" {
  description = "ID dell'istanza primaria"
  value       = google_sql_database_instance.primary.id
}

output "replica_instance_id" {
  description = "ID dell'istanza di replica"
  value       = google_sql_database_instance.replica.id
}

output "primary_private_ip" {
  description = "Indirizzo IP privato dell'istanza primaria"
  value       = google_sql_database_instance.primary.private_ip_address
}

output "replica_private_ip" {
  description = "Indirizzo IP privato dell'istanza di replica"
  value       = google_sql_database_instance.replica.private_ip_address
}

output "region_a_zonea_connection" {
  description = "Nome della connessione del database Region A - Zone A"
  value       = google_sql_database_instance.region_a_zonea_db.connection_name
}

output "region_a_zoneb_connection" {
  description = "Nome della connessione del database Region A - Zone B"
  value       = google_sql_database_instance.region_a_zoneb_db.connection_name
}

output "region_c_zonec_connection" {
  description = "Nome della connessione del database Region C - Zone C"
  value       = google_sql_database_instance.region_c_zonec_db.connection_name
}

output "backup_bucket" {
  description = "Nome del bucket per i backup del database"
  value       = google_storage_bucket.database_backup.name
}