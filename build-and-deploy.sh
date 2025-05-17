#!/bin/bash
# Script per costruire e deployare tutte le immagini Docker

set -e

# Configura variabili
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"

# Verifica l'esistenza di gcloud e docker
command -v gcloud >/dev/null 2>&1 || { echo "gcloud è richiesto ma non è installato. Aborting."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "docker è richiesto ma non è installato. Aborting."; exit 1; }

# Notifica
echo "Building and deploying Docker images for project: $PROJECT_ID"

# Abilita le API necessarie
echo "Enabling necessary APIs..."
gcloud services enable \
  artifactregistry.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com

# Crea un repository Artifact Registry
echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create autonetgen \
  --repository-format=docker \
  --location=$REGION \
  --description="AutonetGen Docker Repository"

# Configura Docker per utilizzare l'autenticazione di gcloud
echo "Configuring Docker authentication..."
gcloud auth configure-docker $REGION-docker.pkg.dev

# Definisci i tag delle immagini
FRONTEND_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/autonetgen/frontend:latest"
BACKEND_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/autonetgen/backend:latest"
ANALYZER_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/autonetgen/network-analyzer:latest"

# Build e push dell'immagine frontend
echo "Building and pushing frontend image..."
cd network-analyzer-gui
docker build -t $FRONTEND_IMAGE .
docker push $FRONTEND_IMAGE
cd ..

# Build e push dell'immagine backend
echo "Building and pushing backend image..."
docker build -f Dockerfile.backend -t $BACKEND_IMAGE .
docker push $BACKEND_IMAGE

# Build e push dell'immagine analyzer
echo "Building and pushing analyzer image..."
docker build -f Dockerfile.analyzer -t $ANALYZER_IMAGE .
docker push $ANALYZER_IMAGE

echo "All images built and pushed successfully!"
echo "Frontend: $FRONTEND_IMAGE"
echo "Backend: $BACKEND_IMAGE"
echo "Analyzer: $ANALYZER_IMAGE"

# Aggiorna il file terraform.tfvars con le immagini appena create
echo "Updating Terraform variables with the new image URLs..."
cat > terraform/terraform.tfvars << EOF
project_id = "$PROJECT_ID"
region     = "$REGION"

frontend_container_image = "$FRONTEND_IMAGE"
backend_container_image = "$BACKEND_IMAGE"
EOF

echo "Setup complete! You can now proceed with Terraform deployment:"
echo "cd terraform"
echo "terraform init"
echo "terraform plan"
echo "terraform apply"