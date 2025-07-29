# Convention de Jonglerie - Application Web

Ce projet est une application web complète (full-stack) dédiée à la gestion et à la découverte de conventions de jonglerie.

## Objectif du Projet

L'application permet aux utilisateurs de :
*   Consulter une liste de conventions de jonglerie.
*   Ajouter de nouvelles conventions avec des détails complets.
*   Modifier et supprimer les conventions qu'ils ont créées.
*   Marquer des conventions comme favorites.
*   Gérer leur profil utilisateur (inscription, connexion, déconnexion).

## Technologies Utilisées

*   **Frontend :**
    *   [Nuxt.js](https://nuxt.com/) (v4.0.1) : Framework Vue.js pour le développement d'applications universelles.
    *   [Nuxt UI](https://ui.nuxt.com/) (v3.3.0) : Bibliothèque de composants UI basée sur Tailwind CSS et Headless UI.
    *   [Pinia](https://pinia.vuejs.org/) : Solution de gestion d'état pour Vue.js.
*   **Backend :**
    *   [Nitro](https://nitro.unjs.io/) : Moteur de serveur de Nuxt.js pour la création d'API RESTful.
*   **Base de Données :**
    *   MySQL : Système de gestion de base de données relationnelle.
    *   [Prisma](https://www.prisma.io/) : ORM (Object-Relational Mapper) pour interagir avec la base de données.
*   **Langage :**
    *   [TypeScript](https://www.typescriptlang.org/) : Langage de programmation typé pour une meilleure maintenabilité.
*   **Authentification :**
    *   JWT (JSON Web Tokens) : Mécanisme d'authentification sécurisé.

## Fonctionnalités Clés

*   **Gestion des Utilisateurs :** Inscription, connexion, déconnexion, et gestion des profils.
*   **Gestion des Conventions :**
    *   **CRUD complet :** Création, lecture, mise à jour et suppression de conventions.
    *   **Détails riches :** Nom, description, dates, adresse complète, liens externes (billetterie, réseaux sociaux), et services disponibles (restauration, zone enfants, animaux, camping, salle de sport).
    *   **Filtrage :** Recherche et filtrage des conventions par nom et dates.
    *   **Géolocalisation :** Géocodage automatique des adresses pour affichage sur carte.
*   **Favoris :** Possibilité pour les utilisateurs authentifiés de marquer des conventions comme favorites.
*   **Carte Interactive :** Visualisation géographique des éditions favorites à venir avec Leaflet.
*   **Interface Utilisateur :** Navigation intuitive et réactive, notifications via toasts.
*   **Sécurité :** Middleware d'authentification pour protéger les routes et les API.

## Structure du Projet

*   `app/` : Contient le code source du frontend Nuxt.js (pages, composants, stores Pinia, middleware).
*   `server/api/` : Définit les points de terminaison de l'API backend pour l'authentification et la gestion des conventions.
*   `prisma/` : Contient le schéma de base de données Prisma (`schema.prisma`) et les migrations.
*   `public/` : Fichiers statiques (ex: favicon).

## Démarrage Rapide

Assurez-vous d'avoir Node.js, npm (ou pnpm, yarn, bun) et MySQL installés.

1.  **Cloner le dépôt :**
    ```bash
    git clone <URL_DU_DEPOT>
    cd convention-de-jonglerie-gemini-code
    ```

2.  **Installation des dépendances :**
    ```bash
    npm install
    # ou pnpm install / yarn install / bun install
    ```

3.  **Configuration de la base de données :**
    *   Créez un fichier `.env` à la racine du projet et configurez votre `DATABASE_URL` et `JWT_SECRET`.
        ```env
        DATABASE_URL="mysql://user:password@host:port/database_name"
        JWT_SECRET="votre_secret_jwt_tres_securise"
        ```
    *   Appliquez les migrations Prisma pour créer la base de données et les tables :
        ```bash
        npx prisma migrate dev
        ```
    *   Générez le client Prisma :
        ```bash
        npx prisma generate
        ```

4.  **Lancer le serveur de développement :**
    ```bash
    npm run dev
    # ou pnpm dev / yarn dev / bun run dev
    ```
    L'application sera accessible sur `http://localhost:3000`.

## Build pour la Production

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

## Prévisualisation de la Production (localement)

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Pour plus d'informations sur le déploiement, consultez la [documentation Nuxt](https://nuxt.com/docs/getting-started/deployment).
