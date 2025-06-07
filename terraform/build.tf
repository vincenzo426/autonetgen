# AutonetGen - Cloud Build CI/CD Configuration

# Service Account for Cloud Build
resource "google_service_account" "cloud_build_sa" {
  account_id   = "${local.name_prefix}-build-sa-${local.suffix}"
  display_name = "AutonetGen Cloud Build Service Account"
  description  = "Service account for AutonetGen Cloud Build operations"
}

# IAM permissions for Cloud Build service account
resource "google_project_iam_member" "cloud_build_permissions" {
  for_each = toset([
    "roles/cloudbuild.builds.builder",
    "roles/artifactregistry.writer",
    "roles/storage.admin",
    "roles/run.developer",
    "roles/iam.serviceAccountUser"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cloud_build_sa.email}"
}

# Cloud Build triggers (optional, requires GitHub connection)
resource "google_cloudbuild_trigger" "frontend_trigger" {
  count = var.github_repo != null ? 1 : 0

  name        = "${local.name_prefix}-frontend-trigger-${local.suffix}"
  description = "Trigger for AutonetGen frontend builds"

  github {
    owner = var.github_repo.owner
    name  = var.github_repo.name
    push {
      branch = "^(${join("|", var.build_trigger_branches)})$"
    }
  }

  included_files = [
    "network-analyzer-gui/**",
    "Dockerfile.frontend"
  ]

  build {
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "build",
        "-f", "Dockerfile.frontend",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/frontend:$COMMIT_SHA",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/frontend:latest",
        "."
      ]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/frontend:$COMMIT_SHA"
      ]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/frontend:latest"
      ]
    }

    step {
      name = "gcr.io/cloud-builders/gcloud"
      args = [
        "run", "deploy", google_cloud_run_v2_service.frontend.name,
        "--image", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/frontend:$COMMIT_SHA",
        "--region", var.region,
        "--platform", "managed"
      ]
    }
  }

  service_account = google_service_account.cloud_build_sa.id

  depends_on = [google_project_service.required_apis]
}

resource "google_cloudbuild_trigger" "backend_trigger" {
  count = var.github_repo != null ? 1 : 0

  name        = "${local.name_prefix}-backend-trigger-${local.suffix}"
  description = "Trigger for AutonetGen backend builds"

  github {
    owner = var.github_repo.owner
    name  = var.github_repo.name
    push {
      branch = "^(${join("|", var.build_trigger_branches)})$"
    }
  }

  included_files = [
    "backend/**",
    "Dockerfile.backend",
    "requirements.txt"
  ]

  build {
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "build",
        "-f", "Dockerfile.backend",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/backend:$COMMIT_SHA",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/backend:latest",
        "."
      ]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/backend:$COMMIT_SHA"
      ]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/backend:latest"
      ]
    }

    step {
      name = "gcr.io/cloud-builders/gcloud"
      args = [
        "run", "deploy", google_cloud_run_v2_service.backend.name,
        "--image", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.container_registry.repository_id}/backend:$COMMIT_SHA",
        "--region", var.region,
        "--platform", "managed"
      ]
    }
  }

  service_account = google_service_account.cloud_build_sa.id

  depends_on = [google_project_service.required_apis]
}

# Cloud Build manual build configuration
resource "local_file" "cloudbuild_frontend" {
  filename = "${path.module}/../cloudbuild-frontend.yaml"
  content = templatefile("${path.module}/templates/cloudbuild-frontend.yaml.tpl", {
    project_id    = var.project_id
    region        = var.region
    registry_name = google_artifact_registry_repository.container_registry.repository_id
    service_name  = google_cloud_run_v2_service.frontend.name
  })
}

resource "local_file" "cloudbuild_backend" {
  filename = "${path.module}/../cloudbuild-backend.yaml"
  content = templatefile("${path.module}/templates/cloudbuild-backend.yaml.tpl", {
    project_id    = var.project_id
    region        = var.region
    registry_name = google_artifact_registry_repository.container_registry.repository_id
    service_name  = google_cloud_run_v2_service.backend.name
  })
}

# Build and deploy script
resource "local_file" "deploy_script" {
  filename = "${path.module}/../deploy.sh"
  content = templatefile("${path.module}/templates/deploy.sh.tpl", {
    project_id      = var.project_id
    region          = var.region
    registry_name   = google_artifact_registry_repository.container_registry.repository_id
    frontend_service = google_cloud_run_v2_service.frontend.name
    backend_service  = google_cloud_run_v2_service.backend.name
  })

  provisioner "local-exec" {
    command = "chmod +x ${self.filename}"
  }
}