# Cloud Build configuration for AutonetGen Frontend
steps:
  # Build frontend container
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'network-analyzer-gui/Dockerfile'
      - '-t'
      - '${region}-docker.pkg.dev/${project_id}/${registry_name}/frontend:$COMMIT_SHA'
      - '-t'
      - '${region}-docker.pkg.dev/${project_id}/${registry_name}/frontend:latest'
      - '--build-arg'
      - 'REACT_APP_API_URL=https://$${_DOMAIN_NAME}/api'
      - './network-analyzer-gui'
    id: 'build-frontend'

  # Push frontend container with commit SHA
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '${region}-docker.pkg.dev/${project_id}/${registry_name}/frontend:$COMMIT_SHA'
    id: 'push-frontend-sha'
    waitFor: ['build-frontend']

  # Push frontend container with latest tag
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '${region}-docker.pkg.dev/${project_id}/${registry_name}/frontend:latest'
    id: 'push-frontend-latest'
    waitFor: ['build-frontend']

  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - '${service_name}'
      - '--image'
      - '${region}-docker.pkg.dev/${project_id}/${registry_name}/frontend:$COMMIT_SHA'
      - '--region'
      - '${region}'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'BACKEND_API_URL=https://$${_DOMAIN_NAME}/api,ENVIRONMENT=production'
    id: 'deploy-frontend'
    waitFor: ['push-frontend-sha']

# Substitutions for Cloud Build variables
substitutions:
  _DOMAIN_NAME: 'your-domain.com'  # Replace with actual domain

options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY

timeout: '1200s'