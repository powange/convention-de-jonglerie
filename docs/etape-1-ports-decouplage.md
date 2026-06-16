# Étape 1 — Ports & découplage des dépendances transverses

> **Statut** : ✅ **Implémenté** (sur `main`, déployé en release). **8 ports** livrés
> (`notifications`, `email`, `messenger`, `organizers`, `eventScope`, `ticketing`, `artists`, `meals`)
> dans `server/volunteers/ports/`, binding par défaut paresseux via `useVolunteerPorts()` / surcharge
> `setVolunteerPorts()`. Les couplages billetterie/artistes/repas sont désormais découplés (le
> `MealsPort` délègue au module cœur `server/meals/`). Voir la section _Avancement_ de
> [modularisation-multi-domaines.md](./modularisation-multi-domaines.md).
> **Date** : 2026-06-15 (conception), mise à jour 2026-06-17.
>
> 📌 **Ce document est le plan de conception** ; l'implémentation a divergé (emplacement, signatures,
> ajout d'`eventScope` à l'étape 0bis, puis `ticketing`/`artists`/`meals`). Pour la référence **à
> jour** des 8 ports et de leurs contrats, voir [ports-module-benevole.md](./ports-module-benevole.md).
> **Prérequis** : [modularisation-multi-domaines.md](./modularisation-multi-domaines.md) §7 et §8 ;
> conçu pour être **appliqué lors de l'étape 2** (extraction en layer), après l'étape 0
> ([etape-0-abstraction-event.md](./etape-0-abstraction-event.md)).

## 1. Objectif

Le module bénévole importe aujourd'hui **directement** des services concrets de l'app
(`notification-service`, `messenger-helpers`, `emailService`). Pour qu'il devienne un layer
réutilisable par une 2ᵉ app, il ne doit plus dépendre d'implémentations concrètes mais de **ports**
(interfaces) qu'il **consomme**, et que **l'app câble** sur ses propres implémentations.

```
Aujourd'hui :   volunteers/*  ──import direct──> NotificationService, ensureVolunteerConversations…

Cible :         volunteers/*  ──> Ports (interfaces) <──implémente── app jonglerie (binding)
                                                      <──implémente── app autre-domaine (binding)
```

Périmètre de l'étape 1 : **définir les ports + le mécanisme d'injection + la cartographie des sites
d'appel**. Le câblage effectif (réécriture des imports) se fait à l'étape 2.

## 2. Surfaces de couplage relevées

### 2.1 Notifications in-app — `NotificationService.create` / `safeNotify`

Signature réelle (`server/utils/notification-service.ts`) :

```ts
interface CreateNotificationData {
  userId: number
  type: NotificationType            // enum Prisma
  category?: string
  entityType?: string
  entityId?: string
  actionUrl?: string
  notificationType?: CustomNotificationType  // pour filtrer selon préférences
  // système de traduction
  titleKey?: string; messageKey?: string
  translationParams?: Record<string, any>; actionTextKey?: string
  // OU texte libre
  titleText?: string; messageText?: string; actionText?: string
}
NotificationService.create(data): Promise<Notification | null>
safeNotify<T>(operation: () => Promise<T>, context?: string): Promise<T | null>
```

Appelé dans : `applications/[applicationId].patch.ts`, `notifications.post.ts`,
`notify-schedules.post.ts`, `server/tasks/volunteer-reminders.ts`.

### 2.2 Email transactionnel — `sendEmail`

Appelé dans : `create-user-and-add.post.ts` (email de vérification), `notify-schedules.post.ts`
(envoi des plannings). Dépend de `#server/utils/emailService`.

### 2.3 Messenger — `messenger-helpers.ts`

```ts
ensureVolunteerConversations(editionId: number, teamId: string, userId: number, tx?): Promise<void>
ensureVolunteerToOrganizersConversation(editionId: number, volunteerId: number, tx?): Promise<string>
```

