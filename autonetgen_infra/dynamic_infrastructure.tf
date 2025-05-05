# This file contains modules for dynamically provisioned infrastructure that will be created
# by the AutoNetGen system based on inferred network topology

locals {
  inferred_nodes_template = {
    client = {
      machine_type = "e2-medium"
      subnet       = "client-subnet"
      tags         = ["client"]
      startup_script = "#!/bin/bash\necho 'Client node setup'"
    }
    server = {
      machine_type = "e2-standard-2"
      subnet       = "server-subnet"
      tags         = ["server"]
      startup_script = "#!/bin/bash\necho 'Server node setup'"
    }
    plc = {
      machine_type = "e2-small"
      subnet       = "plc-subnet"
      tags         = ["plc"]
      startup_script = "#!/bin/bash\necho 'PLC node setup'"
    }
  }
}

# Module to create a new dynamic subnet
module "dynamic_subnet" {
  source = "./modules/dynamic_subnet"
  
  # These will be populated by the deployment engine
  for_each      = {}
  project_id    = var.project_id
  region        = var.region
  network       = google_compute_network.autonetgen_network.id
  subnet_name   = "dynamic-subnet"
  ip_cidr_range = "10.0.0.0/24"
}

# Module to create a new VM instance based on inferred role
module "dynamic_vm" {
  source = "./modules/dynamic_vm"
  
  # These will be populated by the deployment engine
  for_each       = {}
  project_id     = var.project_id
  zone           = var.zone
  instance_name  = "dynamic-instance"
  machine_type   = "e2-medium"
  subnet         = ""
  tags           = []
  startup_script = ""
  service_account = google_service_account.autonetgen_service_account.email
}

# Module to create a new container instance based on inferred role
module "dynamic_container" {
  source = "./modules/dynamic_container"
  
  # These will be populated by the deployment engine
  for_each      = {}
  project_id    = var.project_id
  region        = var.region
  name          = "dynamic-container"
  image         = "gcr.io/autonetgen/service:latest"
  subnet        = ""
  env_vars      = {}
  service_account = google_service_account.autonetgen_service_account.email
}

# Module to create firewall rules based on inferred communication patterns
module "dynamic_firewall" {
  source = "./modules/dynamic_firewall"
  
  # These will be populated by the deployment engine
  for_each       = {}
  project_id     = var.project_id
  network        = google_compute_network.autonetgen_network.id
  name           = "dynamic-firewall"
  source_ranges  = []
  target_tags    = []
  allowed_ports  = []
  allowed_protocol = "tcp"
}
