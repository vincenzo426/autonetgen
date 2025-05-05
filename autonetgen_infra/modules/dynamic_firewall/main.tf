variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "network" {
  description = "VPC network ID"
  type        = string
}

variable "name" {
  description = "Name for the firewall rule"
  type        = string
}

variable "source_ranges" {
  description = "Source IP ranges"
  type        = list(string)
  default     = []
}

variable "source_tags" {
  description = "Source tags"
  type        = list(string)
  default     = []
}

variable "target_tags" {
  description = "Target tags"
  type        = list(string)
  default     = []
}

variable "allowed_ports" {
  description = "Allowed ports"
  type        = list(string)
  default     = []
}

variable "allowed_protocol" {
  description = "Allowed protocol"
  type        = string
  default     = "tcp"
}

variable "direction" {
  description = "Direction of traffic (INGRESS or EGRESS)"
  type        = string
  default     = "INGRESS"
}

resource "google_compute_firewall" "firewall" {
  name        = var.name
  network     = var.network
  project     = var.project_id
  description = "Dynamically created firewall rule"
  direction   = var.direction
  
  source_ranges = var.source_ranges
  source_tags   = var.source_tags
  target_tags   = var.target_tags
  
  allow {
    protocol = var.allowed_protocol
    ports    = var.allowed_ports
  }
}

output "firewall_id" {
  value = google_compute_firewall.firewall.id
}

output "firewall_name" {
  value = google_compute_firewall.firewall.name
}
