# App2 — Plateforme d'organisation d'événements (SaaS, abonnement simulé)

Application **Nuxt 4 autonome** (`apps/app2/`), indépendante de l'app principale. Un utilisateur se
connecte, crée un événement, puis débloque les **fonctionnalités d'organisation** (gestion des
bénévoles…) via un **abonnement mensuel ou annuel**.

> ⚠️ **Paiement simulé** : aucun prestataire de paiement réel n'est appelé. Le « paiement » réussit
> immédiatement et active l'abonnement (persisté en base).

## Stack

- **Nuxt 4** + **Nuxt UI v4** (Tailwind) — interface
- **nuxt-auth-utils** — authentification par session (email / mot de passe)
- **Prisma 7** + **SQLite** (driver adapter `better-sqlite3`) — base de données de dev
- **bcryptjs** — hachage des mots de passe, **zod** — validation

## Démarrage en local (recommandé pour le dev)

Depuis `apps/app2/` :

```bash
# 1. Variables d'environnement
cp .env.example .env          # puis renseigner NUXT_SESSION_PASSWORD (>= 32 caractères)

# 2. Dépendances (compile better-sqlite3 — nécessite python3/make/g++)
npm install

# 3. Base de données (crée le fichier SQLite + applique le schéma)
npx prisma migrate dev --name init

# 4. Lancer le serveur de dev
npm run dev                   # http://localhost:3000
```

Scripts utiles : `npm run db:migrate` (migration), `npm run db:studio` (Prisma Studio),
`npm run db:generate` (régénère le client Prisma).

## Lancer en Docker (démo, cible `dev` + SQLite)

```bash
docker compose up --build -d                              # build + run → http://localhost:3001
docker compose exec app2 npx prisma migrate dev --name init   # une seule fois : crée le schéma SQLite
docker compose down
```

- La base SQLite est persistée dans le volume `app2_db` (`/data/app2.db`), hors du code.
- `NUXT_SESSION_PASSWORD` est lu depuis `apps/app2/.env` par Docker Compose.
- Le conteneur est rattaché au réseau externe **`proxy-network`** : le reverse proxy (domaine
  auto-signé **https://dev.event.powange.com**) l'atteint par le nom `app2` sur le port 3000.
  Le domaine est autorisé dans `nuxt.config.ts` (`vite.server.allowedHosts`). Si ton proxy vise
  l'hôte (`localhost:3001`), retire le bloc `networks` du `docker-compose.yml`.

> La cible Docker `runtime` (prod, image slim) est prévue pour **MySQL** (cf. ci-dessous) : elle ne
> contient pas le CLI Prisma et ne peut donc pas appliquer un schéma SQLite.

## Structure

```
app/
  layouts/default.vue          en-tête + pied de page
  pages/                       index, login, register, dashboard, pricing,
                               events/new, events/[id], events/[id]/volunteers
  middleware/                  auth, guest-only, subscription
server/
  api/auth/                    register, login, logout
  api/events/                  liste, création, détail
  api/subscription/            status, checkout (paiement simulé)
  utils/                       prisma (singleton), subscription (garde + validation)
prisma/schema.prisma           User, Event, Subscription (SQLite)
```

## Passage en production

Cette première itération vise un parcours complet **simulé** avec une UI épurée. Avant la prod, il
restera à :

- remplacer **SQLite par MySQL** (adapter `@prisma/adapter-mariadb`, comme app1) et finaliser la
  cible Docker `runtime` ;
- brancher un **vrai prestataire de paiement** (ex. Stripe) à la place de `checkout.post.ts` ;
- ajouter l'**i18n** (la 1ʳᵉ version est en français en dur) et les tests.
