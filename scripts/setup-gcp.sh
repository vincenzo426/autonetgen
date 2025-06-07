#!/bin/bash
# AutonetGen GCP Project Setup Script
# This script initializes a new GCP project for AutonetGen deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Print banner
print_banner() {
    echo "=================================================="
    echo "        AutonetGen GCP Setup Script"
    echo "=================================================="
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first:"
        echo "  https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    # Check terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install it first:"
        echo "  https://developer.hashicorp.com/terraform/downloads"
        exit 1
    fi
    
    # Check docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first:"
        echo "  https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    log_success "All prerequisites are available"
}

# Get project configuration
get_project_config() {
    log_step "Configuring project settings..."
    
    # Get project ID
    if [ -z "$PROJECT_ID" ]; then
        read -p "Enter your GCP Project ID: " PROJECT_ID
    fi
    
    if [ -z "$PROJECT_ID" ]; then
        log_error "Project ID is required"
        exit 1
    fi
    
    # Get region
    if [ -z "$REGION" ]; then
        echo ""
        echo "Available regions (recommended for cost/performance):"
        echo "  us-central1     (Iowa) - Lowest cost"
        echo "  us-east1        (South Carolina)"
        echo "  europe-west1    (Belgium)"
        echo "  asia-southeast1 (Singapore)"
        echo ""
        read -p "Enter your preferred region [us-central1]: " REGION
        REGION=${REGION:-us-central1}
    fi
    
    # Get domain (optional)
    if [ -z "$DOMAIN_NAME" ]; then
        read -p "Enter your domain name (optional, press Enter to skip): " DOMAIN_NAME
    fi
    
    # Get notification email
    if [ -z "$NOTIFICATION_EMAIL" ]; then
        read -p "Enter email for monitoring notifications (optional): " NOTIFICATION_EMAIL
    fi
    
    log_info "Configuration:"
    log_info "  Project ID: $PROJECT_ID"
    log_info "  Region: $REGION"
    log_info "  Domain: ${DOMAIN_NAME:-"Not configured"}"
    log_info "  Notification Email: ${NOTIFICATION_EMAIL:-"Not configured"}"
    echo ""
}

# Set up GCP authentication
setup_authentication() {
    log_step "Setting up GCP authentication..."
    
    # Check if already authenticated
    if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        CURRENT_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
        log_info "Already authenticated as: $CURRENT_ACCOUNT"
        
        read -p "Do you want to use this account? (y/n): " use_current
        if [[ $use_current != "y" && $use_current != "Y" ]]; then
            gcloud auth login
        fi
    else
        log_info "Authenticating with Google Cloud..."
        gcloud auth login
    fi
    
    # Set project
    gcloud config set project $PROJECT_ID
    
    # Enable Application Default Credentials
    gcloud auth application-default login
    
    log_success "Authentication configured"
}

# Enable required APIs
enable_apis() {
    log_step "Enabling required Google Cloud APIs..."
    
    local apis=(
        "run.googleapis.com"
        "cloudbuild.googleapis.com"
        "artifactregistry.googleapis.com"
        "compute.googleapis.com"
        "storage.googleapis.com"
        "iamcredentials.googleapis.com"
        "logging.googleapis.com"
        "monitoring.googleapis.com"
        "secretmanager.googleapis.com"
        "cloudresourcemanager.googleapis.com"
        "billing.googleapis.com"
    )
    
    log_info "Enabling APIs (this may take a few minutes)..."
    for api in "${apis[@]}"; do
        log_info "  Enabling $api..."
        gcloud services enable $api --project=$PROJECT_ID
    done
    
    log_success "All required APIs enabled"
}

# Create terraform configuration
create_terraform_config() {
    log_step "Creating Terraform configuration..."
    
    local terraform_dir="$PROJECT_ROOT/terraform"
    local tfvars_file="$terraform_dir/terraform.tfvars"
    
    # Create terraform.tfvars from template
    if [ ! -f "$tfvars_file" ]; then
        log_info "Creating terraform.tfvars..."
        
        cat > "$tfvars_file" << EOF
# AutonetGen Terraform Configuration
# Generated by setup script on $(date)

# Required Variables
project_id = "$PROJECT_ID"
region     = "$REGION"

# Environment Configuration
environment = "prod"

# Container Images (will be updated by build process)
frontend_container_image = "$REGION-docker.pkg.dev/$PROJECT_ID/autonetgen-registry/frontend:latest"
backend_container_image  = "$REGION-docker.pkg.dev/$PROJECT_ID/autonetgen-registry/backend:latest"

# Cloud Run Configuration
frontend_config = {
  cpu_limit    = "1"
  memory_limit = "512Mi"
  min_scale    = 0
  max_scale    = 10
  concurrency  = 100
}

backend_config = {
  cpu_limit    = "2"
  memory_limit = "2Gi"
  min_scale    = 0
  max_scale    = 20
  concurrency  = 50
  timeout      = "300s"
}

# Storage Configuration
storage_location        = "US"
storage_lifecycle_days  = 30

# Security Configuration
allowed_cidr_blocks = ["0.0.0.0/0"]
enable_vpc_connector = false

# Monitoring Configuration
enable_monitoring = true
EOF

        # Add domain configuration if provided
        if [ ! -z "$DOMAIN_NAME" ]; then
            cat >> "$tfvars_file" << EOF

# Domain Configuration
domain_name = "$DOMAIN_NAME"
enable_https_redirect = true
EOF
        fi

        # Add notification email if provided
        if [ ! -z "$NOTIFICATION_EMAIL" ]; then
            cat >> "$tfvars_file" << EOF

# Notification Configuration
notification_email = "$NOTIFICATION_EMAIL"
EOF
        fi

        # Add cost control
        cat >> "$tfvars_file" << EOF

# Cost Control
budget_amount        = 100
enable_budget_alerts = true
EOF

        log_success "Terraform configuration created: $tfvars_file"
    else
        log_warning "Terraform configuration already exists: $tfvars_file"
    fi
}

