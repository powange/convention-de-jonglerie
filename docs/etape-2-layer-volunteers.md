# Étape 2 — Extraction du `layers/volunteers`

> **Statut** : proposition de conception (non implémentée).
> **Date** : 2026-06-15.
> **Prérequis** : [etape-0-abstraction-event.md](./etape-0-abstraction-event.md) (schéma `Event`) et
> [etape-1-ports-decouplage.md](./etape-1-ports-decouplage.md) (ports). Réalisable **dans le repo
> actuel**, avant tout passage en monorepo (étape 3).

## 1. Objectif et principe

Extraire le module bénévole dans un **Nuxt layer** autonome que les deux apps consommeront via
`extends`. Un layer embarque `app/` (pages, composants, composables), `server/` (api, utils, tasks,
plugins) et son **fragment Prisma**. Critère de réussite : **après extraction, l'app jonglerie se
comporte exactement comme avant**, seul l'emplacement du code change.

```
layers/volunteers/  ──extends──>  apps/jonglerie  (+ futur apps/autre-domaine)
```

## 2. Arborescence cible du layer

```
layers/volunteers/
├── nuxt.config.ts                  # config du layer (i18n, composants, etc.)
├── package.json                    # nom @cdj/layer-volunteers (utile en monorepo)
├── app/
│   ├── components/
│   │   ├── edition/volunteer/**    # 21 composants (Table, planning/*, notifications/*, …)
│   │   └── volunteers/**           # 8 composants (AddVolunteerModal, VolunteerCard, …)
│   ├── composables/
│   │   ├── useVolunteerSchedule.ts
│   │   ├── useVolunteerSettings.ts
│   │   ├── useVolunteerTeams.ts
│   │   └── useVolunteerTimeSlots.ts
│   ├── pages/
│   │   ├── editions/[id]/gestion/volunteers/**   # applications, config, form, notifications, planning, teams, page
│   │   └── editions/[id]/volunteers/**           # index, notification/[groupId]/confirm
│   └── utils/
│       ├── allergy-severity.ts
│       ├── volunteer-application-api.ts
│       └── volunteer-stats.ts
├── server/
│   ├── api/
│   │   ├── editions/[id]/volunteers/**           # ~35 endpoints
│   │   ├── editions/[id]/volunteer-teams/**
│   │   ├── editions/[id]/volunteer-time-slots/**
│   │   └── user/volunteer-applications.get.ts
│   ├── utils/
│   │   ├── editions/volunteers/**                # applications.ts, teams.ts, …
│   │   ├── volunteer-scheduler.ts
│   │   ├── volunteer-meals.ts
│   │   ├── volunteer-application-diff.ts
│   │   └── permissions/volunteer-policy.ts       # politique seule (voir §3.4)
│   ├── ports/                                    # interfaces (étape 1)
│   │   ├── notification.port.ts / email.port.ts / messenger.port.ts / organizer-directory.port.ts
│   │   └── registry.ts
│   ├── emails/
│   │   └── VolunteerScheduleEmail.vue
│   └── tasks/
│       └── volunteer-reminders.ts
├── i18n/locales/{lang}/
│   ├── volunteers.json                           # namespace { volunteers: … }
│   └── gestion-volunteers.json                   # namespace { gestion: { volunteers: … } }
└── prisma/
    ├── volunteer.prisma                          # 5 modèles repointés sur Event (étape 0)
    └── event-volunteer-settings.prisma           # EventVolunteerSettings (étape 0)
```

### Table de correspondance (source actuelle → layer)

| Type            | Source                                                                                                                 | Destination layer          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| API bénévoles   | `server/api/editions/[id]/{volunteers,volunteer-teams,volunteer-time-slots}/**`                                        | `server/api/…` (identique) |
| API user        | `server/api/user/volunteer-applications.get.ts`                                                                        | `server/api/user/…`        |
| Utils           | `server/utils/editions/volunteers/**`, `volunteer-scheduler.ts`, `volunteer-meals.ts`, `volunteer-application-diff.ts` | `server/utils/…`           |
| Email           | `server/emails/VolunteerScheduleEmail.vue`                                                                             | `server/emails/…`          |
| Tâche planifiée | `server/tasks/volunteer-reminders.ts`                                                                                  | `server/tasks/…`           |
| Composants      | `app/components/edition/volunteer/**`, `app/components/volunteers/**`                                                  | `app/components/…`         |
| Composables     | `app/composables/useVolunteer*.ts`                                                                                     | `app/composables/…`        |
| Pages           | `app/pages/editions/[id]/{gestion/volunteers,volunteers}/**`                                                           | `app/pages/…`              |
| Utils front     | `app/utils/{allergy-severity,volunteer-application-api,volunteer-stats}.ts`                                            | `app/utils/…`              |
| i18n            | `i18n/locales/*/volunteers.json`, `gestion-volunteers.json`                                                            | `i18n/locales/…`           |
| Prisma          | `prisma/schema/volunteer.prisma` (+ `EventVolunteerSettings`)                                                          | `prisma/…`                 |

