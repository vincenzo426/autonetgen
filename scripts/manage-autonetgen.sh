#!/bin/bash
# AutonetGen Management Utility Script
# Provides common operations for managing AutonetGen on GCP

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${PURPLE}[STEP]${NC} $1"; }

# Get project configuration from Terraform
get_project_config() {
    cd "$TERRAFORM_DIR"
    
    if [ ! -f "terraform.tfstate" ]; then
        log_error "Terraform state not found. Please deploy first."
        exit 1
    fi
    
    PROJECT_ID=$(terraform output -raw project_id 2>/dev/null || echo "")
    REGION=$(terraform output -raw region 2>/dev/null || echo "us-central1")
    FRONTEND_SERVICE=$(terraform output -raw frontend_service_name 2>/dev/null || echo "")
    BACKEND_SERVICE=$(terraform output -raw backend_service_name 2>/dev/null || echo "")
    
    if [ -z "$PROJECT_ID" ]; then
        log_error "Could not determine project configuration"
        exit 1
    fi
    
    cd - > /dev/null
}

# Display help
show_help() {
    echo "AutonetGen Management Utility"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  status        Show application status"
    echo "  logs          View application logs"
    echo "  deploy        Deploy/update application"
    echo "  scale         Scale services"
    echo "  backup        Backup application data"
    echo "  restore       Restore application data"
    echo "  monitor       Open monitoring dashboard"
    echo "  test          Run health checks"
    echo "  cleanup       Clean up temporary resources"
    echo "  destroy       Destroy all resources"
    echo ""
    echo "Options:"
    echo "  --service SERVICENAME    Target specific service (frontend/backend)"
    echo "  --follow                 Follow logs in real-time"
    echo "  --since DURATION         Show logs since duration (e.g., 1h, 30m)"
    echo "  --instances N            Number of instances to scale to"
    echo "  --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 logs --service backend --follow"
    echo "  $0 scale --service frontend --instances 5"
    echo "  $0 deploy"
    echo ""
}

# Show application status
show_status() {
    log_step "Checking AutonetGen status..."
    
    get_project_config
    
    echo "Project Configuration:"
    echo "  Project ID: $PROJECT_ID"
    echo "  Region: $REGION"
    echo "  Frontend Service: $FRONTEND_SERVICE"
    echo "  Backend Service: $BACKEND_SERVICE"
    echo ""
    
    # Check Cloud Run services
    log_info "Cloud Run Services:"
    gcloud run services list --region=$REGION --project=$PROJECT_ID --format="table(metadata.name,status.url,status.conditions[0].type,spec.template.spec.containers[0].image)"
    echo ""
    
    # Check recent deployments
    log_info "Recent Deployments:"
    gcloud run revisions list --region=$REGION --project=$PROJECT_ID --limit=5 --format="table(metadata.name,metadata.creationTimestamp,status.conditions[0].type)"
    echo ""
    
    # Check application URLs
    cd "$TERRAFORM_DIR"
    APP_URL=$(terraform output -raw application_url 2>/dev/null || echo "Not available")
    API_URL=$(terraform output -raw api_url 2>/dev/null || echo "Not available")
    
    echo "Application URLs:"
    echo "  Frontend: $APP_URL"
    echo "  API: $API_URL"
    echo ""
    cd - > /dev/null
}

# View application logs
view_logs() {
    local service="$1"
    local follow="${2:-false}"
    local since="${3:-1h}"
    
    get_project_config
    
    if [ "$service" = "frontend" ]; then
        target_service="$FRONTEND_SERVICE"
    elif [ "$service" = "backend" ]; then
        target_service="$BACKEND_SERVICE"
    elif [ -z "$service" ]; then
        log_info "Showing logs for all services"
        target_service=""
    else
        log_error "Unknown service: $service"
        exit 1
    fi
    
    if [ -z "$target_service" ]; then
        # Show logs for both services
        log_info "Frontend logs (last 50 entries):"
        gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$FRONTEND_SERVICE" --limit 50 --project $PROJECT_ID --format="table(timestamp,severity,textPayload)"
        
        echo ""
        log_info "Backend logs (last 50 entries):"
        gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$BACKEND_SERVICE" --limit 50 --project $PROJECT_ID --format="table(timestamp,severity,textPayload)"
    else
        log_info "Showing logs for $target_service"
        
        if [ "$follow" = "true" ]; then
            # Stream logs in real-time
            gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=$target_service" --project $PROJECT_ID
        else
            # Show recent logs
            gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$target_service" --limit 100 --project $PROJECT_ID --format="table(timestamp,severity,textPayload)"
        fi
    fi
}

# Deploy application
deploy_application() {
    log_step "Deploying AutonetGen application..."
    
    get_project_config
    
    # Run deployment script
    if [ -f "$PROJECT_ROOT/deploy-autonetgen.sh" ]; then
        cd "$PROJECT_ROOT"
        ./deploy-autonetgen.sh
    else
        log_error "Deployment script not found"
        exit 1
    fi
    
    log_success "Deployment completed"
}

# Scale services
scale_services() {
    local service="$1"
    local instances="$2"
    
    get_project_config
    
    if [ -z "$service" ] || [ -z "$instances" ]; then
        log_error "Service and instance count required for scaling"
        exit 1
    fi
    
    if [ "$service" = "frontend" ]; then
        target_service="$FRONTEND_SERVICE"
    elif [ "$service" = "backend" ]; then
        target_service="$BACKEND_SERVICE"
    else
        log_error "Unknown service: $service"
        exit 1
    fi
    
    log_info "Scaling $target_service to $instances instances..."
    
    gcloud run services update $target_service \
        --max-instances=$instances \
        --region=$REGION \
        --project=$PROJECT_ID
    
    log_success "Service scaled successfully"
}

