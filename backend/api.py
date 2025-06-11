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

app = Flask(__name__)
CORS(app, origins=["*"])  # Permette chiamate da frontend React

# Configurazione Google Cloud Storage
GCS_BUCKET_NAME = os.environ.get('GCS_BUCKET_NAME', 'gruppo-10-autonetgen-storage')
GOOGLE_APPLICATION_CREDENTIALS = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')

# Inizializza il client GCS
if GOOGLE_APPLICATION_CREDENTIALS and os.path.exists(GOOGLE_APPLICATION_CREDENTIALS):
    storage_client = storage.Client.from_service_account_json(GOOGLE_APPLICATION_CREDENTIALS)
else:
    # Usa le credenziali di default dell'ambiente (utile su Cloud Run)
    storage_client = storage.Client()

bucket = storage_client.bucket(GCS_BUCKET_NAME)

# Configura una directory per i file temporanei (ora usata solo per risultati)
TEMP_DIR = tempfile.mkdtemp()
app.config['TEMP_DIR'] = TEMP_DIR

@app.errorhandler(413)
def request_entity_too_large(error):
    """Gestisce l'errore 413"""
    return jsonify({
        'status': 'error', 
        'message': 'File troppo grande per essere processato'
    }), 413

class GCSFileManager:
    """Gestisce le operazioni con Google Cloud Storage"""
    
    @staticmethod
    def generate_signed_url(blob_name, method='PUT', expiration=3600):
        """
        Genera una signed URL per l'upload di un file
        
        Args:
            blob_name (str): Nome del blob su GCS
            method (str): Metodo HTTP (PUT per upload)
            expiration (int): Secondi di validità della URL
            
        Returns:
            str: Signed URL
        """
        try:
            blob = bucket.blob(blob_name)
            
            # Genera la signed URL
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=datetime.utcnow() + timedelta(seconds=expiration),
                method=method,
                content_type="application/octet-stream"
            )
            
            logger.info(f"Generated signed URL for {blob_name}")
            return signed_url
            
        except Exception as e:
            logger.error(f"Failed to generate signed URL for {blob_name}: {e}")
            raise

    @staticmethod
    def download_file_to_memory(blob_name):
        """
        Scarica un file da GCS in memoria
        
        Args:
            blob_name (str): Nome del blob su GCS
            
        Returns:
            bytes: Contenuto del file
        """
        try:
            blob = bucket.blob(blob_name)
            
            if not blob.exists():
                raise FileNotFoundError(f"File {blob_name} not found in GCS")
            
            # Scarica il file in memoria
            file_content = blob.download_as_bytes()
            logger.info(f"Downloaded {blob_name} from GCS ({len(file_content)} bytes)")
            
            return file_content
            
        except Exception as e:
            logger.error(f"Failed to download {blob_name} from GCS: {e}")
            raise

    @staticmethod
    def move_file_to_processed(blob_name):
        """
        Sposta un file dalla cartella uploads a processed
        
        Args:
            blob_name (str): Nome del blob da spostare
            
        Returns:
            str: Nuovo nome del blob nella cartella processed
        """
        try:
            source_blob = bucket.blob(blob_name)
            
            if not source_blob.exists():
                raise FileNotFoundError(f"File {blob_name} not found in GCS")
            
            # Crea il nuovo nome nella cartella processed
            processed_blob_name = blob_name.replace('uploads/', 'processed/', 1)
            
            # Copia il file
            bucket.copy_blob(source_blob, bucket, processed_blob_name)
            
            # Elimina il file originale
            source_blob.delete()
            
            logger.info(f"Moved {blob_name} to {processed_blob_name}")
            return processed_blob_name
            
        except Exception as e:
            logger.error(f"Failed to move {blob_name} to processed: {e}")
            raise

    @staticmethod
    def cleanup_session_files(session_id):
        """
        Pulisce tutti i file di una sessione
        
        Args:
            session_id (str): ID della sessione
        """
        try:
            prefix = f"uploads/{session_id}/"
            blobs = bucket.list_blobs(prefix=prefix)
            
            for blob in blobs:
                try:
                    blob.delete()
                    logger.info(f"Deleted {blob.name}")
                except Exception as e:
                    logger.warning(f"Failed to delete {blob.name}: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to cleanup session {session_id}: {e}")

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
                signed_url = GCSFileManager.generate_signed_url(
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
                blob = bucket.blob(blob_name)
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
    Ora accetta blob_names invece di file caricati direttamente
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
        output_dir = data.get('output_dir', DEFAULT_OUTPUT_DIR)
        output_graph = data.get('output_graph')
        output_analysis = data.get('output_analysis')
        output_terraform = data.get('output_terraform')
        
        # Crea la directory di output se non esiste
        os.makedirs(output_dir, exist_ok=True)
        
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
                file_content = GCSFileManager.download_file_to_memory(blob_name)
                
                # Crea un file temporaneo per l'analisi
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pcap') as temp_file:
                    temp_file.write(file_content)
                    temp_file_path = temp_file.name
                
                # Esegui l'analisi
                success = orchestrator.run(
                    input_file=temp_file_path,
                    file_type=file_type,
                    output_dir=output_dir,
                    output_graph=output_graph,
                    output_analysis=output_analysis,
                    output_terraform=output_terraform
                )
                
                # Pulisci il file temporaneo
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                
                if not success:
                    logger.error(f"Analysis failed for {blob_name}")
                    # In caso di errore, prova comunque a processare gli altri file
                    continue
                
                # Sposta il file nella cartella processed
                try:
                    processed_blob_name = GCSFileManager.move_file_to_processed(blob_name)
                    processed_files.append(processed_blob_name)
                except Exception as e:
                    logger.warning(f"Failed to move {blob_name} to processed: {e}")
                    # Non bloccare l'analisi se il movimento fallisce
                
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
                # Continua con gli altri file anche se uno fallisce
                continue
        
        # Verifica se almeno un file è stato processato con successo
        if not result_data['hosts'] and not result_data['connections']:
            return jsonify({
                'status': 'error',
                'message': 'No files were successfully analyzed'
            }), 500
        
        # Prepara il risultato finale
        final_result = {
            'hosts': len(result_data['hosts']),
            'hosts_list': list(result_data['hosts']),
            'connections': sum(result_data['connections'].values()),
            'connections_details': result_data['connections'],
            'protocols': [{'name': proto, 'count': count} for proto, count in result_data['protocols'].items()],
            'subnets': list(result_data['subnets'].values()),
            'roles': {},
            'anomalies': 0,  # Questo richiede un'implementazione per rilevare anomalie
            'session_id': session_id,
            'processed_files': processed_files,
            'output_paths': {
                'graph': output_graph,
                'analysis': output_analysis,
                'terraform': output_terraform
            }
        }
        
        # Conta i ruoli
        for host, role in result_data['roles'].items():
            if role in final_result['roles']:
                final_result['roles'][role] += 1
            else:
                final_result['roles'][role] = 1
        
        return jsonify({
            'status': 'success',
            'message': 'Analysis completed',
            'results': final_result
        })
            
    except Exception as e:
        logger.error(f"Error during analysis: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/cleanup/session', methods=['POST'])
def cleanup_session():
    """
    Endpoint per pulire i file di una sessione
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'status': 'error', 'message': 'Session ID required'}), 400
        
        GCSFileManager.cleanup_session_files(session_id)
        
        return jsonify({
            'status': 'success',
            'message': f'Session {session_id} cleaned up successfully'
        })
        
    except Exception as e:
        logger.error(f"Error cleaning up session: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Mantieni tutti gli altri endpoint esistenti (download, terraform, etc.)
@app.route('/api/download/<file_type>', methods=['GET'])
def download_file(file_type):
    """
    Endpoint per scaricare i file generati dall'analisi
    """
    try:
        if file_type == 'graph':
            file_path = request.args.get('path', os.path.join(DEFAULT_OUTPUT_DIR, 'network_graph.pdf'))
            return send_file(file_path, as_attachment=True, download_name='network_graph.pdf')
        
        elif file_type == 'analysis':
            file_path = request.args.get('path', os.path.join(DEFAULT_OUTPUT_DIR, 'network_analysis.json'))
            return send_file(file_path, as_attachment=True, download_name='network_analysis.json')
        
        elif file_type == 'terraform':
            # Crea un archivio zip dei file Terraform
            terraform_dir = request.args.get('path', os.path.join(DEFAULT_OUTPUT_DIR, 'terraform'))
            if not os.path.exists(terraform_dir):
                return jsonify({'status': 'error', 'message': 'Directory Terraform non trovata'}), 404
            
            # Crea un file ZIP temporaneo
            temp_zip = os.path.join(tempfile.gettempdir(), 'terraform_config.zip')
            shutil.make_archive(os.path.splitext(temp_zip)[0], 'zip', terraform_dir)
            
            return send_file(temp_zip, as_attachment=True, download_name='terraform_config.zip')
        
        else:
            return jsonify({'status': 'error', 'message': 'Tipo di file non valido'}), 400
            
    except Exception as e:
        logger.error(f"Errore durante il download del file: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/terraform/files', methods=['GET'])
def get_terraform_files():
    """
    Endpoint per ottenere la lista dei file Terraform
    """
    try:
        # Ottieni il percorso della directory Terraform
        terraform_dir = request.args.get('path', os.path.join(DEFAULT_OUTPUT_DIR, 'terraform'))
        
        if not os.path.exists(terraform_dir):
            return jsonify({'status': 'error', 'message': 'Directory Terraform non trovata'}), 404
        
        # Ottieni la lista dei file nella directory
        files = []
        for file_name in os.listdir(terraform_dir):
            file_path = os.path.join(terraform_dir, file_name)
            if os.path.isfile(file_path) and file_name.endswith('.tf'):
                # Determina il tipo di file in base al contenuto o al nome
                file_type = determine_terraform_file_type(file_name, file_path)
                
                files.append({
                    'id': len(files) + 1,
                    'name': file_name,
                    'type': file_type,
                    'size': os.path.getsize(file_path)
                })
        
        return jsonify({
            'status': 'success',
            'path': terraform_dir,
            'files': files
        })
    
    except Exception as e:
        logger.error(f"Errore durante il recupero dei file Terraform: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/terraform/content', methods=['GET'])
def get_terraform_file_content():
    """
    Endpoint per ottenere il contenuto di un file Terraform
    """
    try:
        # Ottieni il percorso del file
        file_path = request.args.get('path')
        
        if not file_path or not os.path.exists(file_path):
            return jsonify({'status': 'error', 'message': 'File non trovato'}), 404
        
        # Leggi il contenuto del file
        with open(file_path, 'r') as file:
            content = file.read()
        
        return jsonify({
            'status': 'success',
            'content': content
        })
    
    except Exception as e:
        logger.error(f"Errore durante il recupero del contenuto del file: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/terraform/save', methods=['POST'])
def save_terraform_file():
    """
    Endpoint per salvare le modifiche a un file Terraform
    """
    try:
        # Ottieni i dati dalla richiesta
        data = request.json
        file_path = data.get('path')
        content = data.get('content')
        
        if not file_path or not content:
            return jsonify({'status': 'error', 'message': 'Percorso del file o contenuto mancante'}), 400
        
        # Verifica che il file esista
        if not os.path.exists(file_path):
            return jsonify({'status': 'error', 'message': 'File non trovato'}), 404
        
        # Salva il contenuto nel file
        with open(file_path, 'w') as file:
            file.write(content)
        
        return jsonify({
            'status': 'success',
            'message': 'File salvato con successo'
        })
    
    except Exception as e:
        logger.error(f"Errore durante il salvataggio del file: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Endpoint per verificare lo stato del servizio
    """
    return jsonify({
        'status': 'healthy',
        'service': 'network-analyzer-backend',
        'gcs_bucket': GCS_BUCKET_NAME,
        'timestamp': str(os.environ.get('K_REVISION', 'unknown'))
    }), 200

def determine_terraform_file_type(file_name, file_path):
    """
    Determina il tipo di file Terraform in base al nome e al contenuto
    
    Args:
        file_name (str): Nome del file
        file_path (str): Percorso completo del file
        
    Returns:
        str: Tipo di file (network, compute, variables, output, configuration)
    """
    # Controlla prima il nome del file
    if file_name.startswith('provider') or file_name == 'main.tf':
        return 'configuration'
    elif file_name.startswith('network') or 'network' in file_name:
        return 'network'
    elif file_name.startswith('instance') or 'compute' in file_name:
        return 'compute'
    elif file_name.startswith('output') or 'output' in file_name:
        return 'output'
    elif file_name.startswith('variable') or 'var' in file_name:
        return 'variables'
    
    # Se non è possibile determinare il tipo dal nome, verifica il contenuto
    try:
        with open(file_path, 'r') as file:
            content = file.read().lower()
            
            if 'provider "google"' in content or 'terraform {' in content:
                return 'configuration'
            elif 'google_compute_network' in content or 'google_compute_subnetwork' in content:
                return 'network'
            elif 'google_compute_instance' in content:
                return 'compute'
            elif 'output ' in content:
                return 'output'
            elif 'variable ' in content:
                return 'variables'
    except:
        pass
    
    # Tipo predefinito se non è possibile determinarlo
    return 'configuration'

# Mantieni tutti gli endpoint Terraform esistenti
@app.route('/api/terraform/init', methods=['POST'])
def terraform_init():
    """
    Endpoint per inizializzare Terraform nella directory specificata
    """
    try:
        terraform_dir = request.json.get('terraformPath')
        
        if not terraform_dir or not os.path.exists(terraform_dir):
            return jsonify({
                'status': 'error', 
                'message': 'Directory Terraform non valida'
            }), 400
        
        # Inizializza il manager Terraform
        manager = TerraformManager(terraform_dir)
        result = manager.init()
        
        if result['success']:
            return jsonify({
                'status': 'success',
                'message': 'Terraform inizializzato con successo',
                'output': result['output']
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Errore durante l\'inizializzazione di Terraform',
                'error': result['error']
            }), 500
    
    except Exception as e:
        logger.error(f"Errore durante l'inizializzazione Terraform: {e}")
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
        terraform_dir = request.json.get('terraformPath')
        
        if not terraform_dir or not os.path.exists(terraform_dir):
            return jsonify({
                'status': 'error', 
                'message': 'Directory Terraform non valida'
            }), 400
        
        # Inizializza il manager Terraform
        manager = TerraformManager(terraform_dir)
        result = manager.validate()
        
        if result['success']:
            return jsonify({
                'status': 'success',
                'message': 'Configurazione Terraform valida',
                'output': result['output']
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Configurazione Terraform non valida',
                'error': result['error']
            }), 400
    
    except Exception as e:
        logger.error(f"Errore durante la validazione Terraform: {e}")
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
        terraform_dir = request.json.get('terraformPath')
        
        if not terraform_dir or not os.path.exists(terraform_dir):
            return jsonify({
                'status': 'error', 
                'message': 'Directory Terraform non valida'
            }), 400
        
        # Inizializza il manager Terraform
        manager = TerraformManager(terraform_dir)
        
        # Prima inizializza
        init_result = manager.init()
        if not init_result['success']:
            return jsonify({
                'status': 'error',
                'message': 'Errore durante l\'inizializzazione di Terraform',
                'error': init_result['error']
            }), 500
        
        # Poi esegui il plan
        plan_result = manager.plan()
        
        if plan_result['success']:
            return jsonify({
                'status': 'success',
                'message': 'Plan Terraform completato',
                'has_changes': plan_result['has_changes'],
                'plan_summary': plan_result['plan_summary'],
                'plan_file': plan_result['plan_file'],
                'output': plan_result['output']
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Errore durante l\'esecuzione del plan Terraform',
                'error': plan_result['error']
            }), 500
    
    except Exception as e:
        logger.error(f"Errore durante l'esecuzione di terraform plan: {e}")
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
        terraform_dir = request.json.get('terraformPath')
        plan_file = request.json.get('planFile')
        auto_approve = request.json.get('autoApprove', False)
        
        if not terraform_dir or not os.path.exists(terraform_dir):
            return jsonify({
                'status': 'error', 
                'message': 'Directory Terraform non valida'
            }), 400
        
        # Se è specificato un file plan, verifica che esista
        if plan_file and not os.path.exists(plan_file):
            return jsonify({
                'status': 'error', 
                'message': 'File di piano Terraform non trovato'
            }), 400
        
        # Inizializza il manager Terraform
        manager = TerraformManager(terraform_dir)
        
        # Esegui apply
        apply_result = manager.apply(plan_file, auto_approve)
        
        if apply_result['success']:
            # Recupera gli output Terraform dopo il deployment
            outputs = manager.get_outputs()
            
            return jsonify({
                'status': 'success',
                'message': 'Infrastruttura Terraform deployata con successo',
                'output': apply_result['output'],
                'terraform_outputs': outputs.get('outputs', {}) if outputs['success'] else {}
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Errore durante il deploy dell\'infrastruttura Terraform',
                'error': apply_result['error']
            }), 500
    
    except Exception as e:
        logger.error(f"Errore durante l'esecuzione di terraform apply: {e}")
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
        terraform_dir = request.json.get('terraformPath')
        auto_approve = request.json.get('autoApprove', False)
        
        if not terraform_dir or not os.path.exists(terraform_dir):
            return jsonify({
                'status': 'error', 
                'message': 'Directory Terraform non valida'
            }), 400
        
        # Inizializza il manager Terraform
        manager = TerraformManager(terraform_dir)
        
        # Esegui destroy
        destroy_result = manager.destroy(auto_approve)
        
        if destroy_result['success']:
            return jsonify({
                'status': 'success',
                'message': 'Infrastruttura Terraform distrutta con successo',
                'output': destroy_result['output']
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Errore durante la distruzione dell\'infrastruttura Terraform',
                'error': destroy_result['error']
            }), 500
    
    except Exception as e:
        logger.error(f"Errore durante l'esecuzione di terraform destroy: {e}")
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
        terraform_dir = request.args.get('terraformPath')
        
        if not terraform_dir or not os.path.exists(terraform_dir):
            return jsonify({
                'status': 'error', 
                'message': 'Directory Terraform non valida'
            }), 400
        
        # Inizializza il manager Terraform
        manager = TerraformManager(terraform_dir)
        
        # Verifica se è stato già inizializzato
        init_dir = os.path.join(terraform_dir, ".terraform")
        is_initialized = os.path.exists(init_dir)
        
        # Cerca di ottenere gli output (funziona solo se è stato fatto apply)
        outputs_result = manager.get_outputs()
        is_deployed = outputs_result['success']
        
        return jsonify({
            'status': 'success',
            'is_initialized': is_initialized,
            'is_deployed': is_deployed,
            'outputs': outputs_result.get('outputs', {}) if is_deployed else {}
        })
    
    except Exception as e:
        logger.error(f"Errore durante il recupero dello stato Terraform: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
        
if __name__ == '__main__':
    # Assicurati che la directory di output esista
    os.makedirs(DEFAULT_OUTPUT_DIR, exist_ok=True)
    
    # In produzione, utilizzare un server WSGI come Gunicorn
    app.run(debug=True, host='0.0.0.0', port=8080)