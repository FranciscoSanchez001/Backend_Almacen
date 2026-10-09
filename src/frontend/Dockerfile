# ============================================================================
# Frontend_Almacen · Imagen Docker (React + Vite + Nginx)
# Sistema E-commerce para Supermercado · Desarrollo de Aplicaciones Web (UNET)
# ============================================================================

# =========================================================
# ETAPA DE COMPILACIÓN (Node.js 20 LTS)
# =========================================================
FROM node:20-alpine AS build
WORKDIR /app

# 1) Copiar solo los manifiestos e instalar dependencias.
#    (Se cachea: npm install solo se repite si cambian package*.json)
COPY package*.json ./
RUN npm install

# 2) Copiar el resto del código fuente.
COPY . .

# 3) Dirección de la API. Vite "hornea" las variables VITE_* dentro del
#    JavaScript en tiempo de compilación, así que se definen ANTES del build.
#    El navegador (que corre en tu máquina) llega al backend por localhost:5085.
ARG VITE_API_URL=http://localhost:5085
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# 4) Compilar para producción (genera /app/dist).
RUN npm run build

# =========================================================
# ETAPA DE PRODUCCIÓN (Servidor Web Nginx)
# =========================================================
FROM nginx:alpine

# Copiar los archivos estáticos compilados desde la etapa anterior.
COPY --from=build /app/dist /usr/share/nginx/html

# Configuración de Nginx con soporte de rutas del cliente (SPA fallback).
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
