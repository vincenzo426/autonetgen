#!/usr/bin/env python3
"""
TrafficTestManager - gestisce l'esecuzione dei test di traffico sulla VM custom
"""

import os
import subprocess
import tempfile
import time
import json
import threading
from datetime import datetime
from config import logger

class TrafficTestManager:
    """Gestisce l'esecuzione dei test di traffico sulla VM personalizzata"""
    
    def __init__(self, session_id, gcs_manager):
        """
        Inizializza il manager per i test di traffico
        
        Args:
            session_id (str): ID della sessione
            gcs_manager: Istanza del GCSFileManager
        """
        self.session_id = session_id
        self.gcs_manager = gcs_manager
        self.vm_name = "custom-vm"
        self.vm_zone = "us-central1-a"
        self.test_status = "idle"  # idle, running, completed, error
        self.test_thread = None
        
    def execute_traffic_test(self, pcap_file=None):
        """
        Esegue il test di traffico sulla VM personalizzata
        
        Args:
            pcap_file (str): Nome del file PCAP da utilizzare (opzionale)
            
        Returns:
            dict: Risultato dell'esecuzione
        """
        try:
            start_time = time.time()
            self.test_status = "running"
            
            logger.info(f"Avvio test di traffico per sessione {self.session_id}")
            
            # 1. Scarica i file necessari da GCS
            temp_dir = self._download_required_files(pcap_file)
            
            # 2. Verifica che la VM custom esista
            if not self._check_vm_exists():
                raise Exception(f"VM {self.vm_name} not found in zone {self.vm_zone}")
            
            # 3. Copia il file PCAP sulla VM
            pcap_local_path = self._get_pcap_file_path(temp_dir, pcap_file)
            if not pcap_local_path:
                raise Exception("No PCAP file found for testing")
            
            self._copy_file_to_vm(pcap_local_path)
            
            # 4. Copia lo script traffic.sh sulla VM
            script_path = self._prepare_traffic_script(temp_dir)
            self._copy_file_to_vm(script_path, "/tmp/traffic.sh")
            
            # 5. Rendi lo script eseguibile
            self._run_ssh_command("chmod +x /tmp/traffic.sh")
            
            # 6. Esegui lo script traffic.sh con il file PCAP
            pcap_filename = os.path.basename(pcap_local_path)
            script_output = self._run_traffic_script(pcap_filename)
            
            # 7. Cleanup dei file temporanei
            self._cleanup_temp_files(temp_dir)
            
            execution_time = time.time() - start_time
            self.test_status = "completed"
            
            logger.info(f"Test di traffico completato in {execution_time:.2f} secondi")
            
            return {
                'success': True,
                'output': script_output,
                'execution_time': execution_time,
                'files_processed': {
                    'pcap_file': pcap_filename,
                    'vm_name': self.vm_name
                }
            }
            
        except Exception as e:
            self.test_status = "error"
            logger.error(f"Errore durante il test di traffico: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _download_required_files(self, pcap_file):
        """Scarica i file necessari da GCS"""
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Scarica ip_mapping.json
            mapping_blob = f"results/{self.session_id}/terraform/ip_mapping.json"
            mapping_path = os.path.join(temp_dir, "ip_mapping.json")
            
            if self.gcs_manager.file_exists(mapping_blob):
                self.gcs_manager.download_file_to_memory(mapping_blob)
                logger.info(f"Downloaded IP mapping: {mapping_path}")
            else:
                logger.warning("IP mapping file not found, test may not work correctly")
            
            # Scarica il file PCAP (cerca automaticamente se non specificato)
            if not pcap_file:
                pcap_file = self._find_pcap_file()
            
            if pcap_file:
                pcap_blob = f"uploads/{self.session_id}/{pcap_file}"
                pcap_path = os.path.join(temp_dir, pcap_file)
                
                if self.gcs_manager.file_exists(pcap_blob):
                    self.gcs_manager.download_file_to_memory(pcap_blob)
                    logger.info(f"Downloaded PCAP file: {pcap_path}")
                else:
                    raise Exception(f"PCAP file {pcap_file} not found in GCS")
            
            return temp_dir
            
        except Exception as e:
            # Cleanup in caso di errore
            try:
                import shutil
                shutil.rmtree(temp_dir)
            except:
                pass
            raise e
    
    def _find_pcap_file(self):
        """Trova automaticamente un file PCAP nella sessione"""
        try:
            prefix = f"uploads/{self.session_id}/"
            blobs = self.gcs_manager.bucket.list_blobs(prefix=prefix)
            
            for blob in blobs:
                if blob.name.lower().endswith('.pcap'):
                    filename = os.path.basename(blob.name)
                    logger.info(f"Found PCAP file: {filename}")
                    return filename
            
            return None
        except Exception as e:
            logger.error(f"Error finding PCAP file: {e}")
            return None
    
    def _get_pcap_file_path(self, temp_dir, pcap_file):
        """Ottiene il percorso del file PCAP scaricato"""
        if pcap_file:
            path = os.path.join(temp_dir, pcap_file)
            if os.path.exists(path):
                return path
        
        # Cerca qualsiasi file PCAP nella directory temporanea
        for file in os.listdir(temp_dir):
            if file.lower().endswith('.pcap'):
                return os.path.join(temp_dir, file)
        
        return None
    
    def _prepare_traffic_script(self, temp_dir):
        """Prepara lo script traffic.sh modificato"""
        script_content = '''#!/bin/bash
# traffic.sh - Script per automatizzare i test di traffico con tcpreplay

set -e

# Funzione per mostrare l'uso dello script
show_usage() {
    echo "Usage: $0 <pcap_file_path>"
    echo ""
    echo "Parametri:"
    echo "  pcap_file_path    Percorso completo al file PCAP da utilizzare per i test"
    echo ""
    echo "Esempio:"
    echo "  $0 /home/user/traffic.pcap"
    echo ""
    exit 1
}

# Verifica che sia stato fornito il parametro del file PCAP
if [ $# -ne 1 ]; then
    echo "Errore: È necessario specificare il percorso del file PCAP."
    echo ""
    show_usage
fi

# --- CONFIGURAZIONE ---
PCAP_FILE="$1"
TESTER_VM_NAME="custom-vm"
ZONE="us-central1-a"

# Colori per output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}
print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Verifica che il file PCAP esista
if [ ! -f "$PCAP_FILE" ]; then
    print_error "File PCAP non trovato in: $PCAP_FILE"
    print_error "Verifica che il percorso sia corretto e che il file esista."
    exit 1
fi

print_message "File PCAP trovato: $PCAP_FILE"

# Installa tcpreplay e jq se non presenti
print_message "Installazione di tcpreplay e jq..."
sudo apt-get update -qq && sudo apt-get install -y tcpreplay jq

# Crea il file di remapping degli IP se esiste ip_mapping.json
REMAP_FILE="remap.txt"
if [ -f "/tmp/ip_mapping.json" ]; then
    print_message "Creazione del file di remapping IP: $REMAP_FILE..."
    cat /tmp/ip_mapping.json | jq -r 'to_entries[] | "\\(.key)/32:\\(.value)/32"' > "$REMAP_FILE"
else
    print_message "File ip_mapping.json non trovato, creazione mapping vuoto..."
    touch "$REMAP_FILE"
fi

print_header "Esecuzione del test di traffico"
EDITED_PCAP="edited_traffic.pcap"
CACHE_FILE="traffic.cache"
PCAP_BASENAME=$(basename "$PCAP_FILE")
print_message "File PCAP da elaborare: $PCAP_BASENAME"

# PASSO A: Esecuzione di tcpprep per creare il file cache
PREP_COMMAND="sudo tcpprep --auto=client --pcap=$PCAP_FILE --cachefile=$CACHE_FILE"
print_message "Esecuzione di tcpprep per analizzare il traffico..."
$PREP_COMMAND

# PASSO B: Esecuzione di tcprewrite con il file cache
if [ -s "$REMAP_FILE" ]; then
    REWRITE_COMMAND="sudo tcprewrite --pnat=$(paste -sd, $REMAP_FILE) --cachefile=$CACHE_FILE --infile=$PCAP_FILE --outfile=$EDITED_PCAP"
    print_message "Esecuzione di tcprewrite per modificare il PCAP..."
    $REWRITE_COMMAND
else
    print_message "Nessun remapping IP disponibile, uso del PCAP originale..."
    cp "$PCAP_FILE" "$EDITED_PCAP"
fi

# Ottieni l'interfaccia di rete primaria della VM
INTERFACE=$(ip -o -4 route show to default | awk '{print $5}')
print_message "Interfaccia di rete rilevata: $INTERFACE"

# Comando per rieseguire il traffico
REPLAY_COMMAND="sudo tcpreplay --mbps=100 --stats=30 --intf1=$INTERFACE $EDITED_PCAP"
print_message "Esecuzione di tcpreplay per riprodurre il traffico..."
$REPLAY_COMMAND
print_message "Test di traffico completato."

# Cleanup
rm -f "$REMAP_FILE" "$EDITED_PCAP" "$CACHE_FILE"
print_message "Cleanup completato."
'''
        
        script_path = os.path.join(temp_dir, "traffic.sh")
        with open(script_path, 'w') as f:
            f.write(script_content)
        
        return script_path
    
    def _check_vm_exists(self):
        """Verifica che la VM custom esista"""
        try:
            cmd = [
                "gcloud", "compute", "instances", "describe", self.vm_name,
                "--zone", self.vm_zone, "--format=value(status)"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return result.returncode == 0 and "RUNNING" in result.stdout
            
        except Exception as e:
            logger.error(f"Error checking VM existence: {e}")
            return False
    
    def _copy_file_to_vm(self, local_path, remote_path=None):
        """Copia un file sulla VM"""
        if not remote_path:
            remote_path = f"/tmp/{os.path.basename(local_path)}"
        
        cmd = [
            "gcloud", "compute", "scp", local_path,
            f"{self.vm_name}:{remote_path}",
            "--zone", self.vm_zone, "--quiet"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        if result.returncode != 0:
            raise Exception(f"Failed to copy file to VM: {result.stderr}")
        
        logger.info(f"Copied {local_path} to VM:{remote_path}")
    
    def _run_ssh_command(self, command):
        """Esegue un comando SSH sulla VM"""
        cmd = [
            "gcloud", "compute", "ssh", self.vm_name,
            "--zone", self.vm_zone,
            "--command", command,
            "--quiet"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            raise Exception(f"SSH command failed: {result.stderr}")
        
        return result.stdout
    
    def _run_traffic_script(self, pcap_filename):
        """Esegue lo script traffic.sh sulla VM"""
        pcap_path = f"/tmp/{pcap_filename}"
        command = f"/tmp/traffic.sh {pcap_path}"
        
        cmd = [
            "gcloud", "compute", "ssh", self.vm_name,
            "--zone", self.vm_zone,
            "--command", command
        ]
        
        # Esegui con timeout più lungo per il test di traffico
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)  # 30 minuti
        
        if result.returncode != 0:
            raise Exception(f"Traffic script failed: {result.stderr}")
        
        return result.stdout
    
    def _cleanup_temp_files(self, temp_dir):
        """Pulisce i file temporanei"""
        try:
            import shutil
            shutil.rmtree(temp_dir)
            logger.info(f"Cleaned up temporary directory: {temp_dir}")
        except Exception as e:
            logger.warning(f"Failed to cleanup temp directory: {e}")
    
    def get_test_status(self):
        """Ottiene lo stato corrente del test"""
        return {
            'status': self.test_status,
            'vm_name': self.vm_name,
            'session_id': self.session_id,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def cancel_test(self):
        """Annulla il test in corso (implementazione base)"""
        try:
            if self.test_status == "running":
                self.test_status = "cancelled"
                # In una implementazione completa, qui si potrebbe terminare il processo
                logger.info(f"Test cancellation requested for session {self.session_id}")
            
            return {
                'success': True,
                'message': 'Test cancellation requested'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }