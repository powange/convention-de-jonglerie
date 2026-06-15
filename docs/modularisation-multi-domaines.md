# Modularisation multi-domaines (monorepo + Nuxt layers)

> **Statut** : proposition d'architecture (non implémentée).
> **Date** : 2026-06-14.
> **Objectif** : permettre la création d'une **2ᵉ application** pour d'autres domaines que la
> jonglerie, partageant les modules organisateurs (bénévoles, tâches, billetterie…) avec
> l'application actuelle, de sorte qu'une mise à jour d'un module se répercute sur les deux apps.

## 1. Contexte et décisions cadrées

Cible validée avec le porteur du projet :

| Question | Décision |
| --- | --- |
| Deux apps séparées ou plateforme multi-domaines unique ? | **Deux apps séparées** (déploiements + bases de données distincts) |
| Le nouveau domaine ressemble-t-il à la jonglerie ? | **Forme similaire** (organisation faisant des événements datés avec bénévoles / billetterie / tâches) |
| Module pilote de la modularisation | **Gestion bénévole** |

Conséquence : on vise un **monorepo** où le code partagé vit dans des **Nuxt layers**, chaque
application ayant sa propre base de données et son propre déploiement.

## 2. Le constat central

Les modules organisateurs **ne sont pas couplés à la jonglerie** : ils sont couplés à l'entité
`Edition`.

Le module bénévole (~95 fichiers) ne contient aucune logique spécifique au jonglage. Il sait
seulement qu'il existe un **conteneur d'événement** (`Edition`) auquel se rattachent des
candidatures, des équipes, des créneaux, des repas. Toute la logique métier (validation,
auto-assignation, notifications, QR codes, éligibilité repas) est générique.

La seule chose réellement « jonglerie » se trouve **sur le modèle `Edition`/`Convention`**
lui-même (champs `aerialSpace`, `fireSpace`, `slacklineSpace`, `gala`, la notion de convention
annuelle…).

```
Aujourd'hui :   Volunteer ──FK(editionId)──> Edition (jonglerie)

Cible :         Volunteer ──FK(eventId)──> Event (abstrait) <──1:1── Edition  (jonglerie)
                                                            <──1:1── AutreChose (nouveau domaine)
```

La frontière de modularisation est donc nette. Le travail incontournable consiste à **abstraire
le conteneur d'événement** (`Edition` → `Event`). Ce couplage est en **base de données** (clés
étrangères `editionId` partout), pas seulement en code : c'est le vrai point dur.

## 3. État actuel (atouts / obstacles)

### Atouts

- **Frontière client/serveur parfaite** : `app/` n'importe jamais `server/`, tout passe par HTTP.
- **Schéma Prisma déjà découpé par domaine** : `prisma/schema/volunteer.prisma`,
  `ticketing.prisma`, `tasks.prisma`, `meals.prisma`, etc. Extraction facilitée.
- **Dossier `shared/` + alias `#shared/`** déjà présents (embryon de code partagé).
- **Logique métier bénévole isolée** dans `server/utils/editions/volunteers/` et composables
  dédiés (`useVolunteerSchedule`, `useVolunteerTeams`, `useVolunteerTimeSlots`…).

### Obstacles

- **Base de données unique + tables `User` et `Edition` centrales** : tous les modèles ont une FK
  vers `Edition`. C'est le mur principal.
- **Application monolithique** : pas de workspaces npm, pas de Nuxt layers.
- **i18n** : locales en dur dans `nuxt.config.ts` ; l'outillage lit `i18n/locales/{lang}/` à plat.
- **Auth/sessions centralisées** : un seul `User`, `nuxt-auth-utils`.

## 4. Architecture cible

