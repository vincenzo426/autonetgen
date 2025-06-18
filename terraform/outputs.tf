# outputs.tf - Output del modulo Terraform autonetgen

# === OUTPUT PRINCIPALI ===

output "frontend_url" {
  description = "URL pubblico del frontend AutoNetGen"
  value       = var.enable_load_balancer && var.load_balancer_domain != "" ? "https://${var.load_balancer_domain}" : google_cloud_run_service.frontend.status[0].url
}

output "backend_url" {
  description = "URL pubblico del backend AutoNetGen"
  value       = var.enable_load_balancer && var.load_balancer_domain != "" ? "https://${var.load_balancer_domain}/api" : google_cloud_run_service.backend.status[0].url
}

output "load_balancer_ip" {
  description = "Indirizzo IP statico del Load Balancer (se abilitato)"
  value       = var.enable_load_balancer ? google_compute_global_address.autonetgen_ip[0].address : null
}

output "load_balancer_url" {
  description = "URL del Load Balancer"
  value       = var.enable_load_balancer ? (var.load_balancer_domain != "" ? "https://${var.load_balancer_domain}" : "http://${google_compute_global_address.autonetgen_ip[0].address}") : null
}

# === OUTPUT STORAGE ===

output "storage_bucket_name" {
  description = "Nome del bucket Cloud Storage per i file"
  value       = google_storage_bucket.autonetgen_storage.name
}

output "storage_bucket_url" {
  description = "URL del bucket Cloud Storage"
  value       = google_storage_bucket.autonetgen_storage.url
}

# === OUTPUT SERVICE ACCOUNTS ===

output "service_account_email" {
  description = "Email del service account utilizzato dall'applicazione"
  value       = google_service_account.autonetgen_sa.email
}

output "frontend_service_account_email" {
  description = "Email del service account del frontend"
  value       = google_service_account.frontend_sa.email
}

# === OUTPUT PROGETTO E REGIONE ===

output "project_id" {
  description = "ID del progetto utilizzato"
  value       = var.project_id
}

output "region" {
  description = "Regione del deployment"
  value       = var.region
}

# === OUTPUT SERVIZI CLOUD RUN ===

output "backend_service_name" {
  description = "Nome del servizio Cloud Run per il backend"
  value       = google_cloud_run_service.backend.name
}

output "frontend_service_name" {
  description = "Nome del servizio Cloud Run per il frontend"
  value       = google_cloud_run_service.frontend.name
}

output "backend_direct_url" {
  description = "URL diretto del servizio Cloud Run backend"
  value       = google_cloud_run_service.backend.status[0].url
}

output "frontend_direct_url" {
  description = "URL diretto del servizio Cloud Run frontend"
  value       = google_cloud_run_service.frontend.status[0].url
}

# === OUTPUT VPC E NETWORKING ===

output "vpc_network_id" {
  description = "ID della VPC AutoNetGen"
  value       = google_compute_network.autonetgen_vpc.id
}

output "vpc_network_name" {
  description = "Nome della VPC AutoNetGen"
  value       = google_compute_network.autonetgen_vpc.name
}

output "frontend_subnet_id" {
  description = "ID della subnet del frontend"
  value       = google_compute_subnetwork.frontend_subnet.id
}

output "backend_subnet_id" {
  description = "ID della subnet del backend"
  value       = google_compute_subnetwork.backend_subnet.id
}

output "vpc_connector_id" {
  description = "ID del VPC Connector"
  value       = google_vpc_access_connector.autonetgen_connector.id
}

output "cloud_nat_ip" {
  description = "IP del Cloud NAT Gateway"
  value       = google_compute_router_nat.autonetgen_nat.name
}

# === OUTPUT COMPLETO DEPLOYMENT ===

output "deployment_info" {
  description = "Informazioni complete del deployment"
  value = {
    # Servizi principali
    frontend = {
      url               = var.enable_load_balancer && var.load_balancer_domain != "" ? "https://${var.load_balancer_domain}" : google_cloud_run_service.frontend.status[0].url
      direct_url        = google_cloud_run_service.frontend.status[0].url
      service_name      = google_cloud_run_service.frontend.name
      location          = google_cloud_run_service.frontend.location
      service_account   = google_service_account.frontend_sa.email
    }
    backend = {
      url               = var.enable_load_balancer && var.load_balancer_domain != "" ? "https://${var.load_balancer_domain}/api" : google_cloud_run_service.backend.status[0].url
      direct_url        = google_cloud_run_service.backend.status[0].url
      service_name      = google_cloud_run_service.backend.name
      location          = google_cloud_run_service.backend.location
      service_account   = google_service_account.autonetgen_sa.email
    }
    
    # Storage
    storage = {
      bucket_name = google_storage_bucket.autonetgen_storage.name
      bucket_url  = google_storage_bucket.autonetgen_storage.url
    }
    
    # Networking
    networking = {
      vpc_name            = google_compute_network.autonetgen_vpc.name
      frontend_subnet     = google_compute_subnetwork.frontend_subnet.name
      backend_subnet      = google_compute_subnetwork.backend_subnet.name
      vpc_connector       = google_vpc_access_connector.autonetgen_connector.name
      load_balancer_enabled = var.enable_load_balancer
      load_balancer_ip    = var.enable_load_balancer ? google_compute_global_address.autonetgen_ip[0].address : null
      load_balancer_domain = var.load_balancer_domain != "" ? var.load_balancer_domain : null
    }
  }
}

