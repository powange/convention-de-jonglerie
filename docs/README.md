# Documentation du projet Convention de Jonglerie

Documentation technique de l'architecture, des modules métier et des intégrations.

## 📦 Modules métier

Documentation des grandes fonctionnalités de l'application :

- **[shows-call.md](./shows-call.md)** — Appels à spectacles, candidatures artistes et sondage de notation
- **[tasks.md](./tasks.md)** — Module Tâches (TaskGroup / Task / TaskAssignment) pour l'organisation interne
- **[meals.md](./meals.md)** — Repas (configuration, sélections bénévoles/artistes, validation, intégration billetterie)
- **[workshops.md](./workshops.md)** — Ateliers proposés par les participants
- **[stock.md](./stock.md)** — Stock matériel (groupes, items, réservations sur des périodes)
- **[carpool.md](./carpool.md)** — Covoiturage (offres, demandes, réservations, commentaires)
- **[messenger.md](./messenger.md)** — Messagerie (conversations typées, temps réel, présence)
- **[lost-found.md](./lost-found.md)** — Objets trouvés et perdus
- **[project-costs.md](./project-costs.md)** — Coûts du projet et donations café (Stripe)
- **[volunteer-qr-code-tokens.md](./volunteer-qr-code-tokens.md)** — Tokens QR pour les bénévoles
- **[volunteers/](./volunteers/)** — Sous-dossier dédié au système de bénévolat
- **[ticketing/](./ticketing/)** — Sous-dossier dédié à la billetterie

## 🔧 Systèmes core

Voir **[system/](./system/)** :

- **[ORGANIZER_PERMISSIONS.md](./system/ORGANIZER_PERMISSIONS.md)** — Système de permissions granulaires (convention + per-edition)
- **[NOTIFICATION_SYSTEM.md](./system/NOTIFICATION_SYSTEM.md)** — Notifications in-app, email et push
- **[AUTH_SESSIONS.md](./system/AUTH_SESSIONS.md)** — Authentification et sessions cookies scellés
- **[CRON_SYSTEM.md](./system/CRON_SYSTEM.md)** — Tâches planifiées
- **[ERROR_LOGGING_SYSTEM.md](./system/ERROR_LOGGING_SYSTEM.md)** — Logs d'erreurs centralisés
- **[error-handling.md](./system/error-handling.md)** — Gestion d'erreurs côté serveur
- **[API_PROFILE_STATS.md](./system/API_PROFILE_STATS.md)** — Statistiques de profil utilisateur
- **[feedback.md](./system/feedback.md)** — Système de feedback utilisateur

## 🎫 Billetterie

Voir **[ticketing/](./ticketing/)** :

- [README.md](./ticketing/README.md) — Vue d'ensemble
- [tiers.md](./ticketing/tiers.md), [options.md](./ticketing/options.md), [quotas.md](./ticketing/quotas.md)
- [orders.md](./ticketing/orders.md) — Commandes
- [access-control.md](./ticketing/access-control.md) — Contrôle d'accès
- [returnable-items.md](./ticketing/returnable-items.md) — Articles à restituer
- [external-integration.md](./ticketing/external-integration.md) — Intégrations HelloAsso, etc.

## 👥 Bénévoles

Voir **[volunteers/](./volunteers/)** :

- [allergy-severity-utility.md](./volunteers/allergy-severity-utility.md)
- [teams-utils.md](./volunteers/teams-utils.md)
- [volunteer-application-api-utility.md](./volunteers/volunteer-application-api-utility.md)
- [volunteer-application-diff-utility.md](./volunteers/volunteer-application-diff-utility.md)
- [volunteer-application-edit-mode.md](./volunteers/volunteer-application-edit-mode.md)
- [volunteer-auto-assignment-system.md](./volunteers/volunteer-auto-assignment-system.md)
- [volunteer-returnable-items-by-team.md](./volunteers/volunteer-returnable-items-by-team.md)

## 🔌 Intégrations externes

Voir **[integrations/](./integrations/)** :

