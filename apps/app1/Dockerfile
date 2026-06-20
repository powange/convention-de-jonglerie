# Dockerfile multi-stage pour Convention de Jonglerie (app1)
#
# Monorepo : le CONTEXTE de build est la RACINE du repo (pour inclure les layers
# partagés). Le conteneur reproduit le layout hôte : /app/apps/app1 + /app/layers,
# afin que `extends: '../../layers/*'` (nuxt.config) résolve aussi dans l'image.

# Stage de base commun (image paramétrable)
ARG BASE_NODE_IMAGE=node:24-slim
FROM ${BASE_NODE_IMAGE} AS base
RUN apt-get update && apt-get install -y curl openssl default-mysql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/app1

# -------------------------
# Stage builder (production)
# -------------------------
FROM base AS builder

# Copier les manifests et Prisma (pour le client)
COPY apps/app1/package*.json ./
COPY apps/app1/prisma.config.ts ./
COPY apps/app1/prisma ./prisma/

# Installer dépendances complètes (ci si lock, sinon install)
RUN if [ -f package-lock.json ]; then \
			echo "Using npm ci (builder stage)" && npm ci; \
		else \
			echo "No package-lock.json -> npm install (builder stage)" && npm install; \
		fi

# Générer le client Prisma AVANT le build (requis pour Prisma 7)
RUN DATABASE_URL="mysql://user:pass@localhost:3306/db" npx prisma generate

# Copier le code de l'app + les layers partagés (requis pour extends ../../layers)
COPY apps/app1/ ./
COPY layers/ /app/layers/
# Augmenter la limite de mémoire pour le build Docker (8GB)
# --mount=type=cache : persiste le cache Nuxt/Vite entre les builds Docker (accélère les rebuilds via Portainer)
RUN --mount=type=cache,target=/app/apps/app1/node_modules/.cache \
    NODE_OPTIONS='--max-old-space-size=8192' npx nuxt build

# Conserver uniquement les dépendances de prod
RUN npm prune --omit=dev

# -------------------------
# Stage runtime (production)
# -------------------------
FROM ${BASE_NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y openssl default-mysql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/app1

# Dossiers requis au runtime
RUN mkdir -p /app/apps/app1/public/uploads /app/apps/app1/backups /uploads

# Copier artefacts et dépendances depuis builder (le .output Nitro embarque déjà le code des layers)
COPY --from=builder /app/apps/app1/.output ./.output
COPY --from=builder /app/apps/app1/public ./public
COPY --from=builder /app/apps/app1/node_modules ./node_modules
COPY --from=builder /app/apps/app1/prisma ./prisma
COPY --from=builder /app/apps/app1/prisma.config.ts ./
COPY --from=builder /app/apps/app1/server/generated ./server/generated
COPY --from=builder /app/apps/app1/server/prompts ./server/prompts
COPY --from=builder /app/apps/app1/package*.json ./
COPY --from=builder /app/apps/app1/scripts ./scripts
COPY --from=builder /app/apps/app1/i18n ./i18n

# Script d'entrée: appliquer les migrations Prisma avant de démarrer Nuxt
COPY apps/app1/docker/entrypoint.sh /app/apps/app1/entrypoint.sh
RUN chmod +x /app/apps/app1/entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000
CMD ["/app/apps/app1/entrypoint.sh"]

# -------------------------
# Stage dev (optionnel pour iso image)
# -------------------------
FROM base AS dev
# Ce stage sert d'image de dev avec les dépendances pré-installées
# Le code (app + layers) est monté en volume pour le hot-reload, node_modules reste dans un volume Docker
COPY apps/app1/package*.json ./
COPY apps/app1/prisma.config.ts ./
COPY apps/app1/prisma ./prisma/

# Créer les dossiers requis pour le développement
RUN mkdir -p /app/apps/app1/public/uploads /app/apps/app1/backups /uploads

# Installer les dépendances dans l'image pour un démarrage rapide
RUN if [ -f package-lock.json ]; then \
      echo "Using npm ci (dev stage)" && npm ci; \
    else \
      echo "No package-lock.json -> npm install (dev stage)" && npm install; \
    fi

# Installer Chromium pour les tests E2E Playwright
RUN npx playwright install --with-deps chromium

ENV NODE_ENV=development NUXT_HOST=0.0.0.0 NUXT_PORT=3000
EXPOSE 3000 24678
CMD ["npm", "run", "dev"]
