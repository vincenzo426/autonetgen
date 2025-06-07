# AutonetGen - Monitoring and Alerting Configuration

# Notification Channel for alerts
resource "google_monitoring_notification_channel" "email" {
  count = var.enable_monitoring && var.notification_email != null ? 1 : 0

  display_name = "AutonetGen Email Notifications"
  type         = "email"
  labels = {
    email_address = var.notification_email
  }

  depends_on = [google_project_service.required_apis]
}

# Uptime check for frontend
resource "google_monitoring_uptime_check_config" "frontend_uptime" {
  count = var.enable_monitoring ? 1 : 0

  display_name = "AutonetGen Frontend Uptime"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path           = "/health"
    port           = "443"
    use_ssl        = var.domain_name != null
    validate_ssl   = var.domain_name != null
    request_method = "GET"
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      host       = var.domain_name != null ? var.domain_name : google_compute_global_address.default.address
      project_id = var.project_id
    }
  }

  content_matchers {
    content = "OK"
    matcher = "CONTAINS_STRING"
  }

  depends_on = [google_project_service.required_apis]
}

# Uptime check for backend API
resource "google_monitoring_uptime_check_config" "backend_uptime" {
  count = var.enable_monitoring ? 1 : 0

  display_name = "AutonetGen Backend API Uptime"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path           = "/api/health"
    port           = "443"
    use_ssl        = var.domain_name != null
    validate_ssl   = var.domain_name != null
    request_method = "GET"
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      host       = var.domain_name != null ? var.domain_name : google_compute_global_address.default.address
      project_id = var.project_id
    }
  }

  content_matchers {
    content = "OK"
    matcher = "CONTAINS_STRING"
  }

  depends_on = [google_project_service.required_apis]
}

# Alert Policy for uptime failures
resource "google_monitoring_alert_policy" "uptime_alert" {
  count = var.enable_monitoring && var.notification_email != null ? 1 : 0

  display_name = "AutonetGen Uptime Alert"
  combiner     = "OR"

  conditions {
    display_name = "Frontend Uptime Check"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.labels.check_id=\"${google_monitoring_uptime_check_config.frontend_uptime[0].uptime_check_id}\""
      duration        = "300s"
      comparison      = "COMPARISON_EQUAL"
      threshold_value = 0
      
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"
      }
    }
  }

  conditions {
    display_name = "Backend API Uptime Check"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.labels.check_id=\"${google_monitoring_uptime_check_config.backend_uptime[0].uptime_check_id}\""
      duration        = "300s"
      comparison      = "COMPARISON_EQUAL"
      threshold_value = 0
      
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].id]

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [google_project_service.required_apis]
}

# Alert Policy for Cloud Run errors
resource "google_monitoring_alert_policy" "cloud_run_errors" {
  count = var.enable_monitoring && var.notification_email != null ? 1 : 0

  display_name = "AutonetGen Cloud Run Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "High Error Rate"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10
      
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].id]

  depends_on = [google_project_service.required_apis]
}

# Cloud Run CPU Utilization Alert
resource "google_monitoring_alert_policy" "cpu_utilization" {
  count = var.enable_monitoring && var.notification_email != null ? 1 : 0

  display_name = "AutonetGen High CPU Utilization"
  combiner     = "OR"

  conditions {
    display_name = "High CPU Usage"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/container/cpu/utilizations\" AND resource.type=\"cloud_run_revision\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].id]

  depends_on = [google_project_service.required_apis]
}