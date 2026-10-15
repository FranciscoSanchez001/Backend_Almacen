# ============================================================================
# Servicio de WhatsApp (Baileys) · Imagen Docker
# Sistema E-commerce para Supermercado · Desarrollo de Aplicaciones Web (UNET)
# ============================================================================
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

# 1) Dependencias (capa en caché mientras no cambie package-lock.json).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# 2) Código.
COPY src ./src

# Las credenciales del teléfono vinculado van en un volumen (ver docker-compose.yml).
RUN mkdir -p /app/sesion && chown -R node:node /app
USER node
ENV PUERTO=3001 CARPETA_SESION=/app/sesion
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3001/salud || exit 1
CMD ["node", "src/servidor.js"]