# === OUTPUT COMANDI UTILI ===

output "quick_access_commands" {
  description = "Comandi utili per gestire il deployment"
  value = {
    # Logging
    view_frontend_logs = "gcloud logging read 'resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_service.frontend.name}\"' --project=${var.project_id} --limit=50"
    view_backend_logs  = "gcloud logging read 'resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_service.backend.name}\"' --project=${var.project_id} --limit=50"
    
    # Storage
    list_storage_files = "gsutil ls gs://${google_storage_bucket.autonetgen_storage.name}/"
    
    # Cloud Run
    update_frontend    = "gcloud run deploy ${google_cloud_run_service.frontend.name} --region=${var.region} --project=${var.project_id}"
    update_backend     = "gcloud run deploy ${google_cloud_run_service.backend.name} --region=${var.region} --project=${var.project_id}"
    
    # Networking
    describe_vpc       = "gcloud compute networks describe ${google_compute_network.autonetgen_vpc.name} --project=${var.project_id}"
    list_subnets       = "gcloud compute networks subnets list --network=${google_compute_network.autonetgen_vpc.name} --project=${var.project_id}"
    describe_nat       = "gcloud compute routers nats describe ${google_compute_router_nat.autonetgen_nat.name} --router=${google_compute_router.autonetgen_router.name} --region=${var.region} --project=${var.project_id}"
    
    # Load Balancer (se abilitato)
    describe_lb        = var.enable_load_balancer ? "gcloud compute url-maps describe ${google_compute_url_map.autonetgen_url_map[0].name} --project=${var.project_id}" : "Load Balancer non abilitato"
    check_ssl_cert     = var.enable_load_balancer && var.load_balancer_domain != "" ? "gcloud compute ssl-certificates describe ${google_compute_managed_ssl_certificate.autonetgen_ssl[0].name} --project=${var.project_id}" : "Certificato SSL non configurato"
  }
}

# === OUTPUT CONFIGURAZIONE DNS ===

output "dns_configuration" {
  description = "Configurazione DNS necessaria per il dominio personalizzato"
  value = var.enable_load_balancer && var.load_balancer_domain != "" ? {
    message = "Per completare la configurazione, aggiungi questo record DNS:"
    domain  = var.load_balancer_domain
    type    = "A"
    value   = google_compute_global_address.autonetgen_ip[0].address
    ttl     = "300"
    example = "Aggiungi nel tuo provider DNS: ${var.load_balancer_domain} A ${google_compute_global_address.autonetgen_ip[0].address}"
  } : {
    message = "Configurazione DNS non necessaria (Load Balancer disabilitato o dominio non specificato)"
  }
}

# === OUTPUT STIMA COSTI ===

output "estimated_monthly_cost" {
  description = "Stima dei costi mensili (solo indicativa)"
  value = {
    cloud_run_base      = "~$0-5 USD (dipende dall'utilizzo)"
    cloud_storage_base  = "~$1-3 USD (dipende dai file archiviati)"
    vpc_costs          = "~$1-2 USD (VPC Connector e Cloud NAT)"
    load_balancer_costs = var.enable_load_balancer ? "~$18-25 USD (Load Balancer globale)" : "$0 (disabilitato)"
    network_egress      = "~$0-5 USD (dipende dal traffico)"
    total_estimated     = var.enable_load_balancer ? "~$20-40 USD/mese" : "~$2-15 USD/mese"
    note               = "I costi dipendono dall'utilizzo effettivo. Cloud Run scala a zero quando non in uso. Il Load Balancer ha un costo fisso mensile."
  }
}

# === OUTPUT SECURITY ===

output "security_info" {
  description = "Informazioni sulla sicurezza del deployment"
  value = {
    vpc_isolation       = "Servizi isolati in VPC privata con egress controllato"
    cloud_run_access    = var.enable_load_balancer ? "Accesso tramite Load Balancer" : "Accesso diretto con IAM"
    ssl_status         = var.enable_load_balancer && var.load_balancer_domain != "" ? "Certificato SSL gestito automaticamente" : "HTTPS nativo Cloud Run"
    firewall_rules     = "Regole firewall configurate per health check Load Balancer"
    nat_gateway        = "Cloud NAT configurato per accesso internet in uscita"
    service_accounts   = "Service account dedicati con principio del minimo privilegio"
  }
}

# === OUTPUT MONITORAGGIO ===

output "monitoring_urls" {
  description = "URL per monitoraggio e debugging"
  value = {
    cloud_console_run      = "https://console.cloud.google.com/run?project=${var.project_id}"
    cloud_console_vpc      = "https://console.cloud.google.com/networking/networks/details/${google_compute_network.autonetgen_vpc.name}?project=${var.project_id}"
    cloud_console_lb       = var.enable_load_balancer ? "https://console.cloud.google.com/net-services/loadbalancing/loadBalancers/list?project=${var.project_id}" : null
    cloud_console_storage  = "https://console.cloud.google.com/storage/browser/${google_storage_bucket.autonetgen_storage.name}?project=${var.project_id}"
    cloud_console_logs     = "https://console.cloud.google.com/logs/query?project=${var.project_id}"
    cloud_console_monitoring = "https://console.cloud.google.com/monitoring?project=${var.project_id}"
  }
}