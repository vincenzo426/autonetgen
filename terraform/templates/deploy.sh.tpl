#!/bin/bash
# AutonetGen Deployment Script for GCP
set -e

# Configuration
PROJECT_ID="${project_id}"
REGION="${region}"
REGISTRY_NAME="${registry_name}"
FRONTEND_SERVICE="${frontend_service}"
BACKEND_SERVICE="${backend_service}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "$${BLUE}[INFO]$${NC} $1"
}

log_success() {
    echo -e "$${GREEN}[SUCCESS]$${NC} $1"
}

log_warning() {
    echo -e "$${YELLOW}[WARNING]$${NC} $1"
}

log_error() {
    echo -e "$${RED}[ERROR]$${NC} $1"
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    log_success "All dependencies are available"
}

# Configure authentication
setup_auth() {
    log_info "Setting up authentication..."
    
    # Configure Docker for Artifact Registry
    gcloud auth configure-docker $${REGION}-docker.pkg.dev --quiet
    
    # Set project
    gcloud config set project $${PROJECT_ID}
    
    log_success "Authentication configured"
}

# Build and push frontend
build_frontend() {
    log_info "Building frontend container..."
    
    cd network-analyzer-gui
    
    # Build container
    docker build \
        -t $${REGION}-docker.pkg.dev/$${PROJECT_ID}/$${REGISTRY_NAME}/frontend:latest \
        -t $${REGION}-docker.pkg.dev/$${PROJECT_ID}/$${REGISTRY_NAME}/frontend:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual') \
        .
    
    # Push containers
    docker push $${REGION}-docker.pkg.dev/$${PROJECT_ID}/$${REGISTRY_NAME}/frontend:latest
    docker push $${REGION}-docker.pkg.dev/$${PROJECT_ID}/$${REGISTRY_NAME}/frontend:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')
    
    cd ..
    log_success "Frontend container built and pushed"
}

# Build and push backend
build_backend() {
    log_info "Building backend container..."
    
    # Build container
    docker build \
        -f Dockerfile.backend \
        -t $${REGION}-docker.pkg.dev/$${PROJECT_ID}/$${REGISTRY_NAME}/backend:latest \
        -t $${REGION}-docker.pkg.dev/$${PROJECT_ID}/$${REGISTRY_NAME}/backend:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual') \
        .
    
    # Push containers
    docker push $${REGION}-docker.pkg.dev/$${PROJECT_ID}/$${REGISTRY_NAME}/backend:latest
    docker push $${REGION}-docker.pkg.dev/$${PROJECT_ID}/$${REGISTRY_NAME}/backend:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')
    
    log_success "Backend container built and pushed"
}

# Deploy services
deploy_services() {
    log_info "Deploying services to Cloud Run..."
    
    # Deploy frontend
    gcloud run deploy $${FRONTEND_SERVICE} \
        --image $${REGION}-docker.pkg.dev/$${PROJECT_ID}/$${REGISTRY_NAME}/frontend:latest \
        --region $${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --quiet
    
    # Deploy backend
    gcloud run deploy $${BACKEND_SERVICE} \
        --image $${REGION}-docker.pkg.dev/$${PROJECT_ID}/$${REGISTRY_NAME}/backend:latest \
        --region $${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --memory 2Gi \
        --cpu 2 \
        --timeout 300 \
        --concurrency 50 \
        --max-instances 20 \
        --quiet
    
    log_success "Services deployed successfully"
}

# Get service URLs
get_service_urls() {
    log_info "Getting service URLs..."
    
    FRONTEND_URL=$(gcloud run services describe $${FRONTEND_SERVICE} --region=$${REGION} --format="value(status.url)")
    BACKEND_URL=$(gcloud run services describe $${BACKEND_SERVICE} --region=$${REGION} --format="value(status.url)")
    
    echo ""
    log_success "Deployment completed successfully!"
    echo ""
    echo "Service URLs:"
    echo "  Frontend: $${FRONTEND_URL}"
    echo "  Backend:  $${BACKEND_URL}"
    echo ""
    log_info "Note: If you configured a custom domain, use that instead of the Cloud Run URLs."
}

# Main execution
main() {
    echo "======================================"
    echo "   AutonetGen GCP Deployment Script"
    echo "======================================"
    echo ""
    
    check_dependencies
    setup_auth
    build_frontend
    build_backend
    deploy_services
    get_service_urls
    
    echo ""
    log_success "All done! 🚀"
}

# Run main function
main "$@"