#!/bin/bash
# Startup script per AutonetGen Backend
# Configura l'ambiente e avvia il server Gunicorn

set -e

# Colori per i log
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner di avvio
echo "=================================================="
echo "       AutonetGen Backend Starting..."
echo "=================================================="

# Imposta valori di default se non specificati
export PORT=${PORT:-8080}
export WORKERS=${WORKERS:-2}
export THREADS=${THREADS:-4}
export TIMEOUT=${TIMEOUT:-300}
export MAX_REQUESTS=${MAX_REQUESTS:-1000}
export LOG_LEVEL=${LOG_LEVEL:-info}
export FLASK_ENV=${FLASK_ENV:-production}
export PYTHONUNBUFFERED=${PYTHONUNBUFFERED:-1}

# Directory di default
export DEFAULT_OUTPUT_DIR=${DEFAULT_OUTPUT_DIR:-/tmp/output}
export UPLOAD_DIR=${UPLOAD_DIR:-/tmp/uploads}
export TEMP_DIR=${TEMP_DIR:-/tmp/analysis}

# Configurazioni specifiche di AutonetGen
export AUTONETGEN_VERSION=${AUTONETGEN_VERSION:-1.0.0}
export ENVIRONMENT=${ENVIRONMENT:-production}

# Mostra configurazione
log_info "Starting AutonetGen Backend service with configuration:"
echo "  - Workers: $WORKERS"
echo "  - Threads: $THREADS"
echo "  - Timeout: $TIMEOUT seconds"
echo "  - Max Requests: $MAX_REQUESTS"
echo "  - Log Level: $LOG_LEVEL"
echo "  - Flask Environment: $FLASK_ENV"
echo "  - Port: $PORT"
echo "  - Output Directory: $DEFAULT_OUTPUT_DIR"
echo "  - Upload Directory: $UPLOAD_DIR"
echo "  - Environment: $ENVIRONMENT"

# Crea directory necessarie se non esistono
log_info "Creating necessary directories..."
directories=(
    "$DEFAULT_OUTPUT_DIR"
    "$UPLOAD_DIR" 
    "$TEMP_DIR"
    "/tmp/terraform"
    "/tmp/graphs"
    "/tmp/analysis_cache"
)

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        log_success "Created directory: $dir"
    else
        log_info "Directory already exists: $dir"
    fi
    
    # Assicura che le directory abbiano i permessi corretti
    chmod 755 "$dir" 2>/dev/null || log_warning "Could not set permissions on $dir"
done

# Recupera credenziali dal Secret Manager se configurato
if [ ! -z "$DB_SECRET_ID" ] && [ ! -z "$PROJECT_ID" ]; then
    log_info "Retrieving database credentials from Secret Manager..."
    
    # Verifica se gcloud è disponibile
    if command -v gcloud >/dev/null 2>&1; then
        python3 -c "
try:
    import os
    from google.cloud import secretmanager
    
    client = secretmanager.SecretManagerServiceClient()
    name = f'projects/{os.environ.get(\"PROJECT_ID\")}/secrets/{os.environ.get(\"DB_SECRET_ID\")}/versions/latest'
    response = client.access_secret_version(request={'name': name})
    payload = response.payload.data.decode('UTF-8')
    
    with open('/tmp/db_credentials.env', 'w') as f:
        f.write(payload)
    print('Credentials retrieved successfully')
    
except Exception as e:
    print(f'Warning: Could not retrieve credentials: {e}')
" || log_warning "Could not retrieve secret from Secret Manager"

        # Carica variabili d'ambiente se il file esiste
        if [ -f "/tmp/db_credentials.env" ]; then
            set -a
            source /tmp/db_credentials.env
            set +a
            rm /tmp/db_credentials.env
            log_success "Database credentials loaded"
        fi
    else
        log_warning "gcloud CLI not available, skipping Secret Manager"
    fi
fi

