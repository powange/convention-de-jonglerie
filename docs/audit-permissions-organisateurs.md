# Audit des permissions organisateurs — pages & endpoints API

> Rapport d'analyse **en lecture seule** produit le 2026-07-25 (aucune modification de code).
> Objectif : recenser les pages et requêtes API soumises à des droits organisateurs, et identifier
> les incohérences existantes en vue d'une correction ultérieure.
>
> Périmètre analysé : `apps/app1/server/api/**`, `layers/*/server/api/**` (~464 fichiers d'endpoints),
> `apps/app1/app/pages/editions/[id]/gestion/**`, `layers/*/app/pages/**/gestion/**`,
> `apps/app1/app/layouts/edition-dashboard.vue`, `apps/app1/app/stores/editions.ts`,
> `apps/app1/server/utils/permissions/*`, `apps/app1/server/utils/organizer-management.ts`.

## Sommaire

- [1. Synthèse](#1-synthèse)
- [2. Architecture actuelle des contrôles](#2-architecture-actuelle-des-contrôles)
- [3. Cartographie serveur : quel contrôle pour quel endpoint](#3-cartographie-serveur--quel-contrôle-pour-quel-endpoint)
- [4. Cartographie client : quel contrôle pour quelle page](#4-cartographie-client--quel-contrôle-pour-quelle-page)
- [5. Incohérences détectées](#5-incohérences-détectées)
  - [5.1 Portée de privilège trop large côté serveur](#51-portée-de-privilège-trop-large-côté-serveur)
  - [5.2 Client plus permissif que serveur (403 vécus par l'utilisateur)](#52-client-plus-permissif-que-serveur-403-vécus-par-lutilisateur)
  - [5.3 Bugs confirmés](#53-bugs-confirmés)
  - [5.4 Incohérences intra-module](#54-incohérences-intra-module)
  - [5.5 Code mort et dette](#55-code-mort-et-dette)
- [6. Tableau de priorisation](#6-tableau-de-priorisation)
- [7. Plan de correction suggéré](#7-plan-de-correction-suggéré)
- [8. Annexe — méthodologie](#8-annexe--méthodologie)

---

## 1. Synthèse

Le refactor mené sur les PR #77 → #80 a doté **artistes, repas, billetterie, ateliers et FAQ** de droits
dédiés cohérents entre client et serveur. L'audit montre que **le reste du périmètre n'a pas suivi** :

| Constat                                                                     | Nombre |
| --------------------------------------------------------------------------- | ------ |
| Endpoints protégés par un contrôle « n'importe quel organisateur »           | 21     |
| Endpoints d'un module à droit dédié protégés par `canEditEdition` à la place | 10     |
| Familles de helpers de permission coexistantes (sémantiques différentes)     | 3      |
| Bugs confirmés (clé inexistante, colonne inexistante, oubli de gating)       | 3      |
| Helpers définis et jamais appelés (code mort)                               | 5      |

**Les 3 problèmes les plus impactants :**

1. **Bénévoles** — le client accorde l'accès sur `canEdit`/`editConvention`, le serveur exige
   strictement `canManageVolunteers` → l'utilisateur voit les écrans puis reçoit des **403**
   (exactement le symptôme corrigé pour les artistes en PR #77).
2. **Menu latéral « Tâches »** — le layout lit une clé de droit qui n'existe pas (`rights.canManageTasks`
   au lieu de `rights.manageTasks`) → le droit convention « gérer les tâches » est **silencieusement ignoré**.
3. **Carte du site / posts / objets trouvés / données bénévoles** — les écritures ne demandent que
   « être organisateur », sans droit dédié ni même `canEdit`.

---

## 2. Architecture actuelle des contrôles

Trois familles de helpers coexistent, avec des **signatures et des sémantiques d'admin différentes** :

| Famille | Emplacement                                    | Signature                                | Bypass admin              | Vérifie le per-édition   |
| ------- | ---------------------------------------------- | ---------------------------------------- | ------------------------- | ------------------------ |
| **A**   | `server/utils/permissions/edition-permissions.ts` | `canManageX(edition, user)` — synchrone, édition préchargée | `user.isGlobalAdmin`      | ✅ via `organizerPermissions` |
| **B**   | idem + `organizer-management.ts`               | `canX(editionId, userId, event)` — async, requête interne | `checkAdminMode(userId, event)` | variable (voir §5.5)     |
| **C**   | `server/utils/permissions/volunteer-permissions.ts` | `requireX(event, editionId)` — async, **jette** un 403 | `user.isGlobalAdmin`      | ✅                        |

> ⚠️ **Divergence de sémantique admin** : la famille A/C accorde l'accès à **tout admin global**, la
> famille B seulement si le **mode admin est actif** (`checkAdminMode`). Un admin global hors mode admin
> passe donc certains contrôles et pas d'autres. À arbitrer (les commentaires de
> `volunteer-permissions.ts:16-17` disent « Super Admin en mode admin » alors que le code teste
> `user.isGlobalAdmin` — commentaire et code divergent).

Côté client, la logique est portée par `app/stores/editions.ts` (méthodes `canManageX(edition, userId)`),
**sauf pour Tâches et Stock** dont la logique est **dupliquée en inline** dans deux fichiers (§5.3).

---

## 3. Cartographie serveur : quel contrôle pour quel endpoint

Répartition des contrôles sur les endpoints (`apps/app1/server/api` + `layers/*/server/api`) :

| Contrôle utilisé                       | Fichiers | Appréciation                                                     |
| -------------------------------------- | -------- | ---------------------------------------------------------------- |
| `canManageTicketingById`               | 58       | ✅ droit dédié, complet (convention + per-édition + créateur)     |
| `canManageArtists`                     | 20       | ✅ droit dédié                                                    |
| `canManageTasks`                       | 18       | ✅ droit dédié                                                    |
| `canAccessEditionData`                 | **21**   | ⚠️ **« n'importe quel organisateur »** — aucun droit dédié requis |
| `canEditEdition`                       | **10**   | ⚠️ droit d'édition utilisé à la place d'un droit dédié            |
| `canManageStock`                       | 6+4      | ✅ droit dédié (+ `canAccessStock` pour les team leaders)         |
| `canManageMealsOrValidation` / `ById`  | 6 / 4    | ✅ droit dédié + cas validation buffet                            |
| `canManageTicketing`                   | 5        | ✅                                                                |
| `canManageFAQ`                         | 5        | ✅ (PR #80)                                                       |
| `canAccessEditionDataOrAccessControl`  | 5        | ✅ intentionnel (bénévole en créneau de contrôle d'accès)         |
| `canManageWorkshopLocations` / `canEditWorkshop` | 3 / 2 | ✅ (PR #79, délèguent à `canManageWorkshops`)                 |
| `requireManagementAccess` (port bénévoles) | 10   | ✅ droit dédié `canManageVolunteers`                              |
| `canManageEditionVolunteers`           | 3        | ✅ mais doublon fonctionnel du port ci-dessus                     |
| `canManageEditionOrganizers`           | 4        | ⚠️ contient une branche morte (§5.3 B2)                           |
| `isGlobalAdmin` seul                   | 22       | ✅ endpoints d'administration globale                             |

**Les 21 endpoints en `canAccessEditionData`** (tout organisateur, sans droit dédié) :

```
apps/app1/server/api/editions/[id]/markers/{index.post, [markerId].put, [markerId].delete, reorder.put}
apps/app1/server/api/editions/[id]/zones/{index.post, [zoneId].put, [zoneId].delete, reorder.put}
apps/app1/server/api/editions/[id]/posts/{index.post, [postId]/index.delete, [postId]/comments/[commentId]/index.delete}
apps/app1/server/api/editions/[id]/shows/{index.get, [showId].get}
layers/artists/server/api/editions/[id]/artists/{index.get, [artistId]/notes.patch}
layers/lost-found/server/api/editions/[id]/lost-found/{index.post, [itemId]/return.patch}
layers/volunteers/server/api/editions/[id]/volunteers/{applications.get, team-assignments.get,
                                                        [volunteerId]/meals.get, [volunteerId]/meals.put}
```

**Les 10 endpoints en `canEditEdition`** :

```
apps/app1/server/api/editions/[id]/shows/{index.post, [showId].put, [showId].delete}   ← module Artistes
apps/app1/server/api/editions/[id]/posts/[postId]/pin.patch
apps/app1/server/api/files/{edition.post, lost-found.post, show.post}
layers/artists/server/api/editions/[id]/artists/[artistId].delete                       ← module Artistes
layers/artists/server/api/editions/[id]/artists/[artistId]/meals.{get,put}              ← Artistes + Repas
```

---

## 4. Cartographie client : quel contrôle pour quelle page

| Page de gestion                    | Contrôle client                              | Droit serveur attendu        | Cohérent ? |
| ---------------------------------- | -------------------------------------------- | ---------------------------- | ---------- |
| `general-info`, `about`, `services`, `external-links`, `features`, `ai-update` | `canEditEdition`     | `canEditEdition`             | ✅         |
| `map`                              | `canEditEdition`                              | `canAccessEditionData` (API) | ❌ §5.1 C1 |
| `organizers`                       | `canManageOrganizers`                         | `canManageEditionOrganizers` | ✅         |
| `artists`, `artists/shows*`, `shows-call*` | `canManageArtists`                    | mixte (`canManageArtists` **et** `canEditEdition`) | ❌ §5.4 D1 |
| `meals`, `meals/list`              | `canManageMeals`                              | `canManageMealsById`         | ✅         |
| `meals/validate`                   | `canManageMeals` \|\| `canAccessMealValidation` | `canManageMealsOrValidation` | ✅       |
| `ticketing/*` (config, tiers, orders, stats, external, handout-items) | `canManageTicketing` | `canManageTicketingById` | ✅ |
| `ticketing/counter/[counterId]`    | `canEditEdition`                              | `canManageTicketingById`     | ❌ §5.4 D2 |
| `ticketing/access-control`         | `canEdit` \|\| `canManageVolunteers`          | `canAccessEditionDataOrAccessControl` | ⚠️ §5.2 |
| `workshops`                        | `canManageWorkshops`                          | `canManageWorkshops`         | ✅         |
| `faq`                              | `canManageFAQ`                                | `canManageFAQ`               | ✅         |
| **carte FAQ sur l'accueil gestion** | `canEdit`                                    | `canManageFAQ`               | ❌ §5.3 B3 |
| `volunteers/*` (config, form, teams, planning, applications, notifications, page) | `canEdit` \|\| `canManageVolunteers` | `canManageVolunteers` strict | ❌ §5.2 F1 |
| `lost-found`                       | `canEdit` \|\| `canManageVolunteers`          | `canAccessEditionData`       | ❌ §5.1 C4 |
| `tasks`, `tasks/[groupId]`         | aucun (délégué layout/API)                    | `canManageTasks`             | ⚠️ §5.3 B1 |
| `stock`, `stock/*`                 | aucun (délégué layout/API)                    | `canManageStock`             | ⚠️         |

---

## 5. Incohérences détectées

### 5.1 Portée de privilège trop large côté serveur

> Ces endpoints n'exigent **aucun droit dédié** : être organisateur de la convention suffit — même
> sans `canEdit`. Ce n'est pas un contournement d'authentification (il faut être organisateur), mais
> la **portée du privilège est plus large que ce que l'UI laisse penser**.

| Réf.   | Sujet                    | Détail                                                                                                                                                    | Sévérité |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **C1** | Carte du site (zones/markers) | 8 endpoints d'**écriture** (`POST`/`PUT`/`DELETE`/`reorder`) en `canAccessEditionData`, alors que la page `gestion/map` exige `canEdit`. Un organisateur sans `canEdit` ne voit pas la page mais **peut appeler l'API**. | 🔴 Haute |
| **C2** | Données bénévoles        | `volunteers/applications.get`, `team-assignments.get`, `[volunteerId]/meals.get` **et `.put`** en `canAccessEditionData` : tout organisateur lit les candidatures/affectations (données personnelles) et **modifie les repas** d'un bénévole, sans `canManageVolunteers`. | 🔴 Haute |
| **C3** | Notes artistes           | `artists/[artistId]/notes.patch` (**écriture**) et `artists/index.get` en `canAccessEditionData`, alors que le module a `canManageArtists` (20 autres endpoints l'utilisent). | 🟠 Moyenne |
| **C4** | Objets trouvés           | `lost-found/index.post` et `[itemId]/return.patch` en `canAccessEditionData` ; en parallèle `files/lost-found.post` exige `canEditEdition`. Deux niveaux pour le même module. | 🟠 Moyenne |
| **C5** | Publications (posts)     | `posts/index.post` et suppressions en `canAccessEditionData`, mais `posts/[postId]/pin.patch` en `canEditEdition` : **épingler** est plus protégé que **publier ou supprimer**. | 🟠 Moyenne |

### 5.2 Client plus permissif que serveur (403 vécus par l'utilisateur)

| Réf.   | Sujet                                                                                                                                                                                                | Sévérité |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **F1** | **Bénévoles — le cas le plus net.** `app/stores/editions.ts:480` accorde `canManageVolunteers` dès `editConvention` \|\| `editAllEditions`, et `:484` dès `per.canEdit`. Le serveur (`volunteer-permissions.ts:57-70`) exige **strictement** `canManageVolunteers` (convention ou per-édition). → Un organisateur `canEdit` voit tout le menu Bénévoles et les 7 pages, puis **reçoit des 403** à la moindre action. C'est le symptôme exact corrigé pour les artistes en PR #77. | 🔴 Haute |
| **F2** | Pages `volunteers/form.vue:123`, `volunteers/teams.vue:63`, `lost-found/index.vue:109`, `ticketing/access-control.vue:764` : condition `canEdit \|\| canManageVolunteers` — même écart que F1.        | 🟠 Moyenne |

### 5.3 Bugs confirmés

| Réf.   | Sujet                                                                                                                                                                                                                                                                                                       | Sévérité |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **B1** | **Clé de droit inexistante.** `app/layouts/edition-dashboard.vue:232` teste `collab.rights?.canManageTasks`. L'API renvoie la clé **courte** `manageTasks` (`server/api/editions/[id]/index.get.ts`) → l'expression est **toujours `undefined`**. Conséquence : le droit **convention** « gérer les tâches » n'affiche pas l'entrée de menu ; seuls `editConvention` ou un droit per-édition fonctionnent. À noter : `gestion/index.vue:693` utilise, lui, la **bonne** clé `manageTasks` → les deux copies de la même logique divergent. | 🔴 Haute |
| **B2** | **Colonne inexistante.** `edition-permissions.ts:669` teste `perm.canManageOrganizers` sur `EditionOrganizerPermission` — or ce modèle **n'a pas cette colonne** (elle n'existe que sur `ConventionOrganizer`). La branche `hasEditionOrganizersRights` est donc **morte** : on ne peut pas déléguer la gestion des organisateurs par édition, alors que le code laisse croire le contraire. | 🟠 Moyenne |
| **B3** | **Oubli de gating (PR #80).** `app/pages/editions/[id]/gestion/index.vue:509` : la carte FAQ est encore conditionnée par `canEdit` au lieu de `canManageFAQ` (la page et l'API ont bien été migrées). Un organisateur `canEdit` voit la carte « Gérer la FAQ » sans pouvoir rien y faire. | 🟡 Basse |

### 5.4 Incohérences intra-module

| Réf.   | Sujet                                                                                                                                                                                                                                                                        | Sévérité |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **D1** | **Module Artistes à deux vitesses.** Les pages exigent `canManageArtists` (9 pages), mais côté API : `shows/index.post`, `shows/[showId].put`, `shows/[showId].delete`, `artists/[artistId].delete`, `artists/[artistId]/meals.{get,put}` utilisent **`canEditEdition`** ; `artists/index.get` et `notes.patch` utilisent `canAccessEditionData`. Trois niveaux de contrôle pour un seul module. | 🔴 Haute |
| **D2** | `ticketing/counter/[counterId].vue` exige `canEditEdition` alors que **toutes** les autres pages billetterie exigent `canManageTicketing`.                                                                                                                                     | 🟡 Basse |
| **D3** | **Tâches & Stock hors du store.** Contrairement aux 7 autres modules, `canManageTasks`/`canManageStock` n'existent pas dans `app/stores/editions.ts` : la logique est **dupliquée inline** dans `edition-dashboard.vue:223-257` et `gestion/index.vue:684-720`. C'est la cause directe de B1 (les deux copies ont divergé). De plus, ces deux copies accordent le droit sur `editConvention`/`canEdit`, ce que le serveur (`canManageTasks`/`canManageStock`) **n'accorde pas** → même classe d'écart que F1. | 🟠 Moyenne |
| **D4** | **Asymétrie du modèle de données.** `ConventionOrganizer` porte 14 droits, `EditionOrganizerPermission` seulement 10 : `canManageOrganizers`, `canEditConvention`, `canDeleteConvention`, `canAddEdition` n'ont pas d'équivalent per-édition (cf. B2). Choix probablement volontaire, mais non documenté. | 🟡 Basse |

### 5.5 Code mort et dette

| Réf.   | Sujet                                                                                                                                                                                                                                     | Sévérité |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **M1** | `organizer-management.ts:135` — `canManageVolunteers(conventionId, userId, event)` : **jamais appelée**. Piège : elle ne vérifie **pas** les droits per-édition ; l'utiliser par erreur créerait une régression. | 🟠 Moyenne |
| **M2** | Helpers définis mais sans aucun appel dans les endpoints : `canViewEdition`, `canManageEditionStatus`, `canDeleteEdition`, `canManageMeals` (le module passe par `canManageMealsById`), `canAccessEditionDataOrMealValidation`. | 🟡 Basse |
| **M3** | Doublon fonctionnel : `canManageEditionVolunteers` (3 usages) vs le port `requireManagementAccess` → `requireVolunteerManagementAccess` (10 usages) font la même chose avec des sémantiques admin différentes (§2). | 🟡 Basse |
| **M4** | 46 endpoints d'écriture sous `editions/[id]` sans helper de permission reconnu : ~26 sont légitimes (actions « me concernant » : favoris, mes repas, mes candidatures…), ~20 passent par des contrôles ad-hoc ou des ports. À re-vérifier au cas par cas lors des correctifs. | 🟡 Basse |

---

## 6. Tableau de priorisation

| Priorité | Réf.       | Correctif                                                                             | Effort |
| -------- | ---------- | ------------------------------------------------------------------------------------- | ------ |
| **P1**   | F1, F2     | Aligner le store `canManageVolunteers` sur le serveur (retirer `editConvention`/`editAllEditions`/`canEdit`) + pages bénévoles | M      |
| **P1**   | B1         | Corriger la clé `canManageTasks` → `manageTasks` dans le layout                        | XS     |
| **P1**   | D1         | Uniformiser le module Artistes sur `canManageArtists` (6 endpoints + 2 lectures)       | M      |
| **P2**   | C1         | Décider du droit pour la carte du site (`canEdit` ou nouveau `canManageMap`) et l'appliquer aux 8 endpoints | M |
| **P2**   | C2         | Passer les 4 endpoints bénévoles de `canAccessEditionData` à `canManageVolunteers`     | S      |
| **P2**   | D3         | Extraire `canManageTasks`/`canManageStock` dans le store et supprimer les copies inline | S      |
| **P3**   | C3, C4, C5 | Uniformiser artistes/notes, objets trouvés et posts                                    | S      |
| **P3**   | B2, D4     | Trancher : ajouter `canManageOrganizers` à `EditionOrganizerPermission` **ou** supprimer la branche morte | S |
| **P3**   | B3, D2     | Carte FAQ → `canManageFAQ` ; page counter → `canManageTicketing`                        | XS     |
| **P4**   | M1–M3, §2  | Supprimer le code mort, unifier les 3 familles de helpers et la sémantique admin        | L      |

---

## 7. Plan de correction suggéré

Découpage en lots livrables indépendamment, dans l'esprit des PR #77 → #80 (un module par PR, avec
tests de régression « éditer ≠ gérer ») :

1. **Lot 1 — Bénévoles** (P1) : store + 7 pages + 4 endpoints `canAccessEditionData` → `canManageVolunteers`.
   Ajouter un test de régression « `editConvention` seul ne donne pas accès aux bénévoles ».
2. **Lot 2 — Correctifs ponctuels** (P1/P3, très faible risque) : clé `manageTasks` (B1), carte FAQ (B3),
   page counter billetterie (D2).
3. **Lot 3 — Artistes/Spectacles** (P1) : uniformiser les 8 endpoints restants sur `canManageArtists`
   (attention : `artists/[artistId]/meals.*` relève sans doute de `canManageMeals` **ou** `canManageArtists` — à arbitrer).
4. **Lot 4 — Carte du site & contenus** (P2/P3) : décision produit d'abord (faut-il un droit dédié
   « carte » ? les posts relèvent-ils de `canEdit` ?), puis application aux zones/markers/posts/lost-found.
5. **Lot 5 — Dette technique** (P4) : store `canManageTasks`/`canManageStock`, suppression du code mort,
   convergence des familles de helpers et de la sémantique admin (`isGlobalAdmin` vs `checkAdminMode`).

**Garde-fous recommandés pour la suite :**

- Toute section de gestion doit avoir **un seul** droit dédié, appliqué **à l'identique** côté store,
  page, entrée de menu, carte d'accueil et endpoints.
- Interdire l'usage de `canAccessEditionData` pour les **écritures** (le réserver aux lectures larges
  assumées) — un test d'architecture pourrait le vérifier automatiquement.
- Ne jamais dupliquer la logique de permission hors du store (cause racine de B1/D3).

---

## 8. Annexe — méthodologie

- Inventaire des helpers via recherche de symboles sur `server/utils/permissions/**` et
  `organizer-management.ts`.
- Cartographie endpoint → contrôle par extraction automatisée des appels de helpers sur les
  ~464 fichiers de `server/api/**`, puis classification des fichiers sans helper reconnu
  (contrôle ad-hoc / auth seule / port).
- Cartographie page → contrôle par extraction des appels `editionStore.canX(` dans les pages
  `**/gestion/**`, complétée par lecture des computeds du layout et de l'accueil gestion.
- Vérification des clés de droits contre la réponse réelle de `GET /api/editions/[id]`
  (clés courtes `manageX` pour `rights`, clés longues `canManageX` pour `perEditionRights`).
- Vérification des colonnes contre `prisma/schema/schema.prisma`.

Aucun fichier de code n'a été modifié pour produire ce rapport.
