# Modulo per il monitoring
# Gestisce logging, monitoring e alerts

# Variabili del modulo monitoring
variable "project_id" {
  description = "ID del progetto GCP"
  type        = string
}

variable "enable_monitoring" {
  description = "Abilita il monitoraggio avanzato"
  type        = bool
}

variable "log_retention_days" {
  description = "Giorni di conservazione dei log"
  type        = number
}

variable "frontend_service_id" {
  description = "ID del servizio frontend"
  type        = string
}

variable "backend_service_id" {
  description = "ID del servizio backend"
  type        = string
}

variable "database_instance_id" {
  description = "ID dell'istanza del database primario"
  type        = string
}

# Bucket per la conservazione dei log
resource "google_storage_bucket" "logs_bucket" {
  name          = "${var.project_id}-logs"
  location      = "EU"
  force_destroy = true
  
  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = var.log_retention_days
    }
    action {
      type = "Delete"
    }
  }
}

# Sink per i log del progetto
resource "google_logging_project_sink" "logs_sink" {
  name        = "project-logs-sink"
  description = "Sink per i log del progetto"
  
  destination = "storage.googleapis.com/${google_storage_bucket.logs_bucket.name}"
  
  filter = "resource.type = (\"cloud_run_revision\" OR \"cloudsql_database\" OR \"gce_instance\" OR \"gcs_bucket\")"
  
  unique_writer_identity = true
}

# IAM: permessi per il sink di log
resource "google_project_iam_binding" "log_writer" {
  project = var.project_id
  role    = "roles/storage.objectCreator"
  
  members = [
    google_logging_project_sink.logs_sink.writer_identity,
  ]
}

# Filtri dei log per il frontend
resource "google_logging_project_exclusion" "frontend_debug_exclusion" {
  name        = "frontend-debug-exclusion"
  description = "Esclude i log di debug del frontend"
  filter      = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.frontend_service_id}\" AND severity<\"WARNING\""
}

# Alert policy per errori 5xx elevati nel frontend
resource "google_monitoring_alert_policy" "frontend_error_rate" {
  display_name = "Frontend Error Rate Alert"
  combiner     = "OR"
  
  conditions {
    display_name = "High 5xx error rate"
    
    condition_threshold {
      filter     = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.frontend_service_id}\" AND metric.labels.response_code_class=\"5xx\""
      duration   = "60s"
      comparison = "COMPARISON_GT"
      
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
      
      threshold_value = 5  # Alert se più di 5 errori al minuto
    }
  }
  
  documentation {
    content   = "Il frontend sta generando un numero elevato di errori 5xx. Verificare i log e lo stato del servizio."
    mime_type = "text/markdown"
  }
  
  notification_channels = [
    google_monitoring_notification_channel.email.name
  ]
}

# Alert policy per errori del database
resource "google_monitoring_alert_policy" "database_error" {
  display_name = "Database Error Alert"
  combiner     = "OR"
  
  conditions {
    display_name = "PostgreSQL errors"
    
    condition_threshold {
      filter     = "metric.type=\"cloudsql.googleapis.com/database/postgresql/log_checkpoints\" AND resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.database_instance_id}\""
      duration   = "300s"
      comparison = "COMPARISON_GT"
      
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_COUNT"
      }
      
      threshold_value = 0  # Alert su ogni errore
    }
  }
  
  documentation {
    content   = "Errori rilevati nell'istanza PostgreSQL. Verificare i log e lo stato del database."
    mime_type = "text/markdown"
  }
  
  notification_channels = [
    google_monitoring_notification_channel.email.name
  ]
}

# Alert policy per il backend - carico elevato
resource "google_monitoring_alert_policy" "backend_high_load" {
  display_name = "Backend High Load Alert"
  combiner     = "OR"
  
  conditions {
    display_name = "High CPU utilization"
    
    condition_threshold {
      filter     = "metric.type=\"run.googleapis.com/container/cpu/utilization\" AND resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.backend_service_id}\""
      duration   = "300s"
      comparison = "COMPARISON_GT"
      
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_99"
        cross_series_reducer = "REDUCE_MEAN"
      }
      
      threshold_value = 0.85  # Alert se CPU > 85%
    }
  }
  
  documentation {
    content   = "Il backend sta subendo un carico elevato di CPU. Verificare se è necessario aumentare le risorse o scalare orizzontalmente."
    mime_type = "text/markdown"
  }
  
  notification_channels = [
    google_monitoring_notification_channel.email.name
  ]
}

# Canale di notifica email
resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Notification Channel"
  type         = "email"
  
  labels = {
    email_address = "admin@example.com"  # Sostituire con email reale
  }
}

# Canale di notifica SMS (opzionale)
resource "google_monitoring_notification_channel" "sms" {
  count        = var.enable_monitoring ? 1 : 0
  display_name = "SMS Notification Channel"
  type         = "sms"
  
  labels = {
    number = "+391234567890"  # Sostituire con numero reale
  }
}

# Dashboard di monitoraggio dell'applicazione
resource "google_monitoring_dashboard" "application_dashboard" {
  dashboard_json = <<EOF
{
  "displayName": "AutonetGen Application Dashboard",
  "gridLayout": {
    "widgets": [
      {
        "title": "Frontend Request Count",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.frontend_service_id}\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE",
                    "crossSeriesReducer": "REDUCE_SUM",
                    "groupByFields": []
                  }
                }
              },
              "plotType": "LINE"
            }
          ]
        }
      },
      {
        "title": "Backend Request Count",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.backend_service_id}\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE",
                    "crossSeriesReducer": "REDUCE_SUM",
                    "groupByFields": []
                  }
                }
              },
              "plotType": "LINE"
            }
          ]
        }
      },
      {
        "title": "Database CPU Utilization",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\" AND resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.database_instance_id}\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_MEAN"
                  }
                }
              },
              "plotType": "LINE"
            }
          ]
        }
      },
      {
        "title": "Error Rate",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND (resource.labels.service_name=\"${var.frontend_service_id}\" OR resource.labels.service_name=\"${var.backend_service_id}\") AND metric.labels.response_code_class=\"5xx\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE",
                    "crossSeriesReducer": "REDUCE_SUM",
                    "groupByFields": [
                      "resource.labels.service_name"
                    ]
                  }
                }
              },
              "plotType": "LINE"
            }
          ]
        }
      }
    ]
  }
}
EOF
}