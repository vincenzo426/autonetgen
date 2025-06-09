# terraform/pubsub.tf - NUOVO FILE
# Aggiungere questo file per configurare Pub/Sub e notifiche storage

# Abilita Pub/Sub API
resource "google_project_service" "pubsub_api" {
  service = "pubsub.googleapis.com"
  disable_dependent_services = false
}

# Topic Pub/Sub per notifiche di caricamento file
resource "google_pubsub_topic" "file_upload_notifications" {
  name = "autonetgen-file-uploads"
  
  depends_on = [google_project_service.pubsub_api]
}

# Subscription per il backend
resource "google_pubsub_subscription" "backend_file_notifications" {
  name  = "autonetgen-backend-notifications"
  topic = google_pubsub_topic.file_upload_notifications.name

  # Configurazione per Cloud Run
  push_config {
    push_endpoint = "${google_cloud_run_service.backend.status[0].url}/api/file-notification"
    
    # Autenticazione per endpoint privato
    oidc_token {
      service_account_email = google_service_account.autonetgen_sa.email
    }
  }

  # Configurazione per gestire retry
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  # TTL dei messaggi
  message_retention_duration = "1200s" # 20 minuti
}

# Notificazione storage per pubblicare su Pub/Sub
resource "google_storage_notification" "file_upload_notification" {
  bucket         = google_storage_bucket.autonetgen_storage.name
  payload_format = "JSON_API_V1"
  topic          = google_pubsub_topic.file_upload_notifications.id
  
  # Notifica solo per eventi di creazione di oggetti nella cartella uploads/
  object_name_prefix = "uploads/"
  event_types = ["OBJECT_FINALIZE"]

  depends_on = [google_pubsub_topic_iam_member.storage_publish]
}

# Permessi per Cloud Storage di pubblicare su Pub/Sub
data "google_storage_project_service_account" "gcs_account" {
}

resource "google_pubsub_topic_iam_member" "storage_publish" {
  topic  = google_pubsub_topic.file_upload_notifications.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}
