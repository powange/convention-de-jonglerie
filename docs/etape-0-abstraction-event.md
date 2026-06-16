# Étape 0 — Abstraction `Event` (pilote bénévole)

> **Statut** : ✅ **Implémenté en scope réduit** (sur `main`, déployé en release). `Event` est une
> **ancre minimale** : seules les 5 FK bénévoles ont migré `editionId → eventId` ; les champs
> génériques (`name`/dates/`status`/`volunteers*`) sont **restés sur `Edition`**. La promotion de ces
> champs vers `Event` est reportée à l'**étape 0bis** (avant la 2ᵉ app). Voir la section _Avancement_
> de [modularisation-multi-domaines.md](./modularisation-multi-domaines.md).
> **Date** : 2026-06-15 (conception), mise à jour 2026-06-16.
> **Prérequis du plan** : voir [modularisation-multi-domaines.md](./modularisation-multi-domaines.md) §5 et §8.
> **Rappel** : les migrations Prisma ne sont **jamais exécutées par l'assistant**. Ce document
> fournit le schéma cible et le SQL ; la création/application de la migration reste à la charge du
> porteur du projet.

## 1. Objectif et périmètre

Introduire une entité **`Event`** générique dont `Edition` (jonglerie) devient une extension 1:1,
puis **repointer uniquement le module bénévole** sur `Event`. Les autres modules (billetterie,
tâches, repas, carte…) **continuent de pointer sur `Edition`** : ils seront migrés lors de leurs
propres extractions.

Périmètre exact de l'étape 0 :

- ✅ Créer `Event` + `EventVolunteerSettings`.
- ✅ Faire d'`Edition` une extension 1:1 d'`Event` (`Edition.eventId`).
- ✅ Repointer les **5 tables bénévoles** portant `editionId` vers `eventId`.
- ✅ Déplacer les **23 champs `volunteers*`** d'`Edition` vers `EventVolunteerSettings`.
- ✅ Découpler la résolution du nom d'affichage (`edition.convention.name` → `event.name`).
- ❌ **Hors périmètre** : déplacer `name`/`startDate`/`endDate`/`status` hors d'`Edition` (rayon
  d'impact énorme, voir §7). On les **garde sur `Edition`** et on les **recopie dans `Event`**
  (source de vérité pour le layer). Leur retrait d'`Edition` se fera plus tard, module par module.

## 2. La technique clé : réutilisation de l'id (`Event.id == Edition.id`)

Lors du backfill, on crée **un `Event` par `Edition` en forçant `Event.id = Edition.id`**.
Conséquences décisives :

- `Edition.eventId = Edition.id` → relation 1:1 triviale.
- Les colonnes bénévoles `editionId` contiennent déjà des valeurs égales à `Edition.id`, donc
  égales à `Event.id`. **Renommer `editionId` → `eventId` est un pur renommage de colonne, sans
  remapping de valeurs ni risque d'intégrité référentielle.**
- Dans l'app jonglerie, le paramètre de route `/editions/[id]/…` (= un `Edition.id`) **est aussi
  un `Event.id`**. Les handlers d'API bénévoles requêtent les tables par `eventId` avec la **même
  valeur numérique** : la logique de routage ne change pas.

> Après le backfill, positionner `AUTO_INCREMENT` de `Event` à `MAX(Edition.id) + 1` pour éviter
> toute collision sur les futurs `Event`.

## 3. Schéma cible

### 3.1 Nouveau modèle `Event` (futur `layers/core`)

```prisma
enum EventStatus { // renommage logique de EditionStatus (mêmes valeurs)
  PLANNED
  PUBLISHED
  OFFLINE
  CANCELLED
}

model Event {
  id        Int         @id @default(autoincrement())
  name      String?     // nom d'affichage canonique (résolu, voir §5)
  startDate DateTime
  endDate   DateTime
  status    EventStatus @default(OFFLINE)
  timezone  String?
  imageUrl  String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  creatorId Int?
  creator   User?       @relation("CreatedEvents", fields: [creatorId], references: [id])

  // Extension domaine (1:1) — côté jonglerie
  edition Edition?

  // Config + relations du module bénévole (repointées)
  volunteerSettings           EventVolunteerSettings?
  volunteerApplications       EditionVolunteerApplication[]
  volunteerTeams              VolunteerTeam[]
  volunteerTimeSlots          VolunteerTimeSlot[]
  volunteerNotificationGroups VolunteerNotificationGroup[]
  volunteerComments           VolunteerComment[]

  @@index([status])
  @@index([startDate])
}
```

