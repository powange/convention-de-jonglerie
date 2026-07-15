# syntax=docker/dockerfile:1
# Dockerfile de Flowvent (app2) — application autonome (aucun layer partagé).
# 3 cibles : builder, runtime (prod), dev. Base de données MySQL (adapter mariadb).
ARG BASE_NODE_IMAGE=node:24-slim

# Stage de base commun
FROM ${BASE_NODE_IMAGE} AS base
RUN apt-get update && apt-get install -y curl openssl default-mysql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# -------------------------
# Stage builder (production)
# -------------------------
FROM base AS builder
# DATABASE_URL factice : le postinstall (prisma generate) lit prisma.config mais ne se connecte pas.
ENV DATABASE_URL="mysql://user:pass@localhost:3306/db"
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
# Le packaging Nitro est gourmand en mémoire ; le cache Nuxt/Vite accélère les rebuilds.
RUN --mount=type=cache,target=/app/node_modules/.cache \
    NODE_OPTIONS='--max-old-space-size=4096' npx nuxt build
# Conserver uniquement les dépendances de prod (prisma reste en `dependencies` pour `migrate deploy`).
RUN npm prune --omit=dev

# -------------------------
# Stage runtime (production)
# -------------------------
FROM ${BASE_NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y openssl default-mysql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/server/generated ./server/generated
COPY --from=builder /app/package*.json ./
# Entrypoint : applique les migrations Prisma (migrate deploy) avant de démarrer Nuxt.
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
EXPOSE 3000
CMD ["/app/entrypoint.sh"]

# -------------------------
# Stage dev (HMR)
# -------------------------
FROM base AS dev
# DATABASE_URL factice pour le postinstall (prisma generate) ; surchargé par docker-compose au runtime.
ENV DATABASE_URL="mysql://user:pass@localhost:3306/db"
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
ENV NODE_ENV=development NUXT_HOST=0.0.0.0 NUXT_PORT=3000
EXPOSE 3000 24678
# Le compose surcharge `command` pour lancer les migrations avant `npm run dev`.
CMD ["npm", "run", "dev"]
