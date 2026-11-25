# syntax=docker/dockerfile:1
# Dockerfile de Flowvent (app2). 3 cibles : builder, runtime (release/prod), dev.
#
# ⚠️ CONTEXTE DE BUILD = RACINE DU DÉPÔT, et non `apps/app2`. App2 étend le layer partagé
# `layers/auth` (`extends: '../../layers/auth'`), qui vit hors de son dossier : avec `apps/app2`
# comme contexte, le build ne pouvait pas le voir. Le conteneur reproduit donc le layout du dépôt
# — `/app/apps/app2` + `/app/layers/auth` — exactement comme app1.
#
# Ce qui entre dans le contexte est réglé par `Dockerfile.dockerignore`, à côté de ce fichier
# (BuildKit le préfère au `.dockerignore` racine, qui exclut justement `apps/app2`).
ARG BASE_NODE_IMAGE=node:24-slim

# Stage de base commun
FROM ${BASE_NODE_IMAGE} AS base
RUN apt-get update && apt-get install -y curl openssl default-mysql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/app2

# -------------------------
# Stage builder (production)
# -------------------------
FROM base AS builder
COPY apps/app2/package*.json ./
# --mount=type=cache : réutilise les tarballs npm déjà téléchargés entre les builds Docker
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
# Client Prisma généré explicitement, comme app1 : le postinstall ne le fait plus (il ne lance que
# `nuxt prepare`), pour qu'un `npm install` sur l'hôte n'ait pas à réécrire `server/generated`,
# que le conteneur de dev possède. DATABASE_URL factice : la génération ne se connecte pas.
COPY apps/app2/prisma.config.ts ./
COPY apps/app2/prisma ./prisma/
RUN DATABASE_URL="mysql://user:pass@localhost:3306/db" npx prisma generate
COPY apps/app2/ ./
COPY layers/ui/ /app/layers/ui/
COPY layers/core/ /app/layers/core/
COPY layers/auth/ /app/layers/auth/
COPY layers/volunteers/ /app/layers/volunteers/
COPY layers/map/ /app/layers/map/
COPY layers/stock/ /app/layers/stock/
# Commit construit, passé par la CI : il nomme le répertoire des fichiers de build
# (`/_nuxt-<sha>/`, cf. nuxt.config.ts), ce qui rend le commit servi lisible dans la page.
# Placé après les COPY : il change à chaque commit, et n'invalide ainsi que le build.
ARG BUILD_SHA=""
ENV NUXT_BUILD_SHA=$BUILD_SHA
# Le packaging Nitro est gourmand en mémoire ; le cache Nuxt/Vite accélère les rebuilds.
RUN --mount=type=cache,target=/app/apps/app2/node_modules/.cache \
    NODE_OPTIONS='--max-old-space-size=4096' npx nuxt build
# Conserver uniquement les dépendances de prod (prisma reste en `dependencies` pour `migrate deploy`).
RUN npm prune --omit=dev

# -------------------------
# Stage runtime (release / production)
# -------------------------
FROM ${BASE_NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y openssl default-mysql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/app2
# Fichiers déposés (photos de profil) : monté sur un volume par les piles (docker-compose.*.yml).
RUN mkdir -p /uploads
COPY --from=builder /app/apps/app2/.output ./.output
COPY --from=builder /app/apps/app2/node_modules ./node_modules
COPY --from=builder /app/apps/app2/prisma ./prisma
COPY --from=builder /app/apps/app2/prisma.config.ts ./
COPY --from=builder /app/apps/app2/server/generated ./server/generated
COPY --from=builder /app/apps/app2/package*.json ./
# Entrypoint : construit DATABASE_URL, applique les migrations (migrate deploy), démarre Nitro.
COPY apps/app2/docker/entrypoint.sh /app/apps/app2/entrypoint.sh
RUN chmod +x /app/apps/app2/entrypoint.sh
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
EXPOSE 3000
CMD ["/app/apps/app2/entrypoint.sh"]

# -------------------------
# Stage dev (HMR) — le code est monté par docker-compose.dev.yml
# -------------------------
FROM base AS dev
RUN mkdir -p /uploads
COPY apps/app2/package*.json ./
# --mount=type=cache : réutilise les tarballs npm déjà téléchargés entre les builds Docker
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
# Empreinte de ce qui vient d'être installé : `scripts/docker-start.sh` la compare au verrou pour
# décider s'il faut réinstaller (même mécanique qu'app1).
RUN if [ -f package-lock.json ]; then \
      md5sum package-lock.json | cut -d' ' -f1 > node_modules/.empreinte-installation; \
    else \
      md5sum package.json | cut -d' ' -f1 > node_modules/.empreinte-installation; \
    fi
COPY apps/app2/prisma.config.ts ./
COPY apps/app2/prisma ./prisma/
ENV NODE_ENV=development NUXT_HOST=0.0.0.0 NUXT_PORT=3000
EXPOSE 3000
# Le compose lance `scripts/docker-start.sh` (dépendances, prepare, Prisma, migrations, dev).
CMD ["npm", "run", "dev"]