## 3. Fichiers « frontière » (inter-modules) — décisions

Ces fichiers touchent plusieurs domaines : ils ne suivent **pas** mécaniquement le layer.

| Fichier(s)                                                                                                                                 | Nature du couplage                                                                               | Décision                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `server/api/conventions/[id]/volunteers/[userId]/comment.*`                                                                                | `VolunteerComment` (modèle bénévole) mais route sous `conventions` (concept jonglerie)           | **Déplacer la logique** dans le layer, **mais re-router** sous `editions/[id]/volunteers/[userId]/comment` (scope event) pour être agnostique. Refactor à prévoir. |
| `server/api/editions/[id]/ticketing/volunteers*`, `app/components/ticketing/{VolunteerDetailsCard,TicketingVolunteerHandoutItemsList}.vue` | Intersection **billetterie × bénévoles** (`EditionVolunteerHandoutItem`, validation d'entrée QR) | **Rester dans la billetterie** (futur `layers/ticketing`). Consomme les données bénévoles via un futur `VolunteerPort` (lecture) ou la DB.                         |
| `server/api/messenger/volunteer-to-organizers.post.ts`                                                                                     | Endpoint messenger spécifique bénévoles                                                          | **Rester dans l'app** comme glue ; délègue au `MessengerPort` / `OrganizerDirectoryPort` (étape 1).                                                                |
| `server/api/__sitemap__/volunteers.get.ts`                                                                                                 | SEO, lit `volunteersPagePublic`                                                                  | **Déplacer dans le layer** ; lit `event.volunteerSettings.pagePublic`.                                                                                             |
| `app/pages/guide/volunteer.vue`, `app/pages/guide/organizer/volunteers.vue`                                                                | Contenu d'aide rédigé, orienté produit jonglerie                                                 | **Rester dans l'app** (contenu spécifique au produit). Chaque app a son propre guide.                                                                              |
| `scripts/{assign-meals-to-accepted-volunteers,check-volunteer-tokens,debug-volunteer-meals,generate-volunteer-qr-tokens}.ts`               | Scripts ops ponctuels                                                                            | **Déplacer dans le layer** (`scripts/`), faible priorité.                                                                                                          |

### 3.4 Permissions — scinder politique et résolution

`server/utils/permissions/volunteer-permissions.ts` mêle **politique** (« il faut le droit
_gérer les bénévoles_ ») et **résolution** (lecture de `ConventionOrganizer` /
`EditionOrganizerPermission`, spécifique au modèle jonglerie).

- **Politique** → `layers/volunteers/server/utils/permissions/volunteer-policy.ts` (agnostique).
- **Résolution** → via le port (étape 1), enrichi :

```ts
export interface OrganizerDirectoryPort {
  getVolunteerManagers(eventId: number): Promise<number[]>
  canManageVolunteers(userId: number, eventId: number): Promise<boolean> // ← ajout
  canReadVolunteers(userId: number, eventId: number): Promise<boolean> // ← ajout
}
```

L'app câble ces méthodes sur son modèle de permissions concret.

## 4. Configuration `extends` et alias

```ts
// apps/jonglerie/nuxt.config.ts (ou nuxt.config.ts actuel, en attendant le monorepo)
export default defineNuxtConfig({
  extends: ['./layers/volunteers'], // chemin relatif (repo actuel) ou '../../layers/volunteers' (monorepo)
})
```

```ts
// layers/volunteers/nuxt.config.ts
export default defineNuxtConfig({
  // i18n, composants prefix, etc. (voir §5, §6)
})
```

- **Alias** : exposer `#layers/volunteers/*` (ports/registry) via `alias` dans la config app, ou
  `imports`/`nitro.alias`. Les imports serveur du layer continuent d'utiliser `#server/*` (fournis
  par l'app/core), d'où la nécessité que **les services concrets référencés vivent dans l'app**
  (rappel étape 1 : le layer ne référence que ses **ports**, jamais `#server/utils/notification-service`).
- **Ordre de `extends`** : le layer est surchargé par l'app (l'app peut override un composant/clé i18n
  du layer en plaçant un fichier de même chemin). Utile pour personnaliser par domaine.

## 5. i18n dans un layer (le point dur)

Le projet n'utilise **pas** le merge i18n standard : il a un **lazy-loading custom**
(`app/utils/translation-loaders.ts`) avec un mapping route→domaines et des `import()` codés en dur
(`~~/i18n/locales/{lang}/{domaine}.json`). Conséquences :

1. **Déplacer** `volunteers.json` et `gestion-volunteers.json` (13 langues) dans
   `layers/volunteers/i18n/locales/`.
