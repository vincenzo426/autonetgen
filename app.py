#!/usr/bin/env python3
"""
Main application entry point for the Network Analyzer Backend
Ottimizzato per Google Cloud Run
"""

import os
import sys
import logging
from flask import Flask, jsonify
from flask_cors import CORS

# Configura logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("NetworkAnalyzerBackend")

# Crea l'app Flask
app = Flask(__name__)
CORS(app, origins=["*"])  # Per Cloud Run, permetti tutte le origini

# Configura le directory
UPLOAD_FOLDER = "/tmp/uploads"
OUTPUT_FOLDER = "/tmp/output"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# Health check endpoint per Cloud Run
@app.route('/health')
def health_check():
    """Health check per Cloud Run"""
    return jsonify({
        'status': 'healthy',
        'service': 'network-analyzer-backend'
    }), 200

@app.route('/')
def root():
    """Root endpoint"""
    return jsonify({
        'service': 'Network Analyzer Backend',
        'status': 'running',
        'version': '1.0.0'
    })

# Importa e registra gli endpoint dell'API esistente
try:
    from api import app as api_app
    
    # Copia le routes dall'app API esistente
    for rule in api_app.url_map.iter_rules():
        if rule.endpoint != 'static':
            view_func = api_app.view_functions[rule.endpoint]
            app.add_url_rule(
                rule.rule,
                endpoint=rule.endpoint,
                view_func=view_func,
                methods=rule.methods
            )
    
    logger.info("API endpoints importati con successo")
    
except ImportError as e:
    logger.warning(f"Impossibile importare l'API esistente: {e}")
    
    # Fallback: endpoint di base per l'analisi
    @app.route('/api/status')
    def api_status():
        return jsonify({
            'api_status': 'available',
            'endpoints': ['/api/analyze', '/health']
        })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint non trovato'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Errore interno: {error}")
    return jsonify({'error': 'Errore interno del server'}), 500

@app.errorhandler(413)
def too_large(error):
    return jsonify({'error': 'File troppo grande (max 100MB)'}), 413

if __name__ == '__main__':
    # Ottieni la porta dalla variabile d'ambiente (requirement di Cloud Run)
    port = int(os.environ.get('PORT', 8080))
    
    # Avvia l'app
    logger.info(f"Avvio Network Analyzer Backend sulla porta {port}")
    app.run(host='0.0.0.0', port=port, debug=False)