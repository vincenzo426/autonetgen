# Fase di build
FROM node:18 AS build

WORKDIR /app

# Copia file di configurazione pacchetti
COPY package.json package-lock.json ./

# Installa dipendenze
RUN npm ci

# Copia il resto dei file sorgente
COPY . .

# Configura variabili d'ambiente per la build
ARG REACT_APP_API_URL=https://autonetgen-backend-SERVICE_HASH-uc.a.run.app
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Genera build ottimizzata per produzione
RUN npm run build

# Fase di produzione - immagine leggera per servire l'app
FROM nginx:alpine

# Copia la build di produzione
COPY --from=build /app/build /usr/share/nginx/html

# Copia configurazione nginx personalizzata
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Aggiunge script per sostituire variabili d'ambiente in runtime
COPY nginx/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Espone la porta 8080 (Cloud Run preferisce questa porta)
EXPOSE 8080

# Aggiunge un endpoint di health check semplice
RUN mkdir -p /usr/share/nginx/html/health && \
    echo "OK" > /usr/share/nginx/html/health/index.html

# Imposta l'entrypoint per sostituire variabili d'ambiente
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Avvia NGINX in foreground
CMD ["nginx", "-g", "daemon off;"]