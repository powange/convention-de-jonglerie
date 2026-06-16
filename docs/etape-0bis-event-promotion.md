# Étape 0bis — Promotion des métadonnées génériques vers `Event`

> **Statut** : 🟢 **Implémenté** sur la branche `feat/etape-0bis-event-generic-fields`.
> Le layer `volunteers` ne lit plus aucun `Edition`/`Convention` côté serveur : toute donnée propre
> au domaine passe par les ports. Objectif atteint : layer réutilisable par une 2ᵉ app
> (cf. [modularisation-multi-domaines.md](./modularisation-multi-domaines.md)).
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

### 4. Extraction `EventVolunteerSettings` (config bénévole) — ✅ Fait

La config `volunteers*` (`mode`, `ask*`, `open`, `description`, `pagePublic`, `externalUrl`, dates
setup/teardown, `updatedAt`, `enabled`) est sortie d'`Edition` vers une table `EventVolunteerSettings`
(1:1 avec `Event`, champs sans préfixe `volunteers`), portée par le layer. Migration
`20260616120000_event_volunteer_settings` : création + backfill depuis `Edition` + **drop des 23
colonnes** `volunteers*` d'`Edition`. La ligne est créée à la création d'édition (API, seed, import,
duplicate). Lecteurs migrés : `settings.get/patch`, `applications/index.post`, `meals.get`,
`volunteer-time-slots` (layer) ; `index.get/put`, `duplicate`, `import`, `sitemap`, `ticketing/stats`
(core). Les réponses consommées par le front restent rétro-compatibles (champs `volunteers*`
ré-aplatis depuis les settings).

### 5. Découplage final via le port `eventScope` (B + C) — ✅ Fait

Les deux derniers couplages à `Edition`/`Convention` du layer passaient par une notion propre au
domaine (« les autres éditions de la même convention » ; « ville/image/logo de convention »). Plutôt
que de lire `Edition` dans le layer, on introduit un port [`EventScopePort`](../server/volunteers/ports/types.ts) :

- `getRelatedEventIds(eventId)` → ids des événements « liés » (jonglerie : les éditions de la même
  convention ; domaine générique : l'événement seul).
- `getEventDisplayData(eventIds)` → données d'affichage propres au domaine (jonglerie : `city`,
  `country`, `imageUrl`, `convention`), transmises au front sans être interprétées par le layer.

Le câblage jonglerie de ces deux méthodes (lectures `Edition`/`Convention`) vit dans
[`server/volunteers/ports/default-binding.ts`](../server/volunteers/ports/default-binding.ts), **côté
app**. Une 2ᵉ app fournit sa propre implémentation via `setVolunteerPorts()`.

- **B. Page « mes candidatures »** (`user/volunteer-applications.get.ts`) : la réponse est construite
  depuis `Event` (`name`, dates) + `EventVolunteerSettings` (config `volunteers*` ré-aplatie) +
  `getEventDisplayData()` pour la partie domaine. Forme `edition` à plat conservée → **front
  inchangé**.
- **C. Commentaires bénévoles scopés convention** (`volunteers/applications.get.ts`) : le `where` des
  `volunteerComments` utilise `eventId: { in: getRelatedEventIds(eventId) }` et sélectionne
  `event.{name,startDate,endDate}` (plus de traversée `edition`/`convention`). Le composant
  [`Table.vue`](../layers/volunteers/app/components/edition/volunteer/Table.vue) lit `comment.event.*`.

> Résultat : `grep` de `prisma.edition` / `event.edition` / `.convention` dans
> `layers/volunteers/server` → **0 occurrence**. Le layer est server-side agnostique du domaine.

## Validation

- ✅ 371 tests unitaires, tests nuxt éditions/bénévoles mockés (settings, applications, `[id].get`)
  et test d'intégration DB du workflow bénévole : verts.
- ✅ Migrations appliquées en base de dev + backfill vérifié (`Event.name`, `EventVolunteerSettings`).
- ✅ Test unitaire du helper de sync (`test/nuxt/server/utils/event-sync.test.ts`).
- ✅ Smoke-test SSR : `/api/editions/:id` et `/api/editions/:id/volunteers/settings` en 200, config
  bénévole servie depuis `EventVolunteerSettings`. (Le blocage dev `appendCorsHeaders` rencontré
  pendant le développement était indépendant ; corrigé séparément — cf. PR #4.)
- ✅ Smoke-test SSR des endpoints découplés via `eventScope` : `/api/user/volunteer-applications`
  et `/api/editions/:id/volunteers/applications` se chargent (401 sans auth, pas de 500).
- ✅ `grep prisma.edition / event.edition / .convention` dans `layers/volunteers/server` → 0 occurrence.
