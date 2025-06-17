#!/usr/bin/env python3
"""
GCS Manager - Gestisce tutte le operazioni con Google Cloud Storage
"""

import os
import json
import tempfile
from datetime import datetime, timedelta
from google.cloud import storage
from google.oauth2 import service_account
from config import logger

class GCSFileManager:
    """Gestisce le operazioni con Google Cloud Storage"""
    
    def __init__(self, bucket_name, storage_client=None):
        """
        Inizializza il GCSFileManager
        
        Args:
            bucket_name (str): Nome del bucket GCS
            storage_client: Client GCS (opzionale, ne crea uno se non fornito)
        """
        self.bucket_name = bucket_name
        
        if storage_client:
            self.storage_client = storage_client
        else:
            self.storage_client = self._get_storage_client()
            
        self.bucket = self.storage_client.bucket(self.bucket_name)
    
    def _get_storage_client(self):
        """Inizializza il client Google Cloud Storage"""
        try:
            # Prova a leggere le credenziali dalla variabile di ambiente
            credentials_json = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS_JSON')
            
            if credentials_json:
                # Carica le credenziali dal JSON nella variabile di ambiente
                credentials_info = json.loads(credentials_json)
                credentials = service_account.Credentials.from_service_account_info(credentials_info)
                storage_client = storage.Client(credentials=credentials)
                logger.info("Client GCS inizializzato con credenziali dalla variabile di ambiente")
            else:
                # Usa le credenziali di default dell'ambiente (utile su Cloud Run)
                storage_client = storage.Client()
                logger.info("Client GCS inizializzato con credenziali di default")
                
            return storage_client
            
        except Exception as e:
            logger.error(f"Errore nell'inizializzazione del client GCS: {e}")
            # Fallback alle credenziali di default
            return storage.Client()

    def generate_signed_url(self, blob_name, method='PUT', expiration=3600):
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
            blob = self.bucket.blob(blob_name)
            
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

    def download_file_to_memory(self, blob_name):
        """
        Scarica un file da GCS in memoria
        
        Args:
            blob_name (str): Nome del blob su GCS
            
        Returns:
            bytes: Contenuto del file
        """
        try:
            blob = self.bucket.blob(blob_name)
            
            if not blob.exists():
                raise FileNotFoundError(f"File {blob_name} not found in GCS")
            
            # Scarica il file in memoria
            file_content = blob.download_as_bytes()
            logger.info(f"Downloaded {blob_name} from GCS ({len(file_content)} bytes)")
            
            return file_content
            
        except Exception as e:
            logger.error(f"Failed to download {blob_name} from GCS: {e}")
            raise

    def upload_file_from_memory(self, file_content, blob_name, content_type='application/octet-stream'):
        """
        Carica un file su GCS dalla memoria
        
        Args:
            file_content (bytes): Contenuto del file
            blob_name (str): Nome del blob su GCS
            content_type (str): Tipo di contenuto
            
        Returns:
            str: URL pubblico del file
        """
        try:
            blob = self.bucket.blob(blob_name)
            blob.upload_from_string(file_content, content_type=content_type)
            
            logger.info(f"File caricato su GCS: {blob_name}")
            return f"gs://{self.bucket_name}/{blob_name}"
            
        except Exception as e:
            logger.error(f"Errore nel caricamento su GCS: {e}")
            raise

    def upload_directory_to_gcs(self, local_dir, gcs_prefix):
        """
        Carica una directory locale su GCS
        
        Args:
            local_dir (str): Percorso della directory locale
            gcs_prefix (str): Prefisso per i file su GCS
            
        Returns:
            list: Lista dei file caricati su GCS
        """
        uploaded_files = []
        try:
            for root, dirs, files in os.walk(local_dir):
                for file in files:
                    local_file_path = os.path.join(root, file)
                    # Calcola il percorso relativo dal local_dir
                    relative_path = os.path.relpath(local_file_path, local_dir)
                    # Crea il nome del blob combinando il prefisso con il percorso relativo
                    blob_name = f"{gcs_prefix}/{relative_path}".replace("\\", "/")
                    
                    # Leggi il file e caricalo su GCS
                    with open(local_file_path, 'rb') as f:
                        file_content = f.read()
                    
                    # Determina il content-type basato sull'estensione
                    content_type = 'application/octet-stream'
                    if file.endswith('.json'):
                        content_type = 'application/json'
                    elif file.endswith('.pdf'):
                        content_type = 'application/pdf'
                    elif file.endswith('.png'):
                        content_type = 'image/png'
                    elif file.endswith('.tf'):
                        content_type = 'text/plain'
                    elif file.endswith('.zip'):
                        content_type = 'application/zip'
                    elif file.endswith('.tfstate'):
                        content_type = 'application/json'
                    
                    self.upload_file_from_memory(file_content, blob_name, content_type)
                    uploaded_files.append(blob_name)
                    
            logger.info(f"Caricati {len(uploaded_files)} file da {local_dir} a GCS con prefisso {gcs_prefix}")
            return uploaded_files
            
        except Exception as e:
            logger.error(f"Errore durante il caricamento della directory su GCS: {e}")
            raise

    def create_download_url(self, blob_name, expiration=3600):
        """
        Crea una signed URL per il download di un file da GCS
        
        Args:
            blob_name (str): Nome del blob su GCS
            expiration (int): Secondi di validità della URL
            
        Returns:
            str: Signed URL per il download
        """
        try:
            blob = self.bucket.blob(blob_name)
            
            if not blob.exists():
                raise FileNotFoundError(f"File {blob_name} not found in GCS")
            
            # Genera la signed URL per il download
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=datetime.utcnow() + timedelta(seconds=expiration),
                method="GET"
            )
            
            logger.info(f"Generated download URL for {blob_name}")
            return signed_url
            
        except Exception as e:
            logger.error(f"Failed to generate download URL for {blob_name}: {e}")
            raise

    def move_file_to_processed(self, blob_name):
        """
        Sposta un file dalla cartella uploads a processed
        
        Args:
            blob_name (str): Nome del blob da spostare
            
        Returns:
            str: Nuovo nome del blob nella cartella processed
        """
        try:
            source_blob = self.bucket.blob(blob_name)
            
            if not source_blob.exists():
                raise FileNotFoundError(f"File {blob_name} not found in GCS")
            
            # Crea il nuovo nome nella cartella processed
            processed_blob_name = blob_name.replace('uploads/', 'processed/', 1)
            
            # Copia il file
            self.bucket.copy_blob(source_blob, self.bucket, processed_blob_name)
            
            # Elimina il file originale
            source_blob.delete()
            
            logger.info(f"Moved {blob_name} to {processed_blob_name}")
            return processed_blob_name
            
        except Exception as e:
            logger.error(f"Failed to move {blob_name} to processed: {e}")
            raise

    def cleanup_session_files(self, session_id):
        """
        Pulisce tutti i file di una sessione
        
        Args:
            session_id (str): ID della sessione
        """
        try:
            # Pulisci file uploads
            prefix = f"uploads/{session_id}/"
            blobs = self.bucket.list_blobs(prefix=prefix)
            
            for blob in blobs:
                try:
                    blob.delete()
                    logger.info(f"Deleted {blob.name}")
                except Exception as e:
                    logger.warning(f"Failed to delete {blob.name}: {e}")
            
            # Pulisci anche i file di risultati
            results_prefix = f"results/{session_id}/"
            results_blobs = self.bucket.list_blobs(prefix=results_prefix)
            
            for blob in results_blobs:
                try:
                    blob.delete()
                    logger.info(f"Deleted result file {blob.name}")
                except Exception as e:
                    logger.warning(f"Failed to delete result file {blob.name}: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to cleanup session {session_id}: {e}")

    def file_exists(self, blob_name):
        """
        Verifica se un file esiste su GCS
        
        Args:
            blob_name (str): Nome del blob su GCS
            
        Returns:
            bool: True se il file esiste
        """
        try:
            blob = self.bucket.blob(blob_name)
            return blob.exists()
        except Exception as e:
            logger.error(f"Errore nella verifica esistenza file: {e}")
            return False

    # ========== METODI SPECIFICI PER TERRAFORM TFSTATE ==========

    def upload_tfstate(self, session_id, tfstate_path):
        """
        Carica il file terraform.tfstate su GCS
        
        Args:
            session_id (str): ID della sessione
            tfstate_path (str): Percorso locale del file tfstate
            
        Returns:
            str: Nome del blob su GCS
        """
        try:
            if not os.path.exists(tfstate_path):
                logger.warning(f"File tfstate non trovato: {tfstate_path}")
                return None
                
            blob_name = f"results/{session_id}/terraform/terraform.tfstate"
            
            with open(tfstate_path, 'rb') as f:
                tfstate_content = f.read()
            
            self.upload_file_from_memory(
                tfstate_content, 
                blob_name, 
                'application/json'
            )
            
            logger.info(f"File tfstate caricato su GCS: {blob_name}")
            return blob_name
            
        except Exception as e:
            logger.error(f"Errore nel caricamento del tfstate su GCS: {e}")
            raise

    def download_tfstate(self, session_id, local_tfstate_path):
        """
        Scarica il file terraform.tfstate da GCS
        
        Args:
            session_id (str): ID della sessione
            local_tfstate_path (str): Percorso locale dove salvare il tfstate
            
        Returns:
            bool: True se il download è riuscito
        """
        try:
            blob_name = f"results/{session_id}/terraform/terraform.tfstate"
            
            if not self.file_exists(blob_name):
                logger.info(f"File tfstate non trovato su GCS: {blob_name}")
                return False
            
            # Scarica il contenuto
            tfstate_content = self.download_file_to_memory(blob_name)
            
            # Crea la directory se non esiste
            os.makedirs(os.path.dirname(local_tfstate_path), exist_ok=True)
            
            # Salva il file localmente
            with open(local_tfstate_path, 'wb') as f:
                f.write(tfstate_content)
            
            logger.info(f"File tfstate scaricato da GCS: {blob_name} -> {local_tfstate_path}")
            return True
            
        except Exception as e:
            logger.error(f"Errore nel download del tfstate da GCS: {e}")
            return False

    def backup_tfstate(self, session_id, tfstate_path, backup_suffix=None):
        """
        Crea un backup del file tfstate su GCS
        
        Args:
            session_id (str): ID della sessione
            tfstate_path (str): Percorso locale del file tfstate
            backup_suffix (str): Suffisso per il backup (es. "pre-destroy")
            
        Returns:
            str: Nome del blob di backup
        """
        try:
            if not os.path.exists(tfstate_path):
                logger.warning(f"File tfstate non trovato per il backup: {tfstate_path}")
                return None
            
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            suffix = f"_{backup_suffix}" if backup_suffix else ""
            blob_name = f"results/{session_id}/terraform/backups/terraform.tfstate.{timestamp}{suffix}"
            
            with open(tfstate_path, 'rb') as f:
                tfstate_content = f.read()
            
            self.upload_file_from_memory(
                tfstate_content, 
                blob_name, 
                'application/json'
            )
            
            logger.info(f"Backup tfstate creato su GCS: {blob_name}")
            return blob_name
            
        except Exception as e:
            logger.error(f"Errore nella creazione del backup tfstate: {e}")
            raise

    def list_tfstate_backups(self, session_id):
        """
        Lista tutti i backup del tfstate per una sessione
        
        Args:
            session_id (str): ID della sessione
            
        Returns:
            list: Lista dei nomi dei blob di backup
        """
        try:
            backup_prefix = f"results/{session_id}/terraform/backups/"
            backup_blobs = self.bucket.list_blobs(prefix=backup_prefix)
            
            backups = []
            for blob in backup_blobs:
                if blob.name.endswith('.tfstate') or 'terraform.tfstate.' in blob.name:
                    backups.append({
                        'blob_name': blob.name,
                        'size': blob.size,
                        'created': blob.time_created,
                        'updated': blob.updated
                    })
            
            # Ordina per data di creazione (più recente prima)
            backups.sort(key=lambda x: x['created'], reverse=True)
            
            logger.info(f"Trovati {len(backups)} backup tfstate per sessione {session_id}")
            return backups
            
        except Exception as e:
            logger.error(f"Errore nel listing dei backup tfstate: {e}")
            return []

    def restore_tfstate_from_backup(self, session_id, backup_blob_name):
        """
        Ripristina un tfstate da un backup
        
        Args:
            session_id (str): ID della sessione
            backup_blob_name (str): Nome del blob di backup
            
        Returns:
            bool: True se il ripristino è riuscito
        """
        try:
            if not self.file_exists(backup_blob_name):
                logger.error(f"Backup tfstate non trovato: {backup_blob_name}")
                return False
            
            # Scarica il backup
            backup_content = self.download_file_to_memory(backup_blob_name)
            
            # Carica come tfstate attuale
            current_tfstate_blob = f"results/{session_id}/terraform/terraform.tfstate"
            self.upload_file_from_memory(
                backup_content,
                current_tfstate_blob,
                'application/json'
            )
            
            logger.info(f"Tfstate ripristinato da backup: {backup_blob_name} -> {current_tfstate_blob}")
            return True
            
        except Exception as e:
            logger.error(f"Errore nel ripristino del tfstate da backup: {e}")
            return False

    def get_tfstate_info(self, session_id):
        """
        Ottiene informazioni sul tfstate corrente
        
        Args:
            session_id (str): ID della sessione
            
        Returns:
            dict: Informazioni sul tfstate
        """
        try:
            blob_name = f"results/{session_id}/terraform/terraform.tfstate"
            
            if not self.file_exists(blob_name):
                return {
                    'exists': False,
                    'message': 'No tfstate found for this session'
                }
            
            blob = self.bucket.blob(blob_name)
            blob.reload()  # Aggiorna le metadata
            
            return {
                'exists': True,
                'blob_name': blob_name,
                'size': blob.size,
                'created': blob.time_created,
                'updated': blob.updated,
                'content_type': blob.content_type
            }
            
        except Exception as e:
            logger.error(f"Errore nel recupero info tfstate: {e}")
            return {
                'exists': False,
                'error': str(e)
            }