```
convention-platform/                  (monorepo, pnpm workspaces)
├── apps/
│   ├── jonglerie/                     ← l'app actuelle, allégée
│   │   ├── prisma/schema/             ← fragments composés (core + layers + edition.prisma)
│   │   ├── nuxt.config.ts             ← extends: core, volunteers, ticketing, tasks…
│   │   └── (base de données A)
│   └── autre-domaine/
│       ├── prisma/schema/             ← core + layers + son propre <domaine>.prisma
│       ├── nuxt.config.ts
│       └── (base de données B)
├── layers/
│   ├── core/                          ← User, auth, Event (générique), notifications, messenger
│   ├── volunteers/                    ← PILOTE : pages + api + composables + i18n + volunteer.prisma
│   ├── tasks/
│   ├── ticketing/
│   └── meals/ …
└── packages/                          (optionnel : utils purs, design tokens)
```

Un Nuxt layer embarque **pages, composants, composables ET `server/api/`** : le module bénévole
part en entier (front + back) dans `layers/volunteers`. Les deux applications font :

```ts
// apps/jonglerie/nuxt.config.ts
export default defineNuxtConfig({
  extends: ['../../layers/core', '../../layers/volunteers', '../../layers/tasks'],
})
```

On modifie le layer → les deux apps en héritent au prochain build. **C'est le mécanisme de
propagation du code.**

## 5. L'abstraction `Event` (prérequis n°1)

`Edition` devient une **extension 1:1** d'un `Event` générique.

```prisma
// layers/core/prisma/event.prisma
model Event {
  id        Int       @id @default(autoincrement())
  name      String
  startDate DateTime
  endDate   DateTime
  status    EventStatus @default(DRAFT)

  // Flags d'activation des modules (génériques)
  volunteersEnabled Boolean @default(false)
  tasksEnabled      Boolean @default(false)
  mealsEnabled      Boolean @default(false)
  ticketingEnabled  Boolean @default(false)
  // …

  // Relations vers les modules (fournies par les layers, voir §6)
  // volunteerApplications EditionVolunteerApplication[]
  // …

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// apps/jonglerie/prisma/edition.prisma  (spécifique jonglerie)
model Edition {
  id      Int   @id @default(autoincrement())
  eventId Int   @unique
  event   Event @relation(fields: [eventId], references: [id], onDelete: Cascade)

  // Champs purement jonglerie
  aerialSpace    Boolean @default(false)
  fireSpace      Boolean @default(false)
  slacklineSpace Boolean @default(false)
  gala           Boolean @default(false)
  // … convention, line-up, etc.
}
```

### Où vont les champs actuels d'`Edition` ?

| Catégorie | Destination |
| --- | --- |
| Génériques (dates, nom, statut, flags `*Enabled`) | `Event` (core) |
| Config bénévoles (`volunteersMode`, `volunteersAsk*`, `volunteersSetupStartDate`…) | `Event` **ou** table `EventVolunteerSettings` portée par `layers/volunteers` (recommandé pour ne pas alourdir `Event`) |
| Purement jonglerie (`aerialSpace`, `fireSpace`, `gala`, line-up…) | `Edition` (app jonglerie) |

> **Recommandation** : sortir la configuration spécifique d'un module **dans une table dédiée
> portée par le layer du module** (ex. `EventVolunteerSettings`). Cela garde `Event` mince et évite
> que `layers/core` connaisse les détails de chaque module.

## 6. Stratégie Prisma avec deux bases séparées

C'est le seul vrai obstacle. Il faut être lucide sur la distinction code / schéma.

- **Le code se propage automatiquement** via le lien de workspace (pnpm). ✅
- **Le schéma se propage, mais les migrations restent par application.** Prisma ne fusionne pas
  nativement des schémas entre packages, et chaque app a sa propre base. La mécanique :

  1. Chaque layer fournit un **fragment** de schéma (ex. `layers/volunteers/prisma/volunteer.prisma`)
     dont les FK pointent vers `Event` (fourni par `layers/core`).
  2. Un script de `prepare` **copie/assemble** les fragments des layers dans le `prisma/schema/`
     de chaque app, à côté de son fragment de domaine (`edition.prisma` pour la jonglerie). Prisma
     lit tous les `.prisma` d'un dossier (`schema = "prisma/schema"`), donc l'assemblage par copie
     suffit — pas besoin d'outil de merge.
  3. Quand on modifie `volunteer.prisma` dans le layer → chaque app régénère et lance **son
     propre** `prisma migrate dev` sur **sa** base.

