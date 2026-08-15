# Dockerfile para La Senda del Saber - v3 (full cache bust 2026-08-15)
FROM node:20-alpine

WORKDIR /app

# Forzar rebuild limpio sin cache
ARG CACHE_BUST=3
RUN npm cache clean --force

# Copiar package.json e instalar con legacy peer deps
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copiar todo el codigo
COPY . .

# Build del frontend + backend
RUN npm run build

# Puerto del servidor
EXPOSE 3000
EXPOSE 3001

# Comando de inicio
CMD ["npm", "start"]
