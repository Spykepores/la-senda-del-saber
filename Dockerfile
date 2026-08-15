# Dockerfile para La Senda del Saber - v2 (cache bust)
FROM node:20-alpine

WORKDIR /app

# Copiar solo package.json (no package-lock.json)
COPY package.json ./
RUN npm install

# Copiar todo el codigo
COPY . .

# Build del frontend + backend
RUN npm run build

# Puerto del servidor
EXPOSE 3000
EXPOSE 3001

# Comando de inicio
CMD ["npm", "start"]