# Configura logging
log_info "Configuring logging..."
export GUNICORN_ACCESS_LOG_FORMAT='%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Verifica connessione a eventuali servizi esterni
check_external_services() {
    log_info "Checking external service connectivity..."
    
    # Controlla connessione a Google Cloud Storage se configurato
    if [ ! -z "$STORAGE_BUCKET" ]; then
        python3 -c "
try:
    from google.cloud import storage
    client = storage.Client()
    bucket = client.bucket('${STORAGE_BUCKET}')
    if bucket.exists():
        print('✓ Cloud Storage connection: OK')
    else:
        print('⚠ Cloud Storage bucket does not exist')
except Exception as e:
    print(f'⚠ Cloud Storage connection: {e}')
" || log_warning "Could not verify Cloud Storage connection"
    fi
    
    # Test di scrittura nelle directory
    test_file="$DEFAULT_OUTPUT_DIR/.write_test"
    if touch "$test_file" 2>/dev/null; then
        rm "$test_file"
        log_success "Output directory write test: OK"
    else
        log_error "Cannot write to output directory: $DEFAULT_OUTPUT_DIR"
    fi
}

# Esegui controlli di connettività
check_external_services

# Verifica che l'applicazione sia configurata correttamente
log_info "Validating application setup..."

# Controlla che i moduli Python essenziali siano installati
python3 -c "
import sys
required_modules = ['flask', 'scapy', 'networkx', 'pandas', 'numpy']
missing_modules = []

for module in required_modules:
    try:
        __import__(module)
        print(f'✓ {module}')
    except ImportError:
        missing_modules.append(module)
        print(f'✗ {module} (missing)')

if missing_modules:
    print(f'ERROR: Missing required modules: {missing_modules}')
    sys.exit(1)
else:
    print('All required modules are available')
" || {
    log_error "Required Python modules are missing"
    exit 1
}

# Pre-fork setup per ottimizzazioni
setup_prefork() {
    log_info "Setting up pre-fork optimizations..."
    
    # Precarica librerie pesanti per condividerle tra worker
    python3 -c "
import sys
import warnings
warnings.filterwarnings('ignore')

try:
    # Precarica librerie di network analysis
    import scapy.all
    import networkx
    import pandas
    import numpy
    import matplotlib
    matplotlib.use('Agg')  # Backend non-interattivo
    
    print('Libraries preloaded successfully')
except Exception as e:
    print(f'Warning: Could not preload some libraries: {e}')
"
}

# Esegui setup pre-fork
setup_prefork

# Configura le opzioni di Gunicorn
GUNICORN_OPTS=(
    "--bind" "0.0.0.0:$PORT"
    "--workers" "$WORKERS"
    "--threads" "$THREADS"
    "--timeout" "$TIMEOUT"
    "--max-requests" "$MAX_REQUESTS"
    "--max-requests-jitter" "50"
    "--preload-app"
    "--log-level" "$LOG_LEVEL"
    "--access-logfile" "-"
    "--error-logfile" "-"
    "--access-logformat" "$GUNICORN_ACCESS_LOG_FORMAT"
    "--capture-output"
    "--enable-stdio-inheritance"
)

# Aggiungi opzioni specifiche per l'ambiente
if [ "$FLASK_ENV" = "development" ]; then
    GUNICORN_OPTS+=("--reload")
    log_info "Development mode: auto-reload enabled"
fi

# Worker class ottimizzata per I/O intensivo
GUNICORN_OPTS+=("--worker-class" "gthread")

# Configurazioni di sicurezza
GUNICORN_OPTS+=("--limit-request-line" "8192")
GUNICORN_OPTS+=("--limit-request-fields" "100")
GUNICORN_OPTS+=("--limit-request-field-size" "8192")

# Health check prima dell'avvio
log_info "Running pre-start health check..."
python3 -c "
from backend.api import app
print('✓ Flask application loads successfully')
" || {
    log_error "Flask application failed to load"
    exit 1
}

log_success "All checks passed, starting Gunicorn server..."

# Mostra comando finale
log_info "Executing: gunicorn backend.api:app ${GUNICORN_OPTS[*]}"

# Avvia il server Gunicorn
exec gunicorn backend.api:app "${GUNICORN_OPTS[@]}"