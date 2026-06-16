# Ports du module bénévole — référence « tel que construit »

> **Statut** : 🟢 À jour avec `main` (étape 0bis incluse). Ce document décrit les ports **tels
> qu'implémentés aujourd'hui**. Pour la conception initiale et l'historique, voir
> [etape-1-ports-decouplage.md](./etape-1-ports-decouplage.md) (le plan a légèrement divergé :
> emplacement des fichiers, signatures, et ajout du 5ᵉ port `eventScope` à l'étape 0bis).
> **Date** : 2026-06-16.

## 1. Le pattern « Ports & Adapters »

Le module bénévole (`layers/volunteers/`) doit être réutilisable par une 2ᵉ app d'un autre domaine.
Il ne doit donc **pas dépendre** des services concrets de l'app jonglerie (`prisma.edition`,
`sendEmail`, `NotificationService`…), sinon il y est soudé.

La solution : le module dépend d'**interfaces** (les **ports**) qui décrivent _ce dont il a besoin_,
sans dire _comment c'est fait_. Chaque app fournit ses **implémentations** (les **bindings** /
_adapters_).

- **Port** = le contrat (la prise murale).
- **Binding / adapter** = l'implémentation concrète qui s'y branche (la prise de l'appareil).

```
Sans ports :  volunteers/*  ──import direct──> prisma.edition, NotificationService, sendEmail…
                              (soudé à jonglerie → non réutilisable)

Avec ports :  volunteers/*  ──consomme──> Ports (interfaces)
                                              ↑ implémente   app jonglerie  (default-binding)
                                              ↑ implémente   app 2 (autre domaine) (son binding)
```

C'est une **inversion de dépendance** : le layer ne connaît plus ni `Edition` ni `Convention`, il
demande au port « donne-moi les événements liés », et chaque app répond à sa façon.

## 2. Emplacement des fichiers

Aujourd'hui, les ports vivent **côté app/core** dans `server/volunteers/ports/`, et le layer les
consomme via l'alias `#server` :

| Fichier                                                                                       | Rôle                                                                                                    |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`server/volunteers/ports/types.ts`](../server/volunteers/ports/types.ts)                     | Les **interfaces** (contrats). Aucune implémentation.                                                   |
| [`server/volunteers/ports/default-binding.ts`](../server/volunteers/ports/default-binding.ts) | Le **binding jonglerie** : implémentations concrètes (lit `prisma.edition`, appelle `sendEmail`, etc.). |
| [`server/volunteers/ports/registry.ts`](../server/volunteers/ports/registry.ts)               | Le **registre** : `useVolunteerPorts()` (récupération) / `setVolunteerPorts()` (surcharge).             |

Le layer importe **toujours** via le registre, jamais le binding directement :

```ts
import { useVolunteerPorts } from '#server/volunteers/ports/registry'
const relatedEventIds = await useVolunteerPorts().eventScope.getRelatedEventIds(eventId)
```

> **Évolution prévue** (étapes 2–3) : `types.ts` + `registry.ts` migreront _dans_ le layer
> (contrats partagés), seul `default-binding.ts` restera côté app jonglerie. La surface d'API
> (`useVolunteerPorts` / `setVolunteerPorts`) ne changera pas.

## 3. Les 5 ports et leurs contrats

L'agrégat injecté est `VolunteerPorts` :

```ts
export interface VolunteerPorts {
  notifications: NotificationPort
  email: EmailPort
  messenger: MessengerPort
  organizers: OrganizerDirectoryPort
  eventScope: EventScopePort
}
```

| Port                         | Méthodes                                                                                                             | Ce qu'il abstrait                                                                                                 | Binding jonglerie                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **`NotificationPort`**       | `notify(input)`                                                                                                      | Notification in-app. `notify` englobe déjà le « safe » : ne lève jamais.                                          | `safeNotify(NotificationService.create(...))`                                   |
| **`EmailPort`**              | `send(input): Promise<boolean>`                                                                                      | Email transactionnel.                                                                                             | `sendEmail(...)`                                                                |
| **`MessengerPort`**          | `ensureTeamConversation(input)`, `removeFromTeamConversations(input)`                                                | Conversations équipe ⇄ bénévole. Accepte un `tx` Prisma optionnel.                                                | `ensureVolunteerConversations` / `removeVolunteerFromTeamConversations`         |
| **`OrganizerDirectoryPort`** | `requireManagementAccess(event, eventId)`, `requireReadAccess(event, eventId)`, `canManage(eventId, userId, event?)` | Droits organisateur sur les bénévoles d'un event. Chaque app résout contre **son** modèle de permissions.         | `requireVolunteer*Access` / `canManageEditionVolunteers`                        |
| **`EventScopePort`**         | `getRelatedEventIds(eventId)`, `getEventDisplayData(eventIds)`                                                       | Regroupement d'événements **propre au domaine** + données d'affichage transverses, sans notion de « convention ». | éditions sœurs de la même convention + `city`/`country`/`imageUrl`/`convention` |

