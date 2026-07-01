# syntax=docker/dockerfile:1
# Dockerfile autonome de la 2ᵉ app (Nuxt 4). 3 cibles : builder, runtime (prod), dev.
ARG NODE_IMAGE=node:22-alpine

# --- Étape de build ---
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
# Outils de compilation pour les modules natifs (better-sqlite3)
RUN apk add --no-cache python3 make g++
# Le postinstall lance `prisma generate` : le schéma + prisma.config doivent être
# présents AVANT npm ci. URL factice (generate lit la config mais ne se connecte pas).
ENV DATABASE_URL=file:./build.db
COPY package.json package-lock.json* prisma.config.ts ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
# Le packaging Nitro est gourmand en mémoire : on relève la limite du heap Node.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

# --- Image de production (sert le build Nitro) ---
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
COPY --from=builder /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

# --- Image de dev (HMR) ---
FROM ${NODE_IMAGE} AS dev
WORKDIR /app
# Outils de compilation pour les modules natifs (better-sqlite3)
RUN apk add --no-cache python3 make g++
ENV NODE_ENV=development NUXT_HOST=0.0.0.0 NUXT_PORT=3000
# Idem builder : schéma + prisma.config nécessaires au postinstall (prisma generate).
ENV DATABASE_URL=file:./dev.db
COPY package.json package-lock.json* prisma.config.ts ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
EXPOSE 3000 24678
CMD ["npm", "run", "dev"]
