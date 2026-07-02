# Flowvent — Plateforme d'organisation d'événements (SaaS, abonnement simulé)

Application **Nuxt 4 autonome** (`apps/app2/`, nom de produit **Flowvent**), indépendante de l'app principale. Un utilisateur se
connecte, crée un événement, puis débloque les **fonctionnalités d'organisation** (gestion des
bénévoles…) via un **abonnement mensuel ou annuel**.

> ⚠️ **Paiement simulé** : aucun prestataire de paiement réel n'est appelé. Le « paiement » réussit
> immédiatement et active l'abonnement (persisté en base).

## Stack

- **Nuxt 4** + **Nuxt UI v4** (Tailwind) — interface
- **nuxt-auth-utils** — authentification par session (email / mot de passe)
- **Prisma 7** + **MySQL** (driver adapter `@prisma/adapter-mariadb`) — base de données
- **bcryptjs** — hachage des mots de passe, **zod** — validation

## Environnements Docker (parité avec app1)

Trois composes, tous avec un service MySQL dédié. Depuis `apps/app2/` :

| Environnement | Compose | Cible | Conteneur app | MySQL (hôte) |
| --- | --- | --- | --- | --- |
| **dev** | `docker-compose.dev.yml` | `dev` (HMR) | `flowvent-app` | `3307` (publié) |
| **release** | `docker-compose.release.yml` | `runtime` | `flowvent-app-release` | interne |
| **prod** | `docker-compose.prod.yml` | `runtime` | `flowvent-app-prod` | interne |

- **dev** : hot-reload, code monté en volume, exposé sur `http://localhost:3001` **et** via le reverse
  proxy `https://dev.event.powange.com` (réseau `proxy-network`, conteneur `flowvent-app`). Lit
  `apps/app2/.env`.
- **release / prod** : image `runtime`, derrière le reverse proxy, variables lues depuis
  `../../stack.env` (comme app1). Les migrations sont appliquées au démarrage (`entrypoint.sh` →
  `prisma migrate deploy`).

### Lancer le dev

```bash
docker compose -f docker-compose.dev.yml up --build -d
# Première fois : créer la migration initiale (base MySQL)
docker compose -f docker-compose.dev.yml exec flowvent-app npx prisma migrate dev --name init
# → https://dev.event.powange.com  (ou http://localhost:3001)
docker compose -f docker-compose.dev.yml down
```

> ⚠️ **`NUXT_SESSION_PASSWORD`** doit être défini dans `apps/app2/.env` (dev) ou `stack.env`
> (release/prod). Le domaine du proxy est autorisé dans `nuxt.config.ts` (`vite.server.allowedHosts`).

## Démarrage en local (sans Docker)

Nécessite un MySQL accessible (ex. le service `flowvent-db` du compose dev, publié sur `localhost:3307`).

```bash
cp .env.example .env          # renseigner NUXT_SESSION_PASSWORD + pointer DATABASE_URL vers ton MySQL
npm install
npx prisma migrate dev --name init
npm run dev                   # http://localhost:3000
```

Scripts utiles : `npm run db:migrate`, `npm run db:studio`, `npm run db:generate`.

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
  utils/                       prisma (singleton mariadb), subscription (garde + validation)
prisma/schema.prisma           User, Event, Subscription (MySQL)
docker/
  entrypoint.sh                runtime : migrate deploy puis démarrage Nitro
  mysql/init/01-init.sql       grants MySQL (shadow DB pour `prisma migrate dev`)
```

## Déploiement Portainer

Créer une stack par environnement (compose path = `apps/app2/docker-compose.release.yml` ou
`…prod.yml`), fournir `stack.env` (dont `NUXT_SESSION_PASSWORD`, `MYSQL_*`), et faire pointer le
reverse proxy vers le conteneur (`flowvent-app-release` / `flowvent-app-prod`).

## Reste à faire

- Brancher un **vrai prestataire de paiement** (ex. Stripe) à la place de `checkout.post.ts`.
- Ajouter l'**i18n** (la 1ʳᵉ version est en français en dur) et les tests.
