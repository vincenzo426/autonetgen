#!/bin/bash
set -e

# Imposta valori di default se non specificati
export PORT=${PORT:-8080}
export WORKERS=${WORKERS:-1}  # Un solo worker per l'analyzer (operazioni pesanti)
export THREADS=${THREADS:-2}
export TIMEOUT=${TIMEOUT:-900}  # 15 minuti di timeout per operazioni lunghe
export MAX_REQUESTS=${MAX_REQUESTS:-100}
export LOG_LEVEL=${LOG_LEVEL:-info}

# Mostra configurazione
echo "Starting Network Analyzer service with configuration:"
echo "- Workers: $WORKERS"
echo "- Threads: $THREADS"
echo "- Timeout: $TIMEOUT seconds"
echo "- Max Requests: $MAX_REQUESTS"
echo "- Log Level: $LOG_LEVEL"
echo "- Mode: $ANALYZER_MODE"

# Crea directory di output se non esiste
mkdir -p $DEFAULT_OUTPUT_DIR

# Recupera le credenziali dal Secret Manager se DB_SECRET_ID è impostato
if [ ! -z "$DB_SECRET_ID" ]; then
    echo "Retrieving database credentials from Secret Manager..."
    python -c "
import os
from google.cloud import secretmanager
client = secretmanager.SecretManagerServiceClient()
name = f'projects/{os.environ.get(\"PROJECT_ID\")}/secrets/{os.environ.get(\"DB_SECRET_ID\")}/versions/latest'
response = client.access_secret_version(request={'name': name})
payload = response.payload.data.decode('UTF-8')
with open('/tmp/db_credentials.env', 'w') as f:
    f.write(payload)
"
    # Carica variabili d'ambiente
    export $(cat /tmp/db_credentials.env | xargs)
    rm /tmp/db_credentials.env
fi

# Controlla la modalità di esecuzione
if [ "$ANALYZER_MODE" = "api" ]; then
    # Avvia l'API server per l'analyzer
    echo "Starting Network Analyzer in API mode..."
    exec gunicorn backend.analyzer_api:app \
        --bind 0.0.0.0:$PORT \
        --workers $WORKERS \
        --threads $THREADS \
        --timeout $TIMEOUT \
        --max-requests $MAX_REQUESTS \
        --max-requests-jitter 50 \
        --log-level $LOG_LEVEL \
        --access-logfile - \
        --error-logfile -
else
    # Avvia il worker mode (per job in background)
    echo "Starting Network Analyzer in worker mode..."
    exec python -m backend.main "$@"
fi