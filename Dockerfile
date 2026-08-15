# Dockerfile para La Senda del Saber - v4 (assets + cache bust)
FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copiar todo el codigo
COPY . .

# Generar placeholders de assets y build
RUN npm run prebuild && npm run build

# Puerto del servidor
EXPOSE 3000
EXPOSE 3001

# Comando de inicio
CMD ["npm", "start"]
