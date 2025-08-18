# Configuration Claude

## Langue de communication
- Les conversations avec Claude se déroulent en français

## Détails du projet

### Convention de Jonglerie - Application Web Full-Stack

**Objectif :** Application de gestion et découverte de conventions de jonglerie permettant de consulter, ajouter, modifier des conventions et gérer les favoris.

**Technologies et Versions :**

**Frontend :**
- **Nuxt.js** v4.0.1 - Framework Vue.js universel
- **Vue.js** v3.5.17 - Framework JavaScript réactif
- **Nuxt UI** v3.3.0 - Composants UI avec Tailwind CSS
- **Pinia** v3.0.3 - Gestion d'état pour Vue.js
- **TypeScript** v5.8.3 - Langage typé

**Backend :**
- **Nitro** (intégré à Nuxt) - Moteur serveur pour API RESTful
- **Prisma** v6.12.0 - ORM pour base de données
- **MySQL** - Base de données relationnelle

**Authentification & Sécurité :**
 - Auth par session (nuxt-auth-utils) - Cookies de session scellés
- **bcryptjs** v3.0.2 - Hachage des mots de passe

**Outils de développement :**
- **ESLint** v9.32.0 - Linter JavaScript/TypeScript
- **Nuxt Test Utils** v3.19.2 - Tests
- **Nuxt Scripts** v0.11.10 & **Nuxt Image** v1.10.0 - Optimisations

**Architecture :**
- `app/` : Frontend Nuxt (pages, composants, stores)
- `server/api/` : API backend (auth, conventions)
- `prisma/` : Schéma DB et migrations
- Structure full-stack TypeScript moderne

## Documentation de référence

**Liens de documentation officiels :**
- **Nuxt 4.x** : https://nuxt.com/docs/4.x/getting-started/introduction
- **Nuxt 4.x Testing** : https://nuxt.com/docs/4.x/getting-started/testing
- **Nuxt UI** : https://ui.nuxt.com/getting-started
- **Nuxt i18n** : https://i18n.nuxtjs.org/docs/getting-started
- **Nuxt Icon** : https://nuxt.com/modules/icon
- **Nuxt Image** : https://image.nuxt.com/get-started/installation
- **Nuxt Prisma** : https://nuxt.com/modules/prisma
- **Prisma Nuxt Module (Documentation officielle)** : https://www.prisma.io/docs/orm/more/help-and-troubleshooting/prisma-nuxt-module
- **Nuxt ESLint** : https://eslint.nuxt.com/packages/module