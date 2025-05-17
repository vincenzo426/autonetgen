#!/bin/bash
set -e

# Imposta valori di default se non specificati
export PORT=${PORT:-8080}
export WORKERS=${WORKERS:-2}
export THREADS=${THREADS:-4}
export TIMEOUT=${TIMEOUT:-120}
export MAX_REQUESTS=${MAX_REQUESTS:-1000}
export LOG_LEVEL=${LOG_LEVEL:-info}

# Mostra configurazione
echo "Starting backend API server with configuration:"
echo "- Workers: $WORKERS"
echo "- Threads: $THREADS"
echo "- Timeout: $TIMEOUT seconds"
echo "- Max Requests: $MAX_REQUESTS"
echo "- Log Level: $LOG_LEVEL"

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

# Avvia server Gunicorn
exec gunicorn api:app \
    --bind 0.0.0.0:$PORT \
    --workers $WORKERS \
    --threads $THREADS \
    --timeout $TIMEOUT \
    --max-requests $MAX_REQUESTS \
    --max-requests-jitter 50 \
    --log-level $LOG_LEVEL \
    --access-logfile - \
    --error-logfile - \
    --capture-output