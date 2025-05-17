# File di configurazione delle variabili (da personalizzare)
project_id = "your-project-id"
region     = "us-central1"
zones      = ["us-central1-a", "us-central1-b", "us-central1-c"]

secondary_region = "us-west1"
secondary_zones  = ["us-west1-a", "us-west1-b"]

network_name = "autonetgen-vpc"
subnet_cidr_ranges = {
  "frontend" = "10.0.1.0/24"
  "backend"  = "10.0.2.0/24"
  "database" = "10.0.3.0/24"
}

frontend_service_name = "autonetgen-frontend"
frontend_container_image = "gcr.io/your-project-id/autonetgen-frontend:latest"

backend_service_name = "autonetgen-backend"
backend_container_image = "gcr.io/your-project-id/autonetgen-backend:latest"
job_service_account_id = "autonetgen-job-sa"

db_tier = "db-custom-2-4096"
db_name = "autonetgen_db"
db_user = "autonetgen_user"
# db_password = "change-me-securely" # Si consiglia di non memorizzare la password in chiaro

enable_monitoring = true
log_retention_days = 30