# Modulo per il database
# Gestisce l'istanza PostgreSQL principale, replica e backup

# Variabili del modulo database
variable "project_id" {
  description = "ID del progetto GCP"
  type        = string
}

variable "region" {
  description = "Regione primaria"
  type        = string
}

variable "secondary_region" {
  description = "Regione secondaria per il disaster recovery"
  type        = string
}

variable "zones" {
  description = "Zone disponibili nella regione primaria"
  type        = list(string)
}

variable "secondary_zones" {
  description = "Zone disponibili nella regione secondaria"
  type        = list(string)
}

variable "network_id" {
  description = "ID della rete VPC"
  type        = string
}

variable "database_subnet_id" {
  description = "ID della subnet database"
  type        = string
}

variable "db_tier" {
  description = "Tier dell'istanza Cloud SQL"
  type        = string
}

variable "db_name" {
  description = "Nome del database"
  type        = string
}

variable "db_user" {
  description = "Nome utente del database"
  type        = string
}

variable "db_password" {
  description = "Password dell'utente del database"
  type        = string
  sensitive   = true
}

# Istanza PostgreSQL primaria
resource "google_sql_database_instance" "primary" {
  name             = "autonetgen-db-primary"
  database_version = "POSTGRES_14"
  region           = var.region
  
  settings {
    tier              = var.db_tier
    availability_type = "REGIONAL"
    disk_size         = 20
    disk_type         = "PD_SSD"
    
    location_preference {
      zone = var.zones[0]
    }
    
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
      backup_retention_settings {
        retained_backups = 7
      }
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
      
      # Accetta connessioni solo dalla subnet database
      authorized_networks {
        name  = "vpc-network"
        value = var.database_subnet_id
      }
    }
    
    database_flags {
      name  = "max_connections"
      value = "100"
    }
    
    database_flags {
      name  = "log_min_duration_statement"
      value = "300"
    }
    
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
    
    maintenance_window {
      day          = 7  # Domenica
      hour         = 2  # 2 AM
      update_track = "stable"
    }
  }
  
  deletion_protection = true  # Protezione da cancellazione accidentale
}

# Istanza PostgreSQL di replica nella regione secondaria (disaster recovery)
resource "google_sql_database_instance" "replica" {
  name                 = "autonetgen-db-replica"
  database_version     = "POSTGRES_14"
  region               = var.secondary_region
  master_instance_name = google_sql_database_instance.primary.name
  
  replica_configuration {
    failover_target = false
  }
  
  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    
    location_preference {
      zone = var.secondary_zones[0]
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
    }
    
    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }
  
  deletion_protection = true
  
  depends_on = [
    google_sql_database_instance.primary
  ]
}

# Database PostgreSQL
resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.primary.name
}

# Utente del database
resource "google_sql_user" "user" {
  name     = var.db_user
  instance = google_sql_database_instance.primary.name
  password = var.db_password
}

# Database di replica manuale per la regione A - Zona A
resource "google_sql_database_instance" "region_a_zonea_db" {
  name             = "region-a-zonea-db"
  database_version = "POSTGRES_14"
  region           = var.region
  
  settings {
    tier          = var.db_tier
    disk_size     = 10
    disk_type     = "PD_SSD"
    
    location_preference {
      zone = var.zones[0]
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
    }
  }
  
  deletion_protection = true
}

# Database di replica manuale per la regione A - Zona B
resource "google_sql_database_instance" "region_a_zoneb_db" {
  name             = "region-a-zoneb-db"
  database_version = "POSTGRES_14"
  region           = var.region
  
  settings {
    tier          = var.db_tier
    disk_size     = 10
    disk_type     = "PD_SSD"
    
    location_preference {
      zone = var.zones[1]
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
    }
  }
  
  deletion_protection = true
}

# Database di replica manuale per la regione C - Zona C
resource "google_sql_database_instance" "region_c_zonec_db" {
  name             = "region-c-zonec-db"
  database_version = "POSTGRES_14"
  region           = var.secondary_region
  
  settings {
    tier          = var.db_tier
    disk_size     = 10
    disk_type     = "PD_SSD"
    
    location_preference {
      zone = var.secondary_zones[0]
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
    }
  }
  
  deletion_protection = true
}

# Bucket per i backup dei database
resource "google_storage_bucket" "database_backup" {
  name          = "${var.project_id}-db-backups"
  location      = "EU"  # Multi-regione per maggiore resilienza
  force_destroy = false
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}