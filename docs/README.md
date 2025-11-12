# Documentation du Projet Convention de Jonglerie

Cette documentation technique décrit l'architecture, les systèmes et les patterns utilisés dans le projet.

## 📁 Structure de la documentation

### 🔧 [system/](./system/) - Systèmes Core (8 fichiers)
Documentation des systèmes fondamentaux de l'application :
- **API_PROFILE_STATS.md** - Statistiques de profil utilisateur
- **AUTH_SESSIONS.md** - Système d'authentification et sessions
- **CRON_SYSTEM.md** - Tâches planifiées et cron jobs
- **ERROR_LOGGING_SYSTEM.md** - Système de logs d'erreurs
- **NOTIFICATION_SYSTEM.md** - Système de notifications
- **ORGANIZER_PERMISSIONS.md** - Système de permissions des organisateurs
- **api-utils-refactoring.md** - Utilitaires API centralisés
- **feedback.md** - Système de feedback utilisateur

### 🎫 [ticketing/](./ticketing/) - Billetterie (8 fichiers)
Documentation complète du système de billetterie :
- **README.md** - Vue d'ensemble du système
- **access-control.md** - Contrôle d'accès et validation
- **external-integration.md** - Intégrations externes (HelloAsso, etc.)
- **options.md** - Options de billets
- **orders.md** - Gestion des commandes
- **quotas.md** - Système de quotas
- **returnable-items.md** - Objets consignés
- **tiers.md** - Tarifs et catégories

### 👥 [volunteers/](./volunteers/) - Bénévoles (7 fichiers)
Documentation du système de gestion des bénévoles :
- **allergy-severity-utility.md** - Gestion des allergies
- **teams-utils.md** - Utilitaires pour les équipes
- **volunteer-application-api-utility.md** - Utilitaires API candidatures
- **volunteer-application-diff-utility.md** - Comparaison de candidatures
- **volunteer-application-edit-mode.md** - Mode édition des candidatures
- **volunteer-auto-assignment-system.md** - Système d'assignation automatique
- **volunteer-returnable-items-by-team.md** - Objets consignés par équipe

### 🔌 [integrations/](./integrations/) - Intégrations (3 fichiers)
Documentation des intégrations avec services externes :
- **anthropic-integration.md** - Intégration API Anthropic Claude
- **backup-system.md** - Système de sauvegarde
- **helloasso-integration.md** - Intégration HelloAsso (paiements)

### ⚡ [optimization/](./optimization/) - Optimisations (8 fichiers)
Documentation des optimisations de performance :
- **cache-http-assets.md** - Cache HTTP des assets statiques
- **i18n-component-lazy-loading.md** - Lazy loading i18n composants
- **i18n-lazy-loading.md** - Lazy loading i18n général
- **image-loading-cache.md** - Cache de chargement d'images
- **lazy-loading-libraries.md** - Lazy loading des bibliothèques
- **notification-i18n.md** - Internationalisation des notifications
- **prisma-log-configuration.md** - Configuration des logs Prisma
- **push-notifications-browser-support.md** - Support des push notifications

### 📦 [archive/](./archive/) - Archives (3 fichiers)
Documentation historique et guides de migration terminés :
- **README.md** - Vue d'ensemble des archives
- **logs-erreur-api-ameliorations.md** - Migration logs d'erreur (terminée)
- **notification-i18n-migration-guide.md** - Migration notifications i18n (terminée)

## 🔍 Navigation rapide

### Par thématique
- **Authentification** → [system/AUTH_SESSIONS.md](./system/AUTH_SESSIONS.md)
- **Billetterie** → [ticketing/README.md](./ticketing/README.md)
- **Bénévoles** → [volunteers/](./volunteers/)
- **Notifications** → [system/NOTIFICATION_SYSTEM.md](./system/NOTIFICATION_SYSTEM.md)
- **Permissions** → [system/ORGANIZER_PERMISSIONS.md](./system/ORGANIZER_PERMISSIONS.md)
- **Performance** → [optimization/](./optimization/)
- **Intégrations** → [integrations/](./integrations/)

### Par type de documentation
- **Architecture système** → [system/](./system/)
- **Guides de migration** → [archive/](./archive/)
- **Optimisations** → [optimization/](./optimization/)
- **APIs et utilitaires** → [system/api-utils-refactoring.md](./system/api-utils-refactoring.md)

## 📊 Statistiques

- **Total** : 37 fichiers de documentation
- **Systèmes core** : 8 fichiers
- **Billetterie** : 8 fichiers
- **Bénévoles** : 7 fichiers
- **Intégrations** : 3 fichiers
- **Optimisations** : 8 fichiers
- **Archives** : 3 fichiers

## 🔄 Maintenance

Cette documentation est maintenue activement. Les fichiers obsolètes sont déplacés dans `archive/` pour référence historique.

**Dernière réorganisation** : 12 novembre 2025