# Initialize Terraform
initialize_terraform() {
    log_step "Initializing Terraform..."
    
    cd "$PROJECT_ROOT/terraform"
    
    # Initialize Terraform
    terraform init
    
    # Validate configuration
    terraform validate
    
    log_success "Terraform initialized and validated"
}

# Create deployment script
create_deployment_script() {
    log_step "Creating deployment script..."
    
    local deploy_script="$PROJECT_ROOT/deploy-autonetgen.sh"
    
    cat > "$deploy_script" << 'EOF'
#!/bin/bash
# AutonetGen Deployment Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo "=================================="
echo "   AutonetGen Deployment"
echo "=================================="
echo ""

# Deploy infrastructure
log_info "Deploying infrastructure with Terraform..."
cd terraform
terraform plan
terraform apply -auto-approve
cd ..

# Build and deploy applications
log_info "Building and deploying applications..."
if [ -f "./deploy.sh" ]; then
    ./deploy.sh
else
    log_info "Deploy script not found, running manual build..."
    
    # Get project info from terraform
    PROJECT_ID=$(cd terraform && terraform output -raw project_id 2>/dev/null || echo "")
    REGION=$(cd terraform && terraform output -raw region 2>/dev/null || echo "us-central1")
    
    if [ -z "$PROJECT_ID" ]; then
        echo "Could not determine project ID from terraform output"
        exit 1
    fi
    
    # Configure Docker
    gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
    
    # Build and push images
    docker build -f Dockerfile.frontend -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/autonetgen-registry/frontend:latest .
    docker build -f Dockerfile.backend.optimized -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/autonetgen-registry/backend:latest .
    
    docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/autonetgen-registry/frontend:latest
    docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/autonetgen-registry/backend:latest
    
    # Deploy to Cloud Run
    FRONTEND_SERVICE=$(cd terraform && terraform output -raw frontend_service_name)
    BACKEND_SERVICE=$(cd terraform && terraform output -raw backend_service_name)
    
    gcloud run deploy $FRONTEND_SERVICE --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/autonetgen-registry/frontend:latest --region $REGION --quiet
    gcloud run deploy $BACKEND_SERVICE --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/autonetgen-registry/backend:latest --region $REGION --quiet
fi

log_success "Deployment completed!"
echo ""
echo "Application URL: $(cd terraform && terraform output -raw application_url)"
echo "API URL: $(cd terraform && terraform output -raw api_url)"
echo ""
EOF

    chmod +x "$deploy_script"
    log_success "Deployment script created: $deploy_script"
}

# Print next steps
print_next_steps() {
    echo ""
    echo "=================================================="
    echo "              Setup Complete! 🚀"
    echo "=================================================="
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Review and customize the configuration:"
    echo "   ${GREEN}nano terraform/terraform.tfvars${NC}"
    echo ""
    echo "2. Deploy the infrastructure and application:"
    echo "   ${GREEN}./deploy-autonetgen.sh${NC}"
    echo ""
    echo "3. Monitor your deployment:"
    echo "   - Cloud Console: https://console.cloud.google.com/run?project=$PROJECT_ID"
    echo "   - Logs: https://console.cloud.google.com/logs?project=$PROJECT_ID"
    echo ""
    if [ ! -z "$DOMAIN_NAME" ]; then
        echo "4. Configure DNS for your domain:"
        echo "   - Get the load balancer IP after deployment"
        echo "   - Create an A record pointing $DOMAIN_NAME to that IP"
        echo ""
    fi
    echo "5. Test your application:"
    echo "   - Upload a network file (PCAP/CSV)"
    echo "   - Generate network analysis and Terraform configs"
    echo ""
    echo "Documentation: terraform/README.md"
    echo ""
}

# Main execution
main() {
    print_banner
    check_prerequisites
    get_project_config
    setup_authentication
    enable_apis
    create_terraform_config
    initialize_terraform
    create_deployment_script
    print_next_steps
}

# Run main function with error handling
if ! main "$@"; then
    log_error "Setup failed. Please check the error messages above."
    exit 1
fi