# Dockerfile pour Convention de Jonglerie
FROM node:20-alpine AS base

# Installer les dépendances système nécessaires
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copier les fichiers de configuration des packages
COPY package*.json ./
COPY prisma ./prisma/

# Installer les dépendances
RUN npm ci --only=production

# Étape de build
FROM base AS build

# Installer toutes les dépendances (dev incluses)
RUN npm ci

# Copier le code source
COPY . .

# Générer le client Prisma
RUN npx prisma generate

# Construire l'application
RUN npm run build

# Étape de production
FROM node:20-alpine AS production

RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# Créer un utilisateur non-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nuxtjs

# Copier les fichiers nécessaires
COPY --from=build --chown=nuxtjs:nodejs /app/.output /app/.output
COPY --from=build --chown=nuxtjs:nodejs /app/prisma /app/prisma
COPY --from=build --chown=nuxtjs:nodejs /app/package*.json /app/
COPY --from=build --chown=nuxtjs:nodejs /app/node_modules /app/node_modules

# Créer le dossier uploads
RUN mkdir -p /app/public/uploads && chown -R nuxtjs:nodejs /app/public/uploads

USER nuxtjs

EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Script de démarrage
CMD ["sh", "-c", "npx prisma migrate deploy && node .output/server/index.mjs"]