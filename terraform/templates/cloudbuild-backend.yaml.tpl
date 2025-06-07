# Cloud Build configuration for AutonetGen Backend
steps:
  # Build backend container
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'Dockerfile.backend'
      - '-t'
      - '${region}-docker.pkg.dev/${project_id}/${registry_name}/backend:$COMMIT_SHA'
      - '-t'
      - '${region}-docker.pkg.dev/${project_id}/${registry_name}/backend:latest'
      - '.'
    id: 'build-backend'

  # Push backend container with commit SHA
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '${region}-docker.pkg.dev/${project_id}/${registry_name}/backend:$COMMIT_SHA'
    id: 'push-backend-sha'
    waitFor: ['build-backend']

  # Push backend container with latest tag
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '${region}-docker.pkg.dev/${project_id}/${registry_name}/backend:latest'
    id: 'push-backend-latest'
    waitFor: ['build-backend']

  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - '${service_name}'
      - '--image'
      - '${region}-docker.pkg.dev/${project_id}/${registry_name}/backend:$COMMIT_SHA'
      - '--region'
      - '${region}'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--memory'
      - '2Gi'
      - '--cpu'
      - '2'
      - '--timeout'
      - '300'
      - '--concurrency'
      - '50'
      - '--max-instances'
      - '20'
      - '--set-env-vars'
      - 'PROJECT_ID=${project_id},ENVIRONMENT=production,DEFAULT_OUTPUT_DIR=/tmp/output'
    id: 'deploy-backend'
    waitFor: ['push-backend-sha']

options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY

timeout: '1200s'