# Dockerfile multi-stage pour Convention de Jonglerie (app1)
#
# Monorepo : le CONTEXTE de build est la RACINE du repo (pour inclure les layers
# partagés). Le conteneur reproduit le layout hôte : /app/apps/app1 + /app/layers,
# afin que `extends: '../../layers/*'` (nuxt.config) résolve aussi dans l'image.

# Stage de base commun (image paramétrable)
ARG BASE_NODE_IMAGE=node:24-slim
FROM ${BASE_NODE_IMAGE} AS base
RUN apt-get update && apt-get install -y curl openssl default-mysql-client && rm -rf /var/lib/apt/lists/*
# npm 12 : les install scripts des dépendances sont OFF par défaut ; les packages de
# confiance sont explicitement autorisés via le champ `allowScripts` de package.json.
RUN npm install -g npm@12 && npm --version
WORKDIR /app/apps/app1

# -------------------------
# Stage builder (production)
# -------------------------
FROM base AS builder

# Manifests SEULS d'abord : la couche d'install ne dépend que d'eux, donc modifier prisma/
# (nouvelle migration, édition de schéma) ne l'invalide plus.
#
# Le script du `postinstall` doit exister avant `npm ci` : il relie les dépendances aux layers.
# On copie CE SEUL FICHIER, comme dans le stage dev.
#
# Le changement est NEUTRE sur l'image produite : `COPY apps/app1/ ./`, plus bas, recopie tout
# `scripts/`, et le stage runtime le reprend de là. Seul change ce qui invalide le cache — et la
# CI en a un (`cache-from: type=gha`), donc éditer un utilitaire y relançait `npm ci` à chaque
# fusion sur un build qui dure déjà 330 à 470 s et conditionne le déploiement.
COPY apps/app1/package*.json ./
COPY apps/app1/scripts/lier-layers-node-modules.mjs ./scripts/

# Installer dépendances complètes (ci si lock, sinon install)
# --mount=type=cache : réutilise les tarballs npm déjà téléchargés entre les builds Docker
RUN --mount=type=cache,target=/root/.npm \
		if [ -f package-lock.json ]; then \
			echo "Using npm ci (builder stage)" && npm ci; \
		else \
			echo "No package-lock.json -> npm install (builder stage)" && npm install; \
		fi

# Prisma ensuite : requis pour générer le client, mais placé sous l'install pour préserver son cache
COPY apps/app1/prisma.config.ts ./
COPY apps/app1/prisma ./prisma/

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
# Manifests SEULS d'abord : ni l'install npm ni Playwright ne dépendent de prisma/,
# donc une migration ne relance plus aucune des deux couches.
#
# Le script du `postinstall` doit exister avant `npm ci` : il relie les dépendances aux layers.
# On copie CE SEUL FICHIER, et non tout `scripts/`.
#
# Le dossier en compte 44, dont un seul sert à l'installation. Copier l'ensemble faisait qu'éditer
# `check-i18n.js` ou `seed-dev.ts` — sans rapport aucun avec les dépendances — invalidait `npm ci`
# puis les couches Playwright qui suivaient : 243 s de reconstruction mesurées, pour une ligne
# changée dans un utilitaire. Le reste de `scripts/` est de toute façon monté en volume au
# runtime : sa présence dans l'image ne servait à rien.
COPY apps/app1/package*.json ./
COPY apps/app1/scripts/lier-layers-node-modules.mjs ./scripts/

# Installer les dépendances dans l'image pour un démarrage rapide
# --mount=type=cache : réutilise les tarballs npm déjà téléchargés entre les builds Docker
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then \
      echo "Using npm ci (dev stage)" && npm ci --no-audit --no-fund; \
    else \
      echo "No package-lock.json -> npm install (dev stage)" && npm install --no-audit --no-fund; \
    fi

# L'empreinte de CE QUI VIENT D'ÊTRE INSTALLÉ, inscrite dans node_modules.
#
# Elle voyage avec le dossier quand Docker le recopie dans le volume au premier démarrage, et
# `docker-start.sh` la compare au verrou monté depuis l'hôte. Sans elle, le script devrait
# SUPPOSER que l'image est à jour — ce qui serait faux après un `clean-modules` suivi d'un `up`
# sans `--build`, et il enregistrerait alors une empreinte mensongère.
RUN if [ -f package-lock.json ]; then \
      md5sum package-lock.json | cut -d' ' -f1 > node_modules/.empreinte-installation; \
    else \
      md5sum package.json | cut -d' ' -f1 > node_modules/.empreinte-installation; \
    fi

# Créer les dossiers requis pour le développement
RUN mkdir -p /app/apps/app1/public/uploads /app/apps/app1/backups /uploads

# Prisma en dernier : monté en volume au runtime en dev, présent dans l'image par cohérence.
# Placé sous les couches coûteuses pour ne pas invalider leur cache à chaque migration.
COPY apps/app1/prisma.config.ts ./
COPY apps/app1/prisma ./prisma/

ENV NODE_ENV=development NUXT_HOST=0.0.0.0 NUXT_PORT=3000
EXPOSE 3000 24678
CMD ["npm", "run", "dev"]

# -------------------------
# Stage dev-e2e : le dev, plus Chromium
# -------------------------
# Playwright pesait 1 005 Mo sur les 3,8 Go de l'image de dev, et ses deux couches étaient les
# plus lentes à reconstruire (59 s pour les seules dépendances système). Or la CI installe SON
# PROPRE Chromium (`playwright install chromium --with-deps` dans tests.yml) : celui de l'image
# ne servait qu'aux exécutions locales dans le conteneur.
#
# Il vit donc au-dessus du stage de tous les jours. Qui lance Playwright depuis l'hôte ne le paie
# plus jamais ; qui le lance dans le conteneur construit cette image-ci :
#
#   docker compose -f docker-compose.dev.yml -f docker-compose.dev-e2e.yml up -d --build app
FROM dev AS dev-e2e

# Dépendances système de Chromium (libs Debian) — étape séparée du téléchargement du binaire.
RUN npx playwright install-deps chromium

# Binaire Chromium : téléchargé dans un cache persistant entre builds, puis copié dans l'image.
# Un cache mount n'étant pas committé dans la couche, la copie est ce qui rend le navigateur
# présent au runtime ; sur un rebuild, le téléchargement (~150 Mo) est sauté.
RUN --mount=type=cache,target=/opt/pw-browsers \
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install chromium \
    && mkdir -p /root/.cache/ms-playwright \
    && cp -a /opt/pw-browsers/. /root/.cache/ms-playwright/
