variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "zone" {
  description = "Google Cloud zone"
  type        = string
}

variable "instance_name" {
  description = "Name for the VM instance"
  type        = string
}

variable "machine_type" {
  description = "Machine type for the VM"
  type        = string
  default     = "e2-medium"
}

variable "subnet" {
  description = "Subnet self_link for the VM"
  type        = string
}

variable "tags" {
  description = "Network tags to assign to the VM"
  type        = list(string)
  default     = []
}

variable "image" {
  description = "OS image for the VM"
  type        = string
  default     = "debian-cloud/debian-11"
}

variable "startup_script" {
  description = "Startup script for the VM"
  type        = string
  default     = ""
}

variable "service_account" {
  description = "Service account email for the VM"
  type        = string
}

variable "metadata" {
  description = "Additional metadata for the VM"
  type        = map(string)
  default     = {}
}

resource "google_compute_instance" "vm" {
  name         = var.instance_name
  machine_type = var.machine_type
  zone         = var.zone
  project      = var.project_id
  
  tags = var.tags
  
  boot_disk {
    initialize_params {
      image = var.image
    }
  }
  
  network_interface {
    subnetwork = var.subnet
    
    # If you need external IP
    access_config {
      # Ephemeral public IP
    }
  }
  
  metadata = merge(
    var.metadata,
    {
      startup-script = var.startup_script
    }
  )
  
  service_account {
    email  = var.service_account
    scopes = ["cloud-platform"]
  }
}

output "vm_id" {
  value = google_compute_instance.vm.id
}

output "vm_name" {
  value = google_compute_instance.vm.name
}

output "vm_internal_ip" {
  value = google_compute_instance.vm.network_interface[0].network_ip
}

output "vm_external_ip" {
  value = google_compute_instance.vm.network_interface[0].access_config[0].nat_ip
}
