# AutonetGen - Global Load Balancer Configuration

# Reserve a global static IP address
resource "google_compute_global_address" "default" {
  name         = "${local.name_prefix}-ip-${local.suffix}"
  address_type = "EXTERNAL"

  depends_on = [google_project_service.required_apis]
}

# Managed SSL certificate (if domain provided)
resource "google_compute_managed_ssl_certificate" "default" {
  count = var.domain_name != null ? 1 : 0

  name = "${local.name_prefix}-ssl-${local.suffix}"

  managed {
    domains = [var.domain_name]
  }

  depends_on = [google_project_service.required_apis]
}

# Network Endpoint Groups for Cloud Run services
resource "google_compute_region_network_endpoint_group" "frontend_neg" {
  name                  = "${local.name_prefix}-frontend-neg-${local.suffix}"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.frontend.name
  }

  depends_on = [google_cloud_run_v2_service.frontend]
}

resource "google_compute_region_network_endpoint_group" "backend_neg" {
  name                  = "${local.name_prefix}-backend-neg-${local.suffix}"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.backend.name
  }

  depends_on = [google_cloud_run_v2_service.backend]
}

# Backend Services
resource "google_compute_backend_service" "frontend_backend" {
  name        = "${local.name_prefix}-frontend-backend-${local.suffix}"
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg.id
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_compute_backend_service" "backend_backend" {
  name        = "${local.name_prefix}-backend-backend-${local.suffix}"
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 300

  backend {
    group = google_compute_region_network_endpoint_group.backend_neg.id
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  depends_on = [google_project_service.required_apis]
}

# URL Map
resource "google_compute_url_map" "default" {
  name            = "${local.name_prefix}-url-map-${local.suffix}"
  default_service = google_compute_backend_service.frontend_backend.id

  host_rule {
    hosts        = var.domain_name != null ? [var.domain_name] : ["*"]
    path_matcher = "allpaths"
  }

  path_matcher {
    name            = "allpaths"
    default_service = google_compute_backend_service.frontend_backend.id

    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.backend_backend.id
    }

    path_rule {
      paths   = ["/health"]
      service = google_compute_backend_service.frontend_backend.id
    }
  }

  depends_on = [google_project_service.required_apis]
}

# HTTPS Target Proxy
resource "google_compute_target_https_proxy" "default" {
  count = var.domain_name != null ? 1 : 0

  name             = "${local.name_prefix}-https-proxy-${local.suffix}"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default[0].id]

  depends_on = [google_project_service.required_apis]
}

# HTTP Target Proxy (for redirect or fallback)
resource "google_compute_target_http_proxy" "default" {
  name    = "${local.name_prefix}-http-proxy-${local.suffix}"
  url_map = var.enable_https_redirect && var.domain_name != null ? google_compute_url_map.https_redirect[0].id : google_compute_url_map.default.id

  depends_on = [google_project_service.required_apis]
}

# HTTPS Redirect URL Map (if HTTPS redirect enabled)
resource "google_compute_url_map" "https_redirect" {
  count = var.enable_https_redirect && var.domain_name != null ? 1 : 0

  name = "${local.name_prefix}-https-redirect-${local.suffix}"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }

  depends_on = [google_project_service.required_apis]
}

# Global Forwarding Rules
resource "google_compute_global_forwarding_rule" "https" {
  count = var.domain_name != null ? 1 : 0

  name       = "${local.name_prefix}-https-rule-${local.suffix}"
  target     = google_compute_target_https_proxy.default[0].id
  port_range = "443"
  ip_address = google_compute_global_address.default.address

  depends_on = [google_project_service.required_apis]
}

resource "google_compute_global_forwarding_rule" "http" {
  name       = "${local.name_prefix}-http-rule-${local.suffix}"
  target     = google_compute_target_http_proxy.default.id
  port_range = "80"
  ip_address = google_compute_global_address.default.address

  depends_on = [google_project_service.required_apis]
}

# Cloud Armor Security Policy (optional, for additional protection)
resource "google_compute_security_policy" "default" {
  name        = "${local.name_prefix}-security-policy-${local.suffix}"
  description = "AutonetGen security policy"

  # Default rule - allow all
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = var.allowed_cidr_blocks
      }
    }
    description = "Default allow rule"
  }

  # Rate limiting rule
  rule {
    action   = "rate_based_ban"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
      ban_duration_sec = 300
    }
    description = "Rate limiting rule"
  }

  depends_on = [google_project_service.required_apis]
}

# Apply security policy to backend service
resource "google_compute_backend_service" "frontend_backend_with_security" {
  count = length(var.allowed_cidr_blocks) > 0 ? 1 : 0

  name            = "${local.name_prefix}-frontend-secure-${local.suffix}"
  protocol        = "HTTP"
  port_name       = "http"
  timeout_sec     = 30
  security_policy = google_compute_security_policy.default.id

  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg.id
  }

  depends_on = [google_project_service.required_apis]
}