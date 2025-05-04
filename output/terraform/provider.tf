
provider "google" {
  project = "744895722272"
  region  = "europe-west1"
  zone    = "europe-west1-b"
}

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}