2. **Adapter le loader** : les `import('~~/i18n/locales/…')` des domaines `volunteers` /
   `gestion-volunteers` doivent pointer vers le layer. Deux options :
   - **(a)** le layer **enregistre** ses domaines auprès d'un registre de loaders (le loader central
     scanne une liste de contributions de layers au lieu d'une map figée) — cible propre ;
   - **(b)** transitoire : garder les `import()` dans le loader de l'app mais avec le chemin du layer.
3. **Mapping route→domaines** (lignes 66–116 de `translation-loaders.ts`) : déplacer ces entrées
   dans une **contribution du layer** (le layer déclare « les routes `…/volunteers` chargent
   `volunteers` (+ `gestion-volunteers`) »).
4. **Outillage** `check-i18n` / `check-translations` : adapter pour scanner aussi
   `layers/*/i18n/locales/` (cf. `scripts/check-i18n.js` qui fusionne les fichiers à plat).
   Voir `docs/optimization/i18n-lazy-loading.md`.

> Les namespaces restent inchangés (`{ volunteers: … }` et `{ gestion: { volunteers: … } }`), donc
> **aucune clé `$t(...)` à modifier** dans les composants/pages.

## 6. Auto-imports et collisions

- Composables (`useVolunteer*`), composants et utils du layer sont **auto-importés** comme ceux de
  l'app. Vérifier l'absence de **collision de noms** entre layers (préfixer si besoin via
  `components: { prefix: 'Vol' }` dans la config du layer, ou conserver l'arborescence
  `edition/volunteer/**` qui génère déjà des noms préfixés type `EditionVolunteer*`).
- `app/utils/allergy-severity.ts` est **générique** (sévérité d'allergie) : si un autre layer en a
  besoin, le promouvoir plus tard vers `shared/` plutôt que de le dupliquer.

## 7. Fragment Prisma du layer

- `layers/volunteers/prisma/volunteer.prisma` : les 5 modèles **déjà repointés sur `Event`**
  (étape 0). Les FK pointent vers `Event` (fourni par `core`), jamais vers `Edition`.
- `layers/volunteers/prisma/event-volunteer-settings.prisma` : `EventVolunteerSettings`.
- **Composition** : un script `prepare` copie ces fragments dans `apps/<app>/prisma/schema/` (cf.
  [modularisation-multi-domaines.md](./modularisation-multi-domaines.md) §6). Dans le repo actuel
  (avant monorepo), les fichiers peuvent rester sous `prisma/schema/` — la séparation logique est ce
  qui compte à l'étape 2 ; la composition physique arrive à l'étape 3.

## 8. Tests, seeds, fixtures

- Déplacer les tests bénévoles (`test/nuxt/**`, `test/unit/**`, `test/e2e/**` ciblant les bénévoles)
  vers le layer, ou les garder dans l'app le temps de stabiliser (ils testent l'intégration).
- Les **seeds** (`prisma/seed.ts`) doivent créer `Event` + `EventVolunteerSettings` (cf. étape 0 §9).
- Les tests du layer peuvent **injecter un `VolunteerPorts` factice** (étape 1 §8) au lieu de mocker
  les services concrets → tests plus isolés.

## 9. Ordre d'application et dérisquage

1. Créer `layers/volunteers/` et **déplacer** les fichiers (§2) sans rien renommer d'autre que les
   imports de ports (étape 1) et `editionId → eventId` (étape 0).
2. Ajouter `extends: ['./layers/volunteers']` + le plugin Nitro de binding des ports (étape 1).
3. Adapter l'i18n (§5) — c'est le poste le plus sensible.
4. Lancer la suite de tests : **comportement identique** attendu.
5. Traiter les fichiers frontière (§3) un par un.

> On peut **s'arrêter après l'étape 2** : le module est isolé et réutilisable, sans monorepo ni 2ᵉ
> app. C'est le palier « rentable » du plan.

## 10. Checklist d'extraction

- [ ] `layers/volunteers/` créé + `nuxt.config.ts` + `package.json`.
- [ ] Composants / composables / pages / utils front déplacés (§2).
- [ ] API / utils serveur / email / tâche planifiée déplacés (§2).
- [ ] Ports + registry en place ; plugin Nitro de binding dans l'app (étape 1).
- [ ] FK `eventId` et lectures `event.name` / `event.volunteerSettings.*` (étape 0).
- [ ] i18n : fichiers déplacés, loader + mapping route adaptés, outillage `check-i18n` mis à jour.
- [ ] Fichiers frontière traités (comment → event-scoped ; ticketing/messenger via ports ; guides
      restent dans l'app).
- [ ] Permissions scindées (politique dans le layer, résolution via port).
- [ ] Tests verts (non-régression) + seeds à jour.
