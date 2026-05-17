# Gemini Code Assistant Configuration

## Préférences de l'utilisateur

- **Langue préférée :** Français

## Détails du projet

- **Nuxt.js :** 4.4.2+
- **@nuxt/ui :** 4.5.1+
- **Prisma :** 7.8.0+
- **Pinia :** 3.0.4+
- **TypeScript :** 5.x

### Modules Nuxt principaux

- `@nuxt/eslint` ([Doc](https://eslint.nuxt.com/))
- `@nuxt/image` ([Doc](https://image.nuxt.com/))
- `@nuxt/scripts` ([Doc](https://scripts.nuxt.com/))
- `@nuxt/test-utils` ([Doc](https://test-utils.nuxt.com/))
- `@nuxt/ui` ([Doc](https://ui.nuxt.com/))
- `@nuxtjs/i18n` ([Doc](https://i18n.nuxtjs.org/))
- `@nuxt/icon` ([Doc](https://nuxt.com/modules/icon))
- `@pinia/nuxt` ([Doc](https://pinia.vuejs.org/ssr/nuxt.html))
- `nuxt-auth-utils` (sessions cookies scellés)
- `prisma-nuxt-module`

> Pour la configuration détaillée et les conventions, se référer à [`CLAUDE.md`](CLAUDE.md) qui sert de source de vérité.

## Project Overview

Application web de gestion et découverte de **conventions de jonglerie**. Les utilisateurs peuvent consulter, ajouter et modifier des conventions et leurs éditions, gérer leurs favoris, candidater comme bénévole ou artiste, etc.

L'application est full-stack TypeScript avec Nuxt 4 (frontend + serveur Nitro), Prisma comme ORM et MySQL/MariaDB comme base de données.

## Modules métier

- **Conventions / Éditions** — Modèles principaux (cf. `prisma/schema/schema.prisma`)
- **Bénévoles** — Candidatures, équipes, créneaux, repas, restitutions ([`docs/volunteers/`](docs/volunteers/))
- **Artistes & Spectacles** — Show calls, candidatures, sondages ([`docs/shows-call.md`](docs/shows-call.md))
- **Repas** — Configuration, validation, intégration billetterie
- **Tâches** — Organisation interne du travail par groupes ([`docs/tasks.md`](docs/tasks.md))
- **Workshops** — Ateliers proposés par les participants
- **Billetterie** — Tarifs, options, commandes, contrôle d'accès ([`docs/ticketing/`](docs/ticketing/))
- **Covoiturage** — Offres / demandes / réservations
- **Carte du site** — Plan interactif des éditions
- **Calendrier** — Planning bénévoles / spectacles via FullCalendar
- **Notifications** — In-app + email + push web ([`docs/system/NOTIFICATION_SYSTEM.md`](docs/system/NOTIFICATION_SYSTEM.md))
- **Permissions** — Système granulaire convention + per-edition ([`docs/system/ORGANIZER_PERMISSIONS.md`](docs/system/ORGANIZER_PERMISSIONS.md))

## Technologies

- **Frontend :** [Nuxt 4](https://nuxt.com/) (Vue 3)
- **UI Framework :** [Nuxt UI 4](https://ui.nuxt.com/)
- **Backend :** [Nitro](https://nitro.unjs.io/) (intégré à Nuxt)
- **ORM :** [Prisma 7](https://www.prisma.io/)
- **Base de données :** MySQL / MariaDB
- **Authentification :** Sessions par cookie scellé via `nuxt-auth-utils` (pas de JWT)
- **i18n :** `@nuxtjs/i18n` avec lazy loading par domaine ([`docs/optimization/i18n-lazy-loading.md`](docs/optimization/i18n-lazy-loading.md))
- **Tests :** Vitest (unit + Nuxt) + Playwright (e2e)

## Project Structure

- `app/` — Frontend Nuxt
  - `components/` — Composants Vue (PascalCase)
  - `pages/` — Pages et routing
  - `stores/` — Stores Pinia
  - `composables/` — Composables réutilisables (ex: `useApiAction`)
  - `middleware/` — Middlewares Nuxt
  - `layouts/` — Layouts (dashboard édition, etc.)
- `server/` — Backend
  - `api/` — Endpoints REST
  - `utils/` — Helpers serveur (auth, prisma, permissions, notifications)
  - `middleware/` — Middlewares Nitro (CSRF, etc.)
  - `constants/` — Constantes (permissions, etc.)
- `prisma/` — Schéma Prisma multi-fichiers + migrations
- `i18n/locales/` — Traductions par langue, organisées par domaine
- `docs/` — Documentation technique
- `tests/` — Tests Vitest et Playwright

## Coding Style & Conventions

- **Linting :** ESLint (`eslint.config.mjs`)
- **Formatage :** Prettier (`npm run format`)
- **Composants :** PascalCase (`MyComponent.vue`)
- **Pages :** kebab-case (`my-page.vue`)
- **Endpoints API :** kebab-case avec extension HTTP (`my-endpoint.post.ts`)
- **Helpers Prisma centralisés :** voir [`docs/prisma-select-helpers.md`](docs/prisma-select-helpers.md)
- **Composable API client :** `useApiAction` ([`docs/migration-fetch-to-useApiAction.md`](docs/migration-fetch-to-useApiAction.md))

## Commandes courantes

- **Dépendances :** `npm install`
- **Dev server :** `npm run dev` (Docker : `npm run docker:dev`)
- **Build :** `npm run build`
- **Lint :** `npm run lint` (auto-fix : `npm run lint -- --fix`)
- **Format :** `npm run format`
- **Tests unitaires :** `npm run test:unit:run`
- **Tests Nuxt :** `npm run test:nuxt:run`
- **Migrations Prisma :** `npx prisma migrate dev` (laissé à l'humain)
- **Génération Prisma :** `npx prisma generate`
- **Vérif i18n :** `npm run check-i18n` / `npm run check-translations`

## Goals for Gemini

- Assister au développement de nouvelles features en respectant les conventions existantes
- Aider au débogage et au troubleshooting
- Écrire et refactorer du code en suivant le style établi
- Générer des migrations Prisma (sans les exécuter — l'utilisateur le fait)
- Aider à écrire des tests
- Maintenir l'i18n synchronisée (FR comme référence, traduire les autres langues à la demande)

---

Dernière mise à jour : 2026-05-13.
