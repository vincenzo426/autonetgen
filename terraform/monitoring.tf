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
      comparison      = "COMPARISON_GREATER_THAN"
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
      comparison      = "COMPARISON_GREATER_THAN"
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

# Budget Alert
resource "google_billing_budget" "autonetgen_budget" {
  count = var.enable_budget_alerts ? 1 : 0

  billing_account = data.google_billing_account.account.id
  display_name    = "AutonetGen Monthly Budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis      = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.8
    spend_basis      = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis      = "CURRENT_SPEND"
  }

  dynamic "all_updates_rule" {
    for_each = var.notification_email != null ? [1] : []
    content {
      monitoring_notification_channels = var.enable_monitoring ? [google_monitoring_notification_channel.email[0].id] : []
      disable_default_iam_recipients   = true
    }
  }
}

# Data source for billing account
data "google_billing_account" "account" {
  display_name = "My Billing Account"
  open         = true
}

# Custom Dashboard for AutonetGen
resource "google_monitoring_dashboard" "autonetgen_dashboard" {
  count = var.enable_monitoring ? 1 : 0

  dashboard_json = jsonencode({
    displayName = "AutonetGen Dashboard"
    mosaicLayout = {
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "Cloud Run Request Count"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["resource.labels.service_name"]
                    }
                  }
                }
                plotType = "LINE"
              }]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Requests/second"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          yPos   = 0
          xPos   = 6
          widget = {
            title = "Cloud Run Memory Utilization"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/container/memory/utilizations\" AND resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
                plotType = "LINE"
              }]
              yAxis = {
                label = "Memory Utilization"
                scale = "LINEAR"
              }
            }
          }
        }
      ]
    }
  })

  depends_on = [google_project_service.required_apis]
}