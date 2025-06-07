#!/usr/bin/env python3
"""
Main application entry point for the Network Analyzer Backend
Ottimizzato per Google Cloud Run
"""

import os
import sys
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS

# Global flag per il controllo di startup
startup_executed = False

# Configura logging per Cloud Run
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger("NetworkAnalyzerBackend")

# Crea l'app Flask
app = Flask(__name__)
CORS(app, origins=["*"])

# Configura le directory
UPLOAD_FOLDER = "/tmp/uploads"
OUTPUT_FOLDER = "/tmp/output"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

def startup_check():
    """Verifica di avvio"""
    global startup_executed
    if not startup_executed:
        logger.info("=== AVVIO BACKEND AUTONETGEN ===")
        logger.info(f"Upload folder: {UPLOAD_FOLDER}")
        logger.info(f"Output folder: {OUTPUT_FOLDER}")
        logger.info(f"Port: {os.environ.get('PORT', '8080')}")
        logger.info("=== BACKEND PRONTO ===")
        startup_executed = True

# Middleware per eseguire startup check alla prima richiesta
@app.before_request
def ensure_startup():
    startup_check()

# Health check endpoint per Cloud Run (OBBLIGATORIO)
@app.route('/health')
def health_check():
    """Health check per Cloud Run"""
    return jsonify({
        'status': 'healthy',
        'service': 'network-analyzer-backend',
        'timestamp': str(os.environ.get('K_REVISION', 'unknown'))
    }), 200

@app.route('/')
def root():
    """Root endpoint"""
    return jsonify({
        'service': 'Network Analyzer Backend',
        'status': 'running',
        'version': '1.0.0',
        'revision': os.environ.get('K_REVISION', 'unknown')
    })

# Endpoint di test semplice
@app.route('/api/status')
def api_status():
    """Status API semplificato"""
    return jsonify({
        'api_status': 'available',
        'endpoints': ['/api/analyze', '/health', '/api/status'],
        'upload_folder': UPLOAD_FOLDER,
        'output_folder': OUTPUT_FOLDER
    })

# Endpoint per analisi semplificata (fallback)
@app.route('/api/analyze', methods=['POST'])
def analyze_simple():
    """Endpoint di analisi semplificato per test"""
    try:
        logger.info("Richiesta di analisi ricevuta")
        
        # Verifica se ci sono file caricati
        if not request.files:
            return jsonify({
                'status': 'error',
                'message': 'Nessun file caricato'
            }), 400
        
        # Per ora, ritorna solo una risposta di successo
        return jsonify({
            'status': 'success',
            'message': 'Analisi completata (modalità semplificata)',
            'files_received': len(request.files),
            'service': 'autonetgen-backend'
        })
        
    except Exception as e:
        logger.error(f"Errore durante l'analisi: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Importa l'API completa se disponibile
try:
    from api import app as api_app
    logger.info("Tentativo di importazione API completa...")
    
    # Copia solo le routes che non sono già definite
    existing_rules = {rule.rule for rule in app.url_map.iter_rules()}
    
    for rule in api_app.url_map.iter_rules():
        if rule.endpoint != 'static' and rule.rule not in existing_rules:
            try:
                view_func = api_app.view_functions[rule.endpoint]
                app.add_url_rule(
                    rule.rule,
                    endpoint=f"api_{rule.endpoint}",
                    view_func=view_func,
                    methods=rule.methods
                )
            except Exception as e:
                logger.warning(f"Impossibile importare route {rule.rule}: {e}")
    
    logger.info("API completa importata con successo")
    
except ImportError as e:
    logger.warning(f"API completa non disponibile, usando fallback: {e}")
except Exception as e:
    logger.error(f"Errore durante l'importazione API: {e}")

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint non trovato', 'available_endpoints': ['/health', '/', '/api/status']}), 404

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
    
    # Log di avvio
    logger.info("=== AVVIO NETWORK ANALYZER BACKEND ===")
    logger.info(f"Porta: {port}")
    logger.info(f"Upload folder: {UPLOAD_FOLDER}")
    logger.info(f"Output folder: {OUTPUT_FOLDER}")
    logger.info("==========================================")
    
    # Esegui startup check se eseguito direttamente
    startup_check()
    
    # Avvia l'app con configurazione per Cloud Run
    app.run(
        host='0.0.0.0', 
        port=port, 
        debug=False,
        threaded=True
    )