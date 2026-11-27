# Flowvent — Plateforme d'organisation d'événements (SaaS, abonnement simulé)

Application **Nuxt 4 autonome** (`apps/app2/`, nom de produit **Flowvent**), indépendante de l'app principale. Un utilisateur se
connecte, crée un événement et utilise tous les **modules d'organisation** (bénévoles, artistes,
billetterie…). Le prix suit la **taille** : formule gratuite Découverte, puis Association, Festival
ou Grand festival, au mois ou à l'année, qui relèvent les plafonds d'événements, de bénévoles,
d'artistes et de co-organisateurs (cf. [docs/flowvent-abonnements.md](../../docs/flowvent-abonnements.md)).

> ⚠️ **Paiement simulé** : aucun prestataire de paiement réel n'est appelé. Le « paiement » réussit
> immédiatement et active l'abonnement (persisté en base).

## Stack

- **Nuxt 4** + **Nuxt UI v4** (Tailwind) — interface
- **nuxt-auth-utils** — authentification par session (email / mot de passe)
- **Prisma 7** + **MySQL** (driver adapter `@prisma/adapter-mariadb`) — base de données
- **bcryptjs** — hachage des mots de passe, **zod** — validation

## Environnements Docker (parité avec app1)

Trois composes, tous avec un service MySQL dédié. Depuis `apps/app2/` :

| Environnement           | Compose                      | Domaine                               | Conteneur app          | MySQL (hôte)    |
| ----------------------- | ---------------------------- | ------------------------------------- | ---------------------- | --------------- |
| **dev** (local)         | `docker-compose.dev.yml`     | `dev.flowvent.org` / `localhost:3001` | `flowvent-app`         | `3307` (publié) |
| **release** (Portainer) | `docker-compose.release.yml` | `test.flowvent.org`                   | `flowvent-app-release` | interne         |
| **prod** (Portainer)    | `docker-compose.prod.yml`    | `flowvent.org`                        | `flowvent-app-prod`    | interne         |

- **Contexte de build = racine du dépôt** : app2 étend `layers/auth`, qui vit hors de son dossier.
  Ce qui entre dans le contexte est réglé par `Dockerfile.dockerignore`.
- **dev** : hot-reload, code et layer d'auth montés en volume. Lit `apps/app2/.env`.
- **release / prod** : **image publiée par la CI** (`ghcr.io/powange/flowvent:main`, workflow
  `publier-image-flowvent.yml`), jamais construite par l'hôte. Les migrations sont appliquées au
  démarrage (`entrypoint.sh` → `prisma migrate deploy`). Mise en place : voir
  [docs/deploiement-flowvent.md](../../docs/deploiement-flowvent.md).

### Lancer le dev

```bash
docker compose -f docker-compose.dev.yml up --build -d
# Les migrations versionnées (prisma/migrations) sont appliquées au démarrage du conteneur.
# → https://dev.flowvent.org  (ou http://localhost:3001)
docker compose -f docker-compose.dev.yml down
```

> ⚠️ **`NUXT_SESSION_PASSWORD`** doit être défini dans `apps/app2/.env` (dev) ou `stack.env`
> (release/prod). Le domaine du proxy est autorisé dans `nuxt.config.ts` (`vite.server.allowedHosts`).

## Démarrage en local (sans Docker)

Nécessite un MySQL accessible (ex. le service `flowvent-db` du compose dev, publié sur `localhost:3307`).

```bash
cp .env.example .env          # renseigner NUXT_SESSION_PASSWORD + pointer DATABASE_URL vers ton MySQL
npm install
npx prisma migrate deploy
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

Voir [docs/deploiement-flowvent.md](../../docs/deploiement-flowvent.md) : stacks release et prod,
variables, reverse proxy, publication de l'image.

## Reste à faire

- Brancher un **transport de courriel** : aujourd'hui les messages (codes de vérification
  compris) ne sont qu'écrits dans les journaux du conteneur.
- Brancher un **vrai prestataire de paiement** (ex. Stripe) à la place de `checkout.post.ts`.
- Ajouter l'**i18n** (la 1ʳᵉ version est en français en dur) et les tests.
