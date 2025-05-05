#!/usr/bin/env python3
"""
API Flask per il frontend del Network Analyzer
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import shutil
import json
from werkzeug.utils import secure_filename

from analysis_orchestrator import AnalysisOrchestrator
from config import logger, DEFAULT_OUTPUT_DIR

app = Flask(__name__)
CORS(app)  # Permette chiamate da frontend React

# Configura una directory per i file temporanei
UPLOAD_FOLDER = tempfile.mkdtemp()
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """
    Endpoint per avviare l'analisi dei file di rete
    Accetta file caricati e parametri di configurazione
    """
    try:
        # Estrai i file caricati
        uploaded_files = []
        for key in request.files:
            file = request.files[key]
            if file.filename:
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                uploaded_files.append(filepath)
        
        if not uploaded_files:
            return jsonify({'status': 'error', 'message': 'Nessun file caricato'}), 400
        
        # Estrai i parametri
        file_type = request.form.get('type', 'auto')
        output_dir = request.form.get('output_dir', DEFAULT_OUTPUT_DIR)
        output_graph = request.form.get('output_graph')
        output_analysis = request.form.get('output_analysis')
        output_terraform = request.form.get('output_terraform')
        
        # Crea la directory di output se non esiste
        os.makedirs(output_dir, exist_ok=True)
        
        # Inizializza l'orchestratore
        orchestrator = AnalysisOrchestrator()
        
        # Esegui l'analisi per ogni file
        result_data = {
            'hosts': set(),
            'connections': {},
            'protocols': set(),
            'subnets': set(),
            'roles': {}
        }
        
        for file_path in uploaded_files:
            logger.info(f"Analisi del file: {file_path}")
            
            success = orchestrator.run(
                input_file=file_path,
                file_type=file_type,
                output_dir=output_dir,
                output_graph=output_graph,
                output_analysis=output_analysis,
                output_terraform=output_terraform
            )
            
            if not success:
                return jsonify({
                    'status': 'error', 
                    'message': f'Analisi fallita per il file {os.path.basename(file_path)}'
                }), 500
            
            # Aggrega i risultati
            file_data = orchestrator.get_data()
            result_data['hosts'].update(file_data.get('hosts', []))
            
            for proto, count in file_data.get('protocols', {}).items():
                if proto in result_data['protocols']:
                    result_data['protocols'][proto] += count
                else:
                    result_data['protocols'][proto] = count
                    
            # Aggiungi altri dati dai risultati...
            
        # Converti set in liste per il JSON
        result_data['hosts'] = list(result_data['hosts'])
        result_data['protocols'] = [p for p in result_data['protocols']]
        result_data['subnets'] = list(result_data['subnets'])
        
        # Aggiungi i percorsi di output
        result_data['output_paths'] = {
            'graph': output_graph,
            'analysis': output_analysis,
            'terraform': output_terraform
        }
        
        # Conta il numero di connessioni
        result_data['connections_count'] = sum(result_data['connections'].values())
        
        return jsonify({
            'status': 'success',
            'message': 'Analisi completata',
            'results': result_data
        })
            
    except Exception as e:
        logger.error(f"Errore durante l'analisi: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500
    finally:
        # Pulizia file temporanei
        for file_path in uploaded_files:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass

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

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Endpoint per verificare lo stato del servizio
    """
    return jsonify({'status': 'ok', 'message': 'Servizio attivo'})

if __name__ == '__main__':
    # In produzione, utilizzare un server WSGI come Gunicorn
    app.run(debug=True, host='0.0.0.0', port=5000)