- [anthropic-integration.md](./integrations/anthropic-integration.md) — Intégration API Anthropic Claude
- [backup-system.md](./integrations/backup-system.md) — Système de sauvegarde
- [helloasso-integration.md](./integrations/helloasso-integration.md) — Intégration HelloAsso (paiements)
- [infomaniak-ticketing.md](./integrations/infomaniak-ticketing.md) — Intégration Infomaniak (billetterie externe)
- [sumup-integration.md](./sumup-integration.md) — Intégration SumUp
- [firebase-setup.md](./firebase-setup.md), [firebase-multi-environment.md](./firebase-multi-environment.md), [firebase-test-mocks.md](./firebase-test-mocks.md) — Firebase (push notifications)

## 🔐 Sécurité

Voir **[security/](./security/)** :

- [00-synthese-audit.md](./security/00-synthese-audit.md) — Synthèse de l'audit
- [01-api-backend.md](./security/01-api-backend.md) — API & backend
- [02-auth-sessions.md](./security/02-auth-sessions.md) — Authentification & sessions
- [03-upload-donnees.md](./security/03-upload-donnees.md) — Uploads & données
- [04-xss-frontend.md](./security/04-xss-frontend.md) — XSS & frontend

## ⚡ Optimisations

Voir **[optimization/](./optimization/)** :

- [cache-http-assets.md](./optimization/cache-http-assets.md)
- [caching-implementation-opportunities.md](./optimization/caching-implementation-opportunities.md)
- [i18n-lazy-loading.md](./optimization/i18n-lazy-loading.md), [i18n-component-lazy-loading.md](./optimization/i18n-component-lazy-loading.md)
- [lazy-loading-libraries.md](./optimization/lazy-loading-libraries.md)
- [memory-optimization.md](./optimization/memory-optimization.md)
- [notification-i18n.md](./optimization/notification-i18n.md)
- [prisma-log-configuration.md](./optimization/prisma-log-configuration.md)

## 🐳 Docker

Voir **[docker/](./docker/)** :

- [README-DOCKER.md](./docker/README-DOCKER.md) — Vue d'ensemble Docker
- [DOCKER.md](./docker/DOCKER.md), [DOCKER-WINDOWS.md](./docker/DOCKER-WINDOWS.md)
- [TESTS-DOCKER.md](./docker/TESTS-DOCKER.md) — Tests sous Docker

## 🛠️ Patterns et utilitaires transverses

- **[prisma-select-helpers.md](./prisma-select-helpers.md)** — Helpers de sélection Prisma standardisés
- **[migration-fetch-to-useApiAction.md](./migration-fetch-to-useApiAction.md)** — Migration vers le composable `useApiAction`
- **[prisma-migration-log.md](./prisma-migration-log.md)** — Journal des migrations Prisma
- **[nuxt-config-audit.md](./nuxt-config-audit.md)** — Audit de la configuration Nuxt
- **[analyse-nuxt4-recommandations.md](./analyse-nuxt4-recommandations.md)** — Recommandations Nuxt 4
- **[codebase_analysis.md](./codebase_analysis.md)** — Analyse de la base de code

## 🔍 Audits

- **[audit-logique-metier.md](./audit-logique-metier.md)** — Audit logique métier (février 2026)
- **[security/](./security/)** — Audit de sécurité

## 📦 Archive

Voir **[archive/](./archive/)** pour les documents historiques (plans achevés, migrations terminées, instructions obsolètes).

---

## 🔄 Maintenance

Cette documentation est maintenue à jour avec le code. Lorsqu'une fonctionnalité est ajoutée/modifiée, mettre à jour la doc correspondante (et l'archiver si remplacée).

Convention :

- **Modules métier** → fichier dédié à la racine de `docs/`
- **Systèmes transverses** → `docs/system/`
- **Intégrations externes** → `docs/integrations/`
- **Optimisations** → `docs/optimization/`
- **Sécurité** → `docs/security/`
- **Docs obsolètes** → `docs/archive/`

**Dernière mise à jour** : 2026-05-13.
