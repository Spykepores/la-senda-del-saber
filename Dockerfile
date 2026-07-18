# Dockerfile para La Senda del Saber
FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias
COPY package.json package-lock.json* ./
RUN npm ci

# Copiar todo el codigo
COPY . .

# Build del frontend + backend
RUN npm run build

# Puerto del servidor
EXPOSE 3000
EXPOSE 3001

# Comando de inicio
CMD ["npm", "start"]
