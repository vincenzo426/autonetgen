# terraform.tf - Configurazione versioni e backend per autonetgen

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
  
  # Backend configuration (da personalizzare)
  # Decommentare e personalizzare per utilizzare un backend remoto
  # backend "gcs" {
  #   bucket = "YOUR_PROJECT_ID-terraform-state"
  #   prefix = "autonetgen/state"
  # }
}

# Provider di default
provider "google" {
  # Il project viene impostato tramite variabile
  region = var.region
}

# Provider beta per funzionalità avanzate (se necessario)
provider "google-beta" {
  # Il project viene impostato tramite variabile
  region = var.region
}