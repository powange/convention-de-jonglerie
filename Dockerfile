# Dockerfile simplifié pour Convention de Jonglerie
FROM node:22-alpine

# Installer les dépendances système
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# Créer le dossier uploads
RUN mkdir -p /app/public/uploads

# Copier les fichiers de configuration
COPY package*.json ./
COPY prisma ./prisma/

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

EXPOSE 3000

# Script de démarrage
CMD ["sh", "-c", "npm run build && node .output/server/index.mjs"]