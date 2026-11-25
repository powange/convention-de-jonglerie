# Flowvent : la gestion des bénévoles d'app1

Flowvent (app2) doit offrir la gestion des bénévoles d'app1 : configuration, page publique,
formulaire de candidature, candidatures, équipes, répartition, planning, échanges de créneaux et
notifications. Il doit le faire **en réutilisant `layers/volunteers`**, pas en le réécrivant
(environ 36 000 lignes, 160 fichiers, 13 pages).

## Point de départ (25/11/2026)

- **Serveur du layer** : domaine-agnostique depuis l'étape 0bis
  ([etape-0bis-event-promotion.md](./etape-0bis-event-promotion.md)). Il ne lit plus `Edition` ni
  `Convention` : ce qui est propre au domaine passe par les ports (`setVolunteerPorts()`,
  [ports-module-benevole.md](./ports-module-benevole.md)).
- **Mais il importe encore une cinquantaine de modules de l'app hôte** (`#server/…`, `~/…`,
  `~~/shared/…`) qu'app2 n'a pas.
- **Interface du layer** : couplée à app1. Pages sous `/editions/[id]/…`, layout
  `edition-dashboard`, `useEditionStore` (22 appels), `useAuthStore` (20).
- **Base d'app2** : `Event` minimal, aucun des 14 modèles bénévoles, pas d'organisateurs au-delà du
  propriétaire de l'événement.

## Décisions

- Flowvent sert la gestion sous **`/events/[id]/…`**. Le préfixe des pages du layer est réécrit au
  montage dans app2 ; les URL d'app1 ne changent pas.
- Les options sans objet pour Flowvent disparaissent de son interface, à commencer par le **mode de
  gestion externe** : Flowvent n'utilise que ses outils internes.

## Les 50 dépendances, triées

Trois familles, selon qui s'en sert et à qui elles appartiennent :

1. **Propres aux bénévoles, mais rangées dans app1** → **déplacées dans le layer** (lot 1, fait).
   Services des candidatures et des équipes (`editions/volunteers/*`), planificateur
   (`volunteer-scheduler`), permissions bénévoles et de contrôle d'accès, `empreinte-affectations`,
   `volunteer-application-diff`, statistiques (`volunteer-stats`, `besoin-benevoles`,
   `effectif-par-periode`), `spectacles-manques`, `erreurs-validation`, et les utilitaires
   partagés `bornes-retard-creneau`, `brouillon-candidature`, `creneaux-recurrents`,
   `disponibilite-volants`. Ils s'importent désormais par l'alias **`#volunteers`**.
2. **Génériques** (sans métier) → à rendre disponibles à toute app hôte : `logger`,
   `token-generator`, `csv`, `date`, `markdown`, `adresse-email`, `url-externe`, `semaine`,
   `telechargement`, `default-palette`, `export-pdf-tableau`, `apres-la-reponse`,
   `allergy-severity`, `infos-personnelles`, `fuseau-edition`, `presence-edition`…
3. **Liées au domaine d'app1** → **derrière un port**, ou réimplémentées par app2 :
   `edition-permissions`, `organizer-management`, `prisma-select-helpers`, `auth-utils`,
   `invitation`, `stores/editions`, `editionName`, et le lien avec les spectacles (artistes).

## Le contrat d'hôte

Après les lots 1 à 3, `layers/volunteers` n'emprunte plus à son app hôte qu'une liste courte et
explicite de modules : **toute app qui étend le layer doit les fournir**, avec ses propres règles.
L'interface des ports, elle, est fournie par le layer (`#volunteers/server/ports/types`), pour que
chaque app implémente exactement la même.

