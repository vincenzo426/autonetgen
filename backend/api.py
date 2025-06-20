#!/usr/bin/env python3
"""
API Flask per il frontend del Network Analyzer con Google Cloud Storage Signed URLs
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import shutil
import json
import uuid
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from collections import Counter
from google.cloud import storage
from google.oauth2 import service_account
import io
from analysis_orchestrator import AnalysisOrchestrator
from config import logger, DEFAULT_OUTPUT_DIR
from terraform_manager import TerraformManager
from gcs_manager import GCSFileManager  # Import della nuova classe separata
from traffic_test_manager import TrafficTestManager

app = Flask(__name__)
CORS(app, 
     origins=["*"],  # ATTENZIONE: solo per test!
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     max_age=86400)

# Configurazione Google Cloud Storage
GCS_BUCKET_NAME = os.environ.get('STORAGE_BUCKET', 'gruppo-10-autonetgen-storage')

# Inizializza il GCSFileManager
gcs_manager = GCSFileManager(GCS_BUCKET_NAME)

# Configura una directory per i file temporanei (ora usata solo per elaborazione temporanea)
TEMP_DIR = tempfile.mkdtemp()
app.config['TEMP_DIR'] = TEMP_DIR

@app.errorhandler(413)
def request_entity_too_large(error):
    """Gestisce l'errore 413"""
    return jsonify({
        'status': 'error', 
        'message': 'File troppo grande per essere processato'
    }), 413

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint per Cloud Run"""
    try:
        # Testa la connessione a GCS
        gcs_manager.bucket.reload()
        
        return jsonify({
            'status': 'healthy',
            'service': 'autonetgen-backend',
            'bucket': GCS_BUCKET_NAME,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 503

@app.route('/api/upload/signed-url', methods=['POST'])
def generate_signed_url():
    """
    Endpoint per generare signed URLs per l'upload di file su GCS
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400
        
        files_info = data.get('files', [])
        session_id = data.get('session_id')
        
        if not files_info:
            return jsonify({'status': 'error', 'message': 'No files specified'}), 400
        
        if not session_id:
            # Genera un session_id se non fornito
            session_id = str(uuid.uuid4())
        
        # Genera signed URLs per ogni file
        signed_urls = []
        for file_info in files_info:
            filename = secure_filename(file_info.get('name', ''))
            file_size = file_info.get('size', 0)
            
            if not filename:
                continue
            
            # Crea il path del blob
            blob_name = f"uploads/{session_id}/{filename}"
            
            # Genera la signed URL (valida per 1 ora)
            try:
                signed_url = gcs_manager.generate_signed_url(
                    blob_name=blob_name,
                    method='PUT',
                    expiration=3600
                )
                
                signed_urls.append({
                    'filename': filename,
                    'blob_name': blob_name,
                    'signed_url': signed_url,
                    'size': file_size
                })
                
            except Exception as e:
                logger.error(f"Failed to generate signed URL for {filename}: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Failed to generate signed URL for {filename}'
                }), 500
        
        if not signed_urls:
            return jsonify({'status': 'error', 'message': 'No valid files to upload'}), 400
        
        return jsonify({
            'status': 'success',
            'session_id': session_id,
            'signed_urls': signed_urls,
            'expires_in': 3600  # 1 ora
        })
        
    except Exception as e:
        logger.error(f"Error generating signed URLs: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/upload/verify', methods=['POST'])
def verify_upload():
    """
    Endpoint per verificare che i file siano stati caricati correttamente su GCS
    """
    try:
        data = request.json
        blob_names = data.get('blob_names', [])
        
        if not blob_names:
            return jsonify({'status': 'error', 'message': 'No blob names provided'}), 400
        
        verification_results = []
        for blob_name in blob_names:
            try:
                blob = gcs_manager.bucket.blob(blob_name)
                exists = blob.exists()
                size = blob.size if exists else 0
                
                verification_results.append({
                    'blob_name': blob_name,
                    'exists': exists,
                    'size': size
                })
                
            except Exception as e:
                logger.error(f"Error verifying {blob_name}: {e}")
                verification_results.append({
                    'blob_name': blob_name,
                    'exists': False,
                    'error': str(e)
                })
        
        return jsonify({
            'status': 'success',
            'verification_results': verification_results
        })
        
    except Exception as e:
        logger.error(f"Error verifying uploads: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
 
@app.route('/api/analyze', methods=['POST'])
def analyze():
    """
    Endpoint per avviare l'analisi dei file di rete da GCS
    I risultati vengono salvati direttamente su GCS invece che localmente
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({'status': 'error', 'message': 'No data provided'}), 400
        
        blob_names = data.get('blob_names', [])
        session_id = data.get('session_id')
        
        if not blob_names:
            return jsonify({'status': 'error', 'message': 'No files specified for analysis'}), 400
        
        # Estrai i parametri di configurazione
        file_type = data.get('type', 'auto')
        
        # Crea una directory temporanea per l'elaborazione locale
        temp_output_dir = tempfile.mkdtemp()
        
        # Definisci i percorsi per i risultati su GCS
        results_prefix = f"results/{session_id}"
        graph_blob_name = f"{results_prefix}/network_graph.pdf"
        analysis_blob_name = f"{results_prefix}/network_analysis.json"
        terraform_prefix = f"{results_prefix}/terraform"
        
        # Definisci i percorsi temporanei locali
        temp_graph_path = os.path.join(temp_output_dir, 'network_graph.pdf')
        temp_analysis_path = os.path.join(temp_output_dir, 'network_analysis.json')
        temp_terraform_dir = os.path.join(temp_output_dir, 'terraform')
        
        try:
            # Inizializza l'orchestratore
            orchestrator = AnalysisOrchestrator()
            
            # Prepara i risultati aggregati
            result_data = {
                'hosts': set(),
                'connections': {},
                'protocols': {},
                'subnets': {},
                'roles': {}
            }
            
            processed_files = []
            
            # Analizza ogni file da GCS
            for blob_name in blob_names:
                logger.info(f"Analyzing file from GCS: {blob_name}")
                
                try:
                    # Scarica il file da GCS in memoria
                    file_content = gcs_manager.download_file_to_memory(blob_name)
                    
                    # Determina l'estensione dal nome del file
                    file_extension = os.path.splitext(blob_name)[1].lower()

                    # Mappa le estensioni supportate
                    supported_extensions = {'.pcap', '.csv', '.netflow'}

                    # Verifica se l'estensione è supportata, altrimenti usa un default
                    if file_extension in supported_extensions:
                        suffix = file_extension
                    else:
                        # Opzionale: solleva un'eccezione se l'estensione non è supportata
                        # raise ValueError(f"Estensione file non supportata: {file_extension}")
                        
                        # Oppure usa un'estensione di default (esempio: .pcap)
                        suffix = '.pcap'

                    # Crea un file temporaneo per l'analisi con l'estensione corretta
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                        temp_file.write(file_content)
                        temp_file_path = temp_file.name
                    
                    # Esegui l'analisi con percorsi temporanei
                    success = orchestrator.run(
                        input_file=temp_file_path,
                        file_type=file_type,
                        output_dir=temp_output_dir,
                        output_graph=temp_graph_path,
                        output_analysis=temp_analysis_path,
                        output_terraform=temp_terraform_dir
                    )
                    
                    # Pulisci il file temporaneo
                    try:
                        os.unlink(temp_file_path)
                    except:
                        pass
                    
                    if not success:
                        logger.error(f"Analysis failed for {blob_name}")
                        continue
                    
                    # Sposta il file nella cartella processed
                    try:
                        processed_blob_name = gcs_manager.move_file_to_processed(blob_name)
                        processed_files.append(processed_blob_name)
                    except Exception as e:
                        logger.warning(f"Failed to move {blob_name} to processed: {e}")
                    
                    # Aggrega i risultati dall'analizzatore
                    analyzer_data = orchestrator.analyzer.get_data()
                    
                    # Aggiungi host
                    result_data['hosts'].update(analyzer_data['network_data'].hosts)
                    
                    # Aggiungi protocolli
                    for proto, count in analyzer_data['network_data'].protocols.items():
                        if proto in result_data['protocols']:
                            result_data['protocols'][proto] += count
                        else:
                            result_data['protocols'][proto] = count
                    
                    # Aggiungi subnet con conteggio host e ruolo
                    subnet_roles_summary = {}
                    
                    # Raggruppa ruoli per subnet
                    for ip, subnet in orchestrator.analyzer.subnets.items():
                        role = orchestrator.analyzer.host_roles.get(ip, "UNKNOWN")
                        subnet_roles_summary.setdefault(subnet, {'hosts': [], 'roles': set()})
                        subnet_roles_summary[subnet]['hosts'].append(ip)
                        subnet_roles_summary[subnet]['roles'].add(role)
                    
                    # Costruisci le voci finali delle subnet
                    for subnet, data in subnet_roles_summary.items():
                        host_count = len(data['hosts'])
                        roles_str = ", ".join(sorted(data['roles']))
                        result_data['subnets'][subnet] = f"{subnet} | Hosts in subnet: {host_count} | Roles: {roles_str}"
                    
                    # Aggiungi ruoli degli host
                    for host, role in orchestrator.analyzer.host_roles.items():
                        result_data['roles'][host] = role
                    
                    # Aggiungi connessioni
                    for (src, dst), count in analyzer_data['network_data'].connections.items():
                        conn_key = f"{src}->{dst}"
                        if conn_key in result_data['connections']:
                            result_data['connections'][conn_key] += count
                        else:
                            result_data['connections'][conn_key] = count
                            
                except Exception as e:
                    logger.error(f"Error processing {blob_name}: {e}")
                    continue
            
            # Verifica se almeno un file è stato processato con successo
            if not result_data['hosts'] and not result_data['connections']:
                return jsonify({
                    'status': 'error',
                    'message': 'No files were successfully analyzed'
                }), 500
            
            # Carica i risultati su GCS
            uploaded_results = []
            
            # Carica il grafo di rete se esiste
            if os.path.exists(temp_graph_path):
                with open(temp_graph_path, 'rb') as f:
                    graph_content = f.read()
                gcs_manager.upload_file_from_memory(graph_content, graph_blob_name, 'application/pdf')
                uploaded_results.append(graph_blob_name)
                logger.info(f"Uploaded network graph to {graph_blob_name}")
            
            # Carica l'analisi JSON se esiste
            if os.path.exists(temp_analysis_path):
                with open(temp_analysis_path, 'rb') as f:
                    analysis_content = f.read()
                gcs_manager.upload_file_from_memory(analysis_content, analysis_blob_name, 'application/json')
                uploaded_results.append(analysis_blob_name)
                logger.info(f"Uploaded network analysis to {analysis_blob_name}")
            
            # Carica la directory Terraform se esiste
            terraform_files = []
            if os.path.exists(temp_terraform_dir):
                terraform_files = gcs_manager.upload_directory_to_gcs(temp_terraform_dir, terraform_prefix)
                uploaded_results.extend(terraform_files)
                logger.info(f"Uploaded {len(terraform_files)} Terraform files to {terraform_prefix}")
            
            # Prepara il risultato finale
            final_result = {
                'hosts': len(result_data['hosts']),
                'hosts_list': list(result_data['hosts']),
                'connections': sum(result_data['connections'].values()),
                'connections_details': result_data['connections'],
                'protocols': [{'name': proto, 'count': count} for proto, count in result_data['protocols'].items()],
                'subnets': list(result_data['subnets'].values()),
                'roles': {},
                'anomalies': 0,
                'session_id': session_id,
                'processed_files': processed_files,
                'result_files': {
                    'graph': graph_blob_name if graph_blob_name in uploaded_results else None,
                    'analysis': analysis_blob_name if analysis_blob_name in uploaded_results else None,
                    'terraform_files': terraform_files
                },
                'gcs_results_prefix': results_prefix
            }
            
            # Conta i ruoli
            for host, role in result_data['roles'].items():
                if role in final_result['roles']:
                    final_result['roles'][role] += 1
                else:
                    final_result['roles'][role] = 1
            
            return jsonify({
                'status': 'success',
                'message': 'Analysis completed and results uploaded to cloud storage',
                'results': final_result
            })
            
        finally:
            # Pulisci sempre la directory temporanea
            try:
                shutil.rmtree(temp_output_dir)
                logger.info(f"Cleaned up temporary directory: {temp_output_dir}")
            except Exception as e:
                logger.warning(f"Failed to cleanup temporary directory: {e}")
            
    except Exception as e:
        logger.error(f"Error during analysis: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/cleanup/session', methods=['POST'])
def cleanup_session():
    """
    Endpoint per pulire i file di una sessione (sia uploads che risultati)
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'status': 'error', 'message': 'Session ID required'}), 400
        
        gcs_manager.cleanup_session_files(session_id)
        
        return jsonify({
            'status': 'success',
            'message': f'Session {session_id} cleaned up successfully'
        })
        
    except Exception as e:
        logger.error(f"Error cleaning up session: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/download/<file_type>', methods=['GET'])
def download_file(file_type):
    """
    Endpoint per scaricare i file generati dall'analisi da GCS
    """
    try:
        blob_name = request.args.get('blob_name')
        session_id = request.args.get('session_id')
        
        if not blob_name and not session_id:
            return jsonify({'status': 'error', 'message': 'Blob name or session ID required'}), 400
        
        # Se non è fornito il blob_name, costruiscilo dal session_id e file_type
        if not blob_name:
            if file_type == 'graph':
                blob_name = f"results/{session_id}/network_graph.pdf"
            elif file_type == 'analysis':
                blob_name = f"results/{session_id}/network_analysis.json"
            elif file_type == 'terraform':
                # Per Terraform, crea uno ZIP di tutti i file
                return download_terraform_archive(session_id)
            else:
                return jsonify({'status': 'error', 'message': 'Invalid file type'}), 400
        
        # Verifica che il file esista
        if not gcs_manager.file_exists(blob_name):
            return jsonify({'status': 'error', 'message': 'File not found'}), 404
        
        # Genera una signed URL per il download
        try:
            download_url = gcs_manager.create_download_url(blob_name, expiration=300)  # 5 minuti
            
            # Determina il nome del file per il download
            filename = os.path.basename(blob_name)
            if file_type == 'graph':
                filename = 'network_graph.pdf'
            elif file_type == 'analysis':
                filename = 'network_analysis.json'
            
            return jsonify({
                'status': 'success',
                'download_url': download_url,
                'filename': filename,
                'blob_name': blob_name
            })
            
        except Exception as e:
            logger.error(f"Failed to generate download URL for {blob_name}: {e}")
            return jsonify({'status': 'error', 'message': 'Failed to generate download URL'}), 500
            
    except Exception as e:
        logger.error(f"Error during file download preparation: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

def download_terraform_archive(session_id):
    """
    Crea e restituisce un archivio ZIP dei file Terraform da GCS
    """
    try:
        # Lista tutti i file Terraform per la sessione
        terraform_prefix = f"results/{session_id}/terraform/"
        terraform_blobs = gcs_manager.bucket.list_blobs(prefix=terraform_prefix)
        
        # Crea un archivio ZIP in memoria
        from io import BytesIO
        import zipfile
        
        zip_buffer = BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for blob in terraform_blobs:
                if blob.name.endswith('/'):  # Skip directories
                    continue
                
                # Scarica il contenuto del file
                file_content = blob.download_as_bytes()
                
                # Ottieni il nome del file relativo
                relative_name = blob.name.replace(terraform_prefix, '')
                
                # Aggiungi al ZIP
                zip_file.writestr(relative_name, file_content)
        
        zip_buffer.seek(0)
        
        # Crea un file temporaneo per il download
        temp_zip_path = os.path.join(tempfile.gettempdir(), f'terraform_config_{session_id}.zip')
        
        with open(temp_zip_path, 'wb') as f:
            f.write(zip_buffer.getvalue())
        
        return send_file(temp_zip_path, as_attachment=True, download_name='terraform_config.zip')
        
    except Exception as e:
        logger.error(f"Error creating Terraform archive for session {session_id}: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to create Terraform archive'}), 500

@app.route('/api/terraform/files', methods=['GET'])
def get_terraform_files():
    """
    Endpoint per ottenere la lista dei file Terraform da GCS
    """
    try:
        session_id = request.args.get('session_id')
        
        if not session_id:
            return jsonify({'status': 'error', 'message': 'Session ID required'}), 400
        
        # Lista i file Terraform su GCS
        terraform_prefix = f"results/{session_id}/terraform/"
        terraform_blobs = gcs_manager.bucket.list_blobs(prefix=terraform_prefix)
        
        files = []
        for blob in terraform_blobs:
            if blob.name.endswith('/'):  # Skip directories
                continue
                
            file_name = os.path.basename(blob.name)
            if file_name.endswith('.tf'):
                # Determina il tipo di file in base al contenuto del nome
                file_type = determine_terraform_file_type_from_name(file_name)
                
                files.append({
                    'id': len(files) + 1,
                    'name': file_name,
                    'type': file_type,
                    'size': blob.size,
                    'blob_name': blob.name
                })
        
        return jsonify({
            'status': 'success',
            'session_id': session_id,
            'files': files
        })
    
    except Exception as e:
        logger.error(f"Error getting Terraform files for session: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/terraform/content', methods=['GET'])
def get_terraform_file_content():
    """
    Endpoint per ottenere il contenuto di un file Terraform da GCS
    """
    try:
        blob_name = request.args.get('blob_name')
        
        if not blob_name:
            return jsonify({'status': 'error', 'message': 'Blob name required'}), 400
        
        # Verifica che il file esista
        if not gcs_manager.file_exists(blob_name):
            return jsonify({'status': 'error', 'message': 'File not found'}), 404
        
        # Scarica il contenuto del file
        try:
            file_content = gcs_manager.download_file_to_memory(blob_name)
            content_str = file_content.decode('utf-8')
            
            return jsonify({
                'status': 'success',
                'content': content_str,
                'blob_name': blob_name
            })
            
        except UnicodeDecodeError:
            return jsonify({'status': 'error', 'message': 'File is not a text file'}), 400
    
    except Exception as e:
        logger.error(f"Error getting file content: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/terraform/save', methods=['POST'])
def save_terraform_file():
    """
    Endpoint per salvare le modifiche a un file Terraform su GCS
    """
    try:
        data = request.json
        blob_name = data.get('blob_name')
        content = data.get('content')
        
        if not blob_name or content is None:
            return jsonify({'status': 'error', 'message': 'Blob name and content required'}), 400
        
        # Verifica che il file esista
        if not gcs_manager.file_exists(blob_name):
            return jsonify({'status': 'error', 'message': 'File not found'}), 404
        
        # Salva il contenuto su GCS
        try:
            content_bytes = content.encode('utf-8')
            gcs_manager.upload_file_from_memory(content_bytes, blob_name, 'text/plain')
            
            return jsonify({
                'status': 'success',
                'message': 'File saved successfully',
                'blob_name': blob_name
            })
            
        except Exception as e:
            logger.error(f"Failed to save file {blob_name}: {e}")
            return jsonify({'status': 'error', 'message': 'Failed to save file'}), 500
    
    except Exception as e:
        logger.error(f"Error saving Terraform file: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

def determine_terraform_file_type_from_name(file_name):
    """
    Determina il tipo di file Terraform in base al nome
    
    Args:
        file_name (str): Nome del file
        
    Returns:
        str: Tipo di file (network, compute, variables, output, configuration)
    """
    file_name_lower = file_name.lower()
    
    if file_name_lower.startswith('provider') or file_name_lower == 'main.tf':
        return 'configuration'
    elif 'network' in file_name_lower or file_name_lower.startswith('network'):
        return 'network'
    elif 'instance' in file_name_lower or 'compute' in file_name_lower:
        return 'compute'
    elif 'output' in file_name_lower or file_name_lower.startswith('output'):
        return 'output'
    elif 'variable' in file_name_lower or 'var' in file_name_lower:
        return 'variables'
    else:
        return 'configuration'

# ========== ENDPOINT TERRAFORM AGGIORNATI ==========

@app.route('/api/terraform/init', methods=['POST'])
def terraform_init():
    """
    Endpoint per inizializzare Terraform scaricando i file da GCS
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({
                'status': 'error', 
                'message': 'Session ID required'
            }), 400
        
        # Crea una directory temporanea per i file Terraform
        temp_terraform_dir = tempfile.mkdtemp()
        
        try:
            # Scarica tutti i file Terraform da GCS (esclusi tfstate e directory)
            terraform_prefix = f"results/{session_id}/terraform/"
            terraform_blobs = gcs_manager.bucket.list_blobs(prefix=terraform_prefix)
            
            downloaded_files = 0
            for blob in terraform_blobs:
                if blob.name.endswith('/') or blob.name.endswith('.tfstate'):  # Skip directories e tfstate
                    continue
                
                # Scarica il file
                file_content = blob.download_as_bytes()
                
                # Calcola il percorso locale
                relative_path = blob.name.replace(terraform_prefix, '')
                local_file_path = os.path.join(temp_terraform_dir, relative_path)
                
                # Crea la directory se necessaria
                os.makedirs(os.path.dirname(local_file_path), exist_ok=True)
                
                # Salva il file
                with open(local_file_path, 'wb') as f:
                    f.write(file_content)
                
                downloaded_files += 1
            
            if downloaded_files == 0:
                return jsonify({
                    'status': 'error',
                    'message': 'No Terraform files found for this session'
                }), 404
            
            # Inizializza il manager Terraform con supporto GCS
            manager = TerraformManager(temp_terraform_dir, session_id, gcs_manager)
            result = manager.init()
            
            if result['success']:
                return jsonify({
                    'status': 'success',
                    'message': 'Terraform initialized successfully',
                    'output': result['output'],
                    'temp_dir': temp_terraform_dir,
                    'files_downloaded': downloaded_files,
                    'tfstate_synced': True
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'Error during Terraform initialization',
                    'error': result['error']
                }), 500
        
        except Exception as e:
            # Pulisci la directory temporanea in caso di errore
            try:
                shutil.rmtree(temp_terraform_dir)
            except:
                pass
            raise e
    
    except Exception as e:
        logger.error(f"Error during Terraform initialization: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/terraform/validate', methods=['POST'])
def terraform_validate():
    """
    Endpoint per validare la configurazione Terraform
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        temp_dir = data.get('temp_dir')
        
        if not session_id:
            return jsonify({
                'status': 'error', 
                'message': 'Session ID required'
            }), 400
        
        terraform_dir = temp_dir
        
        # Se non abbiamo una directory temporanea, scarica i file da GCS
        if not terraform_dir or not os.path.exists(terraform_dir):
            init_result = terraform_init()
            init_data = init_result.get_json()
            
            if init_data.get('status') != 'success':
                return init_result
            
            terraform_dir = init_data.get('temp_dir')
        
        # Inizializza il manager Terraform con supporto GCS
        manager = TerraformManager(terraform_dir, session_id, gcs_manager)
        result = manager.validate()
        
        if result['success']:
            return jsonify({
                'status': 'success',
                'message': 'Terraform configuration is valid',
                'output': result['output']
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Terraform configuration is invalid',
                'error': result['error']
            }), 400
    
    except Exception as e:
        logger.error(f"Error during Terraform validation: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/terraform/plan', methods=['POST'])
def terraform_plan():
    """
    Endpoint per eseguire terraform plan
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        temp_dir = data.get('temp_dir')
        
        if not session_id:
            return jsonify({
                'status': 'error', 
                'message': 'Session ID required'
            }), 400
        
        terraform_dir = temp_dir
        
        # Se non abbiamo una directory temporanea, scarica i file da GCS
        if not terraform_dir or not os.path.exists(terraform_dir):
            init_result = terraform_init()
            init_data = init_result.get_json()
            
            if init_data.get('status') != 'success':
                return init_result
            
            terraform_dir = init_data.get('temp_dir')
        
        # Inizializza il manager Terraform con supporto GCS
        manager = TerraformManager(terraform_dir, session_id, gcs_manager)
        
        # Prima inizializza se necessario
        if not os.path.exists(os.path.join(terraform_dir, '.terraform')):
            init_result = manager.init()
            if not init_result['success']:
                return jsonify({
                    'status': 'error',
                    'message': 'Error during Terraform initialization',
                    'error': init_result['error']
                }), 500
        
        # Poi esegui il plan
        plan_result = manager.plan()
        
        if plan_result['success']:
            return jsonify({
                'status': 'success',
                'message': 'Terraform plan completed',
                'has_changes': plan_result['has_changes'],
                'plan_summary': plan_result['plan_summary'],
                'plan_file': plan_result['plan_file'],
                'output': plan_result['output'],
                'tfstate_synced': True
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Error during Terraform plan execution',
                'error': plan_result['error']
            }), 500
    
    except Exception as e:
        logger.error(f"Error during terraform plan: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/terraform/apply', methods=['POST'])
def terraform_apply():
    """
    Endpoint per eseguire terraform apply
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        temp_dir = data.get('temp_dir')
        plan_file = data.get('plan_file')
        auto_approve = data.get('auto_approve', False)
        
        if not session_id:
            return jsonify({
                'status': 'error', 
                'message': 'Session ID required'
            }), 400
        
        terraform_dir = temp_dir
        
        # Se non abbiamo una directory temporanea, scarica i file da GCS
        if not terraform_dir or not os.path.exists(terraform_dir):
            init_result = terraform_init()
            init_data = init_result.get_json()
            
            if init_data.get('status') != 'success':
                return init_result
            
            terraform_dir = init_data.get('temp_dir')
        
        # Se è specificato un file plan, verifica che esista
        if plan_file and not os.path.exists(plan_file):
            return jsonify({
                'status': 'error', 
                'message': 'Terraform plan file not found'
            }), 400
        
        # Inizializza il manager Terraform con supporto GCS
        manager = TerraformManager(terraform_dir, session_id, gcs_manager)
        
        # Esegui apply (il manager sincronizzerà automaticamente il tfstate)
        apply_result = manager.apply(plan_file, auto_approve)
        
        if apply_result['success']:
            # Recupera gli output Terraform dopo il deployment
            outputs = manager.get_outputs()
           
            # Ottieni la mappatura IP
            mapping = outputs["outputs"]["original_to_gcp_mapping"]["value"]
            
            # Salva il mapping su GCS nella directory terraform
            try:
                # Converti la mappatura in JSON
                mapping_json = json.dumps(mapping, indent=4)
                
                # Definisci il percorso su GCS nella directory terraform
                blob_name = f"results/{session_id}/terraform/ip_mapping.json"
                
                # Carica il file su GCS
                gcs_url = gcs_manager.upload_file_from_memory(
                    mapping_json.encode('utf-8'), 
                    blob_name, 
                    content_type='application/json'
                )
                
                logger.info(f"Mappatura IP salvata su GCS: {gcs_url}")
                
            except Exception as e:
                logger.error(f"Errore nel salvataggio della mappatura IP su GCS: {e}")
                # Non interrompiamo l'esecuzione se il salvataggio fallisce
            
            return jsonify({
                'status': 'success',
                'message': 'Terraform infrastructure deployed successfully',
                'output': apply_result['output'],
                'terraform_outputs': outputs.get('outputs', {}) if outputs['success'] else {},
                'tfstate_synced': True,
                'ip_mapping_saved': f"gs://{gcs_manager.bucket_name}/results/{session_id}/terraform/ip_mapping.json"
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Error during Terraform infrastructure deployment',
                'error': apply_result['error']
            }), 500
    
    except Exception as e:
        logger.error(f"Error during terraform apply: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
        
@app.route('/api/terraform/destroy', methods=['POST'])
def terraform_destroy():
    """
    Endpoint per eseguire terraform destroy
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        temp_dir = data.get('temp_dir')
        auto_approve = data.get('auto_approve', False)
        
        if not session_id:
            return jsonify({
                'status': 'error', 
                'message': 'Session ID required'
            }), 400
        
        terraform_dir = temp_dir
        
        # Se non abbiamo una directory temporanea, scarica i file da GCS
        if not terraform_dir or not os.path.exists(terraform_dir):
            init_result = terraform_init()
            init_data = init_result.get_json()
            
            if init_data.get('status') != 'success':
                return init_result
            
            terraform_dir = init_data.get('temp_dir')
        
        # Inizializza il manager Terraform con supporto GCS
        manager = TerraformManager(terraform_dir, session_id, gcs_manager)
        
        # Prima sincronizza il tfstate da GCS (CRUCIALE per il destroy!)
        logger.info(f"Sincronizzazione tfstate da GCS prima del destroy per sessione {session_id}")
        state_synced = manager.sync_state_from_gcs()
        
        if not state_synced:
            logger.warning(f"Impossibile sincronizzare il tfstate da GCS per la sessione {session_id}")
        
        # Esegui destroy (il manager gestirà automaticamente la sincronizzazione)
        destroy_result = manager.destroy(auto_approve)
        
        if destroy_result['success']:
            return jsonify({
                'status': 'success',
                'message': 'Terraform infrastructure destroyed successfully',
                'output': destroy_result['output'],
                'tfstate_synced': True
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Error during Terraform infrastructure destruction',
                'error': destroy_result['error']
            }), 500
    
    except Exception as e:
        logger.error(f"Error during terraform destroy: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/terraform/status', methods=['GET'])
def terraform_status():
    """
    Endpoint per verificare lo stato attuale dell'infrastruttura Terraform
    """
    try:
        session_id = request.args.get('session_id')
        temp_dir = request.args.get('temp_dir')
        
        if not session_id:
            return jsonify({
                'status': 'error', 
                'message': 'Session ID required'
            }), 400
        
        terraform_dir = temp_dir
        
        # Verifica se ci sono file Terraform su GCS per questa sessione
        terraform_prefix = f"results/{session_id}/terraform/"
        terraform_blobs = list(gcs_manager.bucket.list_blobs(prefix=terraform_prefix, max_results=1))
        has_terraform_files = len(terraform_blobs) > 0
        
        # Verifica se esiste un tfstate su GCS
        tfstate_blob_name = f"results/{session_id}/terraform/terraform.tfstate"
        has_tfstate_on_gcs = gcs_manager.file_exists(tfstate_blob_name)
        
        if not has_terraform_files:
            return jsonify({
                'status': 'success',
                'has_terraform_files': False,
                'has_tfstate_on_gcs': False,
                'is_initialized': False,
                'is_deployed': False,
                'outputs': {}
            })
        
        # Se non abbiamo una directory temporanea locale, lo stato è basato su GCS
        if not terraform_dir or not os.path.exists(terraform_dir):
            return jsonify({
                'status': 'success',
                'has_terraform_files': True,
                'has_tfstate_on_gcs': has_tfstate_on_gcs,
                'is_initialized': False,
                'is_deployed': has_tfstate_on_gcs,  # Se c'è tfstate su GCS, probabilmente è deployed
                'outputs': {},
                'message': 'Terraform files available on cloud storage, but not initialized locally'
            })
        
        # Verifica se è stato già inizializzato localmente
        init_dir = os.path.join(terraform_dir, ".terraform")
        is_initialized = os.path.exists(init_dir)
        
        # Cerca di ottenere gli output (funziona solo se è stato fatto apply)
        is_deployed = False
        outputs = {}
        
        if is_initialized:
            manager = TerraformManager(terraform_dir, session_id, gcs_manager)
            outputs_result = manager.get_outputs()
            is_deployed = outputs_result['success']
            outputs = outputs_result.get('outputs', {}) if is_deployed else {}
        
        return jsonify({
            'status': 'success',
            'has_terraform_files': True,
            'has_tfstate_on_gcs': has_tfstate_on_gcs,
            'is_initialized': is_initialized,
            'is_deployed': is_deployed,
            'outputs': outputs
        })
    
    except Exception as e:
        logger.error(f"Error getting Terraform status: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# ========== ENDPOINT PER GESTIONE TFSTATE ==========

@app.route('/api/terraform/tfstate/info', methods=['GET'])
def get_tfstate_info():
    """
    Endpoint per ottenere informazioni sul tfstate
    """
    try:
        session_id = request.args.get('session_id')
        
        if not session_id:
            return jsonify({
                'status': 'error',
                'message': 'Session ID required'
            }), 400
        
        tfstate_info = gcs_manager.get_tfstate_info(session_id)
        
        return jsonify({
            'status': 'success',
            'tfstate_info': tfstate_info
        })
    
    except Exception as e:
        logger.error(f"Error getting tfstate info: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/terraform/tfstate/backups', methods=['GET'])
def list_tfstate_backups():
    """
    Endpoint per listare i backup del tfstate
    """
    try:
        session_id = request.args.get('session_id')
        
        if not session_id:
            return jsonify({
                'status': 'error',
                'message': 'Session ID required'
            }), 400
        
        backups = gcs_manager.list_tfstate_backups(session_id)
        
        return jsonify({
            'status': 'success',
            'backups': backups
        })
    
    except Exception as e:
        logger.error(f"Error listing tfstate backups: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/terraform/tfstate/restore', methods=['POST'])
def restore_tfstate_from_backup():
    """
    Endpoint per ripristinare il tfstate da un backup
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        backup_blob_name = data.get('backup_blob_name')
        
        if not session_id or not backup_blob_name:
            return jsonify({
                'status': 'error',
                'message': 'Session ID and backup blob name required'
            }), 400
        
        success = gcs_manager.restore_tfstate_from_backup(session_id, backup_blob_name)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Tfstate restored from backup successfully'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to restore tfstate from backup'
            }), 500
    
    except Exception as e:
        logger.error(f"Error restoring tfstate from backup: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/traffic/test', methods=['POST'])
def run_traffic_test():
    """
    Endpoint per avviare il test di traffico
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        pcap_file = data.get('pcap_file')  # Opzionale
        
        if not session_id:
            return jsonify({
                'status': 'error', 
                'message': 'Session ID required'
            }), 400
        
        # Inizializza il manager per i test di traffico
        traffic_manager = TrafficTestManager(session_id, gcs_manager)
        
        # Esegui il test di traffico
        test_result = traffic_manager.execute_traffic_test(pcap_file)
        
        if test_result['success']:
            return jsonify({
                'status': 'success',
                'message': 'Traffic test completed successfully',
                'output': test_result['output'],
                'execution_time': test_result.get('execution_time'),
                'files_processed': test_result.get('files_processed', {})
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Traffic test failed',
                'error': test_result['error']
            }), 500
    
    except Exception as e:
        logger.error(f"Error during traffic test: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/traffic/status/<session_id>', methods=['GET'])
def get_traffic_test_status(session_id):
    """
    Endpoint per ottenere lo stato del test di traffico
    """
    try:
        if not session_id:
            return jsonify({
                'status': 'error', 
                'message': 'Session ID required'
            }), 400
        
        traffic_manager = TrafficTestManager(session_id, gcs_manager)
        status = traffic_manager.get_test_status()
        
        return jsonify({
            'status': 'success',
            'test_status': status
        })
    
    except Exception as e:
        logger.error(f"Error getting traffic test status: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/traffic/cancel', methods=['POST'])
def cancel_traffic_test():
    """
    Endpoint per annullare il test di traffico in corso
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({
                'status': 'error', 
                'message': 'Session ID required'
            }), 400
        
        traffic_manager = TrafficTestManager(session_id, gcs_manager)
        cancel_result = traffic_manager.cancel_test()
        
        if cancel_result['success']:
            return jsonify({
                'status': 'success',
                'message': 'Traffic test cancelled successfully'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to cancel traffic test',
                'error': cancel_result['error']
            }), 500
    
    except Exception as e:
        logger.error(f"Error cancelling traffic test: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """Endpoint per ottenere lo stato del servizio"""
    return jsonify({
        'status': 'running',
        'service': 'autonetgen-backend',
        'version': '1.0.0',
        'bucket': GCS_BUCKET_NAME,
        'storage_mode': 'cloud'
    })
        
if __name__ == '__main__':
    # Assicurati che la directory temporanea esista
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    # Avvia il server Flask
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)