### Contrats notables

- **`NotifyInput.type`** est un `string` (clé générique) : le binding le mappe vers l'enum Prisma de
  l'app. C'est la **frontière de traduction** entre le contrat du layer et les types concrets.
- **`EventScopePort.getRelatedEventIds(eventId)`** : ids des événements « liés », **incluant
  l'événement lui-même**. Jonglerie → les éditions de la même convention. Domaine générique →
  `[eventId]` seul.
- **`EventScopePort.getEventDisplayData(eventIds)`** : `Record<eventId, données d'affichage>`.
  - _Devrait_ renvoyer une entrée pour **chaque** eventId demandé (sinon l'appelant retombe sur un
    objet vide et le front perd ces données).
  - Ne doit **pas** renvoyer les clés réservées `id`, `name`, `startDate`, `endDate`, `volunteers*` :
    le module les fournit (métadonnées génériques d'`Event` + config bénévole) et elles priment.

## 4. Injection : `useVolunteerPorts` / `setVolunteerPorts`

```ts
// registry.ts (résumé)
export function setVolunteerPorts(ports: VolunteerPorts | null): void // surcharge (ou reset si null)
export function useVolunteerPorts(): VolunteerPorts // surcharge si définie, sinon binding par défaut (lazy)
```

- **Par défaut** : `useVolunteerPorts()` instancie paresseusement `createDefaultVolunteerPorts()`
  (le binding jonglerie). Aucune configuration n'est nécessaire dans l'app jonglerie.
- **2ᵉ app** : un plugin serveur appelle `setVolunteerPorts({...})` au démarrage pour injecter ses
  propres implémentations. Le **remplacement est complet** (pas de merge partiel) : l'objet fourni
  doit définir les **5** ports. Pour n'en surcharger qu'un, partir du défaut puis écraser le port
  voulu :

```ts
setVolunteerPorts({
  ...createDefaultVolunteerPorts(),
  eventScope: monImplementationMaison,
})
```

## 5. Exemple de bout en bout (`eventScope`)

**Avant** — l'endpoint « commentaires bénévoles » était soudé à jonglerie :

```ts
const edition = await prisma.edition.findUnique({
  where: { id: editionId },
  select: { conventionId: true },
})
// puis where: { event: { edition: { conventionId } } }
```

**Après** — il passe par le port, sans connaître « convention » ni « édition » :

```ts
const relatedEventIds = await useVolunteerPorts().eventScope.getRelatedEventIds(editionId)
// puis where: { eventId: { in: relatedEventIds } }
```

Jonglerie répond « les éditions sœurs » ; une autre app répondrait « juste l'événement ». Le layer
est identique dans les deux cas.

## 6. Tests

Les ports facilitent le test : on injecte un `VolunteerPorts` factice via `setVolunteerPorts()` au
lieu de mocker les modules concrets. Le binding par défaut se teste, lui, avec le mock Prisma global.

Voir [test/nuxt/server/volunteers/ports/eventScope.test.ts](../test/nuxt/server/volunteers/ports/eventScope.test.ts) :
il couvre le binding jonglerie (`getRelatedEventIds`, `getEventDisplayData`, clés réservées) **et**
vérifie qu'une surcharge `setVolunteerPorts()` remplace bien le câblage par défaut — ce qui verrouille
le contrat de modularisation.

## Voir aussi

- [etape-1-ports-decouplage.md](./etape-1-ports-decouplage.md) — conception initiale & cartographie
  des sites d'appel.
- [etape-0bis-event-promotion.md](./etape-0bis-event-promotion.md) — promotion des métadonnées vers
  `Event` et ajout du port `eventScope`.
- [modularisation-multi-domaines.md](./modularisation-multi-domaines.md) — stratégie d'ensemble.
