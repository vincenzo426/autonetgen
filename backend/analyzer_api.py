#!/usr/bin/env python3
"""
API per il Network Analyzer
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import json
import logging
from werkzeug.utils import secure_filename

# Importa le classi di analisi
from backend.analysis_orchestrator import AnalysisOrchestrator
from backend.config import logger, DEFAULT_OUTPUT_DIR

app = Flask(__name__)
CORS(app)

# Configura logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('analyzer_api')

# Crea directory temporanea per i file caricati
UPLOAD_FOLDER = tempfile.mkdtemp()
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/health', methods=['GET'])
def health():
    """Endpoint di health check"""
    return "OK", 200

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Endpoint per l'analisi dei file di rete"""
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
        
        # Esegui l'analisi per ogni file
        orchestrator = AnalysisOrchestrator()
        results = []
        
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
            
            if success:
                # Ottieni i risultati dall'analizzatore
                analyzer_data = orchestrator.analyzer.get_data()
                results.append({
                    'filename': os.path.basename(file_path),
                    'hosts': len(analyzer_data['network_data'].hosts),
                    'connections': sum(analyzer_data['network_data'].connections.values()),
                    'protocols': dict(analyzer_data['network_data'].protocols),
                    'host_roles': orchestrator.analyzer.host_roles,
                    'subnets': orchestrator.analyzer.subnets
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': f'Analisi fallita per il file {os.path.basename(file_path)}'
                }), 500
        
        return jsonify({
            'status': 'success',
            'message': 'Analisi completata',
            'results': results,
            'output_paths': {
                'graph': output_graph,
                'analysis': output_analysis,
                'terraform': output_terraform
            }
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
    """Endpoint per scaricare i file generati dall'analisi"""
    try:
        path = request.args.get('path')
        if not path or not os.path.exists(path):
            return jsonify({'status': 'error', 'message': 'File non trovato'}), 404
            
        return send_file(path, as_attachment=True)
    except Exception as e:
        logger.error(f"Errore durante il download del file: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))