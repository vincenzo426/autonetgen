#!/bin/bash
# deploy.sh - Script di deployment automatico per autonetgen su GCP

set -e  # Exit on any error

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzione per stampare messaggi colorati
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Verifica prerequisiti
check_prerequisites() {
    print_header "Verifica prerequisiti"
    
    # Controlla se gcloud è installato
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI non è installato. Installa da: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    # Controlla se terraform è installato
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform non è installato. Installa da: https://terraform.io/downloads"
        exit 1
    fi
    
    # Controlla se docker è installato
    if ! command -v docker &> /dev/null; then
        print_error "Docker non è installato. Installa da: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    print_message "Tutti i prerequisiti sono soddisfatti"
}

# Leggi configurazione
read_config() {
    print_header "Lettura configurazione"
    
    if [ ! -f "terraform/terraform.tfvars" ]; then
        print_error "File terraform/terraform.tfvars non trovato!"
        print_message "Copia terraform/terraform.tfvars.example in terraform/terraform.tfvars e configuralo"
        exit 1
    fi
    
    # Estrai PROJECT_ID dal tfvars
    PROJECT_ID=$(grep 'project_id' terraform/terraform.tfvars | sed 's/.*=\s*"\([^"]*\)".*/\1/')
    
    if [ -z "$PROJECT_ID" ]; then
        print_error "PROJECT_ID non trovato in terraform.tfvars"
        exit 1
    fi
    
    print_message "PROJECT_ID: $PROJECT_ID"
}

# Configura gcloud
setup_gcloud() {
    print_header "Configurazione gcloud"
    
    # Imposta il progetto
    gcloud config set project $PROJECT_ID
    
    # Abilita le API necessarie
    print_message "Abilitazione API Google Cloud..."
    gcloud services enable \
        cloudbuild.googleapis.com \
        run.googleapis.com \
        storage-api.googleapis.com \
        storage-component.googleapis.com
    
    # Configura autenticazione Docker
    print_message "Configurazione autenticazione Docker..."
    gcloud auth configure-docker --quiet
}

# Build e push delle immagini Docker
build_and_push_images() {
    print_header "Build e push immagini Docker"
    
    # Build backend
    print_message "Building backend image..."
    docker build --no-cache -t gcr.io/$PROJECT_ID/autonetgen-backend:latest -f Dockerfile.backend .
    
    print_message "Pushing backend image..."
    docker push gcr.io/$PROJECT_ID/autonetgen-backend:latest
    
    # Build frontend
    print_message "Building frontend image..."
    docker build --no-cache -t gcr.io/$PROJECT_ID/autonetgen-frontend:latest -f Dockerfile.frontend .
    
    print_message "Pushing frontend image..."
    docker push gcr.io/$PROJECT_ID/autonetgen-frontend:latest
    
    print_message "Immagini Docker build e push completati"
}

# Deploy con Terraform
deploy_terraform() {
    print_header "Deployment Terraform"
    
    cd terraform
    
    # Sostituisci PROJECT_ID nel tfvars se necessario
    sed -i.bak "s/il-tuo-project-id/$PROJECT_ID/g" terraform.tfvars
    
    print_message "Inizializzazione Terraform..."
    terraform init
    
    print_message "Validazione configurazione Terraform..."
    terraform validate
    
    print_message "Planning deployment..."
    terraform plan
    
    # Chiedi conferma prima di applicare
    echo ""
    read -p "Vuoi procedere con il deployment? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_message "Applying Terraform configuration..."
        terraform apply -auto-approve
        
        print_message "Deployment completato!"
        
        # Mostra gli output
        print_header "Informazioni deployment"
        terraform output -json | jq .
        
    else
        print_warning "Deployment annullato dall'utente"
    fi
    
    cd ..
}

# Verifica deployment
verify_deployment() {
    print_header "Verifica deployment"
    
    cd terraform
    
    FRONTEND_URL=$(terraform output -raw frontend_url)
    BACKEND_URL=$(terraform output -raw backend_url)
    
    cd ..
    
    print_message "Frontend URL: $FRONTEND_URL"
    print_message "Backend URL: $BACKEND_URL"
    
    # Test health check del backend
    print_message "Testing backend health..."
    if curl -s "$BACKEND_URL/health" > /dev/null; then
        print_message "✅ Backend is healthy"
    else
        print_warning "⚠️  Backend health check failed"
    fi
}

# Cleanup function
cleanup() {
    print_header "Cleanup"
    print_message "Per eliminare tutte le risorse create:"
    echo "cd terraform && terraform destroy"
}

# Main function
main() {
    print_header "AutoNetGen Deployment Script"
    
    check_prerequisites
    read_config
    setup_gcloud
    build_and_push_images
    deploy_terraform
    verify_deployment
    
    print_header "Deployment completato con successo!"
    print_message "L'applicazione AutoNetGen è ora disponibile su Google Cloud Platform"
    
    echo ""
    echo "📋 Prossimi passi:"
    echo "1. Testa l'applicazione usando gli URL mostrati sopra"
    echo "2. Configura un dominio personalizzato se necessario"
    echo "3. Imposta il monitoring e alerting"
    echo "4. Configura backup automatici se richiesti"
}

# Gestione argomenti
case "${1:-}" in
    "cleanup")
        cleanup
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [cleanup|help]"
        echo ""
        echo "Deploy autonetgen application to Google Cloud Platform"
        echo ""
        echo "Commands:"
        echo "  (no args)  Run full deployment"
        echo "  cleanup    Show cleanup instructions" 
        echo "  help       Show this help"
        ;;
    *)
        main
        ;;
esac