> Pendant l'étape 0, `Event.name/startDate/endDate/status/timezone/imageUrl` sont **alimentés par
> recopie depuis `Edition`** (voir §6). `Edition` conserve ces colonnes pour ne pas casser le reste
> de l'app. Tant que les deux coexistent, une **synchronisation** est nécessaire à l'écriture d'une
> `Edition` (voir §6.3).

### 3.2 Nouveau modèle `EventVolunteerSettings` (futur `layers/volunteers`)

Reçoit les **23 champs `volunteers*`** aujourd'hui sur `Edition` :

```prisma
model EventVolunteerSettings {
  eventId Int   @id
  event   Event @relation(fields: [eventId], references: [id], onDelete: Cascade)

  enabled              Boolean       @default(false) // ex-volunteersEnabled
  description          String?       @db.Text        // ex-volunteersDescription
  pagePublic           Boolean       @default(false) // ex-volunteersPagePublic
  open                 Boolean       @default(false) // ex-volunteersOpen
  updatedAt            DateTime?                      // ex-volunteersUpdatedAt
  externalUrl          String?                        // ex-volunteersExternalUrl
  mode                 VolunteerMode @default(INTERNAL) // ex-volunteersMode
  askDiet              Boolean       @default(false)
  askAllergies         Boolean       @default(false)
  askTimePreferences   Boolean       @default(false)
  askTeamPreferences   Boolean       @default(false)
  askPets              Boolean       @default(false)
  askMinors            Boolean       @default(false)
  askVehicle           Boolean       @default(false)
  askCompanion         Boolean       @default(false)
  askAvoidList         Boolean       @default(false)
  askSkills            Boolean       @default(false)
  askExperience        Boolean       @default(false)
  askEmergencyContact  Boolean       @default(false)
  teardownEndDate      DateTime?
  setupStartDate       DateTime?
  askSetup             Boolean       @default(false)
  askTeardown          Boolean       @default(false)
}
```

> `VolunteerMode` (enum) suit dans le layer bénévoles.

### 3.3 `Edition` modifiée (app jonglerie)

- **Ajoute** `eventId Int @unique` + relation `event`.
- **Retire** les 23 champs `volunteers*` (déplacés en §3.2).
- **Conserve** tout le reste, y compris `name/startDate/endDate/status/timezone/imageUrl`
  (mirror, hors périmètre du retrait).

```prisma
model Edition {
  id      Int   @id @default(autoincrement())
  eventId Int   @unique
  event   Event @relation(fields: [eventId], references: [id], onDelete: Cascade)

  // … tous les champs actuels SAUF les 23 volunteers* …
  // name, startDate, endDate, status, timezone, imageUrl : CONSERVÉS (mirror, voir §6.3)
  // conventionId + convention : CONSERVÉS (concept jonglerie)
  // has*Space, hasGala, jugglingEdgeUrl, etc. : CONSERVÉS

  @@index([eventId])
}
```

### 3.4 `volunteer.prisma` — repointage des 5 FK

| Modèle                        | Avant                                                     | Après                                               |
| ----------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| `EditionVolunteerApplication` | `editionId` → `Edition` ; `@@unique([editionId, userId])` | `eventId` → `Event` ; `@@unique([eventId, userId])` |
| `VolunteerNotificationGroup`  | `editionId` → `Edition`                                   | `eventId` → `Event`                                 |
| `VolunteerTeam`               | `editionId` → `Edition`                                   | `eventId` → `Event`                                 |
| `VolunteerTimeSlot`           | `editionId` → `Edition`                                   | `eventId` → `Event`                                 |
| `VolunteerComment`            | `editionId` → `Edition` ; `@@unique([userId, editionId])` | `eventId` → `Event` ; `@@unique([userId, eventId])` |

