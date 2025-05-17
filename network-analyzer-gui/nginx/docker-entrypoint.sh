#!/bin/sh

# Sostituisce le variabili d'ambiente nella configurazione di nginx
envsubst '${BACKEND_API_URL}' < /etc/nginx/conf.d/default.conf > /etc/nginx/conf.d/default.conf.tmp
mv /etc/nginx/conf.d/default.conf.tmp /etc/nginx/conf.d/default.conf

# Continua con il comando specificato
exec "$@"