# Modulo Networking
# Gestisce la creazione di VPC, subnet, firewall rules e load balancer

# Variabili specifiche del modulo
variable "project_id" {
  description = "ID del progetto GCP"
  type        = string
}

variable "network_name" {
  description = "Nome della rete VPC"
  type        = string
}

variable "region" {
  description = "Regione primaria"
  type        = string
}

variable "secondary_region" {
  description = "Regione secondaria"
  type        = string
}

variable "subnet_cidr_ranges" {
  description = "Ranges CIDR per le subnet"
  type        = map(string)
}

# Creazione della rete VPC
resource "google_compute_network" "vpc_network" {
  name                    = var.network_name
  auto_create_subnetworks = false
  description             = "Virtual Private Cloud per l'applicazione AutonetGen"
}

# Creazione delle subnet nelle regioni specificate
resource "google_compute_subnetwork" "frontend_subnet" {
  name          = "subnet-frontend"
  region        = var.region
  network       = google_compute_network.vpc_network.self_link
  ip_cidr_range = var.subnet_cidr_ranges["frontend"]
  description   = "Subnet Frontend in ${var.region}"
  
  # Abilita Private Google Access
  private_ip_google_access = true
  
  # Stack di log di flusso (opzionale)
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_subnetwork" "backend_subnet" {
  name          = "subnet-backend"
  region        = var.region
  network       = google_compute_network.vpc_network.self_link
  ip_cidr_range = var.subnet_cidr_ranges["backend"]
  description   = "Subnet Backend in ${var.region}"
  
  # Abilita Private Google Access
  private_ip_google_access = true
  
  # Stack di log di flusso (opzionale)
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_subnetwork" "database_subnet" {
  name          = "subnet-database"
  region        = var.region
  network       = google_compute_network.vpc_network.self_link
  ip_cidr_range = var.subnet_cidr_ranges["database"]
  description   = "Subnet Database in ${var.region}"
  
  # Abilita Private Google Access
  private_ip_google_access = true
  
  # Stack di log di flusso (opzionale)
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Regola firewall per consentire SSH
resource "google_compute_firewall" "allow_ssh" {
  name    = "allow-ssh"
  network = google_compute_network.vpc_network.self_link

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ssh"]
  description   = "Consente connessioni SSH da internet"
}

# Regola firewall per consentire traffico HTTP/HTTPS verso il frontend
resource "google_compute_firewall" "allow_http_https" {
  name    = "allow-http-https"
  network = google_compute_network.vpc_network.self_link

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web", "frontend"]
  description   = "Consente traffico HTTP e HTTPS verso il frontend"
}

# Regola firewall per consentire la comunicazione interna
resource "google_compute_firewall" "allow_internal" {
  name    = "allow-internal"
  network = google_compute_network.vpc_network.self_link

  allow {
    protocol = "tcp"
  }
  
  allow {
    protocol = "udp"
  }
  
  allow {
    protocol = "icmp"
  }
  
  source_ranges = [
    var.subnet_cidr_ranges["frontend"],
    var.subnet_cidr_ranges["backend"],
    var.subnet_cidr_ranges["database"]
  ]
  description   = "Consente traffico interno tra subnet"
}

# Regola firewall per il load balancer interno
resource "google_compute_firewall" "allow_health_check" {
  name    = "allow-health-check"
  network = google_compute_network.vpc_network.self_link

  allow {
    protocol = "tcp"
  }
  
  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
  target_tags   = ["backend", "load-balanced"]
  description   = "Consente health check dai sistemi Google Load Balancer"
}

# Router e NAT per consentire l'accesso a Internet dalle istanze private
resource "google_compute_router" "router" {
  name    = "nat-router"
  region  = var.region
  network = google_compute_network.vpc_network.self_link
}

resource "google_compute_router_nat" "nat" {
  name                               = "nat-config"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Indirizzo IP statico per il load balancer esterno
resource "google_compute_global_address" "lb_ip" {
  name         = "lb-external-ip"
  description  = "Indirizzo IP globale per il Load Balancer esterno"
  address_type = "EXTERNAL"
}

# Creazione della regola per il forwarding al pool di backend
resource "google_compute_global_forwarding_rule" "frontend_lb_forwarding_rule" {
  name       = "frontend-lb-forwarding-rule"
  ip_address = google_compute_global_address.lb_ip.address
  port_range = "443"
  target     = google_compute_target_https_proxy.frontend_lb_proxy.self_link
}

# Certificato SSL per HTTPS (autogenerato per semplicità - usare un certificato reale in produzione)
resource "google_compute_managed_ssl_certificate" "frontend_cert" {
  name = "frontend-cert"
  
  managed {
    domains = ["autonetgen.example.com"] # Sostituire con dominio reale
  }
}

# Proxy HTTPS che utilizza il certificato
resource "google_compute_target_https_proxy" "frontend_lb_proxy" {
  name             = "frontend-lb-proxy"
  url_map          = google_compute_url_map.frontend_lb_url_map.self_link
  ssl_certificates = [google_compute_managed_ssl_certificate.frontend_cert.self_link]
}

# URL Map per l'applicazione frontend
resource "google_compute_url_map" "frontend_lb_url_map" {
  name            = "frontend-lb-url-map"
  default_service = google_compute_backend_service.frontend_lb_backend_service.self_link
}

# Backend service per il load balancer esterno
resource "google_compute_backend_service" "frontend_lb_backend_service" {
  name        = "frontend-lb-backend-service"
  port_name   = "http"
  protocol    = "HTTP"
  timeout_sec = 10
  
  health_checks = [google_compute_health_check.frontend_health_check.self_link]
  
  # I backend groups saranno associati nel modulo frontend
  # quando creiamo i NEG per i servizi Cloud Run
}

# Health check per il backend service
resource "google_compute_health_check" "frontend_health_check" {
  name               = "frontend-health-check"
  timeout_sec        = 5
  check_interval_sec = 10
  
  http_health_check {
    port         = 80
    request_path = "/health"
  }
}

# Load Balancer interno per il backend
resource "google_compute_forwarding_rule" "backend_lb_forwarding_rule" {
  name                  = "backend-lb-forwarding-rule"
  region                = var.region
  ip_protocol           = "TCP"
  load_balancing_scheme = "INTERNAL"
  network               = google_compute_network.vpc_network.self_link
  subnetwork            = google_compute_subnetwork.backend_subnet.self_link
  backend_service       = google_compute_region_backend_service.backend_lb_backend_service.self_link
  ports                 = ["80", "443"]
}

resource "google_compute_region_backend_service" "backend_lb_backend_service" {
  name                  = "backend-lb-backend-service"
  region                = var.region
  protocol              = "TCP"
  load_balancing_scheme = "INTERNAL"
  health_checks         = [google_compute_region_health_check.backend_health_check.self_link]
  
  # I backend groups saranno associati nel modulo backend
}

resource "google_compute_region_health_check" "backend_health_check" {
  name               = "backend-health-check"
  region             = var.region
  timeout_sec        = 5
  check_interval_sec = 10
  
  http_health_check {
    port         = 80
    request_path = "/health"
  }
}