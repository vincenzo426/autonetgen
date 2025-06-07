#!/bin/sh
# Docker entrypoint script for AutonetGen Frontend
# Sostituisce le variabili d'ambiente nella configurazione nginx e avvia il server

set -e

# Colori per i log
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

# Banner di avvio
echo "=================================================="
echo "       AutonetGen Frontend Starting..."
echo "=================================================="

# Verifica e imposta valori di default per le variabili d'ambiente
if [ -z "$BACKEND_API_URL" ]; then
    log_warning "BACKEND_API_URL not set, using default"
    export BACKEND_API_URL="http://localhost:8001/api"
fi

if [ -z "$ENVIRONMENT" ]; then
    export ENVIRONMENT="production"
fi

# Log delle configurazioni
log_info "Environment: $ENVIRONMENT"
log_info "Backend API URL: $BACKEND_API_URL"

# Sostituisce le variabili d'ambiente nel template di configurazione nginx
log_info "Configuring nginx with environment variables..."

# Se esiste il template, lo processa
if [ -f "/etc/nginx/conf.d/default.conf.template" ]; then
    envsubst '${BACKEND_API_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
    log_success "Nginx configuration updated"
else
    log_warning "No nginx template found, using default configuration"
fi

# Crea una configurazione di base se non esiste
if [ ! -f "/etc/nginx/conf.d/default.conf" ]; then
    log_info "Creating default nginx configuration..."
    cat > /etc/nginx/conf.d/default.conf << EOF
server {
    listen 8080;
    
    root /usr/share/nginx/html;
    index index.html;

    # Configurazione gzip per migliorare le performance
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript;
    gzip_disable "MSIE [1-6]\.";

    # Health check
    location /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 'OK';
    }

    # Configurazione SPA
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Cache statica per file che cambiano raramente
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000";
    }

    # Proxy per API (se BACKEND_API_URL è configurato)
    location /api/ {
        proxy_pass ${BACKEND_API_URL}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
}
EOF
    log_success "Default nginx configuration created"
fi

# Verifica la configurazione nginx
log_info "Testing nginx configuration..."
if nginx -t; then
    log_success "Nginx configuration is valid"
else
    log_warning "Nginx configuration test failed, but continuing..."
fi

# Crea runtime configuration per JavaScript
log_info "Creating runtime configuration for frontend..."
cat > /usr/share/nginx/html/config.js << EOF
window.ENV = {
    BACKEND_API_URL: '${BACKEND_API_URL}',
    ENVIRONMENT: '${ENVIRONMENT}',
    VERSION: '${REACT_APP_VERSION:-1.0.0}'
};
EOF

# Aggiunge il config.js all'index.html se non è già presente
if [ -f "/usr/share/nginx/html/index.html" ] && ! grep -q "config.js" /usr/share/nginx/html/index.html; then
    log_info "Adding runtime configuration to index.html..."
    sed -i 's|<head>|<head>\n  <script src="/config.js"></script>|' /usr/share/nginx/html/index.html
fi

# Log delle directory e permessi
log_info "Checking file structure..."
ls -la /usr/share/nginx/html/ | head -10

# Verifica che i file essenziali esistano
essential_files="index.html"
for file in $essential_files; do
    if [ -f "/usr/share/nginx/html/$file" ]; then
        log_success "Found: $file"
    else
        log_warning "Missing: $file"
    fi
done

log_success "Frontend configuration completed"
log_info "Starting nginx..."

# Avvia nginx o esegue il comando passato
if [ "$1" = "nginx" ] || [ "$#" -eq 0 ]; then
    exec nginx -g "daemon off;"
else
    exec "$@"
fi