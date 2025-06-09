# backend/storage_api.py - NUOVO FILE
# Aggiungere questo file al backend per gestire storage e notifiche

import json
import base64
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from google.cloud import storage
from google.cloud import pubsub_v1
import os
import tempfile
from analysis_orchestrator import AnalysisOrchestrator
from config import logger, DEFAULT_OUTPUT_DIR

# Configurazione Google Cloud
PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT', 'gruppo-10')
BUCKET_NAME = f"{PROJECT_ID}-autonetgen-storage"

# Client Google Cloud
storage_client = storage.Client()
bucket = storage_client.bucket(BUCKET_NAME)

def generate_signed_upload_url(filename):
    """
    Genera un signed URL per l'upload diretto su Cloud Storage
    """
    try:
        # Crea il percorso del file nella cartella uploads/
        blob_name = f"uploads/{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        blob = bucket.blob(blob_name)
        
        # Genera signed URL per upload (valido per 1 ora)
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=1),
            method="PUT",
            content_type="application/octet-stream",
        )
        
        return {
            'upload_url': url,
            'blob_name': blob_name,
            'expires_at': (datetime.now() + timedelta(hours=1)).isoformat()
        }
    except Exception as e:
        logger.error(f"Errore generazione signed URL: {str(e)}")
        raise

def process_uploaded_file(blob_name):
    """
    Processa un file caricato su Cloud Storage
    """
    try:
        # Scarica il file dal bucket
        blob = bucket.blob(blob_name)
        
        # Crea file temporaneo
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(blob_name)[1]) as temp_file:
            blob.download_to_filename(temp_file.name)
            temp_filepath = temp_file.name
        
        logger.info(f"File scaricato da storage: {blob_name} -> {temp_filepath}")
        
        # Inizializza l'orchestratore per l'analisi
        orchestrator = AnalysisOrchestrator()
        
        # Crea directory di output
        output_dir = os.path.join(DEFAULT_OUTPUT_DIR, f"analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        os.makedirs(output_dir, exist_ok=True)
        
        # Esegui l'analisi
        result = orchestrator.process_file(temp_filepath, output_dir)
        
        # Carica i risultati su Cloud Storage
        upload_results_to_storage(output_dir, blob_name)
        
        # Cleanup file temporaneo
        os.unlink(temp_filepath)
        
        logger.info(f"Analisi completata per: {blob_name}")
        return result
        
    except Exception as e:
        logger.error(f"Errore processamento file {blob_name}: {str(e)}")
        raise

def upload_results_to_storage(output_dir, original_blob_name):
    """
    Carica i risultati dell'analisi su Cloud Storage
    """
    try:
        # Crea cartella risultati basata sul nome del file originale
        base_name = os.path.splitext(os.path.basename(original_blob_name))[0]
        results_prefix = f"results/{base_name}/"
        
        # Carica tutti i file dalla directory di output
        for root, dirs, files in os.walk(output_dir):
            for file in files:
                local_path = os.path.join(root, file)
                # Calcola il percorso relativo per mantenere la struttura
                relative_path = os.path.relpath(local_path, output_dir)
                blob_path = f"{results_prefix}{relative_path}"
                
                blob = bucket.blob(blob_path)
                blob.upload_from_filename(local_path)
                logger.info(f"Caricato risultato: {blob_path}")
                
    except Exception as e:
        logger.error(f"Errore caricamento risultati: {str(e)}")

# === ENDPOINT API === 

def add_storage_endpoints(app):
    """
    Aggiunge gli endpoint per la gestione dello storage all'app Flask
    """
    
    @app.route('/api/upload-url', methods=['POST'])
    def get_upload_url():
        """
        Endpoint per ottenere un signed URL per l'upload
        """
        try:
            data = request.get_json()
            filename = data.get('filename')
            
            if not filename:
                return jsonify({'error': 'Nome file richiesto'}), 400
            
            # Genera signed URL
            upload_info = generate_signed_upload_url(filename)
            
            return jsonify({
                'status': 'success',
                'upload_info': upload_info
            })
            
        except Exception as e:
            logger.error(f"Errore generazione upload URL: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/file-notification', methods=['POST'])
    def handle_file_notification():
        """
        Endpoint per gestire le notifiche Pub/Sub di file caricati
        """
        try:
            # Decodifica il messaggio Pub/Sub
            envelope = request.get_json()
            if not envelope:
                return 'No Pub/Sub message received', 400

            pubsub_message = envelope.get('message', {})
            if not pubsub_message:
                return 'Invalid Pub/Sub message format', 400

            # Decodifica i dati del messaggio
            message_data = base64.b64decode(pubsub_message.get('data', '')).decode('utf-8')
            notification_data = json.loads(message_data)
            
            # Estrai informazioni dal messaggio di notifica
            blob_name = notification_data.get('name')
            event_type = notification_data.get('eventType')
            
            logger.info(f"Ricevuta notifica: {event_type} per {blob_name}")
            
            # Processa solo eventi di finalizzazione oggetto nella cartella uploads/
            if event_type == 'OBJECT_FINALIZE' and blob_name.startswith('uploads/'):
                # Elabora il file in background (in una implementazione reale, 
                # potresti voler usare una coda separata per elaborazioni pesanti)
                try:
                    process_uploaded_file(blob_name)
                    logger.info(f"File processato con successo: {blob_name}")
                except Exception as e:
                    logger.error(f"Errore processamento file {blob_name}: {str(e)}")
                    # In caso di errore, potresti voler implementare retry logic
            
            return 'OK', 200
            
        except Exception as e:
            logger.error(f"Errore gestione notifica: {str(e)}")
            return f'Error processing notification: {str(e)}', 500

    @app.route('/api/files', methods=['GET'])
    def list_uploaded_files():
        """
        Endpoint per elencare i file caricati
        """
        try:
            # Lista i file nella cartella uploads/
            blobs = bucket.list_blobs(prefix='uploads/')
            
            files = []
            for blob in blobs:
                files.append({
                    'name': blob.name,
                    'size': blob.size,
                    'created': blob.time_created.isoformat() if blob.time_created else None,
                    'updated': blob.updated.isoformat() if blob.updated else None
                })
            
            return jsonify({
                'status': 'success',
                'files': files
            })
            
        except Exception as e:
            logger.error(f"Errore listing files: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/results/<path:file_id>', methods=['GET'])
    def get_analysis_results(file_id):
        """
        Endpoint per ottenere i risultati dell'analisi di un file
        """
        try:
            # Lista i risultati per il file specificato
            results_prefix = f"results/{file_id}/"
            blobs = bucket.list_blobs(prefix=results_prefix)
            
            results = {}
            for blob in blobs:
                # Scarica e leggi il contenuto del file risultato
                content = blob.download_as_text()
                file_path = blob.name[len(results_prefix):]
                results[file_path] = content
            
            return jsonify({
                'status': 'success',
                'results': results
            })
            
        except Exception as e:
            logger.error(f"Errore recupero risultati: {str(e)}")
            return jsonify({'error': str(e)}), 500