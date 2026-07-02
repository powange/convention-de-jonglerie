# Flowvent (app2) — Plateforme SaaS d'organisation d'événements

**Flowvent** (`apps/app2/`) est une **2ᵉ application autonome** du monorepo : un SaaS où des utilisateurs se
connectent, créent un événement, puis accèdent aux **fonctionnalités d'organisation** (gestion des
bénévoles…) via un **abonnement payant** (mensuel ou annuel).

Cette première itération privilégie une **interface épurée et lisible** et un **paiement simulé**
(aucun prestataire réel ; le paiement réussit immédiatement et l'abonnement est persisté en base).

## Décisions d'architecture

| Sujet | Choix | Raison |
| --- | --- | --- |
| Couplage avec app1 | **Autonome** (aucun layer partagé) | App2 est un produit distinct ; le layer `volunteers` d'app1 est câblé sur le modèle Édition/Convention et n'est pas réutilisable tel quel |
| Base de données | **MySQL** via Prisma 7 (`@prisma/adapter-mariadb`) | Parité avec app1 ; 3 environnements Docker (dev/release/prod), chacun avec son service MySQL dédié |
| Authentification | **nuxt-auth-utils** (session, email/mot de passe) | Même librairie éprouvée qu'app1, sans coupler le code |
| Abonnement | **Persisté en base** (1 par compte) | Débloque les fonctionnalités d'orga ; prêt à brancher un vrai paiement plus tard |
| i18n | **Français en dur** (pas de module i18n) | Garder la 1ʳᵉ itération simple ; à ajouter ensuite |

## Modèle de données (`apps/app2/prisma/schema.prisma`)

- **User** — `email` (unique), `password` (haché bcrypt), `name?`
- **Event** — `name`, `description?`, `location?`, `startDate?`, `owner` → User
- **Subscription** — `userId` (unique), `plan` (`monthly`|`annual`), `status` (`active`|`inactive`),
  `currentPeriodEnd`

> `plan`/`status` sont des `String` (validés côté serveur via la constante `SUBSCRIPTION_PLANS` dans
> `server/utils/subscription.ts`) plutôt que des enum, pour garder le schéma simple.

## Parcours utilisateur

1. **Inscription / connexion** (`/register`, `/login`) → session créée.
2. **Tableau de bord** (`/dashboard`) → liste des événements + bandeau d'abonnement.
3. **Création d'événement** (`/events/new`).
4. **Détail de l'événement** (`/events/[id]`) → section « Fonctionnalités d'organisation » :
   - sans abonnement actif → **paywall** renvoyant vers `/pricing` ;
   - avec abonnement actif → accès à la **gestion des bénévoles**.
5. **Tarifs** (`/pricing`) → bouton « S'abonner » → `POST /api/subscription/checkout`
   (**paiement simulé**) → abonnement activé → redirection vers le tableau de bord.
6. **Gestion des bénévoles** (`/events/[id]/volunteers`) → page **placeholder** (aperçu), protégée
   par les middlewares `auth` + `subscription`.

## API serveur (`apps/app2/server/api/`)

| Endpoint | Rôle |
| --- | --- |
| `POST /api/auth/register` | Crée le compte + ouvre la session |
| `POST /api/auth/login` | Vérifie les identifiants + ouvre la session |
| `POST /api/auth/logout` | Ferme la session |
| `GET /api/events` | Liste les événements de l'utilisateur |
| `POST /api/events` | Crée un événement |
| `GET /api/events/[id]` | Détail (propriétaire uniquement) |
| `GET /api/subscription/status` | Indique si l'abonnement est actif |
| `POST /api/subscription/checkout` | **Paiement simulé** : active l'abonnement (+1 mois ou +1 an) |

Gardes : `requireUserSession` (auth) côté API, et côté util `requireActiveSubscription` /
`isSubscriptionActive` pour l'abonnement. Côté front, middlewares `auth`, `guest-only`,
`subscription`.

## Environnements Docker (parité app1)

Trois composes autonomes (contexte de build = `apps/app2`), chacun avec un service MySQL dédié :

| Environnement | Compose | Cible | Conteneur app | MySQL (hôte) |
| --- | --- | --- | --- | --- |
| **dev** | `docker-compose.dev.yml` | `dev` (HMR) | `flowvent-app` | `3307` (publié) |
| **release** | `docker-compose.release.yml` | `runtime` | `flowvent-app-release` | interne |
| **prod** | `docker-compose.prod.yml` | `runtime` | `flowvent-app-prod` | interne |

- **dev** lit `apps/app2/.env` ; **release/prod** lisent `../../stack.env` (comme app1).
- Les migrations sont appliquées au démarrage : `docker/entrypoint.sh` (runtime) et la `command` du
  compose dev exécutent `prisma migrate deploy`.
- dev + release + prod sont sur le réseau externe `proxy-network` (reverse proxy).

## Lancer en local (Docker dev)

Depuis `apps/app2/` :

```bash
cp .env.example .env       # renseigner NUXT_SESSION_PASSWORD
docker compose -f docker-compose.dev.yml up --build -d
docker compose -f docker-compose.dev.yml exec flowvent-app npx prisma migrate dev --name init  # 1re fois
# → https://dev.event.powange.com (ou http://localhost:3001)
```

## Reste à faire

- Remplacer le **paiement simulé** par un vrai prestataire (ex. Stripe).
- Ajouter **i18n** et **tests** (unitaires + E2E).
