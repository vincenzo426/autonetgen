# outputs.tf - Output del modulo Terraform autonetgen

output "frontend_url" {
  description = "URL pubblico del frontend AutoNetGen"
  value       = google_cloud_run_service.frontend.status[0].url
}

output "backend_url" {
  description = "URL pubblico del backend AutoNetGen"
  value       = google_cloud_run_service.backend.status[0].url
}

output "storage_bucket_name" {
  description = "Nome del bucket Cloud Storage per i file"
  value       = google_storage_bucket.autonetgen_storage.name
}

output "storage_bucket_url" {
  description = "URL del bucket Cloud Storage"
  value       = google_storage_bucket.autonetgen_storage.url
}

output "service_account_email" {
  description = "Email del service account utilizzato dall'applicazione"
  value       = google_service_account.autonetgen_sa.email
}

output "project_id" {
  description = "ID del progetto utilizzato"
  value       = var.project_id
}

output "region" {
  description = "Regione del deployment"
  value       = var.region
}

output "backend_service_name" {
  description = "Nome del servizio Cloud Run per il backend"
  value       = google_cloud_run_service.backend.name
}

output "frontend_service_name" {
  description = "Nome del servizio Cloud Run per il frontend"
  value       = google_cloud_run_service.frontend.name
}

output "deployment_info" {
  description = "Informazioni complete del deployment"
  value = {
    frontend = {
      url          = google_cloud_run_service.frontend.status[0].url
      service_name = google_cloud_run_service.frontend.name
      location     = google_cloud_run_service.frontend.location
    }
    backend = {
      url          = google_cloud_run_service.backend.status[0].url
      service_name = google_cloud_run_service.backend.name
      location     = google_cloud_run_service.backend.location
    }
    storage = {
      bucket_name = google_storage_bucket.autonetgen_storage.name
      bucket_url  = google_storage_bucket.autonetgen_storage.url
    }
    service_account = {
      email = google_service_account.autonetgen_sa.email
    }
  }
}

output "quick_access_commands" {
  description = "Comandi utili per gestire il deployment"
  value = {
    view_frontend_logs = "gcloud logging read 'resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_service.frontend.name}\"' --project=${var.project_id} --limit=50"
    view_backend_logs  = "gcloud logging read 'resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_service.backend.name}\"' --project=${var.project_id} --limit=50"
    list_storage_files = "gsutil ls gs://${google_storage_bucket.autonetgen_storage.name}/"
    update_frontend    = "gcloud run deploy ${google_cloud_run_service.frontend.name} --region=${var.region} --project=${var.project_id}"
    update_backend     = "gcloud run deploy ${google_cloud_run_service.backend.name} --region=${var.region} --project=${var.project_id}"
  }
}

output "estimated_monthly_cost" {
  description = "Stima dei costi mensili (solo indicativa)"
  value = {
    cloud_run_base      = "~$0-5 USD (dipende dall'utilizzo)"
    cloud_storage_base  = "~$1-3 USD (dipende dai file archiviati)"
    network_egress      = "~$0-2 USD (dipende dal traffico)"
    total_estimated     = "~$1-10 USD/mese per utilizzo normale"
    note               = "I costi dipendono dall'utilizzo effettivo. Cloud Run scala a zero quando non in uso."
  }
}