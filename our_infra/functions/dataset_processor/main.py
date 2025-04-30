import os
import json
import requests
from google.cloud import storage
import functions_framework

@functions_framework.cloud_event
def process_upload(cloud_event):
    """Cloud Function triggered by a new file upload to Cloud Storage.
    Extracts metadata from the uploaded file and sends it to the inference engine.
    
    Args:
        cloud_event: The Cloud Event that triggered this function
    """
    data = cloud_event.data

    bucket_name = data["bucket"]
    file_name = data["name"]
    
    # Skip processing if not a dataset file
    if not (file_name.endswith('.pcap') or file_name.endswith('.csv') or file_name.endswith('.flow')):
        print(f"Skipping non-dataset file: {file_name}")
        return
    
    # Get file metadata
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.get_blob(file_name)
    
    # Create metadata for the inference engine
    metadata = {
        "file_name": file_name,
        "file_size": blob.size,
        "content_type": blob.content_type,
        "bucket_name": bucket_name,
        "upload_time": blob.time_created.isoformat(),
        "dataset_id": os.path.splitext(os.path.basename(file_name))[0]
    }
    
    # Determine dataset type and set specific processing flags
    dataset_type = "unknown"
    if "modbus" in file_name.lower():
        dataset_type = "industrial"
        metadata["protocol_hints"] = ["modbus"]
    elif "ids" in file_name.lower():
        dataset_type = "ids"
    elif "netflow" in file_name.lower() or file_name.endswith('.flow'):
        dataset_type = "netflow"
    
    metadata["dataset_type"] = dataset_type
    
    # Add metadata to the blob
    blob.metadata = {
        "dataset_type": dataset_type,
        "processed": "false"
    }
    blob.patch()
    
    # Trigger the inference engine by sending a request
    inference_service_url = os.environ.get('INFERENCE_SERVICE_URL')
    if inference_service_url:
        try:
            response = requests.post(
                f"{inference_service_url}/process",
                json=metadata,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            print(f"Successfully initiated inference for {file_name}")
            return json.dumps({"status": "success", "message": f"Inference initiated for {file_name}"})
        except requests.exceptions.RequestException as e:
            print(f"Error triggering inference: {e}")
            return json.dumps({"status": "error", "message": str(e)})
    else:
        print("INFERENCE_SERVICE_URL environment variable not set")
        return json.dumps({"status": "error", "message": "Inference service URL not configured"})
