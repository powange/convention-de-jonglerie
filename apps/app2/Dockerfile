# syntax=docker/dockerfile:1
# Dockerfile autonome de la 2ᵉ app (Nuxt 4). 3 cibles : builder, runtime (prod), dev.
ARG NODE_IMAGE=node:22-alpine

# --- Étape de build ---
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
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
ENV NODE_ENV=development NUXT_HOST=0.0.0.0 NUXT_PORT=3000
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
EXPOSE 3000 24678
CMD ["npm", "run", "dev"]
