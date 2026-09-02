# Analyse complète de la base de code — Convention de Jonglerie

> Rapport de la skill `/analyze-codebase`, mis à jour le **2026-09-02**.
> Actualise la version du 2026-08-28 : volumétrie remesurée après vingt-cinq lots livrés, deux
> constats **résolus** (§9) et trois enseignements nouveaux, tous tirés de défauts réels — un
> contrat d'API ambigu, une stratégie « supprimer puis recréer » qui invalidait des
> identifiants, et un client qui réessayait un refus d'autorisation. L'architecture — monorepo,
> layers, ports — n'a pas bougé.

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
10. [Ce qui a bougé](#10-ce-qui-a-bougé)
11. [Par où commencer, pour qui arrive](#11-par-où-commencer-pour-qui-arrive)

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

| Élément                | Nombre                                                | Δ depuis le 28 août |
| ---------------------- | ----------------------------------------------------- | ------------------- |
| Endpoints API (app1)   | 282                                                   | +1                  |
| Endpoints API (layers) | 220                                                   | —                   |
| Pages Vue (app1)       | 79                                                    | —                   |
| Pages Vue (layers)     | 51                                                    | —                   |
| Composants (app1)      | 98                                                    | —                   |
| Composants (layers)    | 101                                                   | —                   |
| Composables            | 60                                                    | **+11**             |
| Utilitaires serveur    | 112                                                   | **+22**             |
| Modèles Prisma         | 108, répartis sur 15 fichiers de schéma               | —                   |
| Migrations             | 64                                                    | —                   |
| Langues                | 13                                                    | —                   |
| Fichiers de test       | 400 (88 unit, 252 Nuxt, 8 intégration, 51 Playwright) | +6                  |
| Tests exécutés         | 3 601 (1 380 unitaires, 2 221 Nuxt)                   | **+83**             |
| Clés i18n (fr)         | 4 630 — **0 manquante, 0 inutilisée**                 | −3 clés mortes      |
| Documentation          | 91 fichiers Markdown                                  | —                   |
| Dépôt (hors artefacts) | 131 Mo                                                | —                   |

Vingt-cinq lots livrés en cinq jours, mais la volumétrie bouge peu : l'essentiel du travail a
porté sur des **corrections** et sur l'outillage, non sur de nouvelles surfaces. Les onze
composables et vingt-deux utilitaires serveur supplémentaires viennent surtout d'extractions —
du code déplacé pour être partagé, pas ajouté.

Le chiffre le plus parlant est ailleurs : **0 clé i18n manquante et 0 inutilisée**, là où le
rapport en annonçait 529 et 44 il y a cinq jours (§9).

### Langages et versions

TypeScript 5.9, Node contraint à `>=22 <26`, Nuxt 4.5 avec `compatibilityVersion: 5`
(préparation à Nuxt 5), Prisma 7.9, Vue 3.

---

## 2. Arborescence : rôle de chaque niveau

```
convention-de-jonglerie/
├── apps/
│   ├── app1/          ← l'application jonglerie (le cœur historique)
│   └── app2/          ← seconde application, événements génériques
├── layers/            ← 11 layers Nuxt partagés entre les apps
├── docs/              ← 91 documents techniques, indexés par docs/README.md
├── .claude/skills/    ← skills d'automatisation (pipeline, déploiement, i18n…)
└── .github/workflows/ ← CI : tests.yml et playwright.yml
```

### `apps/app1` — l'application

| Dossier                  | Rôle                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `app/`                   | Frontend : `pages/`, `components/`, `composables/`, `stores/` (5 stores Pinia), `middleware/`, `layouts/`, `utils/` |
| `server/api/`            | 282 endpoints REST, organisés par ressource                                                                         |
| `server/utils/`          | 90 helpers : permissions, Prisma, notifications, emails, validation                                                 |
| `server/<module>/ports/` | Interfaces de découplage pour 9 modules                                                                             |
| `server/middleware/`     | CSRF (`00.csrf.ts`), auth, entêtes de cache, `noindex`                                                              |
| `shared/`                | Code partagé client/serveur — c'est là que vivent les règles testables sans base                                    |
| `prisma/schema/`         | Schéma découpé en 15 fichiers par domaine                                                                           |
| `i18n/locales/`          | 13 langues × 26 domaines                                                                                            |
| `scripts/`               | Outillage : i18n, géocodage, administration, traduction                                                             |

### `layers/` — les modules extraits

| Layer        | Endpoints | Composants | Pages | Particularité                                              |
| ------------ | --------- | ---------- | ----- | ---------------------------------------------------------- |
| `ticketing`  | 66        | 34         | 9     | Le plus gros : tarifs, quotas, commandes, HelloAsso/SumUp  |
| `volunteers` | 47        | 29         | 9     | Le seul à porter ses **propres traductions** (26 fichiers) |
| `tasks`      | 21        | 8          | 2     | Kanban et listes                                           |
| `carpool`    | 19        | 11         | 3     | Offres, demandes, réservations                             |
| `artists`    | 15        | 8          | 9     | Spectacles, représentations, numéros de cabaret            |
| `stock`      | 14        | 7          | 3     | Inventaire et réservations                                 |
| `auth`       | 11        | 1          | 7     | Sessions, OAuth Google/Facebook                            |
| `workshops`  | 11        | 1          | 2     | Ateliers participants                                      |
| `meals`      | 7         | 1          | 3     | Repas bénévoles et artistes                                |
| `faq`        | 5         | 1          | 2     | Questions/réponses publiques                               |
| `lost-found` | 4         | 0          | 2     | Objets trouvés                                             |

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
- 64 migrations, dont plusieurs **écrites à la main** avec leur justification en commentaire — la convention du dépôt quand une opération est destructive ou qu'un `MODIFY` naïf fausserait les données.

### Frontend

79 pages, 98 composants, 49 composables (côté app1 ; les layers en ajoutent 51 et 101). Le composable `useApiAction` est la voie normale pour tout appel API : il gère l'état de chargement, les toasts et les redirections. Les composants Nuxt UI sont la règle ; les icônes viennent de Nuxt Icon.

### Tests

| Projet Vitest      | Fichiers | Ce qu'il couvre                                    |
| ------------------ | -------- | -------------------------------------------------- |
| `unit`             | 87       | Utilitaires purs, `shared/`, validation            |
| `nuxt`             | 248      | Endpoints et composants dans un environnement Nuxt |
| `integration`      | 8        | Parcours avec base de données réelle               |
| `e2e` (Playwright) | 51       | Parcours navigateur                                |

### DevOps

- Neuf fichiers `docker-compose` pour app1 : développement, release, production, et cinq variantes de test.
- `apps/app1/docker/entrypoint.sh` — point d'entrée **release et production** : `set -e` puis `prisma migrate deploy` avant de démarrer Nuxt. Une migration en échec arrête le conteneur.
- `apps/app1/scripts/docker-start.sh` — point d'entrée **développement** uniquement (il finit par `npm run dev`, et n'a pas de `set -e`).

---

## 4. Surface d'API

### Répartition (app1)

| Domaine                                                | Endpoints |
| ------------------------------------------------------ | --------- |
| `editions`                                             | 108       |
| `admin`                                                | 80        |
| `conventions`                                          | 21        |
| `messenger`                                            | 16        |
| `profile`                                              | 14        |
| `notifications`                                        | 12        |
| `files`                                                | 6         |
| autres (`project-costs`, `survey`, `public`, `users`…) | 24        |

À quoi s'ajoutent les **220 endpoints des layers**, montés dans le même espace de routes.

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
- **Les tests d'intégration ne doivent jamais y être lancés** : `TEST_WITH_DB` y vise `DATABASE_URL` et viderait la base de développement. La prudence vaut aussi **sur l'hôte** : `scripts/migrate-test.js` retombe sur `DATABASE_URL` quand la variable est déjà définie, et le `.env` du dépôt pointe vers la base de développement. Le conteneur de test porte de surcroît le même nom que celui de dev. **En pratique : écrire les tests d'intégration, laisser la CI les jouer.**
- **Ne pas lancer deux tâches lourdes à la fois dans le conteneur** (typecheck + suite Nuxt) : la mémoire est saturée, les deux processus sont tués et le serveur de développement tombe avec eux.

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
- **La CI est complète** : neuf jobs dont typecheck, base de données réelle et Playwright. Le
  job `database` joue les tests d'intégration sur sa propre base — ce qui compte, car ils ne
  peuvent pas être lancés en local sans risque (§6).
- **Les décisions de conception sont consignées dans les commits et les commentaires**, pas
  seulement le « quoi ». Un lecteur qui tombe sur `spectacles-visibles.ts` apprend en trois
  lignes pourquoi la règle est partagée : l'avertissement du planning et l'assignation
  automatique doivent dire la même chose, faute de quoi l'algorithme jugerait acceptable ce que
  la page dénonce.

### Points d'attention, par ordre d'importance

**1. Les échecs silencieux d'autorisation sont le défaut structurel le plus coûteux du dépôt.**
Une page appelle une douzaine d'endpoints ; quand l'un est fermé au profil qui la consulte,
l'appel échoue dans un `try/catch` muet. **Rien ne se voit à l'écran** : un compteur reste à
zéro, une liste reste vide, et personne ne signale rien. Sur la page de contrôle d'accès, cinq
endpoints étaient dans ce cas — un seul affichait une erreur, et c'est le seul qui a été
remonté par un utilisateur ; les quatre autres n'ont été trouvés qu'en auditant la liste
complète des appels, puis un cinquième par les journaux d'erreur de production.

Deux parades, toutes deux en place :

- **une assertion générale en e2e** — « aucun appel refusé pendant le chargement de la page » —
  plutôt qu'un test par endpoint. C'est la classe d'oubli qu'il faut attraper, pas l'exemplaire
  du jour ; les endpoints ajoutés demain sont couverts sans rien écrire ;
- **la surveillance des journaux de production** (`/check-error-logs`), qui a détecté le
  cinquième cas quelques heures après sa mise en ligne.

À retenir avant d'ouvrir une page à un nouveau profil : **auditer tous les endpoints qu'elle
appelle**, pas seulement celui qui motive l'ouverture.

**2. Un test qui simule une dépendance par son nom peut verdir sur du code cassé.**
Deux tests d'endpoints simulaient `canManageTicketingById`. Le jour où les handlers sont passés
à `canAccessEditionDataOrAccessControl`, les mocks ont continué de rendre un verdict — sur une
fonction que le code n'appelait plus. Ils seraient restés verts quelle que soit la régression.
Quand un mock porte le nom d'une règle, **ce nom fait partie de l'assertion** : le renommer est
une modification du test, pas un détail de forme.

**3. L'asymétrie i18n entre layers demeure.**
Seul `volunteers` porte ses traductions ; les dix autres layers déposent leurs clés dans `apps/app1/i18n/`. Cette incohérence rend le placement d'une nouvelle clé arbitraire. À trancher : soit chaque layer porte ses traductions, soit aucun.

**4. `check-i18n` produisait des faux positifs massifs — résolu, et l'histoire mérite d'être retenue.**
Le rapport annonçait **529 clés manquantes et 44 inutilisées**. À l'examen : **zéro** manquante, et **3** réellement mortes sur 44. Les 573 autres étaient des angles morts du détecteur, tous corrigés :

| angle mort                            | signalements | correctif                                                                          |
| ------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| préfixe dynamique refusé au tiret bas | 25           | `admin.merge_field_${…}` compose au `_`, pas seulement au `.`                      |
| clé composée hors d'un `t()`          | 16           | le service de notifications _enregistre_ la clé ; `organizer-rights` la _retourne_ |
| fichier avec sa propre fonction `t`   | 523          | les pages du guide, rédigées en français seul, lisent un objet local               |
| accès de propriété et noms d'hôte     | 8            | `data.value`, `tile.openstreetmap.org` — liste d'exceptions                        |

L'enseignement dépasse l'i18n : **un outil qui crie trop ne sert plus à rien**. Personne ne lit
575 lignes de bruit, et le vrai orphelin s'y noyait. Pire, la commande proposait spontanément
`--delete-unused` en fin de rapport — l'exécuter aurait vidé les libellés de droits des
organisateurs et les rappels d'échéance des tâches, tous deux composés à l'exécution.

À retenir avant de faire confiance à un rapport d'outillage : **vérifier un échantillon à la
main**. Ici, quatre familles sur cinq étaient des faux positifs.

**5. Le typecheck local est bruyant, mais exploitable — à condition de savoir ce que la CI juge.**
Le conteneur remonte des milliers d'erreurs d'origine environnementale (références de projet
tsconfig, `@prisma/client has no exported member 'Prisma'`). Longtemps considéré comme
inutilisable, il l'est pourtant : **la CI ne bloque que sur `TS2304`/`TS2552`**, les noms non
définis. La commande suivante reproduit exactement sa porte, et rend un verdict en local :

```bash
docker compose -f apps/app1/docker-compose.dev.yml exec -T app \
  sh -c "cd /app/apps/app1 && npm run typecheck 2>&1 | grep -E 'error TS(2304|2552)'"
# code 1 = aucun nom non défini = la CI passera
```

Ce détour a une valeur concrète : un import de type oublié n'est vu **ni par le lint, ni par les
tests** — vitest efface les types — et n'apparaît qu'au typecheck. C'est exactement ce qui a
rendu une CI rouge le 28 août.

⚠️ Ne pas lancer le typecheck **en même temps** que la suite Nuxt dans le conteneur : les deux
saturent la mémoire et sont tués (`code 137`), emportant le serveur de développement avec eux.

**6 et 7. Le formatage — résolu.**
`npm run format` couvre désormais les `.cjs` et `.mjs`, et `format:check` tourne en CI. Le garde
a servi immédiatement : un fichier que je croyais victime d'un formateur capricieux — et que
j'avais « corrigé » une dizaine de fois — était en réalité non formaté dans le dépôt. C'est
exactement la dérive que ce contrôle existe pour arrêter.

**8. Les parcours de modale — largement couverts depuis.**
Le formulaire de candidature bénévole, l'un des plus complexes du produit, porte désormais
**vingt-six assertions** réparties sur deux fichiers : remontée des refus du serveur et
pré-remplissage depuis le profil d'un côté ; questions conditionnelles, reprise d'une
candidature enregistrée et garde de l'aperçu de l'autre.

Les questions conditionnelles méritaient particulièrement d'être verrouillées : une quinzaine
de drapeaux décident de ce qui est demandé, et une erreur n'échoue pas — elle pose la mauvaise
question, ou tait celle qu'on voulait poser, sans que personne le signale. Chaque drapeau est
donc éprouvé seul, dans les deux sens.

Deux traits du banc de test, découverts en écrivant ces tests et qui valent pour tout test de
composant ici :

- **certaines clés i18n s'y affichent brutes** — tous les domaines de traduction ne sont pas
  chargés. S'ancrer sur le libellé français seul rend un test dépendant d'un détail
  d'environnement ;
- **la valeur d'un `textarea` ne figure pas dans `innerHTML`**. Vérifier une hydratation en
  lisant le HTML sérialisé ne prouve rien : il faut lire la propriété DOM.

**9. Du travail mort subsiste après les suppressions récentes.**
Les invites du modèle et l'import d'édition ont été nettoyés, mais ce type de résidu réapparaît à chaque retrait de fonctionnalité. Une recherche systématique des écritures sans lecture, à chaque suppression, l'éviterait.

**10. Un contrat de retour ambigu se paie en bugs silencieux, partout à la fois.**
`useApiAction` déballait les réponses `{ success, data, message }` et rendait `data`. Les
**46 endpoints** répondant `createSuccessResponse(null, …)` faisaient donc rendre `null` à un
appel parfaitement réussi — la même valeur que sur un échec. Aucun appelant ne pouvait
distinguer les deux.

Le défaut s'est vu sur la carte du site : le toast annonçait la suppression d'un point de
repère, mais l'appelant, croyant à un échec, ne retirait jamais le calque. Il a d'abord été
traité là où il se voyait, puis à sa source — `null` signifie désormais l'échec, et lui seul.

À retenir : **quand une valeur de retour sert de verdict, elle doit être non ambiguë par
construction**. Un contrat qui confond « réussi sans contenu » et « échoué » ne produit pas une
erreur mais un comportement faux, silencieux, et reproduit à chaque appelant.

**11. « Supprimer puis recréer » invalide les identifiants — et perd le travail des autres.**
La composition d'un spectacle cabaret supprimait tous ses numéros avant de les recréer. Deux
conséquences, dont une seule apparaissait dans les journaux :

- le `deleteMany` verrouillait toutes les lignes du spectacle le temps de la transaction, d'où
  des `Lock wait timeout exceeded` (erreur 500) chez un artiste qui enregistrait au même moment ;
- **et les identifiants changeaient**, si bien que la saisie de cet artiste était perdue de
  toute façon — verrou ou pas.

Corriger le seul symptôme visible aurait laissé la perte de données intacte et silencieuse. Le
correctif conserve les identifiants, ce qui supprime les deux problèmes d'un coup.

À retenir : **la table rase est commode côté serveur, coûteuse côté concurrence.** Dès qu'une
autre partie du produit référence une ligne par son identifiant, la recréer revient à la lui
retirer sous les pieds.

**12. Réessayer un refus d'autorisation n'a pas de sens.**
Un flux temps réel se reconnectait cinq fois à trois secondes après chaque échec — y compris sur
un 403. Chaque visite d'un bénévole hors créneau laissait six rejets dans les journaux, pour une
porte qu'on savait fermée avant de frapper. `EventSource` n'exposant pas le code HTTP à
`onerror`, la décision ne pouvait pas se prendre au moment de l'erreur : elle se prend en amont,
là où le droit d'accès est déjà connu.

Cas particulier d'une règle plus large : **une politique de réessai doit distinguer ce qui peut
changer de ce qui ne changera pas.** Une coupure réseau se rattrape ; un refus, non.

### Sécurité

Le socle est correct : CSRF en double soumission, sessions scellées, `nuxt-security`, routes publiques déclarées explicitement, vérification que zones et repères appartiennent bien à l'édition visée. Quatre vigilances :

- la liste `public-routes.ts` est une **liste blanche manuelle** : un oubli fait échouer un endpoint public en 401, et l'inverse — une entrée trop large — exposerait des données. La règle
  d'appariement a été extraite du middleware pour devenir vérifiable, et **quarante assertions**
  la couvrent : une vingtaine de chemins sensibles qui ne doivent jamais être publics, une
  quinzaine réellement ouverts, plus les propriétés de la liste elle-même — ancrage des motifs,
  profondeur minimale des préfixes, méthode respectée. Une entrée trop large fait tomber six
  d'entre elles, dont les candidatures bénévoles et les commandes de billetterie ;
- le second risque, l'**oubli**, reste hors de portée d'un test : rien ne permet de deviner
  qu'un endpoint _devrait_ être public. Quelques routes ouvertes sont vérifiées pour qu'un
  remaniement ne les referme pas en silence, mais une nouvelle route publique oubliée ne se
  verra qu'à l'usage ;
- les tests d'endpoints contournent le middleware, et ne verraient donc rien de tout cela ;
- **les accès temporaires se lisent dans le temps.** `isActiveInTeamSlot` ouvre un droit
  pendant un créneau, à quinze minutes près et retard déclaré compris. La fenêtre ne dépend
  jamais des dates de l'édition — un créneau de montage ou de démontage ouvre le même accès —
  et un droit ainsi accordé se referme tout seul. C'est le bon patron pour tout accès de
  terrain : il est borné par construction, pas par la vigilance d'un organisateur ;
- **certaines restrictions sont des mitigations écrites**, pas des oublis. `sumup/config.get`
  renvoie une clé d'affiliation déchiffrée au navigateur, et documente comme première parade
  son accès réservé aux organisateurs. Élargir un tel endpoint demande une décision explicite,
  jamais un alignement mécanique sur ses voisins.

**Un helper unique pour les accès de terrain.** `canAccessEditionDataOrAccessControl` admet les
gestionnaires **ou** les bénévoles en créneau actif. Son existence n'a de valeur que s'il est
appliqué partout où la page l'exige : cinq endpoints de la billetterie étaient restés sur
`canManageTicketingById` alors que la page qui les appelle était ouverte aux bénévoles. Quand
un helper de ce genre apparaît, **la question n'est pas « où l'utiliser » mais « où manque-t-il »**.

### Performance

Le chargement paresseux de l'i18n par route est bien pensé. La duplication `apps/app1/.nuxt` et `.nuxt` racine reste (27 Mo à elles deux) sans nuire à l'exécution — le poids réel du dossier de travail, 3,7 Go pour 190 000 fichiers, vient d'ailleurs : `node_modules` dupliqué entre la racine, `apps/app1` et `apps/app2`. Les requêtes Prisma passent par des helpers de sélection standardisés (`prisma-select-helpers.ts`) — bonne pratique déjà en place, à maintenir.

---

## 10. Ce qui a bougé

### Du 28 août au 2 septembre — vingt-cinq lots, presque tous correctifs

Cinq jours sans une seule migration : le dépôt a passé la semaine à réparer et à outiller.

| Domaine        | Évolution                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carte du site  | Gestion en plein écran mobile, panneau déroulable, outils de dessin posés sur la carte ; suppression qui retire enfin l'objet                            |
| Sauvegardes    | Envoi découpé en tranches — un fichier de 80 Mo ne passait pas depuis un téléphone —, reprise automatique après coupure, restauration par le même chemin |
| Contrat d'API  | `useApiAction` : `null` signifie l'échec, et lui seul (§9.10)                                                                                            |
| Spectacles     | Les numéros gardent leur identifiant d'un enregistrement à l'autre (§9.11)                                                                               |
| Outillage i18n | Détecteur réparé : de 529 manquantes et 44 inutilisées à **zéro et zéro** (§9.4)                                                                         |
| Qualité        | `format:check` en CI, `.cjs` et `.mjs` couverts (§9.6)                                                                                                   |
| Mobile         | Navigation par panneau latéral, pages bénévoles et candidatures rendues lisibles                                                                         |

Trois de ces lots sont nés de la **surveillance des journaux de production**, pas d'un
signalement utilisateur : le flux temps réel qui réessayait un refus, le verrou sur les numéros
de spectacle, et — la semaine précédente — le cinquième endpoint fermé du contrôle d'accès.
C'est l'argument le plus concret en faveur de cette surveillance : elle trouve ce que personne
ne remonte.

### Du 14 au 28 août — quinze migrations

Les ajouts qui changent quelque chose à la lecture du dépôt :

| Domaine        | Évolution                                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spectacles     | Un spectacle porte désormais des **représentations** (`ShowPerformance`) : l'œuvre et ses passages sont séparés, une même affiche peut être jouée plusieurs soirs |
| Bénévoles      | Origine des affectations (`MANUAL` / `AUTO`), relance qui préserve le travail humain, heures comptées en charge à couvrir                                         |
| Bénévoles      | L'assignation automatique refuse de priver quelqu'un du **dernier passage** d'un spectacle — règle partagée avec l'avertissement du planning                      |
| Billetterie    | Le contrôle d'accès est utilisable de bout en bout par un bénévole **pendant son créneau** : recherche, validation, quotas, inscription sur place                 |
| Artistes       | Notifications aux artistes avec accusés de lecture et relance SMS, groupes de messagerie par spectacle                                                            |
| Administration | Restauration de sauvegarde suivie en arrière-plan, avec progression par table                                                                                     |
| Interface      | Page bénévole repliable sur mobile ; les QR codes forcent le mode clair le temps d'être scannés                                                                   |

**Deux règles nouvelles vivent dans `shared/`** — `spectacles-visibles.ts` et
`regles-mot-de-passe.ts` — et confirment le principe énoncé au §9 : ce qui doit être dit d'une
seule voix par le client et le serveur se place là, avec ses tests.

---

## 11. Par où commencer, pour qui arrive

1. **`README.md` puis `CLAUDE.md`** — le second contient les règles de terrain qui évitent les
   dégâts (ne jamais lancer le serveur de dev, ne jamais appliquer une migration soi-même).
2. **`docs/README.md`** — index des 91 documents ; les étapes `etape-0` à `etape-4` racontent la
   modularisation dans l'ordre où elle a été faite, c'est la meilleure entrée en matière.
3. **Un module de bout en bout** — le layer `faq` est le plus petit (5 endpoints, 1 composant,
   2 pages) : il montre le patron complet sans noyer le lecteur.
4. **`shared/utils/`** — les règles métier pures, avec leurs tests. On y comprend ce que le
   projet considère comme délicat : fuseaux horaires, visibilité des spectacles, mots de passe.
5. **`server/volunteers/ports/types.ts`** — le port le plus riche (15 interfaces). Il dit
   exactement ce qu'un module attend de son hôte, et donc où passent les frontières.
