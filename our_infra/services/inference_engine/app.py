import os
import json
import logging
import tempfile
from flask import Flask, request, jsonify
from google.cloud import storage, pubsub_v1
import yaml
import networkx as nx
import pandas as pd
import threading

from processors.pcap_processor import PCAPProcessor
from processors.csv_processor import CSVProcessor
from processors.netflow_processor import NetFlowProcessor
from analyzers.topology_analyzer import TopologyAnalyzer
from analyzers.service_analyzer import ServiceAnalyzer
from generators.terraform_generator import TerraformGenerator

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Google Cloud clients
storage_client = storage.Client()
publisher = pubsub_v1.PublisherClient()

# Initialize processors and analyzers
pcap_processor = PCAPProcessor()
csv_processor = CSVProcessor()
netflow_processor = NetFlowProcessor()
topology_analyzer = TopologyAnalyzer()
service_analyzer = ServiceAnalyzer()
terraform_generator = TerraformGenerator()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.route('/process', methods=['POST'])
def process_dataset():
    """
    Process a dataset and infer network infrastructure.
    Expected request JSON:
    {
        "file_name": "dataset.pcap",
        "bucket_name": "autonetgen-datasets-abc123",
        "dataset_id": "dataset",
        "dataset_type": "ids"
    }
    """
    request_data = request.get_json()
    
    if not request_data:
        return jsonify({"error": "No request data provided"}), 400
    
    required_fields = ["file_name", "bucket_name", "dataset_id"]
    for field in required_fields:
        if field not in request_data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    # Start processing in a background thread to avoid timeout
    threading.Thread(target=process_dataset_async, args=(request_data,)).start()
    
    return jsonify({
        "status": "processing",
        "message": f"Processing of {request_data['file_name']} started",
        "dataset_id": request_data["dataset_id"]
    }), 202

def process_dataset_async(request_data):
    """
    Asynchronously process a dataset and generate infrastructure.
    """
    file_name = request_data["file_name"]
    bucket_name = request_data["bucket_name"]
    dataset_id = request_data["dataset_id"]
    dataset_type = request_data.get("dataset_type", "unknown")
    
    output_bucket_name = os.environ.get("OUTPUT_BUCKET")
    if not output_bucket_name:
        logger.error("OUTPUT_BUCKET environment variable not set")
        return
    
    try:
        # Download the dataset file
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            blob.download_to_filename(temp_file.name)
            dataset_path = temp_file.name
        
        logger.info(f"Dataset downloaded to {dataset_path}")
        
        # Process the dataset based on file type
        if file_name.endswith('.pcap'):
            df, packets = pcap_processor.process(dataset_path)
        elif file_name.endswith('.csv'):
            df = csv_processor.process(dataset_path)
            packets = None
        elif file_name.endswith('.flow'):
            df = netflow_processor.process(dataset_path)
            packets = None
        else:
            logger.error(f"Unsupported file type: {file_name}")
            return
        
        # Analyze network topology
        graph = topology_analyzer.build_graph(df)
        hosts = topology_analyzer.identify_hosts(graph)
        
        # Analyze services and protocols
        services = service_analyzer.identify_services(df)
        protocols = service_analyzer.identify_protocols(df)
        
        # Identify network roles
        roles = service_analyzer.identify_roles(graph, services)
        
        # Generate infrastructure definition
        infra_def = {
            "dataset_id": dataset_id,
            "hosts": hosts,
            "services": services,
            "protocols": protocols,
            "roles": roles,
            "communication_patterns": topology_analyzer.extract_communication_patterns(graph),
            "subnets": topology_analyzer.identify_subnets(hosts)
        }
        
        # Generate visual representation
        topology_viz = topology_analyzer.generate_visualization(graph)
        
        # Generate Terraform configurations
        terraform_configs = terraform_generator.generate(infra_def)
        
        # Save outputs to Cloud Storage
        output_bucket = storage_client.bucket(output_bucket_name)
        
        # Save infrastructure definition
        infra_blob = output_bucket.blob(f"{dataset_id}/infrastructure.json")
        infra_blob.upload_from_string(json.dumps(infra_def, indent=2))
        
        # Save topology visualization
        viz_blob = output_bucket.blob(f"{dataset_id}/topology.png")
        viz_blob.upload_from_string(topology_viz, content_type="image/png")
        
        # Save Terraform configurations
        for tf_file, content in terraform_configs.items():
            tf_blob = output_bucket.blob(f"{dataset_id}/terraform/{tf_file}")
            tf_blob.upload_from_string(content)
        
        # Create summary report
        summary = {
            "dataset_id": dataset_id,
            "file_name": file_name,
            "hosts_count": len(hosts),
            "services_count": len(services),
            "subnets_count": len(infra_def["subnets"]),
            "terraform_files": list(terraform_configs.keys())
        }
        
        summary_blob = output_bucket.blob(f"{dataset_id}/summary.json")
        summary_blob.upload_from_string(json.dumps(summary, indent=2))
        
        # Send notification that inference is complete
        pubsub_topic = os.environ.get("PUBSUB_TOPIC_COMPLETE")
        if pubsub_topic:
            topic_path = publisher.topic_path(os.environ.get("PROJECT_ID"), pubsub_topic)
            publisher.publish(
                topic_path,
                data=json.dumps({
                    "dataset_id": dataset_id,
                    "status": "complete",
                    "summary": summary
                }).encode("utf-8"),
                dataset_id=dataset_id
            )
        
        logger.info(f"Inference complete for dataset: {dataset_id}")
        
    except Exception as e:
        logger.error(f"Error processing dataset {dataset_id}: {str(e)}")
        
        # Publish error message
        if pubsub_topic:
            topic_path = publisher.topic_path(os.environ.get("PROJECT_ID"), pubsub_topic)
            publisher.publish(
                topic_path,
                data=json.dumps({
                    "dataset_id": dataset_id,
                    "status": "error",
                    "error": str(e)
                }).encode("utf-8"),
                dataset_id=dataset_id
            )
    finally:
        # Clean up temporary file
        if 'dataset_path' in locals() and os.path.exists(dataset_path):
            os.unlink(dataset_path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
