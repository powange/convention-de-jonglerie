# Dockerfile multi-stage pour Convention de Jonglerie

# Stage de base commun
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat curl openssl
WORKDIR /app

# -------------------------
# Stage builder (production)
# -------------------------
FROM base AS builder

# Copier les manifests et Prisma (pour le client)
COPY package*.json ./
COPY prisma ./prisma/

# Installer dépendances complètes puis générer Prisma
RUN npm ci

# Copier le reste du code et construire
COPY . .
RUN npm run build

# Conserver uniquement les dépendances de prod
RUN npm prune --omit=dev && npx prisma generate

# -------------------------
# Stage runtime (production)
# -------------------------
FROM node:22-alpine AS runtime
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Dossiers requis au runtime
RUN mkdir -p /app/public/uploads

# Copier artefacts et dépendances depuis builder
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

# -------------------------
# Stage dev (optionnel pour iso image)
# -------------------------
FROM base AS dev
# Ce stage sert d’image de dev si souhaité. En pratique, on monte le code en volume
# et on utilise npm run dev dans docker compose (docker-compose.dev.yml)
COPY package*.json ./
RUN npm ci || true
ENV NODE_ENV=development NUXT_HOST=0.0.0.0 NUXT_PORT=3000
EXPOSE 3000 24678
CMD ["npm", "run", "dev"]