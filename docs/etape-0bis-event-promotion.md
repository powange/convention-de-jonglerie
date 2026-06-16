# Étape 0bis — Promotion des métadonnées génériques vers `Event`

> **Statut** : 🟡 **Partiellement implémenté** sur la branche `feat/etape-0bis-event-generic-fields`
> (non mergée). Objectif : rendre le layer `volunteers` indépendant d'`Edition`/`Convention` afin
> qu'il soit réutilisable par une 2ᵉ app (cf. [modularisation-multi-domaines.md](./modularisation-multi-domaines.md)).
> **Date** : 2026-06-16.

## Pourquoi

L'étape 0 a été livrée en scope réduit : `Event` n'était qu'une ancre (id + relations), les
métadonnées (`name`/dates/`status`) et la config bénévole (`volunteers*`) restaient sur `Edition`.
Conséquence : le layer `volunteers` lisait encore `Edition`/`Convention` (~40 accès), donc n'était
pas réutilisable par une app sans `Edition`.

## Fait dans cette branche

### 1. Schéma — `Event` porte les métadonnées génériques

`Event` reçoit `name`, `startDate`, `endDate`, `status` (réutilise l'enum `EditionStatus`).
Migration `20260616040000_event_generic_metadata` (hand-authored) : ajout des colonnes + backfill
depuis `Edition` (+ `Convention` pour le nom d'affichage « Convention - Edition »). Appliquée et
vérifiée en base de dev.

### 2. Sync app jonglerie → `Event`

`Edition` reste la source de vérité côté jonglerie ; l'app maintient `Event` en miroir via
[`server/utils/event-sync.ts`](../server/utils/event-sync.ts), câblé sur :

- création d'édition (`server/api/editions/index.post.ts`, dans la transaction)
- mise à jour d'édition (`.../[id]/index.put.ts`) et changement de statut (`.../[id]/status.patch.ts`)
- renommage de convention (`server/api/conventions/[id]/index.put.ts` → re-sync de ses éditions)
- seed dev

### 3. Layer — lectures `Edition` → `Event`

Migrés vers `event.name` / `prisma.event` :

- **Noms d'affichage / notifications / emails** : `notifications.post.ts`, `notify-schedules.post.ts`,
  `create-user-and-add.post.ts`, `add-manually.post.ts`, `applications/index.post.ts`,
  `applications/[applicationId].patch.ts`, `notification/[groupId].get.ts`,
  `notification/[groupId]/confirmations.get.ts`, `tasks/volunteer-reminders.ts`.
- **Vérifs d'existence** : `volunteer-teams/index.get.ts`, `volunteer-teams/index.post.ts`,
  `volunteers/auto-assign.post.ts` (lisent `prisma.event` au lieu d'`Edition`).

> Note : le nom d'affichage unifié est désormais `event.name` (« Convention - Edition »). Quelques
> formulations de notifications/emails sont légèrement simplifiées (un seul nom au lieu de
> convention + édition séparées).

## Reste à faire (travail restant de l'étape 0bis)

### A. Extraction `EventVolunteerSettings` (config bénévole)

La config `volunteers*` (`volunteersMode`, `volunteersAsk*`, `volunteersOpen`,
`volunteersDescription`, `volunteersPagePublic`, `volunteersExternalUrl`, dates setup/teardown,
`volunteersUpdatedAt`, `volunteersEnabled`) est encore sur `Edition`. À sortir dans une table
`EventVolunteerSettings` (1:1 avec `Event`) portée par le layer. Fichiers concernés :

- `volunteers/settings.get.ts`, `volunteers/settings.patch.ts` (lecture/écriture de la config)
- `server/api/editions/[id]/index.get.ts` (core — ré-aplatit les champs `volunteers*`)
- `volunteers/applications/index.post.ts` (lit la config du formulaire)
- `volunteers/meals.get.ts`, `volunteer-time-slots/index.post.ts`,
  `volunteer-time-slots/[slotId].put.ts` (lisent `volunteersSetupStartDate`/`Teardown`)

### B. Page « mes candidatures » (`user/volunteer-applications.get.ts`)

Retourne aujourd'hui l'objet `Edition` complet (ville, image, logo de convention, config) au front.
Rendre agnostique = restructurer la réponse autour d'`Event` + extension de domaine, ce qui touche
le front. À traiter avec l'extraction `EventVolunteerSettings`.

### C. Commentaires bénévoles scopés convention (`volunteers/applications.get.ts`)

Charge les commentaires de **toutes les éditions d'une convention** (fonctionnalité spécifique
jonglerie). Pas de notion de « convention » dans un domaine générique → à repenser (probablement
rester côté app jonglerie plutôt que dans le layer).

## Validation

- ✅ Suite de tests nuxt mockée : verte (volontaires, éditions, conventions, features, utils…).
- ✅ Migration appliquée proprement en base de dev + backfill `Event.name` vérifié.
- ✅ Test unitaire du helper de sync (`test/nuxt/server/utils/event-sync.test.ts`).
- ⚠️ Smoke-test SSR non concluant : l'environnement dev tombe sur un glitch de codegen d'auto-import
  Nuxt (`appendCorsHeaders is not defined`, sur **toutes** les routes), indépendant de ce changement
  (aucun code ne touche au CORS ; h3 exporte bien la fonction). À investiguer séparément.
