# Configuration Claude

## Langue de communication

- Les conversations avec Claude se déroulent en français

## Règles importantes

- **NE JAMAIS lancer `npm run dev`** - Le serveur de développement est déjà en cours d'exécution
- **Pour lire les logs de l'application, utiliser `npm run docker:dev:logs`**
- **NE JAMAIS exécuter les migrations Prisma** - L'utilisateur s'occupe toujours de créer et d'appliquer les migrations. Fournir uniquement la commande de migration sans l'exécuter.
- **Niveau de log Prisma configurable** - Utiliser la variable d'environnement `PRISMA_LOG_LEVEL` dans `.env` pour ajuster les logs (valeurs: `error,warn` par défaut, `query,error,warn,info` pour verbose, `error` pour minimal)
- L'url de l'application en développement est : http://localhost:3000
- Avant de modifier un fichier, lis 3 autres fichiers pour comprendre le style de code et les conventions utilisées
- **A chaque fois que tu utilises un composant Nuxt UI, tu DOIS OBLIGATOIREMENT consulter sa documentation via le MCP Nuxt UI** (`mcp__nuxt-ui__get_component`) pour vérifier la syntaxe exacte des props, slots et événements avant de l'utiliser. Ne jamais deviner ou supposer l'API d'un composant.
- Toujours utiliser les composants Nuxt UI pour les éléments d'interface utilisateur courants (boutons, modals, cartes, etc.) au lieu de créer des composants personnalisés.
- Toujours utiliser les icônes de la bibliothèque Nuxt Icon pour les icônes (https://nuxt.com/modules/icon) et éviter d'importer des SVG ou d'utiliser des images pour les icônes.
- Toujours utiliser les classes utilitaires de Tailwind CSS pour le style et la mise en page
- Toujours écrire les documentations en français dans un répertoire `docs/` à la racine du projet.
- **Règle de traduction i18n** :
  - **De ta propre initiative** : Ne modifier QUE les fichiers français (`i18n/locales/fr/`). Ne JAMAIS remplir les autres langues spontanément.
  - **Avec la commande `/translate-todos`** : Tu DOIS traduire toutes les langues comme demandé dans la commande. Cette commande t'autorise explicitement à traduire.
  - **Nouvelles clés** : Les autres langues seront synchronisées automatiquement via `/check-i18n` et `/check-translations` en mode [TODO] pour traduction ultérieure.
  - **Modification de wording existant** : Lorsque tu modifies le libellé français d'une clé qui existe déjà dans d'autres langues, tu DOIS utiliser le script `npm run i18n:mark-todo` en mode automatique pour détecter et marquer automatiquement ces clés comme [TODO] dans toutes les autres langues. Le script détecte via `git diff` les clés modifiées. Exemple : `npm run i18n:mark-todo` (mode auto) ou `npm run i18n:mark-todo "clé1" "clé2"` (mode manuel)
- **Structure i18n avec lazy loading** : Les traductions sont organisées par domaine dans `i18n/locales/{langue}/`. Le système utilise un mapping intelligent basé sur la structure du français.
- **Règle de commit** : Ne commit jamais sans que la commande `/commit-push` ait été demandée
  - Exception : Si une commande slash (comme `/quality-check`) inclut explicitement `/commit-push` dans son workflow, alors le commit est autorisé
  - Toujours attendre l'instruction explicite de commit de l'utilisateur ou d'une commande slash qui l'inclut

## Détails du projet

### Convention de Jonglerie - Application Web Full-Stack

**Objectif :** Application de gestion et découverte de conventions de jonglerie permettant de consulter, ajouter, modifier des conventions et gérer les favoris.

**Technologies et Versions :**

**Frontend :**

- **Nuxt.js** v4.2.0 - Framework Vue.js universel
- **Vue.js** v3.5.17 - Framework JavaScript réactif
- **Nuxt UI** v4.0.0 - Composants UI avec Tailwind CSS
- **Pinia** v3.0.3 - Gestion d'état pour Vue.js
- **TypeScript** v5.8.3 - Langage typé
- **Nuxt i18n** v10.0.3 - Internationalisation
- **VueUse** v13.6.0 - Collection d'utilitaires Vue

**Backend :**

- **Nitro** (intégré à Nuxt) - Moteur serveur pour API RESTful
- **Prisma** v6.18.0 - ORM pour base de données
- **MySQL** - Base de données relationnelle

**Authentification & Sécurité :**

- **nuxt-auth-utils** v0.5.23 - Auth par session avec cookies scellés
- **bcryptjs** v3.0.2 - Hachage des mots de passe

**Visualisation & UI :**

- **Chart.js** v4.5.1 - Graphiques et visualisations
- **FullCalendar** v6.1.15+ - Calendrier interactif
- **Nuxt QRCode** v0.4.8 - Génération de QR codes

**Outils de développement :**

- **ESLint** v9.32.0 - Linter JavaScript/TypeScript
- **Nuxt Test Utils** v3.19.2 - Tests
- **Vitest** v3.2.4 - Framework de tests
- **Nuxt Scripts** v0.11.10 & **Nuxt Image** v1.10.0 - Optimisations
- **Prettier** v3.3.3 - Formatage de code

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
- **Nuxt UI components** : https://ui.nuxt.com/components
- **Nuxt UI select** : https://ui.nuxt.com/components/select
- **Nuxt UI modal** : https://ui.nuxt.com/components/modal
- **Nuxt UI button group** : https://ui.nuxt.com/components/button-group
- **Nuxt UI formfield** : https://ui.nuxt.com/components/formfield
- **Nuxt i18n** : https://i18n.nuxtjs.org/docs/getting-started
- **Nuxt Icon** : https://nuxt.com/modules/icon
- **Nuxt Image** : https://image.nuxt.com/get-started/installation
- **Nuxt Prisma** : https://nuxt.com/modules/prisma
- **Prisma Nuxt Module (Documentation officielle)** : https://www.prisma.io/docs/orm/more/help-and-troubleshooting/prisma-nuxt-module
- **Nuxt ESLint** : https://eslint.nuxt.com/packages/module

## Commandes utiles

**Scripts de développement :**

- `npm run dev` : Lancer le serveur de développement
- `npm run build` : Construire l'application pour la production
- `npm run preview` : Prévisualiser la version de production
- `npm run lint` : Vérifier le code avec ESLint
- `npm run db:seed:dev` : Peupler la base de données avec des données de développement

**Scripts Docker pour le développement :**

- `npm run docker:dev` : Environnement de développement (build + up)
- `npm run docker:dev:detached` : Environnement de développement en mode détaché
- `npm run docker:dev:down` : Arrêter les services de développement
- `npm run docker:dev:logs` : Afficher les logs de l'application
- `npm run docker:dev:exec` : Ouvrir un shell dans le conteneur de l'application

**Scripts de traduction i18n :**

- `npm run check-i18n` : Analyse clés manquantes/inutilisées/dupliquées/hardcodées (compatible avec la structure lazy loading)
- `npm run check-translations` : Compare les traductions entre locales

**Note importante sur l'i18n :**

- Les traductions sont organisées par domaine dans `i18n/locales/{langue}/{domaine}.json`
- Domaines : `common`, `admin`, `edition`, `auth`, `public`, `components`, `app`
- Le lazy loading charge automatiquement les traductions selon les routes (voir `docs/i18n-lazy-loading.md`)
- Le script `scripts/check-i18n.js` fusionne automatiquement tous les fichiers pour l'analyse

## Commandes Claude personnalisées

**Commande `/lint-fix` :**

Processus de correction automatique complet qui :

1. **Correction automatique**

   ```bash
   npm run lint -- --fix
   ```

2. **Analyse des erreurs restantes** (seulement si nécessaire)

   ```bash
   npm run lint
   ```

3. **Correction manuelle** (si des erreurs persistent)
   Correction manuelle des erreurs qui ne peuvent pas être auto-corrigées.

4. **Formatage du code** (TOUJOURS exécuté à la fin)
   ```bash
   npm run format
   ```

**Commande `/run-tests` :**

Processus d'exécution des tests complet qui :

1. **Exécution des tests unitaires**

   ```bash
   npm run test:unit:run
   ```

2. **Exécution des tests Nuxt**

   ```bash
   npm run test:nuxt:run
   ```

3. **Analyse et correction des erreurs** (si des tests échouent)
   Analyse des erreurs de tests et correction manuelle des problèmes identifiés.

**Commande `/quality-check` :**

Processus complet de vérification de la qualité du code avant commit qui enchaîne :

1. **Lint et correction** - Exécute `/lint-fix`
2. **Tests** - Exécute `/run-tests`
3. **Commit et push** - Exécute `/commit-push` si tout est OK

Cette commande s'arrête si une étape échoue.

## Components Nuxt UI utilisés

- **UButton** : Boutons réutilisables avec différentes variantes
- **UModal** : Composant modal pour les overlays
- **UPagination** : Composant de pagination pour la navigation dans les listes
- **UCard** : Composant de carte pour afficher les éditions
- **UBadge** : Composant d'étiquette pour afficher les compteurs
- **UInput** : Composant d'entrée pour les formulaires
- **USelect** : Composant de sélection déroulante
- **UTextarea** : Composant de zone de texte pour les formulaires
- **UFormField** : Composant de champ de formulaire avec étiquette et validation
- **UFieldGroup** : Composant de groupe de boutons pour les sélections multiples
- **UdropdownMenu** : Composant de menu déroulant pour les actions

A Chaque fois que tu ajoutes un nouveau component Nuxt UI, ajoute-le à cette liste.