Appelé dans : `server/utils/editions/volunteers/teams.ts` (assignation/retrait d'équipe).

⚠️ **Couplage profond** : `ensureVolunteerToOrganizersConversation` lit `Edition.conventionId` puis
les `ConventionOrganizer`/`EditionOrganizerPermission` avec `canManageVolunteers`. Il connaît donc
le concept `Convention` **et** le modèle de permissions. Le port doit **masquer** cette résolution :
le layer demande « assure une conversation entre ce bénévole et ceux qui gèrent les bénévoles » ;
**l'app** sait qui ils sont.

### 2.4 Résolution « qui gère les bénévoles »

Ce besoin (lister les userId des gestionnaires de bénévoles d'un event) apparaît aussi ailleurs
(notifications aux orgas). Il dépend du modèle de permissions, spécifique à l'app → port dédié.

## 3. Ports à définir (dans `layers/volunteers`)

Les interfaces vivent dans le layer (`layers/volunteers/server/ports/`). Le layer ne contient
**que les types** ; aucune implémentation.

```ts
// layers/volunteers/server/ports/notification.port.ts
export interface NotifyInput {
  userId: number
  type: string // mappé sur l'enum de l'app côté implémentation
  actionUrl?: string
  notificationType?: string // clé de préférence
  // traduction
  titleKey?: string
  messageKey?: string
  translationParams?: Record<string, unknown>
  actionTextKey?: string
  // OU texte libre
  titleText?: string
  messageText?: string
  actionText?: string
  // métadonnées optionnelles
  category?: string
  entityType?: string
  entityId?: string
}
export interface NotificationPort {
  notify(input: NotifyInput): Promise<void> // englobe déjà le « safe » (n'échoue pas)
  notifyMany(inputs: NotifyInput[]): Promise<void>
}
```

```ts
// layers/volunteers/server/ports/email.port.ts
export interface SendEmailInput {
  to: string
  subject: string
  html?: string
  text?: string
}
export interface EmailPort {
  send(input: SendEmailInput): Promise<boolean>
}
```

```ts
// layers/volunteers/server/ports/messenger.port.ts
import type { PrismaTransaction } from '#server/types/prisma-helpers'
export interface MessengerPort {
  // équipe ⇄ bénévole (ex-ensureVolunteerConversations)
  ensureTeamConversation(input: {
    eventId: number
    teamId: string
    userId: number
    tx?: PrismaTransaction
  }): Promise<void>
  // bénévole ⇄ gestionnaires de bénévoles (ex-ensureVolunteerToOrganizersConversation)
  ensureVolunteerToManagersConversation(input: {
    eventId: number
    volunteerId: number
    tx?: PrismaTransaction
  }): Promise<string>
}
```

```ts
// layers/volunteers/server/ports/organizer-directory.port.ts
export interface OrganizerDirectoryPort {
  // userId des personnes habilitées à gérer les bénévoles de cet event
  getVolunteerManagers(eventId: number): Promise<number[]>
}
```

> **✅ Faits depuis** : `TicketingPort`, `ArtistsPort` et `MealsPort` ont été extraits en 3 passes
> (le `MealsPort` délègue au module cœur `server/meals/`). Le layer bénévole les **consomme** ; le
> binding jonglerie les **implémente**. Détail des 8 ports : [ports-module-benevole.md](./ports-module-benevole.md).

## 4. Mécanisme d'injection (registry + plugin Nitro)

Idiomatique en contexte Nitro : un petit **registre** dans le layer, configuré au démarrage par un
**plugin serveur de l'app**.

```ts
// layers/volunteers/server/ports/registry.ts
import type { NotificationPort } from './notification.port'
import type { EmailPort } from './email.port'
import type { MessengerPort } from './messenger.port'
import type { OrganizerDirectoryPort } from './organizer-directory.port'

export interface VolunteerPorts {
  notifications: NotificationPort
  email: EmailPort
  messenger: MessengerPort
  organizers: OrganizerDirectoryPort
}

let ports: VolunteerPorts | null = null
export function setVolunteerPorts(p: VolunteerPorts) {
  ports = p
}
export function useVolunteerPorts(): VolunteerPorts {
  if (!ports) throw new Error('[volunteers] ports non configurés (plugin serveur manquant)')
  return ports
}
```

Câblage côté **app jonglerie** (reste dans l'app, connaît les implémentations concrètes) :

```ts
// apps/jonglerie/server/plugins/volunteer-ports.ts
import { setVolunteerPorts } from '#layers/volunteers/server/ports/registry'
import { NotificationService, safeNotify } from '#server/utils/notification-service'
import { sendEmail } from '#server/utils/emailService'
import {
  ensureVolunteerConversations,
  ensureVolunteerToOrganizersConversation,
} from '#server/utils/messenger-helpers'
import { getVolunteerManagerUserIds } from '#server/utils/permissions/volunteer-permissions'

export default defineNitroPlugin(() => {
  setVolunteerPorts({
    notifications: {
      notify: (i) =>
        safeNotify(() => NotificationService.create(mapNotify(i))).then(() => undefined),
      notifyMany: async (is) => {
        for (const i of is) await safeNotify(() => NotificationService.create(mapNotify(i)))
      },
    },
    email: { send: (i) => sendEmail(i) },
    messenger: {
      ensureTeamConversation: ({ eventId, teamId, userId, tx }) =>
        ensureVolunteerConversations(eventId, teamId, userId, tx), // eventId == ancien editionId (étape 0)
      ensureVolunteerToManagersConversation: ({ eventId, volunteerId, tx }) =>
        ensureVolunteerToOrganizersConversation(eventId, volunteerId, tx),
    },
    organizers: { getVolunteerManagers: (eventId) => getVolunteerManagerUserIds(eventId) },
  })
})
```

> `mapNotify` traduit `NotifyInput.type: string` vers l'enum Prisma de l'app. C'est la **frontière
> de traduction** entre le contrat générique du layer et les types concrets de l'app.

Consommation côté **layer** (exemple de réécriture d'un site d'appel) :

```ts
// AVANT — server/api/editions/[id]/volunteers/applications/[applicationId].patch.ts
await safeNotify(() =>
  NotificationService.create({ userId, type: 'VOLUNTEER_ACCEPTED', titleKey: '…' })
)

// APRÈS (dans le layer)
import { useVolunteerPorts } from '#layers/volunteers/server/ports/registry'
const { notifications } = useVolunteerPorts()
await notifications.notify({ userId, type: 'VOLUNTEER_ACCEPTED', titleKey: '…' })
```

## 5. Cartographie site d'appel → port

| Fichier (module bénévole)                   | Appel actuel                                      | Port cible                            |
| ------------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| `applications/[applicationId].patch.ts`     | `safeNotify(NotificationService.create(…))` ×4    | `notifications.notify`                |
| `notifications.post.ts`                     | `NotificationService.create(…)`                   | `notifications.notify` / `notifyMany` |
| `notify-schedules.post.ts`                  | `NotificationService.create(…)` + `sendEmail(…)`  | `notifications.notify` + `email.send` |
| `create-user-and-add.post.ts`               | `sendEmail(…)`                                    | `email.send`                          |
| `server/tasks/volunteer-reminders.ts`       | `NotificationService.create(…)`                   | `notifications.notify`                |
| `server/utils/editions/volunteers/teams.ts` | `ensureVolunteerConversations(…)` ×2              | `messenger.ensureTeamConversation`    |
| (orgas destinataires)                       | requête `ConventionOrganizer.canManageVolunteers` | `organizers.getVolunteerManagers`     |

## 6. Côté `layers/core` : ce qui doit y vivre

Les **implémentations** que l'app câble proviennent de services qui deviendront `core` :

- `notification-service.ts`, `notification-preferences.ts`, `unified-push-service.ts` → `core`.
- `emailService.ts` + `server/emails/*` → `core` (l'email `VolunteerScheduleEmail.vue` reste
  toutefois un asset du **layer bénévole**).
- `messenger-helpers.ts` : à scinder — les **primitives** (créer conversation, ajouter participant)
  → `core` ; la résolution « gestionnaires de bénévoles » → reste dans l'app (dépend des
  permissions), exposée via `OrganizerDirectoryPort`.

> À l'étape 1, on ne déplace rien physiquement : on **définit les ports** et on prépare le binding.
> Le déplacement vers `core`/`layers` se fait aux étapes 2–3.

## 7. Ordre d'application et dérisquage

1. **Étape 1 (ce doc)** : créer les fichiers de ports + registry dans le futur emplacement layer
   (peuvent d'abord vivre sous `server/ports/` du repo actuel), **sans** réécrire les sites d'appel.
2. **Étape 2** : lors de l'extraction du layer, réécrire les sites d'appel (§5) pour passer par
   `useVolunteerPorts()`, et ajouter le plugin Nitro de binding dans l'app.
3. Test de non-régression : comportement identique (mêmes notifications/emails/conversations), seule
   la voie d'accès change.

> Avantage : tant que le binding délègue aux services existants, **aucun changement fonctionnel**.
> Le découplage est purement structurel et réversible.

## 8. Points de vigilance

- **Transactions Prisma** : `ensureTeamConversation` doit continuer d'accepter un `tx` (les
  assignations d'équipe s'exécutent dans une transaction). Le type `PrismaTransaction` reste fourni
  par core/`#server/types`.
- **`eventId` vs `editionId`** : après l'étape 0, le layer parle en `eventId` ; le binding mappe
  vers les helpers actuels qui attendent un `editionId` numériquement identique (cf. id réutilisé).
- **Préférences de notification** : `notificationType` (clé de préférence) reste passé tel quel ;
  le mapping vers `NotificationTypeMapping` est fait par l'implémentation (core), pas par le layer.
- **Tests** : les ports facilitent le mock (injecter un `VolunteerPorts` factice dans les tests du
  layer au lieu de mocker les modules concrets).