| Module attendu                                                                                 | Ce que le layer en utilise                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#server/utils/auth-utils`                                                                     | `requireAuth`, `optionalAuth`, `requireResourceOwner`, type `AuthenticatedUser`                                                                    |
| `#server/utils/api-helpers`                                                                    | `wrapApiHandler`, `createSuccessResponse`, `createPaginatedResponse`                                                                               |
| `#server/utils/validation-helpers`                                                             | `validateEditionId`, `validateResourceId`, `validateStringId`, `validateStringResourceId`, `validatePagination`, `sanitizeEmail`, `sanitizeString` |
| `#server/volunteers/ports/registry`                                                            | `useVolunteerPorts()` — le câblage des ports propre à l'app                                                                                        |
| `#server/utils/prisma-select-helpers`                                                          | `userBasicSelect`, `userWithNameSelect`, `userWithProfileAndGravatarSelect`, `volunteerUserDetailedSelect`, `volunteerAssignmentDetailedInclude`   |
| `#server/utils/organizer-management`                                                           | `canManageEditionVolunteers`                                                                                                                       |
| `#server/utils/permissions/edition-permissions`                                                | `canManageMealsById`                                                                                                                               |
| `#server/utils/permissions/team-slot-helpers`                                                  | (contrôle d'accès)                                                                                                                                 |
| `#server/utils/notification-service`                                                           | `NotificationService`, `NotificationHelpers`, `safeNotify`                                                                                         |
| `#server/utils/invitation`                                                                     | `createPendingUserAndInvite`                                                                                                                       |
| `#server/utils/prisma-helpers`                                                                 | `fetchResourceOrFail`, `buildUpdateData`                                                                                                           |
| `#server/utils/prisma`, `#server/types/prisma`, `#server/types/prisma-helpers`                 | client et types Prisma (`Prisma`, `PrismaTransaction`…)                                                                                            |
| `#server/utils/emailService`, `#server/utils/rate-limiter`, `#server/utils/validation-schemas` | un usage chacun                                                                                                                                    |
| `#server/meals/meals-types`                                                                    | types du port repas                                                                                                                                |
| `~/stores/auth`                                                                                | `useAuthStore`                                                                                                                                     |
| `~/stores/editions`, `~/utils/editionName`, `~/types`, `~/types/volunteer`                     | **interface** : à découpler au lot 6                                                                                                               |

### Organisateurs et notifications : par le schéma, pas par un port

Le layer interroge `prisma.editionOrganizer` et `prisma.notification`, et inclut
`organizerAssignments` / `assignedOrganizers` dans ses requêtes de planning (28 fichiers). Prisma
s'adresse aux tables par **nom de modèle** et suit les relations par **nom de champ** : il suffit que
Flowvent déclare un `EditionOrganizer` (`editionId`, `organizer` → son propre modèle d'organisateur
avec `userId`/`user`) et un `Notification` de même forme. Ce sera aussi la base des co-organisateurs
de Flowvent.

## Les lots

| Lot   | Contenu                                                                                                                   | Touche app1 ?          |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1 ✅  | Famille 1 déplacée dans le layer, alias `#volunteers` (#927)                                                              | oui, imports seulement |
| 2 ✅  | Famille 2 dans le nouveau layer `layers/core`, alias `#core` (#928)                                                       | oui, imports seulement |
| 3 ✅  | Derniers utilitaires bénévoles et interface des ports dans le layer ; contrat d'hôte écrit                                | oui, imports seulement |
| 4a ✅ | Helpers serveur génériques dans `layers/core/server/socle`, réexportés par app1 (#930)                                    | oui, réexports         |
| 4b ✅ | App2 étend `layers/core` ; ses copies réduites deviennent des réexports                                                   | non                    |
| 3b ✅ | Lectures d'`Edition` revenues dans le layer depuis l'étape 0bis : fuseau et nom via `eventScope`, droits via `organizers` | oui                    |
| 4c    | Schéma d'app2 : `Event` aligné, les 14 modèles bénévoles, `EditionOrganizer` et `Notification` minimaux                   | non                    |
| 5     | Ports serveur d'app2 (gestionnaire = propriétaire de l'event, notifications sans courriel)                                | non                    |
| 6     | Découplage de l'interface du layer (« contexte d'événement » fourni par l'app)                                            | oui                    |
| 7     | Écran de gestion de Flowvent : barre latérale, pages sous `/events/[id]`, options retirées                                | non                    |
| 8     | Libellés : le layer est en 13 langues, Flowvent en français                                                               | non                    |

Chaque lot touchant app1 est un **déplacement sans changement de comportement**, prouvé par ses
suites de tests (unitaires et Nuxt) et par le serveur de dev.
