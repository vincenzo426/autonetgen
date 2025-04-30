import os
import json
import logging
import tempfile
import shutil
import subprocess
from flask import Flask, request, jsonify
from google.cloud import storage, pubsub_v1
import yaml
from jinja2 import Environment, FileSystemLoader
import uuid
import threading

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Google Cloud clients
storage_client = storage.Client()
publisher = pubsub_v1.PublisherClient()

# Initialize Jinja2 environment for templates
template_env = Environment(loader=FileSystemLoader('templates'))

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.route('/deploy', methods=['POST'])
def deploy_infrastructure():
    """
    Deploy inferred infrastructure on GCP using Terraform.
    Expected request JSON:
    {
        "dataset_id": "dataset-123",
        "workspace_name": "custom-workspace-name", # Optional
        "override_file": "override.json" # Optional
    }
    """
    request_data = request.get_json()
    
    if not request_data:
        return jsonify({"error": "No request data provided"}), 400
    
    if "dataset_id" not in request_data:
        return jsonify({"error": "Missing required field: dataset_id"}), 400
    
    # Start deployment in a background thread to avoid timeout
    threading.Thread(target=deploy_infrastructure_async, args=(request_data,)).start()
    
    return jsonify({
        "status": "deploying",
        "message": f"Deployment started for dataset ID: {request_data['dataset_id']}",
        "dataset_id": request_data["dataset_id"]
    }), 202

def deploy_infrastructure_async(request_data):
    """
    Asynchronously deploy infrastructure using Terraform.
    """
    dataset_id = request_data["dataset_id"]
    workspace_name = request_data.get("workspace_name", f"autonetgen-{dataset_id}")
    override_file = request_data.get("override_file", None)
    
    output_bucket_name = os.environ.get("OUTPUT_BUCKET")
    if not output_bucket_name:
        logger.error("OUTPUT_BUCKET environment variable not set")
        return
    
    pubsub_topic = os.environ.get("PUBSUB_TOPIC_COMPLETE")
    project_id = os.environ.get("PROJECT_ID")
    
    try:
        # Create temporary directory for Terraform files
        with tempfile.TemporaryDirectory() as temp_dir:
            # Download Terraform files from Cloud Storage
            output_bucket = storage_client.bucket(output_bucket_name)
            
            # Download infrastructure definition
            infra_blob = output_bucket.blob(f"{dataset_id}/infrastructure.json")
            infra_json = json.loads(infra_blob.download_as_text())
            
            # Apply overrides if specified
            if override_file:
                override_blob = output_bucket.blob(f"{dataset_id}/{override_file}")
                if override_blob.exists():
                    override_json = json.loads(override_blob.download_as_text())
                    deep_merge(infra_json, override_json)
            
            # Download Terraform files
            terraform_dir = os.path.join(temp_dir, "terraform")
            os.makedirs(terraform_dir, exist_ok=True)
            
            # List all terraform files
            blobs = output_bucket.list_blobs(prefix=f"{dataset_id}/terraform/")
            for blob in blobs:
                # Extract relative path from the prefix
                relative_path = blob.name.replace(f"{dataset_id}/terraform/", "")
                if relative_path:
                    # Create subdirectories if needed
                    file_path = os.path.join(terraform_dir, relative_path)
                    os.makedirs(os.path.dirname(file_path), exist_ok=True)
                    
                    # Download the file
                    blob.download_to_filename(file_path)
            
            # Create variables file with dynamic values
            generate_terraform_vars(terraform_dir, infra_json, workspace_name, project_id)
            
            # Initialize and apply Terraform
            result = apply_terraform(terraform_dir, workspace_name)
            
            # Save Terraform outputs
            outputs = get_terraform_outputs(terraform_dir)
            outputs_blob = output_bucket.blob(f"{dataset_id}/deployment/outputs.json")
            outputs_blob.upload_from_string(json.dumps(outputs, indent=2))
            
            # Save deployment state
            state_blob = output_bucket.blob(f"{dataset_id}/deployment/terraform.tfstate")
            state_file = os.path.join(terraform_dir, "terraform.tfstate")
            if os.path.exists(state_file):
                state_blob.upload_from_filename(state_file)
            
            # Send notification that deployment is complete
            if pubsub_topic:
                topic_path = publisher.topic_path(project_id, pubsub_topic)
                publisher.publish(
                    topic_path,
                    data=json.dumps({
                        "dataset_id": dataset_id,
                        "workspace_name": workspace_name,
                        "status": "complete" if result["success"] else "failed",
                        "outputs": outputs,
                        "error": result.get("error", None)
                    }).encode("utf-8"),
                    dataset_id=dataset_id,
                    workspace=workspace_name
                )
            
            logger.info(f"Deployment {'succeeded' if result['success'] else 'failed'} for dataset: {dataset_id}")
            
    except Exception as e:
        logger.error(f"Error deploying infrastructure for dataset {dataset_id}: {str(e)}")
        
        # Publish error message
        if pubsub_topic:
            topic_path = publisher.topic_path(project_id, pubsub_topic)
            publisher.publish(
                topic_path,
                data=json.dumps({
                    "dataset_id": dataset_id,
                    "workspace_name": workspace_name,
                    "status": "error",
                    "error": str(e)
                }).encode("utf-8"),
                dataset_id=dataset_id,
                workspace=workspace_name
            )

