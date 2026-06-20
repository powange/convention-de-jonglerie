# Migration monorepo — déplacer l'app1 dans `apps/app1/`

> **Statut** : 📋 **Planifié / non exécuté**. Première tentative live échouée (cf. [Post-mortem](#post-mortem--pourquoi-la-1ère-tentative-a-échoué)).
> Cette doc décrit la procédure **à froid** à suivre pour réussir.
> **Date** : 2026-06-20.

## Objectif

Aligner l'application historique (« app1 ») sur la même structure que [`apps/app2/`](../apps/app2/) :
une **arborescence monorepo** où chaque application vit sous `apps/<nom>/` et où les **layers
réutilisables restent partagés à la racine** (`layers/`).

```
convention-de-jonglerie/          ← racine du repo (= contexte de build Docker)
├── layers/                       ← PARTAGÉ entre apps (reste à la racine)
│   ├── auth/  volunteers/  meals/  ticketing/  …
├── apps/
│   ├── app1/                     ← l'app jonglerie (CETTE migration)
│   │   ├── app/  server/  i18n/  prisma/  shared/  …
│   │   ├── nuxt.config.ts        ← extends '../../layers/*'
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── docker-compose*.yml
│   └── app2/                     ← déjà en place (référence cible)
├── .github/                      ← CI (reste à la racine)
└── docs/
```

### Pourquoi

- **Symétrie app1/app2** : un seul modèle mental, mêmes commandes Docker, même CI.
- **Layers réellement partagés** : `layers/` à la racine est accessible par les deux apps via
  `extends: '../../layers/<nom>'`. C'est ce qui permettra à app2 de réutiliser `auth`, etc.
- **Isolation** : chaque app a ses propres `package.json`, `Dockerfile`, `nuxt.config.ts`, `.env`.

---

## ⚠️ Leçon critique : migration **À FROID** uniquement

La migration consiste à `git mv` une grande partie du repo. **Aucun conteneur Docker ne doit
tourner** pendant les déplacements.

**Pourquoi** : le compose dev monte le code en volume (`./app:/app/app`, etc.). Si un conteneur
tourne pendant la migration et qu'on a déjà repointé un volume sur `apps/app1`, le conteneur
**crée des dossiers root-owned** (`apps/app1/server`, `apps/app1/public` via `prisma generate` /
`mkdir uploads`). Ensuite `git mv server apps/app1/server` **imbrique** au lieu de déplacer :
on obtient `apps/app1/server/server/` et l'alias `#server` (→ `apps/app1/server`) pointe sur un
dossier qui ne contient plus le code → `ENOENT … server//utils/notification-service`.

**Règle d'or** :

1. **Arrêter TOUS les conteneurs** de l'app1 avant de commencer.
2. **Garantir `apps/app1` VIDE** (ou inexistant) avant le premier `git mv`.
3. **Commiter le déplacement AVANT tout `docker build`/`up`**.
   Une fois la structure committée et correcte, un conteneur peut écrire `.nuxt`/`.output`/
   `node_modules` (tous gitignored) sans rien casser.

---

## Pré-requis (checklist avant de commencer)

- [ ] `git status` propre, sur `main` à jour.
- [ ] `docker ps` → **aucun** conteneur `convention-*` (app1) actif. *(app2 peut rester up.)*
- [ ] `apps/app1` **absent** : `ls -d apps/app1` doit échouer.
- [ ] Idéalement, travailler sur un **clone/worktree propre** pour valider le build sans toucher
      le checkout live.
- [ ] Prévenir : pendant la migration, `npm run docker:dev` est cassé (chemins en transit).

---

## Procédure pas-à-pas

### Étape 1 — Arrêter les conteneurs app1

```bash
docker compose -f docker-compose.dev.yml down
docker ps   # vérifier : plus aucun convention-app-dev / convention-db
```

### Étape 2 — Branche dédiée

```bash
git checkout -b feat/monorepo-app1
mkdir -p apps/app1
```

### Étape 3 — Déplacer les fichiers de l'app1, puis **COMMITER TOUT DE SUITE**

Tout ce qui est **spécifique à app1** descend dans `apps/app1/`. Ce qui est **partagé/monorepo**
(`layers/`, `apps/`, `.github/`, `.git/`, méta racine) **reste à la racine**.

```bash
# Dossiers + configs spécifiques app1
git mv app server shared i18n prisma public scripts test lib types backups docker \
       nuxt.config.ts app.config.ts package.json package-lock.json tsconfig.json \
       eslint.config.mjs vitest.config.ts vitest.config.ui.ts prisma.config.ts \
       apps/app1/

# Fichiers Docker app1
git mv Dockerfile Dockerfile.test docker-compose.dev.yml docker-compose.dev-install.yml \
       docker-compose.prod.yml docker-compose.release.yml \
       docker-compose.test.yml docker-compose.test-all.yml docker-compose.test-simple.yml \
       docker-compose.test-integration.yml docker-compose.test-ui.yml \
       apps/app1/

# .env (gitignored → mv classique, pas git mv)
mv .env apps/app1/.env
```

> ⚠️ Adapter la liste à l'arborescence réelle au moment T (`ls` racine). Ne **PAS** déplacer
> `layers/`, `apps/`, `.github/`, `.gitignore` racine, `README.md` racine.

**Commit immédiat** (avant tout build) :

```bash
git add -A
git commit -m "refactor(monorepo): déplace l'app1 dans apps/app1/ (structure iso app2)"
```

### Étape 4 — Repointer `extends` vers les layers partagés

Dans [`apps/app1/nuxt.config.ts`](../apps/app1/nuxt.config.ts), les layers ne sont plus à `./layers`
mais deux niveaux au-dessus :

```diff
   extends: [
-    './layers/volunteers',
-    './layers/meals',
-    …
-    './layers/auth',
+    '../../layers/volunteers',
+    '../../layers/meals',
+    …
+    '../../layers/auth',
   ],
```

> Les alias internes des layers restent valides : `#server` → `apps/app1/server`,
> `~/` → `apps/app1/app`, `#imports` → agrégateur global. C'est le **host** (app1) qui fournit
> son `server/`, d'où la réutilisabilité.

### Étape 5 — Refondre le `Dockerfile` (contexte = racine, layout imbriqué)

Le contexte de build devient la **racine** (pour inclure `layers/`). Le conteneur **reproduit le
layout hôte** (`/app/apps/app1` + `/app/layers`) pour que `extends: '../../layers'` résolve aussi
dans l'image.

Principes (à adapter au `Dockerfile` actuel, cf. [Dockerfile racine actuel](../apps/app1/Dockerfile)) :

```dockerfile
# Stage builder
WORKDIR /app/apps/app1
COPY apps/app1/package*.json ./
COPY apps/app1/prisma.config.ts ./
COPY apps/app1/prisma ./prisma/
RUN npm ci
RUN DATABASE_URL="mysql://user:pass@localhost:3306/db" npx prisma generate
COPY apps/app1/ ./           # source app1
COPY layers/ /app/layers/    # layers partagés (résout ../../layers)
RUN NODE_OPTIONS='--max-old-space-size=8192' npx nuxt build
RUN npm prune --omit=dev

# Stage runtime : copier depuis /app/apps/app1/...
WORKDIR /app/apps/app1
COPY --from=builder /app/apps/app1/.output ./.output
COPY --from=builder /app/apps/app1/public ./public
COPY --from=builder /app/apps/app1/node_modules ./node_modules
COPY --from=builder /app/apps/app1/prisma ./prisma
COPY --from=builder /app/apps/app1/server/generated ./server/generated
# … (mêmes artefacts qu'avant, préfixés /app/apps/app1)

# Stage dev : WORKDIR /app/apps/app1, CMD ["npm", "run", "dev"]
```

> ⚠️ Tous les `COPY --from=builder /app/...` actuels doivent devenir `/app/apps/app1/...`.
> L'`entrypoint.sh` (migrations Prisma) est sous `apps/app1/docker/` → ajuster son chemin.

### Étape 6 — `.dockerignore` à la racine (globs récursifs)

Le contexte étant la racine, le `.dockerignore` racine doit exclure les `node_modules`/builds de
**toutes** les sous-arbos, et exclure app2 du contexte app1 :

```gitignore
**/node_modules
**/.nuxt
**/.output
**/.cache
apps/app2
.git
*.log
**/public/uploads/*
```

### Étape 7 — Refondre les `docker-compose*.yml`

Pour **chaque** compose déplacé dans `apps/app1/`, le contexte de build remonte à la racine et le
Dockerfile est désigné explicitement. Exemple pour [`docker-compose.dev.yml`](../apps/app1/docker-compose.dev.yml) :

```yaml
services:
  app:
    build:
      context: ../..                       # racine du repo
      dockerfile: apps/app1/Dockerfile
      target: dev
    working_dir: /app/apps/app1
    command: sh -lc "/app/apps/app1/scripts/docker-start.sh"
    env_file:
      - .env                                # apps/app1/.env
    volumes:
      - ../../apps/app1/app:/app/apps/app1/app:cached
      - ../../apps/app1/server:/app/apps/app1/server:cached
      - ../../apps/app1/i18n:/app/apps/app1/i18n:cached
      - ../../apps/app1/prisma:/app/apps/app1/prisma:cached
      # … (tous les montages, préfixés ../../apps/app1 → /app/apps/app1)
      - ../../layers:/app/layers:cached     # layers PARTAGÉS
      - node_modules:/app/apps/app1/node_modules
      - uploads_data:/app/apps/app1/public/uploads
      - ../../apps/app1/.nuxt:/app/apps/app1/.nuxt
      - ../../apps/app1/.output:/app/apps/app1/.output
```

> Répéter la logique pour `prod`, `release` et les compose de test. Le hostname DB et les ports
> restent identiques (la DB est un service du compose).

### Étape 8 — CI GitHub Actions

Les workflows ([`.github/workflows/`](../.github/workflows/)) tournent depuis la racine. Ajouter
un `working-directory: apps/app1` aux steps `npm`/`docker`, ou `cd apps/app1` avant chaque commande.
Vérifier les chemins de **playwright.yml** (variables `ENCRYPTION_SECRET`, etc.) et des compose de
test (`-f apps/app1/docker-compose.test-*.yml`, contexte `../..`).

### Étape 9 — Scripts `package.json` (racine vs app1)

Les scripts `docker:*` référencent `-f docker-compose.*.yml`. Deux options :

- **A** — Les scripts vivent dans `apps/app1/package.json` et tournent depuis `apps/app1/`
  (les `-f docker-compose.*.yml` restent relatifs à `apps/app1/`). On lance via
  `npm --prefix apps/app1 run docker:dev` ou `cd apps/app1 && npm run docker:dev`.
- **B** — Ajouter un `package.json` racine minimal (workspaces) qui proxifie vers `apps/app1`.

> Mettre à jour `CLAUDE.md` (section « Commandes Docker ») avec les nouveaux chemins/préfixes.

---

## Validation

À faire de préférence sur un **clone/worktree propre** :

1. **Build dev** : `cd apps/app1 && docker compose -f docker-compose.dev.yml up --build -d`.
   - La structure étant committée, les `.nuxt`/`.output`/`node_modules` créés par le conteneur
     sont gitignored → aucun nesting.
2. **Readiness** : `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → `200`.
3. **Smoke** : login, une page bénévole, une page billetterie (vérifie que les layers résolvent).
4. **Logs** : `docker compose -f docker-compose.dev.yml logs -f app` → pas de
   `Cannot extend config from layers/*` ni d'`ENOENT server//…`.
5. **Tests** : `npm run test:unit:run` + `npm run test:nuxt:run` verts.
6. **CI** : pousser la branche, vérifier les 8 jobs + Playwright verts avant merge.

---

## Coordination déploiement (Portainer)

⚠️ **À faire faire par l'utilisateur** (l'agent ne déploie qu'après autorisation explicite ; il ne
configure pas Portainer).

- Mettre à jour, dans les stacks Portainer **prod** et **release** :
  - le **chemin du compose** : `apps/app1/docker-compose.prod.yml` (resp. `release`).
  - le **contexte de build** : racine du repo.
- **Tester `release` d'abord**, valider, puis prod.
- Les webhooks restent ceux du `.env` racine (`PORTAINER_RELEASE_WEBHOOK_URL`,
  `PORTAINER_PROD_WEBHOOK_URL`).

---

## Rollback

Tant que rien n'est mergé/déployé, l'annulation est triviale :

```bash
git checkout main
git branch -D feat/monorepo-app1
rm -rf apps/app1          # si des artefacts gitignored y traînent
```

Si un conteneur a créé des fichiers **root-owned** sous `apps/app1`, les rechowner via un conteneur
jetable avant `rm` :

```bash
docker run --rm -v "$(pwd)/apps:/work" alpine \
  sh -c "chown -R $(id -u):$(id -g) /work/app1"
```

Puis restaurer le `.env` à la racine et `docker compose -f docker-compose.dev.yml up --build -d`.

---

## Post-mortem — pourquoi la 1ère tentative a échoué

| | |
|---|---|
| **Symptôme** | `Could not load /app/apps/app1/server//utils/notification-service` (ENOENT) au démarrage Nuxt. |
| **Cause racine** | Un conteneur dev tournait avec le volume `../../apps/app1:/app/apps/app1` **déjà** monté. Il a créé `apps/app1/server` et `apps/app1/public` (root-owned) via `prisma generate`/`mkdir uploads`. Le `git mv server apps/app1/server` a donc **imbriqué** → `apps/app1/server/server/`. L'alias `#server` pointait sur `apps/app1/server` (vide de code). |
| **Aggravation** | Fichiers root-owned (WSL2 : Docker écrit en root) → `rm` impossible sans rechown via conteneur jetable. |
| **Correctif appliqué** | Abort propre : rechown via alpine, `.env` restauré, `git reset --hard`, `rm -rf apps/app1`, retour `main`. État stable rétabli. |
| **Leçon** | **Migration à froid** : conteneurs arrêtés + `apps/app1` vide + **commit du `git mv` AVANT tout build**. (cf. section [⚠️ à froid](#️-leçon-critique--migration-à-froid-uniquement)) |

---

## Références

- [`apps/app2/`](../apps/app2/) — structure cible de référence (Dockerfile, compose, nuxt.config).
- [modularisation-multi-domaines.md](./modularisation-multi-domaines.md) — stratégie layers.
- Layer auth extrait : `layers/auth/` (1er layer transverse réutilisable par app2).
</content>
</invoke>
