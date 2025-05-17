# Modulo per il networking (VPC, subnets, firewall)
module "networking" {
  source = "./modules/networking"

  project_id         = var.project_id
  network_name       = var.network_name
  region             = var.region
  secondary_region   = var.secondary_region
  subnet_cidr_ranges = var.subnet_cidr_ranges
}

# Modulo per il frontend (Cloud Run service, LB esterno)
module "frontend" {
  source = "./modules/frontend"

  project_id            = var.project_id
  region                = var.region
  network_id            = module.networking.network_id
  frontend_subnet_id    = module.networking.subnet_ids["frontend"]
  service_name          = var.frontend_service_name
  container_image       = var.frontend_container_image
  backend_service_url   = module.backend.backend_service_url
  depends_on            = [module.networking, module.backend]
}

# Modulo per il backend (Cloud Run services, job orchestration)
module "backend" {
  source = "./modules/backend"

  project_id            = var.project_id
  region                = var.region
  network_id            = module.networking.network_id
  backend_subnet_id     = module.networking.subnet_ids["backend"]
  service_name          = var.backend_service_name
  container_image       = var.backend_container_image
  job_service_account   = var.job_service_account_id
  database_connection   = module.database.connection_name
  database_user         = var.db_user
  database_password     = var.db_password
  database_name         = var.db_name
  depends_on            = [module.networking, module.database]
}

# Modulo per il database (PostgreSQL, replica, backup)
module "database" {
  source = "./modules/database"

  project_id            = var.project_id
  region                = var.region
  secondary_region      = var.secondary_region
  zones                 = var.zones
  secondary_zones       = var.secondary_zones
  network_id            = module.networking.network_id
  database_subnet_id    = module.networking.subnet_ids["database"]
  db_tier               = var.db_tier
  db_name               = var.db_name
  db_user               = var.db_user
  db_password           = var.db_password
  depends_on            = [module.networking]
}

# Modulo per il monitoring (logging, monitoring)
module "monitoring" {
  source = "./modules/monitoring"

  project_id            = var.project_id
  enable_monitoring     = var.enable_monitoring
  log_retention_days    = var.log_retention_days
  frontend_service_id   = module.frontend.service_id
  backend_service_id    = module.backend.service_id
  database_instance_id  = module.database.primary_instance_id
  depends_on            = [module.frontend, module.backend, module.database]
}