# Backup application data
backup_data() {
    log_step "Backing up AutonetGen data..."
    
    get_project_config
    
    local backup_date=$(date +%Y%m%d_%H%M%S)
    local backup_bucket="autonetgen-backups-${PROJECT_ID}"
    
    # Create backup bucket if it doesn't exist
    if ! gsutil ls gs://$backup_bucket &>/dev/null; then
        log_info "Creating backup bucket..."
        gsutil mb gs://$backup_bucket
    fi
    
    # Backup Cloud Storage data
    cd "$TERRAFORM_DIR"
    local storage_buckets=$(terraform output -json storage_buckets | jq -r '.[]')
    
    for bucket in $storage_buckets; do
        log_info "Backing up bucket: $bucket"
        gsutil -m cp -r gs://$bucket gs://$backup_bucket/backup_${backup_date}/
    done
    
    # Backup Terraform state
    log_info "Backing up Terraform state..."
    gsutil cp terraform.tfstate gs://$backup_bucket/terraform_state_${backup_date}.tfstate
    
    cd - > /dev/null
    
    log_success "Backup completed to gs://$backup_bucket/backup_${backup_date}/"
}

# Test application health
test_application() {
    log_step "Running health checks..."
    
    get_project_config
    
    cd "$TERRAFORM_DIR"
    local app_url=$(terraform output -raw application_url 2>/dev/null || echo "")
    local api_url=$(terraform output -raw api_url 2>/dev/null || echo "")
    
    if [ -z "$app_url" ]; then
        log_error "Could not determine application URL"
        exit 1
    fi
    
    # Test frontend health
    log_info "Testing frontend health..."
    if curl -s -f "$app_url/health" >/dev/null; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
    fi
    
    # Test backend API health
    log_info "Testing backend API health..."
    if curl -s -f "$api_url/health" >/dev/null; then
        log_success "Backend API health check passed"
    else
        log_error "Backend API health check failed"
    fi
    
    # Test API functionality
    log_info "Testing API functionality..."
    local api_response=$(curl -s "$api_url/health" | jq -r '.status' 2>/dev/null || echo "error")
    if [ "$api_response" = "ok" ]; then
        log_success "API functionality test passed"
    else
        log_warning "API functionality test failed or returned unexpected response"
    fi
    
    cd - > /dev/null
}

# Open monitoring dashboard
open_monitoring() {
    get_project_config
    
    local monitoring_url="https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
    
    log_info "Opening monitoring dashboard..."
    log_info "URL: $monitoring_url"
    
    # Try to open in browser (works on macOS and most Linux distributions)
    if command -v open >/dev/null 2>&1; then
        open "$monitoring_url"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$monitoring_url"
    else
        log_info "Please open the URL manually in your browser"
    fi
}

# Cleanup temporary resources
cleanup_resources() {
    log_step "Cleaning up temporary resources..."
    
    get_project_config
    
    # Clean up old Cloud Run revisions (keep last 5)
    log_info "Cleaning up old Cloud Run revisions..."
    
    for service in "$FRONTEND_SERVICE" "$BACKEND_SERVICE"; do
        local revisions=$(gcloud run revisions list --service=$service --region=$REGION --project=$PROJECT_ID --format="value(metadata.name)" --sort-by="~metadata.creationTimestamp" | tail -n +6)
        
        for revision in $revisions; do
            log_info "Deleting revision: $revision"
            gcloud run revisions delete $revision --region=$REGION --project=$PROJECT_ID --quiet
        done
    done
    
    # Clean up old container images (keep last 10)
    log_info "Cleaning up old container images..."
    local registry_name=$(cd "$TERRAFORM_DIR" && terraform output -json container_registry | jq -r '.repository_name')
    
    for image in "frontend" "backend"; do
        local old_images=$(gcloud artifacts docker images list "$REGION-docker.pkg.dev/$PROJECT_ID/$registry_name/$image" --sort-by="~CREATE_TIME" --format="value(IMAGE)" | tail -n +11)
        
        for old_image in $old_images; do
            log_info "Deleting image: $old_image"
            gcloud artifacts docker images delete "$old_image" --quiet
        done
    done
    
    log_success "Cleanup completed"
}

# Destroy all resources
destroy_resources() {
    log_warning "This will destroy ALL AutonetGen resources!"
    read -p "Are you sure? Type 'yes' to confirm: " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Destruction cancelled"
        return
    fi
    
    log_step "Destroying AutonetGen resources..."
    
    cd "$TERRAFORM_DIR"
    terraform destroy -auto-approve
    cd - > /dev/null
    
    log_success "All resources destroyed"
}

# Parse command line arguments
parse_args() {
    COMMAND=""
    SERVICE=""
    FOLLOW=false
    SINCE="1h"
    INSTANCES=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            status|logs|deploy|scale|backup|restore|monitor|test|cleanup|destroy)
                COMMAND="$1"
                shift
                ;;
            --service)
                SERVICE="$2"
                shift 2
                ;;
            --follow)
                FOLLOW=true
                shift
                ;;
            --since)
                SINCE="$2"
                shift 2
                ;;
            --instances)
                INSTANCES="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Main execution
main() {
    parse_args "$@"
    
    if [ -z "$COMMAND" ]; then
        show_help
        exit 1
    fi
    
    case $COMMAND in
        status)
            show_status
            ;;
        logs)
            view_logs "$SERVICE" "$FOLLOW" "$SINCE"
            ;;
        deploy)
            deploy_application
            ;;
        scale)
            scale_services "$SERVICE" "$INSTANCES"
            ;;
        backup)
            backup_data
            ;;
        test)
            test_application
            ;;
        monitor)
            open_monitoring
            ;;
        cleanup)
            cleanup_resources
            ;;
        destroy)
            destroy_resources
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"