Les 3 autres tables (`VolunteerAssignment`, `ApplicationTeamAssignment`,
`VolunteerNotificationConfirmation`) **n'ont pas de `editionId`** (elles pointent vers slot / team /
application / group) → aucun changement de FK.

> Le nom de modèle `EditionVolunteerApplication` peut être renommé `EventVolunteerApplication`
> plus tard ; le garder tel quel à l'étape 0 limite le bruit (un `@@map` suffira au besoin).

## 4. Tableau de découpage des champs `Edition`

| Catégorie                     | Champs                                                                                                                                                                   | Destination                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Identité / temporel           | `name`, `startDate`, `endDate`, `status`, `timezone`, `imageUrl`                                                                                                         | **`Event`** (source de vérité) — **conservés aussi sur `Edition`** en étape 0 (mirror)        |
| Config bénévoles (23)         | `volunteers*`                                                                                                                                                            | **`EventVolunteerSettings`**                                                                  |
| Concept jonglerie             | `conventionId`/`convention`, `program`, `artistInfo`, `jugglingEdgeUrl`                                                                                                  | **`Edition`**                                                                                 |
| Espaces / amenities jonglerie | `hasAerialSpace`, `hasFireSpace`, `hasGala`, `hasOpenStage`, `hasSlacklineSpace`, `hasUnicycleSpace`, `hasLongShow`, `hasWorkshops`, `hasConcert`, `hasAfjTokenPayment`… | **`Edition`** (promouvables vers `Event` plus tard si générique)                              |
| Adresse / lieu                | `addressLine1/2`, `city`, `country`, `postalCode`, `region`, `latitude`, `longitude`                                                                                     | **`Edition`** en étape 0 (générique → promouvable vers `Event` lors de l'extraction « lieu ») |
| Autres flags modules          | `mealsEnabled`, `ticketingEnabled`, `tasksEnabled`, `stockEnabled`, `faqEnabled`, `siteMapEnabled`…                                                                      | **`Edition`** en étape 0 (migrés avec chaque module)                                          |

> Décision assumée : à l'étape 0 on **ne déplace que** les `volunteers*` (vers settings) et on
> **n'ajoute que** `eventId` à `Edition`. Tout le reste bouge plus tard, module par module.

## 5. Découplage du nom d'affichage (`convention.name`)

Le code bénévole résout aujourd'hui le nom via `edition.name || edition.convention.name`
(15+ occurrences relevées, ex. `notifications.post.ts`, `volunteer-reminders.ts`,
`applications/index.post.ts`). C'est le seul vrai couplage « jonglerie » du module.

**Cible** : le layer lit **`event.name`** (canonique). La résolution
`edition.name || convention.name` devient une **responsabilité de l'app jonglerie** : à chaque
écriture d'`Edition`, calculer le nom d'affichage et le stocker dans `Event.name`.

- Backfill : `Event.name = COALESCE(Edition.name, Convention.name)` (voir §6.2).
- Runtime : centraliser dans le service de synchronisation `Edition → Event` (§6.3).
- Refactor code : remplacer les `edition.name || edition.convention.name` du module par la lecture
  de `event.name`. Le helper existant `getEditionDisplayNameWithConvention` (app/utils) reste pour
  l'UI jonglerie, mais le **layer** ne doit plus l'appeler.

## 6. Plan de migration (SQL, MySQL)

> À placer dans une migration Prisma générée. Prisma produit le DDL des nouvelles tables/colonnes ;
> les blocs de **backfill** et de **renommage** ci-dessous sont à insérer manuellement dans le
> fichier de migration avant application.

### 6.1 Créer les tables `Event` et `EventVolunteerSettings`

DDL généré par Prisma à partir de §3.1 et §3.2 (`Event` avec PK `id`, `EventVolunteerSettings`
avec PK/FK `eventId`).

### 6.2 Backfill (id réutilisé)

```sql
-- 1) Un Event par Edition, en forçant Event.id = Edition.id
INSERT INTO `Event` (id, name, startDate, endDate, status, timezone, imageUrl, createdAt, updatedAt, creatorId)
SELECT
  e.id,
  COALESCE(e.name, c.name),      -- nom d'affichage canonique (§5)
  e.startDate, e.endDate, e.status, e.timezone, e.imageUrl,
  e.createdAt, e.updatedAt, e.creatorId
FROM `Edition` e
LEFT JOIN `Convention` c ON c.id = e.conventionId;

-- 2) Lien 1:1 : Edition.eventId = Edition.id
--    (la colonne eventId aura été ajoutée par Prisma ; la remplir avant de poser la contrainte NOT NULL/UNIQUE)
UPDATE `Edition` SET eventId = id;

-- 3) Settings bénévoles : une ligne par Event, copiée depuis Edition
INSERT INTO `EventVolunteerSettings`
  (eventId, enabled, description, pagePublic, open, updatedAt, externalUrl, mode,
   askDiet, askAllergies, askTimePreferences, askTeamPreferences, askPets, askMinors,
   askVehicle, askCompanion, askAvoidList, askSkills, askExperience, askEmergencyContact,
   teardownEndDate, setupStartDate, askSetup, askTeardown)
SELECT
  e.id, e.volunteersEnabled, e.volunteersDescription, e.volunteersPagePublic, e.volunteersOpen,
  e.volunteersUpdatedAt, e.volunteersExternalUrl, e.volunteersMode,
  e.volunteersAskDiet, e.volunteersAskAllergies, e.volunteersAskTimePreferences,
  e.volunteersAskTeamPreferences, e.volunteersAskPets, e.volunteersAskMinors,
  e.volunteersAskVehicle, e.volunteersAskCompanion, e.volunteersAskAvoidList,
  e.volunteersAskSkills, e.volunteersAskExperience, e.volunteersAskEmergencyContact,
  e.volunteersTeardownEndDate, e.volunteersSetupStartDate, e.volunteersAskSetup, e.volunteersAskTeardown
FROM `Edition` e;

-- 4) Éviter les collisions d'auto-increment sur les futurs Event
ALTER TABLE `Event` AUTO_INCREMENT = 1; -- MySQL ajuste seul au MAX(id)+1 ; sinon SET explicite
```

### 6.3 Renommage des FK bénévoles (`editionId` → `eventId`)

Comme `editionId == Event.id`, ce sont de purs renommages de colonne + bascule de la contrainte FK.
Exemple pour `EditionVolunteerApplication` (idem pour les 4 autres tables, cf. §3.4) :

```sql
ALTER TABLE `EditionVolunteerApplication`
  DROP FOREIGN KEY `EditionVolunteerApplication_editionId_fkey`;
ALTER TABLE `EditionVolunteerApplication`
  CHANGE COLUMN `editionId` `eventId` INT NOT NULL;
ALTER TABLE `EditionVolunteerApplication`
  ADD CONSTRAINT `EditionVolunteerApplication_eventId_fkey`
  FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE;
-- + recréer l'index unique : (eventId, userId) ; renommer les index editionId → eventId
```

### 6.4 Retrait des colonnes `volunteers*` d'`Edition`

```sql
ALTER TABLE `Edition`
  DROP COLUMN volunteersEnabled, DROP COLUMN volunteersDescription, DROP COLUMN volunteersPagePublic,
  DROP COLUMN volunteersOpen, DROP COLUMN volunteersUpdatedAt, DROP COLUMN volunteersExternalUrl,
  DROP COLUMN volunteersMode, DROP COLUMN volunteersAskDiet, DROP COLUMN volunteersAskAllergies,
  DROP COLUMN volunteersAskTimePreferences, DROP COLUMN volunteersAskTeamPreferences,
  DROP COLUMN volunteersAskPets, DROP COLUMN volunteersAskMinors, DROP COLUMN volunteersAskVehicle,
  DROP COLUMN volunteersAskCompanion, DROP COLUMN volunteersAskAvoidList, DROP COLUMN volunteersAskSkills,
  DROP COLUMN volunteersAskExperience, DROP COLUMN volunteersAskEmergencyContact,
  DROP COLUMN volunteersTeardownEndDate, DROP COLUMN volunteersSetupStartDate,
  DROP COLUMN volunteersAskSetup, DROP COLUMN volunteersAskTeardown;
```

### 6.5 Synchronisation runtime `Edition → Event` (tant que les colonnes coexistent)

Tant que `name/startDate/endDate/status/timezone/imageUrl` existent **à la fois** sur `Edition`
(mirror) et `Event` (source de vérité du layer), toute écriture d'`Edition` doit propager ces
champs (+ le nom d'affichage résolu) vers `Event`. À centraliser dans **un seul point** (service de
mise à jour d'édition / hook Prisma applicatif). Cette dette disparaît quand les colonnes seront
retirées d'`Edition` (étape ultérieure).

### Commande de migration (à exécuter par le porteur, **non lancée ici**)

```bash
npx prisma migrate dev --name abstract_event_volunteers
```

## 7. Rayon d'impact côté code

- **48 fichiers** (API + utils bénévoles) référencent `editionId` → renommage `editionId`/`editionId:`
  en `eventId` dans les requêtes Prisma et la résolution des includes. La valeur passée (param de
  route) reste la même (§2), donc pas de changement de contrat HTTP.
- **~15 occurrences** de `edition.name || edition.convention.name` dans le module → remplacer par
  `event.name` (§5). Fichiers concernés (relevés) : `volunteers/notifications.post.ts`,
  `volunteers/notify-schedules.post.ts`, `volunteers/add-manually.post.ts`,
  `volunteers/create-user-and-add.post.ts`, `volunteers/applications/index.post.ts`,
  `volunteers/applications/[applicationId].patch.ts`, `volunteers/notification/[groupId].get.ts`,
  `volunteers/notification/[groupId]/confirmations.get.ts`, `server/tasks/volunteer-reminders.ts`.
- **Lecture des settings** : tout accès `edition.volunteersXxx` (API settings, store `editions`,
  pages `gestion/volunteers/config.vue` & `form.vue`) devient `event.volunteerSettings.xxx`.
- **Helpers Prisma** : adapter les `include`/`select` bénévoles dans
  `server/utils/prisma-select-helpers.ts` (passer par `event`).

## 8. Sous-phasage recommandé (dérisquage)

| Sous-étape | Contenu                                                                                                                            | Réversibilité             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **0a**     | Tables `Event` + `EventVolunteerSettings` + backfill (§6.1–6.2) + `Edition.eventId`. **Sans** retrait de colonnes ni renommage FK. | Élevée (purement additif) |
| **0b**     | Renommage des 5 FK (§6.3) + refactor code bénévole (`eventId`, `event.name`, `event.volunteerSettings`).                           | Moyenne                   |
| **0c**     | Retrait des 23 colonnes `volunteers*` d'`Edition` (§6.4) une fois 0b validé en prod.                                               | Faible (destructif)       |

Faire **0a seule** d'abord : elle est additive, testable, et ne casse rien. N'enchaîner sur 0b/0c
qu'après validation. La synchro runtime (§6.5) est mise en place dès 0a.

## 9. Points de vigilance

- **Tests** : adapter les seeds (`prisma/seed.ts`) et les fixtures qui créent des `Edition` avec des
  champs `volunteers*` → créer aussi `Event` + `EventVolunteerSettings`.
- **`onDelete`** : `Event` cascade vers `Edition` et vers les tables bénévoles ; vérifier qu'une
  suppression d'`Edition` (aujourd'hui cascade) reste cohérente (supprimer l'`Event` parent, qui
  cascade le reste).
- **Renommage enum** `EditionStatus` → `EventStatus` : optionnel à l'étape 0 (peut rester
  `EditionStatus` pour limiter le bruit ; renommer plus tard avec `@@map`).
- **Sitemap** `__sitemap__/volunteers` : lit `volunteersPagePublic` → passe par
  `event.volunteerSettings.pagePublic`.