def generate_terraform_vars(terraform_dir, infra_json, workspace_name, project_id):
    """
    Generate terraform.tfvars file for deployment.
    """
    vars_file = os.path.join(terraform_dir, "terraform.tfvars")
    
    # Basic variables
    tf_vars = {
        "project_id": project_id,
        "workspace_name": workspace_name,
        "dataset_id": infra_json["dataset_id"],
    }
    
    # Add infrastructure-specific variables
    tf_vars["hosts"] = infra_json["hosts"]
    tf_vars["subnets"] = infra_json["subnets"]
    tf_vars["services"] = infra_json["services"]
    tf_vars["roles"] = infra_json["roles"]
    tf_vars["communication_patterns"] = infra_json["communication_patterns"]
    
    # Write variables to file
    with open(vars_file, 'w') as f:
        for key, value in tf_vars.items():
            if isinstance(value, dict) or isinstance(value, list):
                f.write(f'{key} = {json.dumps(value)}\n')
            else:
                f.write(f'{key} = "{value}"\n')

def apply_terraform(terraform_dir, workspace_name):
    """
    Run Terraform init, workspace, and apply commands.
    Returns dict with success status and any errors.
    """
    result = {"success": False}
    
    try:
        # Initialize Terraform
        init_process = subprocess.run(
            ["terraform", "init"],
            cwd=terraform_dir,
            capture_output=True,
            text=True,
            check=True
        )
        logger.info("Terraform initialization successful")
        
        # Create or select workspace
        workspace_list = subprocess.run(
            ["terraform", "workspace", "list"],
            cwd=terraform_dir,
            capture_output=True,
            text=True
        )
        
        if f"  {workspace_name}" in workspace_list.stdout or f"* {workspace_name}" in workspace_list.stdout:
            # Select existing workspace
            subprocess.run(
                ["terraform", "workspace", "select", workspace_name],
                cwd=terraform_dir,
                capture_output=True,
                text=True,
                check=True
            )
        else:
            # Create new workspace
            subprocess.run(
                ["terraform", "workspace", "new", workspace_name],
                cwd=terraform_dir,
                capture_output=True,
                text=True,
                check=True
            )
        
        logger.info(f"Using Terraform workspace: {workspace_name}")
        
        # Apply Terraform configuration
        apply_process = subprocess.run(
            ["terraform", "apply", "-auto-approve"],
            cwd=terraform_dir,
            capture_output=True,
            text=True
        )
        
        if apply_process.returncode == 0:
            result["success"] = True
            logger.info("Terraform apply successful")
        else:
            result["success"] = False
            result["error"] = apply_process.stderr
            logger.error(f"Terraform apply failed: {apply_process.stderr}")
        
    except subprocess.CalledProcessError as e:
        result["success"] = False
        result["error"] = e.stderr
        logger.error(f"Terraform error: {e.stderr}")
    except Exception as e:
        result["success"] = False
        result["error"] = str(e)
        logger.error(f"Error during Terraform execution: {str(e)}")
    
    return result

def get_terraform_outputs(terraform_dir):
    """
    Get outputs from Terraform apply.
    """
    try:
        output_process = subprocess.run(
            ["terraform", "output", "-json"],
            cwd=terraform_dir,
            capture_output=True,
            text=True
        )
        
        if output_process.returncode == 0 and output_process.stdout:
            return json.loads(output_process.stdout)
        return {}
    except Exception as e:
        logger.error(f"Error getting Terraform outputs: {str(e)}")
        return {}