**Bilan de la propagation :**

| Type de changement | Propagation |
| --- | --- |
| Code (pages, composables, API, composants) | Automatique (workspace) |
| Schéma DB | Automatique au niveau fichier, mais **une migration à lancer par app** |

C'est le compromis inévitable de « deux bases séparées ». Il est acceptable : un changement de
schéma d'un module devient « régénérer + migrer » dans chaque app, et non « réécrire le module ».

> ⚠️ **Rappel projet** : les migrations Prisma ne sont jamais exécutées par l'assistant. On fournit
> uniquement les commandes ; le porteur du projet crée et applique les migrations.

## 7. Dépendances transverses du module bénévole

Le module bénévole **n'est pas 100 % autonome**. Il consomme aujourd'hui :

- **Messenger** : `ensureVolunteerConversations` (création de conversations d'équipe).
- **Service de notifications** : `server/utils/notification-service.ts` (`safeNotify`).
- **Repas** : `VolunteerMeal`, `VolunteerMealSelection`, éligibilité (`volunteer-meals.ts`).
- **Billetterie** : QR d'entrée (`entryValidated`), handout items bénévoles.

### Découpage des responsabilités

- `layers/core` : `User`, auth, **service de notifications**, **messenger** (ce sont des socles
  transverses, pas spécifiques aux bénévoles).
- `layers/volunteers` : tout le bénévolat, **mais consomme des interfaces** plutôt que les
  implémentations concrètes :

```ts
// Le layer volunteers dépend d'un contrat, pas de l'implémentation jonglerie
interface NotificationPort { notify(input: NotifyInput): Promise<void> }
interface MessengerPort   { ensureConversation(input: EnsureConvInput): Promise<ConversationRef> }
```

- **Repas** et **billetterie** deviendront leurs propres layers. En attendant, le couplage
  bénévoles↔repas/billetterie est traité via interfaces (le layer volunteers définit les ports ;
  l'app les câble sur les implémentations disponibles).

## 8. Plan d'extraction du pilote bénévole (par étapes livrables)

### Étape 0 — Abstraction `Event` (dans le repo actuel)

- Introduire le modèle `Event` + faire d'`Edition` une extension 1:1.
- **Migration de données** : créer 1 `Event` par `Edition` existante, recopier les champs
  génériques.
- Repointer les FK du module bénévole `editionId → eventId`.

> C'est la migration la plus délicate. À faire **seule**, avec sauvegarde et tests dédiés.
> Commande de migration à fournir au porteur (non exécutée) :
> `npx prisma migrate dev --name abstract_event_volunteers`
>
> 📄 **Conception détaillée + SQL de migration** : voir
> [etape-0-abstraction-event.md](./etape-0-abstraction-event.md).

### Étape 1 — Isoler les dépendances transverses

- Déplacer notifications + messenger dans une frontière « core » logique.
- Définir les **ports** (`NotificationPort`, `MessengerPort`, et plus tard `MealsPort`,
  `TicketingPort`) consommés par le code bénévole.

> 📄 **Conception détaillée des ports + injection** : voir
> [etape-1-ports-decouplage.md](./etape-1-ports-decouplage.md).

### Étape 2 — Extraire en Nuxt layer (toujours dans le repo actuel)

Déplacer dans `layers/volunteers/` :

| Type | Chemins actuels |
| --- | --- |
| API | `server/api/editions/[id]/volunteers/**`, `.../volunteer-teams/**`, `.../volunteer-time-slots/**` |
| Utils serveur | `server/utils/editions/volunteers/**`, `server/utils/volunteer-scheduler.ts`, `server/utils/volunteer-meals.ts`, `server/utils/permissions/volunteer-permissions.ts` |
| Composants | `app/components/edition/volunteer/**`, `app/components/volunteers/**` |
| Composables | `app/composables/useVolunteer*.ts` |
| Pages | `app/pages/editions/[id]/gestion/volunteers/**`, `app/pages/editions/[id]/volunteers/**` |
| Utils front | `app/utils/volunteer-application-api.ts`, `app/utils/volunteer-stats.ts` |
| i18n | clés `gestion-volunteers` (+ équivalent public) |
| Prisma | `prisma/schema/volunteer.prisma` |

L'app fait `extends: ['../layers/volunteers']`. **À ce stade, tout doit fonctionner sans
changement fonctionnel** : c'est le test de validité de la frontière.

> 📄 **Arborescence détaillée + fichiers frontière + i18n du layer** : voir
> [etape-2-layer-volunteers.md](./etape-2-layer-volunteers.md).

> ✅ On peut **s'arrêter ici et avoir déjà gagné** (module isolé, frontière validée), sans
> s'engager dans le monorepo tant que la 2ᵉ app n'est pas prête.

### Étape 3 — Passer en monorepo

- `apps/jonglerie` = repo actuel déplacé ; `layers/*` extraits ; pnpm workspaces.
- Dédoubler la CI/CD et les fichiers Docker.

> 📄 **Détail** : workspace, déplacement git, composition Prisma, Docker, CI → voir
> [etape-3-monorepo.md](./etape-3-monorepo.md).

### Étape 4 — Créer la 2ᵉ app

- `apps/autre-domaine` avec `extends: ['core', 'volunteers']`, son propre `<domaine>.prisma`, sa
  propre base. Premier vrai test de réutilisation.

> 📄 **Détail** : squelette, modèle de domaine, binding des ports, branding, déploiement, boucle de
> validation → voir [etape-4-deuxieme-app.md](./etape-4-deuxieme-app.md).

## 9. Pièges spécifiques à ce codebase

- **i18n** : locales en dur dans `nuxt.config.ts`, outillage (`check-i18n`, lazy-loading) qui lit
  `i18n/locales/{lang}/` à plat. Les layers peuvent fournir leurs traductions, mais l'outillage
  i18n devra être adapté pour scanner les layers. Voir `docs/optimization/i18n-lazy-loading.md`.
- **Auto-imports Nuxt** : composables/composants des layers sont auto-importés → attention aux
  **collisions de noms** entre layers.
- **Table `User` + sessions** : restent dans `core`. Bases séparées ⇒ comptes distincts par app
  (pas de SSO sauf chantier dédié).
- **`prisma-select-helpers.ts`** : les helpers bénévoles suivent dans le layer ; les helpers `User`
  restent dans core. Voir `docs/prisma-select-helpers.md`.
- **Permissions** : `server/utils/permissions/volunteer-permissions.ts` suit le layer, mais dépend
  du socle de permissions organisateur (`docs/system/ORGANIZER_PERMISSIONS.md`) qui doit vivre dans
  `core`.

## 10. Estimation

| Étape | Charge indicative | Valeur |
| --- | --- | --- |
| 0–1 (abstraction `Event` + découplage services) | Le gros du risque, ~quelques jours | Prérequis |
| 2 (layer dans le repo actuel) | Rapide une fois 0–1 fait | **Utile immédiatement, même sans 2ᵉ app** |
| 3–4 (monorepo + 2ᵉ app) | 2–3 jours de plomberie (CI, Docker, compose Prisma) | Active la 2ᵉ app |

## 11. Synthèse

1. Le couplage réel est à `Edition`, pas à la jonglerie → abstraction `Event` = 80 % de la valeur.
2. Propagation du **code** = gratuite (workspace + layers) ; propagation du **schéma DB** = une
   migration par app (compromis assumé des bases séparées).
3. Séquence dérisquée : chaque étape est livrable et testable ; on ne paie le coût « monorepo »
   que lorsque la 2ᵉ app est réellement décidée.
