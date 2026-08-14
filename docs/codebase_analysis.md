# Analyse complète de la base de code — Convention de Jonglerie

> Rapport de la skill `/analyze-codebase`, mis à jour le **2026-08-14**.
> Remplace la version du 2026-05-24, antérieure à la migration monorepo — celle-ci ne
> mentionnait ni `apps/`, ni `layers/`, ni le découplage par ports, qui structurent
> aujourd'hui l'essentiel du dépôt.

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Arborescence : rôle de chaque niveau](#2-arborescence--rôle-de-chaque-niveau)
3. [Décomposition par catégorie de fichiers](#3-décomposition-par-catégorie-de-fichiers)
4. [Surface d'API](#4-surface-dapi)
5. [Architecture en profondeur](#5-architecture-en-profondeur)
6. [Environnement, développement et déploiement](#6-environnement-développement-et-déploiement)
7. [Stack technique](#7-stack-technique)
8. [Diagrammes](#8-diagrammes)
9. [Constats et recommandations](#9-constats-et-recommandations)

---

## 1. Vue d'ensemble

### Nature du projet

Application web **full-stack** de gestion et de découverte de **conventions de jonglerie**, servant trois publics :

- **participants** — découverte, favoris, covoiturage, candidatures bénévoles et artistes, billetterie, workshops ;
- **organisateurs** — CRUD conventions/éditions et administration d'une dizaine de modules optionnels ;
- **super-administrateurs** — modération, journaux d'erreur, retours utilisateurs, import assisté par IA.

### Ce qui caractérise l'architecture

Trois traits la distinguent d'un monolithe Nuxt ordinaire :

1. **Monorepo à deux applications.** `apps/app1` porte l'application jonglerie ; `apps/app2` est une seconde application (événements génériques, ~190 fichiers) partageant les mêmes fondations.
2. **Onze layers Nuxt partagés** à la racine (`layers/`), consommés par `extends` dans la configuration d'app1. Chaque layer embarque ses pages, composants, endpoints — et, pour les bénévoles, ses propres traductions.
3. **Découplage par ports.** Neuf modules du cœur (`server/<module>/ports/`) exposent des interfaces (`types.ts`), un registre et un câblage par défaut. C'est ce qui a rendu l'extraction en layers possible sans dupliquer la logique métier.

### Volumétrie

| Élément                | Nombre                                                |
| ---------------------- | ----------------------------------------------------- |
| Endpoints API (app1)   | 275                                                   |
| Endpoints API (layers) | 215                                                   |
| Pages Vue (app1)       | 77                                                    |
| Composants (app1)      | 92                                                    |
| Composables            | 46                                                    |
| Utilitaires serveur    | 105                                                   |
| Modèles Prisma         | 105, répartis sur 15 fichiers de schéma               |
| Migrations             | 51                                                    |
| Langues                | 13                                                    |
| Fichiers de test       | 341 (65 unit, 221 Nuxt, 8 intégration, 47 Playwright) |
| Documentation          | 90 fichiers Markdown                                  |

### Langages et versions

TypeScript 5.9, Node 24 en CI, Nuxt 4.5 avec `compatibilityVersion: 5` (préparation à Nuxt 5), Prisma 7.9, Vue 3.

---

## 2. Arborescence : rôle de chaque niveau

```
convention-de-jonglerie/
├── apps/
│   ├── app1/          ← l'application jonglerie (le cœur historique)
│   └── app2/          ← seconde application, événements génériques
├── layers/            ← 11 layers Nuxt partagés entre les apps
├── docs/              ← 90 documents techniques, indexés par docs/README.md
├── .claude/skills/    ← skills d'automatisation (pipeline, déploiement, i18n…)
└── .github/workflows/ ← CI : tests.yml et playwright.yml
```

### `apps/app1` — l'application

| Dossier                  | Rôle                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `app/`                   | Frontend : `pages/`, `components/`, `composables/`, `stores/` (5 stores Pinia), `middleware/`, `layouts/`, `utils/` |
| `server/api/`            | 275 endpoints REST, organisés par ressource                                                                         |
| `server/utils/`          | 105 helpers : permissions, Prisma, notifications, emails, validation                                                |
| `server/<module>/ports/` | Interfaces de découplage pour 9 modules                                                                             |
| `server/middleware/`     | CSRF (`00.csrf.ts`), auth, entêtes de cache, `noindex`                                                              |
| `shared/`                | Code partagé client/serveur — c'est là que vivent les règles testables sans base                                    |
| `prisma/schema/`         | Schéma découpé en 15 fichiers par domaine                                                                           |
| `i18n/locales/`          | 13 langues × 26 domaines                                                                                            |
| `scripts/`               | Outillage : i18n, géocodage, administration, traduction                                                             |

### `layers/` — les modules extraits

| Layer        | Endpoints | Composants Vue | Particularité                                              |
| ------------ | --------- | -------------- | ---------------------------------------------------------- |
| `ticketing`  | 66        | 43             | Le plus gros : tarifs, quotas, commandes, HelloAsso/SumUp  |
| `volunteers` | 46        | 37             | Le seul à porter ses **propres traductions** (26 fichiers) |
| `tasks`      | 21        | 10             | Kanban et listes                                           |
| `carpool`    | 19        | 14             | Offres, demandes, réservations                             |
| `stock`      | 14        | 10             | Inventaire et réservations                                 |
| `artists`    | 11        | 13             | Spectacles, cabarets, numéros                              |
| `auth`       | 11        | 7              | Sessions, OAuth Google/Facebook                            |
| `workshops`  | 11        | 3              | Ateliers participants                                      |
| `meals`      | 7         | 4              | Repas bénévoles et artistes                                |
| `faq`        | 5         | 3              | Questions/réponses publiques                               |
| `lost-found` | 4         | 2              | Objets trouvés                                             |

**Point d'attention** : seul le layer `volunteers` possède un dossier `i18n/`. Les dix autres déposent leurs clés dans `apps/app1/i18n/`. Cette asymétrie a un coût concret, documenté au §9.

---

## 3. Décomposition par catégorie de fichiers

### Cœur applicatif

- `apps/app1/nuxt.config.ts` — 16 modules Nuxt, `extends` des 11 layers, configuration i18n en lazy loading, en-têtes de sécurité.
- `apps/app1/server/api/**` — un fichier par verbe HTTP (`index.get.ts`, `[id].put.ts`…), convention Nitro.
- `apps/app1/server/utils/permissions/` — le modèle de droits granulaires, sans rôles.
- `apps/app1/shared/utils/` — règles métier pures : frise du programme, fuseaux horaires, import IA, découpage en journées. **C'est le code le mieux testé du dépôt**, précisément parce qu'il ne dépend ni du réseau ni de la base.

### Configuration

- `package.json` racine — proxy vers les apps, scripts préfixés `app1:` / `app2:`. Le double `npm run` avale les arguments : pour en passer, lancer depuis `apps/app1`.
- `vitest.config.ts` — quatre projets : `unit`, `nuxt`, `e2e`, `integration`.
- `eslint.config.js`, configuration Prettier dans `apps/app1/package.json` — **les fichiers hors `apps/app1` exigent `--config` explicite**.

### Données

- 15 fichiers de schéma Prisma, du plus gros au plus petit : `ticketing` (24 modèles), `schema` (14), `artists`/`volunteers`/`misc` (9), `meals` (8), `tasks` (7), `carpool` (6), `project-costs` (5), `stock`/`messenger`/`workshops`/`treasury` (3), `faq`/`program` (1).
- 51 migrations, dont plusieurs **écrites à la main** avec leur justification en commentaire — la convention du dépôt quand une opération est destructive ou qu'un `MODIFY` naïf fausserait les données.

### Frontend

77 pages, 92 composants, 46 composables. Le composable `useApiAction` est la voie normale pour tout appel API : il gère l'état de chargement, les toasts et les redirections. Les composants Nuxt UI sont la règle ; les icônes viennent de Nuxt Icon.

### Tests

| Projet Vitest      | Fichiers | Ce qu'il couvre                                    |
| ------------------ | -------- | -------------------------------------------------- |
| `unit`             | 65       | Utilitaires purs, `shared/`, validation            |
| `nuxt`             | 221      | Endpoints et composants dans un environnement Nuxt |
| `integration`      | 8        | Parcours avec base de données réelle               |
| `e2e` (Playwright) | 47       | Parcours navigateur                                |

### DevOps

- Neuf fichiers `docker-compose` pour app1 : développement, release, production, et cinq variantes de test.
- `apps/app1/docker/entrypoint.sh` — point d'entrée **release et production** : `set -e` puis `prisma migrate deploy` avant de démarrer Nuxt. Une migration en échec arrête le conteneur.
- `apps/app1/scripts/docker-start.sh` — point d'entrée **développement** uniquement (il finit par `npm run dev`, et n'a pas de `set -e`).

---

## 4. Surface d'API

### Répartition (app1)

| Domaine                                                | Endpoints |
| ------------------------------------------------------ | --------- |
| `editions`                                             | 106       |
| `admin`                                                | 78        |
| `conventions`                                          | 21        |
| `messenger`                                            | 15        |
| `profile`                                              | 14        |
| `notifications`                                        | 12        |
| `files`                                                | 6         |
| autres (`project-costs`, `survey`, `public`, `users`…) | 23        |

À quoi s'ajoutent les **215 endpoints des layers**, montés dans le même espace de routes.

### Authentification et autorisation

- **Sessions scellées par cookie** via `nuxt-auth-utils`.
- **CSRF en double soumission** : middleware `00.csrf.ts`, cookie `csrf_token` + en-tête `x-csrf-token` sur toute mutation. Des routes sont exemptées de la validation tout en recevant le cookie.
- **Routes publiques déclarées** dans `server/constants/public-routes.ts`. Un endpoint `/api/**` absent de cette liste répond 401, même si son handler ne demande rien — piège classique lors de l'ajout d'un endpoint public.
- **Permissions granulaires sans rôles** : 14 droits sur `ConventionOrganizer`, doublés par une table `EditionOrganizerPermission` pour les accorder édition par édition. Le super-admin et le créateur d'une édition court-circuitent la matrice.

### Conventions de forme

Réponses enveloppées (`{ success, data }`) pour les endpoints récents, handlers enrobés par `wrapApiHandler` (journalisation, erreurs). Pas de versionnage d'API : le client et le serveur étant déployés ensemble, la compatibilité ascendante n'est pas un objectif.

---

## 5. Architecture en profondeur

### Le motif « ports », clé de la modularisation

Neuf modules exposent des ports :

```
server/volunteers/ports/
├── types.ts            ← interfaces (ce dont le module a besoin du cœur)
├── registry.ts         ← registre d'implémentations
└── default-binding.ts  ← câblage vers les services concrets
```

L'intention, lisible dans les commentaires : _« À l'extraction en layer, ce fichier reste côté app ; le layer ne garde que les interfaces et le registre. »_ Le module bénévole peut ainsi notifier, envoyer un email ou lire les repas sans connaître l'implémentation de l'application hôte. C'est ce qui permet à `app2` de réutiliser un layer avec un câblage différent.

### Cycle d'une requête

```
Navigateur
   │  (SSR ou fetch client)
   ▼
Nitro ── 00.csrf.ts ── auth.ts ── cache-headers ── noindex
   │
   ▼
server/api/<ressource>/<verbe>.ts
   │  wrapApiHandler → requireAuth → permissions → validation zod
   ▼
Prisma 7 ──▶ MySQL / MariaDB
```

Le frontend passe systématiquement par `useApiAction`, qui centralise chargement, toasts et redirections.

### Temps réel

SSE pour les notifications, la messagerie et la présence ; WebSocket Nitro pour le HMR. Firebase Admin assure les notifications push.

### Internationalisation

13 langues, 26 domaines, chargement paresseux par route (`app/utils/translation-loaders.ts`). Le namespace d'un fichier vient de sa **structure JSON**, pas de son nom : `gestion-tasks.json` contient `{ gestion: { task } }` et alimente donc `gestion.task.*`.

### Fuseaux horaires

Traitement récemment unifié dans `shared/utils/fuseau-edition.ts` : les horaires de programme sont des **heures de lieu**, ancrées dans le fuseau de l'édition — ni celui du serveur (UTC en conteneur), ni celui du lecteur. Une journée de programme bascule à 3 h du matin, pour que les fins de soirée restent rattachées au jour vécu.

---

## 6. Environnement, développement et déploiement

### Variables essentielles

`DATABASE_URL`, `NUXT_SESSION_PASSWORD` (≥ 32 caractères, obligatoire en production), `SEND_EMAILS` + `SMTP_*`, les clés Firebase, reCAPTCHA, les webhooks Portainer, `BROWSERLESS_URL` pour le scraping, et la configuration IA (`PRISMA_LOG_LEVEL`, providers).

### Développement

Tout tourne dans Docker (`npm run app1:docker:dev`). Deux règles de terrain, apprises à l'usage :

- **Les tests Nuxt doivent être lancés dans le conteneur.** Sur l'hôte, une vingtaine de tests d'endpoints échouent parce que `.nuxt` appartient à root via le bind-mount.
- **Les tests d'intégration ne doivent jamais y être lancés** : `TEST_WITH_DB` y vise `DATABASE_URL` et viderait la base de développement.

### Migrations

Le workflow habituel veut que l'utilisateur crée et applique les migrations. `prisma migrate dev` se lance **depuis l'hôte** — la shadow database n'est joignable que par le port 3308 — et refuse le mode non interactif dès qu'une suppression touche des données. Dans ce cas, la convention du dépôt est d'écrire la migration à la main, puis de l'appliquer par `migrate deploy` et de vérifier l'absence de dérive avec `migrate diff`.

### Déploiement

Deux environnements, déclenchés par webhook Portainer : **release** (`test.juggling-convention.com`) et **production** (`juggling-convention.com`). Les piles sont adossées au dépôt Git : le webhook récupère puis **construit sur place** — aucune image n'est publiée dans un registre.

Le webhook renvoie 204 sans rien prouver. La vérification fiable est `/_nuxt/builds/latest.json` : l'identifiant de build est déterministe par commit, et les deux environnements sur le même commit affichent le même. `entrypoint.sh` appliquant les migrations avant de démarrer, **un déploiement migre la production sans confirmation**.

---

## 7. Stack technique

| Couche        | Technologie                             | Version     |
| ------------- | --------------------------------------- | ----------- |
| Framework     | Nuxt                                    | 4.5         |
| Vue           | Vue 3                                   | 3.5         |
| UI            | Nuxt UI (Tailwind)                      | 4.8         |
| État          | Pinia                                   | 3.0         |
| i18n          | @nuxtjs/i18n                            | 10.2        |
| ORM           | Prisma                                  | 7.9         |
| Base          | MySQL / MariaDB                         | 8.0         |
| Auth          | nuxt-auth-utils + bcryptjs              | 0.5 / 3.0   |
| Validation    | Zod                                     | 4.3         |
| Dates         | Luxon                                   | 3.7         |
| Visualisation | Chart.js, FullCalendar, Leaflet         | 4.5 / 6.1   |
| Emails        | Nodemailer + Vue Email                  | 8.0         |
| Push          | Firebase / Firebase Admin               | 12.9 / 13.6 |
| Tests         | Vitest + Playwright                     | 4.1 / 1.58  |
| Qualité       | ESLint 10, Prettier 3.8, TypeScript 5.9 |             |

---

## 8. Diagrammes

### Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│                        MONOREPO                              │
│                                                              │
│   apps/app1 (jonglerie)          apps/app2 (événements)      │
│        │                               │                     │
│        └───────────┬───────────────────┘                     │
│                    │ extends                                 │
│         ┌──────────▼──────────────────────────────┐          │
│         │  layers/ — 11 modules Nuxt partagés      │          │
│         │  ticketing · volunteers · tasks ·        │          │
│         │  carpool · stock · artists · auth ·      │          │
│         │  workshops · meals · faq · lost-found    │          │
│         └──────────┬──────────────────────────────┘          │
└────────────────────┼─────────────────────────────────────────┘
                     │ ports (interfaces + registre)
                     ▼
        ┌────────────────────────────┐
        │  Cœur : services, emails,  │
        │  notifications, permissions│
        └────────────┬───────────────┘
                     ▼
              Prisma 7 → MySQL
```

### Flux d'une requête authentifiée

```
Navigateur ──▶ Nitro
                 │
                 ├─ 00.csrf.ts        (double soumission)
                 ├─ auth.ts           (session scellée)
                 ├─ public-routes.ts  (401 si non déclarée)
                 │
                 ▼
          wrapApiHandler
                 │
                 ├─ requireAuth
                 ├─ canManage* / canEdit*   ← droits convention OU per-édition
                 ├─ zod                     ← validation du corps
                 │
                 ▼
              Prisma ──▶ MySQL
```

### Chaîne de livraison

```
commit ─▶ PR ─▶ CI (9 jobs : setup, lint, typecheck, build,
                    unit, nuxt, e2e, database, playwright)
              │
              ▼ merge squash
            main
              │
              ▼ webhook Portainer
     ┌────────┴────────┐
  release            production
     │                  │
     └── entrypoint.sh : set -e → prisma migrate deploy → Nuxt
```

---

## 9. Constats et recommandations

### Ce qui est solide

- **La modularisation par ports puis layers** est aboutie et documentée étape par étape (`docs/etape-0` à `etape-4`). Elle a permis une seconde application sans duplication.
- **Le code partagé (`shared/`) est testable sans base ni réseau**, et c'est le mieux couvert du dépôt. Les règles délicates — fuseaux, appariement d'import, frise — y vivent avec leurs tests.
- **Les commentaires expliquent le pourquoi**, y compris dans les migrations SQL écrites à la main. C'est rare et précieux.
- **La CI est complète** : neuf jobs dont typecheck, base de données réelle et Playwright.

### Points d'attention, par ordre d'importance

**1. L'outillage i18n ne voyait pas les layers — corrigé, mais l'asymétrie demeure.**
Seul `volunteers` porte ses traductions ; les dix autres layers déposent leurs clés dans `apps/app1/i18n/`. Cette incohérence rend le placement d'une nouvelle clé arbitraire. À trancher : soit chaque layer porte ses traductions, soit aucun.

**2. `check-i18n` produit des faux positifs massifs.**
529 clés « manquantes » viennent des blocs `<i18n>` locaux des pages guide, et la détection des clés « inutilisées » ignore les clés construites dynamiquement (`$t(\`prefix\_${x}\`)`). Lancer `--delete-unused` sans vérifier casserait des écrans. Un mécanisme d'annotation (`// i18n-dynamic`) fiabiliserait l'outil.

**3. Le typecheck est inexploitable dans le conteneur de développement.**
2 316 erreurs, dont `@prisma/client has no exported member 'Prisma'` et des références de projet tsconfig — d'origine environnementale. La CI reste le seul juge, ce qui allonge la boucle de retour. Purger `.nuxt` et régénérer le client localement mériterait d'être documenté comme procédure.

**4. `npm run format` ne couvre pas les `.cjs`.**
`scripts/check-i18n-variables.cjs` est hors format depuis longtemps. Ajouter l'extension au motif éviterait la dérive.

**5. `format:check` n'est pas dans la CI.**
Seul ESLint y tourne. Des lignes non formatées ont déjà été mergées. Un job supplémentaire coûterait quelques secondes.

**6. Les parcours de modale ne sont pas testés.**
Le formulaire de candidature bénévole — l'un des plus complexes, avec ses watchers et son hydratation — n'a aucun test automatisé. Trois défauts d'affichage y ont été trouvés récemment par lecture et simulation, non par la suite de tests. Un test de composant sur l'hydratation serait le meilleur rapport valeur/effort du dépôt.

**7. Du travail mort subsiste après les suppressions récentes.**
Les invites du modèle et l'import d'édition ont été nettoyés, mais ce type de résidu réapparaît à chaque retrait de fonctionnalité. Une recherche systématique des écritures sans lecture, à chaque suppression, l'éviterait.

### Sécurité

Le socle est correct : CSRF en double soumission, sessions scellées, `nuxt-security`, routes publiques déclarées explicitement, vérification que zones et repères appartiennent bien à l'édition visée. Deux vigilances :

- la liste `public-routes.ts` est une **liste blanche manuelle** : un oubli fait échouer un endpoint public en 401, et l'inverse — une entrée trop large — exposerait des données ;
- les tests d'endpoints contournent le middleware, donc ne détectent ni l'un ni l'autre.

### Performance

Le chargement paresseux de l'i18n par route est bien pensé. La duplication `apps/app1/.nuxt` et `.nuxt` racine gonfle le dépôt (220 Mo, 115 000 fichiers) sans nuire à l'exécution. Les requêtes Prisma passent par des helpers de sélection standardisés (`prisma-select-helpers.ts`) — bonne pratique déjà en place, à maintenir.
