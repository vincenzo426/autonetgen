
# Rete VPC principale
resource "google_compute_network" "main_network" {
  name                    = "inferred-network"
  auto_create_subnetworks = false
}

# Firewall per permettere l'SSH
resource "google_compute_firewall" "allow_ssh" {
  name    = "allow-ssh"
  network = google_compute_network.main_network.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ssh"]
}

resource "google_compute_subnetwork" "subnet-1" {
  name          = "subnet-1"
  network       = google_compute_network.main_network.name
  ip_cidr_range = "10.1.0.0/24"
  region        = "us-central1"
}

resource "google_compute_subnetwork" "subnet-2" {
  name          = "subnet-2"
  network       = google_compute_network.main_network.name
  ip_cidr_range = "10.2.0.0/24"
  region        = "us-central1"
}