def deep_merge(dict1, dict2):
    """
    Deep merge two dictionaries. dict2 values override dict1 values.
    """
    for key in dict2:
        if key in dict1 and isinstance(dict1[key], dict) and isinstance(dict2[key], dict):
            deep_merge(dict1[key], dict2[key])
        else:
            dict1[key] = dict2[key]
    return dict1

@app.route('/destroy', methods=['POST'])
def destroy_infrastructure():
    """
    Destroy deployed infrastructure.
    Expected request JSON:
    {
        "dataset_id": "dataset-123",
        "workspace_name": "custom-workspace-name" # Optional
    }
    """
    request_data = request.get_json()
    
    if not request_data:
        return jsonify({"error": "No request data provided"}), 400
    
    if "dataset_id" not in request_data:
        return jsonify({"error": "Missing required field: dataset_id"}), 400
    
    # Start destruction in a background thread to avoid timeout
    threading.Thread(target=destroy_infrastructure_async, args=(request_data,)).start()
    
    return jsonify({
        "status": "destroying",
        "message": f"Destruction started for dataset ID: {request_data['dataset_id']}",
        "dataset_id": request_data["dataset_id"]
    }), 202

def destroy_infrastructure_async(request_data):
    """
    Asynchronously destroy infrastructure using Terraform.
    """
    dataset_id = request_data["dataset_id"]
    workspace_name = request_data.get("workspace_name", f"autonetgen-{dataset_id}")
    
    output_bucket_name = os.environ.get("OUTPUT_BUCKET")
    pubsub_topic = os.environ.get("PUBSUB_TOPIC_COMPLETE")
    project_id = os.environ.get("PROJECT_ID")
    
    try:
        # Create temporary directory for Terraform files
        with tempfile.TemporaryDirectory() as temp_dir:
            # Download Terraform files from Cloud Storage
            output_bucket = storage_client.bucket(output_bucket_name)
            
            # Create terraform directory
            terraform_dir = os.path.join(temp_dir, "terraform")
            os.makedirs(terraform_dir, exist_ok=True)
            
            # Download Terraform files
            blobs = output_bucket.list_blobs(prefix=f"{dataset_id}/terraform/")
            for blob in blobs:
                # Extract relative path from the prefix
                relative_path = blob.name.replace(f"{dataset_id}/terraform/", "")
                if relative_path:
                    # Create subdirectories if needed
                    file_path = os.path.join(terraform_dir, relative_path)
                    os.makedirs(os.path.dirname(file_path), exist_ok=True)
                    blob.download_to_filename(file_path)
            
            # Initialize and select workspace
            subprocess.run(["terraform", "init"], cwd=terraform_dir, check=True)
            subprocess.run(["terraform", "workspace", "select", workspace_name], cwd=terraform_dir, check=True)
            
            # Destroy infrastructure
            destroy_process = subprocess.run(
                ["terraform", "destroy", "-auto-approve"],
                cwd=terraform_dir,
                capture_output=True,
                text=True
            )
            
            success = destroy_process.returncode == 0
            if success:
                logger.info(f"Successfully destroyed infrastructure for dataset {dataset_id}")
            else:
                logger.error(f"Terraform destroy failed: {destroy_process.stderr}")
            
            # Send notification that destruction is complete
            if pubsub_topic:
                topic_path = publisher.topic_path(project_id, pubsub_topic)
                publisher.publish(
                    topic_path,
                    data=json.dumps({
                        "dataset_id": dataset_id,
                        "workspace_name": workspace_name,
                        "status": "destroyed" if success else "destroy_failed",
                        "error": None if success else destroy_process.stderr
                    }).encode("utf-8"),
                    dataset_id=dataset_id,
                    workspace=workspace_name
                )
    except Exception as e:
        logger.error(f"Error destroying infrastructure for dataset {dataset_id}: {str(e)}")
        
        if pubsub_topic:
            topic_path = publisher.topic_path(project_id, pubsub_topic)
            publisher.publish(
                topic_path,
                data=json.dumps({
                    "dataset_id": dataset_id,
                    "workspace_name": workspace_name,
                    "status": "error",
                    "error": str(e)
                }).encode("utf-8"),
                dataset_id=dataset_id,
                workspace=workspace_name
            )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
