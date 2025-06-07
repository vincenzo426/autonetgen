# AutonetGen - Cloud Storage Configuration

# Main application storage bucket
resource "google_storage_bucket" "app_storage" {
  name     = "${local.name_prefix}-storage-${local.suffix}"
  location = var.storage_location

  labels = local.labels

  # Security settings
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Versioning for important files
  versioning {
    enabled = true
  }

  # Lifecycle management to control costs
  lifecycle_rule {
    condition {
      age = var.storage_lifecycle_days
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      age                   = 7
      matches_storage_class = ["NEARLINE", "COLDLINE"]
    }
    action {
      type = "Delete"
    }
  }

  # Automatic storage class transitions
  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  # CORS configuration for frontend access
  cors {
    origin          = ["*"]
    method          = ["GET", "POST", "PUT", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.required_apis]
}

# Storage bucket for temporary uploads
resource "google_storage_bucket" "temp_uploads" {
  name     = "${local.name_prefix}-uploads-${local.suffix}"
  location = var.storage_location

  labels = merge(local.labels, {
    purpose = "temporary-uploads"
  })

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Short lifecycle for temporary files
  lifecycle_rule {
    condition {
      age = 1
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Storage bucket for generated outputs
resource "google_storage_bucket" "outputs" {
  name     = "${local.name_prefix}-outputs-${local.suffix}"
  location = var.storage_location

  labels = merge(local.labels, {
    purpose = "generated-outputs"
  })

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  # Longer retention for outputs
  lifecycle_rule {
    condition {
      age = var.storage_lifecycle_days * 2
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  depends_on = [google_project_service.required_apis]
}

# IAM binding for Cloud Run service account to access storage
resource "google_storage_bucket_iam_member" "app_storage_access" {
  bucket = google_storage_bucket.app_storage.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_storage_bucket_iam_member" "temp_uploads_access" {
  bucket = google_storage_bucket.temp_uploads.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_storage_bucket_iam_member" "outputs_access" {
  bucket = google_storage_bucket.outputs.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Storage notification for processed files (optional)
resource "google_pubsub_topic" "storage_notifications" {
  name = "${local.name_prefix}-storage-notifications-${local.suffix}"

  labels = local.labels

  depends_on = [google_project_service.required_apis]
}

resource "google_storage_notification" "app_storage_notification" {
  bucket         = google_storage_bucket.app_storage.name
  payload_format = "JSON_API_V1"
  topic          = google_pubsub_topic.storage_notifications.id
  event_types    = ["OBJECT_FINALIZE", "OBJECT_DELETE"]

  depends_on = [google_pubsub_topic_iam_member.storage_notification]
}

# IAM for Cloud Storage to publish to Pub/Sub
data "google_storage_project_service_account" "gcs_account" {
  depends_on = [google_project_service.required_apis]
}

resource "google_pubsub_topic_iam_member" "storage_notification" {
  topic  = google_pubsub_topic.storage_notifications.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}