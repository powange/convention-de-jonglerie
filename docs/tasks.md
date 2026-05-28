# Module Tâches

## Vue d'ensemble

Le module Tâches permet aux organisateurs d'une édition d'organiser leur travail interne via des **groupes de tâches**. Chaque tâche peut être assignée à plusieurs personnes (organisateurs ou bénévoles acceptés), suivie via un statut, et associée à une échéance.

Le module est **désactivé par défaut** sur chaque édition. Il s'active depuis `Édition → Gestion → Fonctionnalités → Tâches`.

## Concepts clés

### TaskGroup

Catégorie libre permettant de regrouper des tâches connexes (ex: « Préparation logistique », « Communication », « Bénévolat »). Chaque groupe est rattaché à une édition.

### Task

Unité de travail avec :

- **Titre** (requis)
- **Description** (optionnelle, rendu Markdown)
- **Statut** : `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`
- **Échéance** (optionnelle)
- **Ordre d'affichage** dans le groupe

### TaskAssignment

Association `(Task, User)` représentant qu'un utilisateur est responsable d'une tâche. Une tâche peut avoir 0..N assignés. Les nouveaux assignés reçoivent une notification.

### TaskComment

Commentaire libre sur une tâche, avec **rendu Markdown**. Stocke l'auteur, le contenu, la date de création et la date d'édition (`editedAt` nullable). Les commentaires sont supprimés en cascade lors de la suppression de la tâche.

## Architecture

### Modèles Prisma

Fichier : `prisma/schema/tasks.prisma`

```prisma
enum TaskStatus { TODO IN_PROGRESS DONE CANCELLED }

model TaskGroup {
  id           Int      @id @default(autoincrement())
  editionId    Int
  name         String
  description  String?  @db.Text
  displayOrder Int      @default(0)
  edition      Edition  @relation(fields: [editionId], references: [id], onDelete: Cascade)
  tasks        Task[]
  @@index([editionId])
  @@index([editionId, displayOrder])
}

model Task {
  id           Int        @id @default(autoincrement())
  taskGroupId  Int
  title        String
  description  String?    @db.Text
  status       TaskStatus @default(TODO)
  deadline     DateTime?
  displayOrder Int        @default(0)
  group        TaskGroup        @relation(fields: [taskGroupId], references: [id], onDelete: Cascade)
  assignments  TaskAssignment[]
  @@index([taskGroupId])
  @@index([taskGroupId, displayOrder])
  @@index([status])
}

model TaskAssignment {
  id     Int @id @default(autoincrement())
  taskId Int
  userId Int
  task   Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([taskId, userId])
}

model TaskComment {
  id        Int       @id @default(autoincrement())
  taskId    Int
  userId    Int
  content   String    @db.Text
  editedAt  DateTime?
  createdAt DateTime  @default(now())
  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([taskId, createdAt])
}
```

Le toggle d'activation est sur `Edition.tasksEnabled` (`Boolean @default(false)`).

## Permissions

Voir [`docs/system/ORGANIZER_PERMISSIONS.md`](system/ORGANIZER_PERMISSIONS.md) pour la vue d'ensemble du système.

Le droit dédié est `canManageTasks` :

- Niveau **convention** : colonne `ConventionOrganizer.canManageTasks` (s'applique à toutes les éditions de la convention).
- Niveau **édition** : colonne `EditionOrganizerPermission.canManageTasks` (override per-édition).

Le helper côté serveur `canManageTasks(edition, user)` est défini dans `server/utils/permissions/edition-permissions.ts`. Il retourne `true` si l'une des conditions est remplie :

1. L'utilisateur est créateur de l'édition
2. L'utilisateur est auteur de la convention
3. L'utilisateur est admin global (mode admin)
4. L'utilisateur est organisateur convention avec `canManageTasks = true`
5. L'utilisateur a une `EditionOrganizerPermission.canManageTasks = true` sur cette édition

## API REST

Tous les endpoints exigent une authentification et le droit `canManageTasks` (sauf mention contraire). Préfixe : `/api/editions/:id/`.

### Groupes

| Méthode | Endpoint                | Description                              |
| ------- | ----------------------- | ---------------------------------------- |
| GET     | `/task-groups`          | Liste les groupes avec leurs tâches      |
| POST    | `/task-groups`          | Crée un groupe                           |
| PUT     | `/task-groups/:groupId` | Met à jour un groupe (champs optionnels) |
| DELETE  | `/task-groups/:groupId` | Supprime un groupe (cascade sur tâches)  |

### Tâches

| Méthode | Endpoint                      | Description                                               |
| ------- | ----------------------------- | --------------------------------------------------------- |
| POST    | `/task-groups/:groupId/tasks` | Crée une tâche dans un groupe                             |
| PUT     | `/tasks/:taskId`              | Met à jour une tâche (titre, statut, deadline, assignés…) |
| DELETE  | `/tasks/:taskId`              | Supprime une tâche (cascade sur assignments)              |

### Utilisateurs assignables

| Méthode | Endpoint                  | Description                                                       |
| ------- | ------------------------- | ----------------------------------------------------------------- |
| GET     | `/tasks/assignable-users` | Liste dédupliquée : organisateurs convention + bénévoles ACCEPTED |

### Commentaires

| Méthode | Endpoint                             | Description                                    |
| ------- | ------------------------------------ | ---------------------------------------------- |
| GET     | `/tasks/:taskId/comments`            | Liste des commentaires (ordre chronologique)   |
| POST    | `/tasks/:taskId/comments`            | Ajoute un commentaire                          |
| PUT     | `/tasks/:taskId/comments/:commentId` | Édite un commentaire (auteur uniquement)       |
| DELETE  | `/tasks/:taskId/comments/:commentId` | Supprime un commentaire (auteur ou modérateur) |

**Permissions sur les commentaires** :

- **Lire / Poster** : organisateurs avec `canManageTasks` **OU** utilisateur assigné à la tâche (helper `canCommentTask` dans `server/utils/tasks-helpers.ts`).
- **Éditer** : auteur uniquement.
- **Supprimer** : auteur OU organisateur avec `canManageTasks` (modération).

À chaque nouveau commentaire, les **autres assignés** de la tâche reçoivent une notification (helper `NotificationHelpers.taskCommented`).

### Comportements importants

- **POST tasks** : `displayOrder` calculé automatiquement (`max + 1` du groupe) si absent.
- **PUT tasks** : `assigneeIds` a un comportement **set** (remplace entièrement la liste). La diff est calculée :
  - Les anciens assignés non présents dans la nouvelle liste sont supprimés.
  - Les nouveaux assignés reçoivent une notification (sauf l'utilisateur courant).
  - L'opération est **atomique** (transaction Prisma sur `taskAssignment.deleteMany` + `createMany` + `task.update`).
- **PUT tasks** : peut déplacer une tâche entre groupes via `taskGroupId` (le groupe cible doit appartenir à la même édition).
- **Validation des `assigneeIds`** : helper `assertAssigneesAreAssignable` (`server/utils/tasks-helpers.ts`) vérifie que chaque ID est bien dans la liste des assignables. Empêche un organisateur d'envoyer des notifications spam à des userIds arbitraires.

## Notifications

| Helper                 | Déclencheur                       | Destinataires                     | Type               |
| ---------------------- | --------------------------------- | --------------------------------- | ------------------ |
| `taskAssigned`         | Nouvelle assignation              | Le nouvel assigné (hors auteur)   | `INFO`             |
| `taskCommented`        | Nouveau commentaire sur une tâche | Les autres assignés (hors auteur) | `INFO`             |
| `taskDeadlineReminder` | Cron quotidien (J-1 et jour J)    | Chaque assigné                    | `INFO` / `WARNING` |

- **Catégorie** : `task`
- **Action URL** : `/editions/:id/gestion/tasks` (assignation/commentaire) ou `/editions/:id/mes-taches` (rappel d'échéance, accessible aux bénévoles)
- **Clés i18n** sous `notifications.task.{assigned|commented|deadline_reminder.{j_minus_1|j}}.{title,message,action}`

### Rappels automatiques d'échéance

Une tâche cron quotidienne ([server/tasks/task-deadlines-reminders.ts](../server/tasks/task-deadlines-reminders.ts)) tourne à **9h00** (heure serveur) et envoie :

- **J-1** (`notificationType=task_deadline_reminder_j_minus_1`, type `INFO`) : pour chaque tâche **non terminée** (`TODO` ou `IN_PROGRESS`) dont la deadline tombe le lendemain, une notification est envoyée à chaque assigné.
- **J** (`notificationType=task_deadline_reminder_j`, type `WARNING`) : idem pour les tâches dont la deadline tombe aujourd'hui.

#### Déduplication via la table `Notification`

Pas de table dédiée — la dédup s'appuie sur la table `Notification` existante. Avant d'envoyer un rappel, le cron récupère en **une seule requête** toutes les notifications de type `task_deadline_reminder_*` déjà créées pour les tâches concernées, et skip les couples `(userId, taskId, notificationType)` déjà présents.

Le `notificationType` inclut le suffixe `_j_minus_1` ou `_j` : chaque kind de rappel se déduplique **indépendamment**. Un même utilisateur ne reçoit donc :

- au maximum 1 notification `_j_minus_1` par tâche (toute sa vie)
- au maximum 1 notification `_j` par tâche (toute sa vie)

> **Limitations acceptées (MVP)** :
>
> - Si l'utilisateur supprime explicitement sa notification, il pourrait être re-notifié au prochain cron.
> - Si la deadline d'une tâche est modifiée et qu'elle retombe dans la fenêtre J-1/J, le rappel correspondant ne sera pas ré-émis.
>
> Ces cas edge sont jugés peu fréquents et acceptables pour cette première version.

Voir [`docs/system/NOTIFICATION_SYSTEM.md`](system/NOTIFICATION_SYSTEM.md) pour le système global.

## Frontend

### Pages

- `app/pages/editions/[id]/gestion/tasks/index.vue` : grille de cards (un par groupe), bouton « Nouveau groupe », menu contextuel pour éditer/supprimer.
- `app/pages/editions/[id]/gestion/tasks/[groupId].vue` : page détail d'un groupe avec :
  - Toggle **Liste** ↔ **Kanban**
  - En-tête (nom, description, actions du groupe)
  - Bouton « Nouvelle tâche »

### Composants

- `app/components/tasks/TaskGroupModal.vue` : création / édition d'un groupe (`name`, `description`).
- `app/components/tasks/TaskModal.vue` : création / édition d'une tâche.
  - Multi-select des assignés via `USelectMenu` (mode `multiple`).
  - Description Markdown via `MinimalMarkdownEditor`.
  - Affiche un badge **« Plus assignable »** pour les assignés legacy (qui n'apparaissent plus dans `assignable-users` mais sont déjà assignés à la tâche), avec un avertissement.
  - Affichage des erreurs Zod par champ via `:error="fieldErrors.X"` sur les `UFormField`.
  - Section **commentaires** affichée uniquement en mode édition (`TasksTaskComments`).
- `app/components/tasks/TaskComments.vue` : fil de discussion d'une tâche.
  - Liste paginée chronologique avec avatar + pseudo + date.
  - Ajout via `MinimalMarkdownEditor` + bouton « Publier ».
  - Édition inline (auteur uniquement) + suppression (auteur ou modérateur).
  - Badge **« modifié »** sur les commentaires édités.

### Navigation

- Une entrée **Tâches** apparaît dans la sidebar du dashboard édition (`app/layouts/edition-dashboard.vue`) si `tasksEnabled` est activé ET que l'utilisateur a `canManageTasks`.
- Une carte **Tâches** apparaît sur l'overview de gestion (`app/pages/editions/[id]/gestion/index.vue`) avec les mêmes conditions.

## i18n

Toutes les clés sont sous `gestion.tasks.*` (12 langues synchronisées). Exemples :

- `gestion.tasks.title`
- `gestion.tasks.new_group`, `gestion.tasks.new_task`
- `gestion.tasks.status.{TODO,IN_PROGRESS,DONE,CANCELLED}`
- `gestion.tasks.empty_state`, `gestion.tasks.empty_group`
- `gestion.tasks.tasks_count` (avec pluriel : `{count} tâche | {count} tâches`)
- `gestion.tasks.assignee_legacy_badge`, `gestion.tasks.legacy_assignees_warning`
- `gestion.features.tasks_description` (description du toggle dans Fonctionnalités)
- `permissions.manageTasks`

## Vues disponibles

Sur la page détail d'un groupe (`[groupId].vue`), deux vues sont proposées via un toggle :

### Vue Liste

Affichage tabulaire :

- Badge de statut coloré
- Titre + deadline (couleur selon urgence)
- Avatars des assignés (3 max + badge `+N`)
- Click pour ouvrir le modal d'édition

### Vue Kanban

Quatre colonnes statiques (TODO, IN_PROGRESS, DONE, CANCELLED) avec drag-and-drop HTML5 supportant **deux opérations** :

#### Changement de statut

Drop sur la zone d'une colonne (ou sur une carte d'une autre colonne) → la tâche change de statut. Implémenté via le helper factorisé `changeTaskStatus` qui appelle `PUT /api/editions/:id/tasks/:taskId` avec `{ status }`. Optimistic update + revert local si l'API échoue.

#### Réordonnancement intra-colonne

Drop sur une carte de la **même colonne** → réordonnancement :

- `onCardDragOver` calcule la position (`before`/`after`) selon la moitié verticale de la carte cible
- Indicateur visuel : `border-t-2` / `border-b-2` `primary-500` sur la carte cible
- Sur drop : reconstruit l'ordre de la colonne avec la tâche déplacée à la nouvelle position
- Appel `POST /api/editions/:id/task-groups/:groupId/reorder` avec les `taskIds` dans le nouvel ordre
- L'endpoint applique `displayOrder = index` en transaction ; les tâches des autres statuts conservent leur `displayOrder`
- Optimistic update via mutation du tableau `group.value.tasks` + revert si erreur API

`@drop.stop` sur les cartes empêche la propagation au handler de la colonne — c'est la carte qui décide entre reorder (même colonne) et change-status (autre colonne). Flag `justDragged` (50 ms) pour absorber le click synthétique post-drag.

## Filtres et recherche

Sur la page détail d'un groupe, une barre de filtres (composant `TasksTaskFilters`) permet d'affiner les tâches affichées. Le filtrage est **client-side** (les tâches du groupe sont déjà chargées) et s'applique à la fois à la vue Liste et à la vue Kanban.

### Filtres disponibles

- **Recherche texte** (debounced 250 ms) : match insensible à la casse sur `title` et `description`.
- **Statuts** : multi-sélection parmi `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`.
- **Assignés** : multi-sélection parmi les utilisateurs assignables actuels **+ les assignés legacy** détectés sur les tâches du groupe.
- **Échéance** : `overdue` (en retard, hors `DONE`/`CANCELLED`), `today`, `next7`, `next30`, `none` (sans échéance).

### Persistance URL

Les filtres sont persistés en query string via `router.replace` (pas de pile d'historique) :

- `?q=<texte>` — recherche
- `?status=TODO,IN_PROGRESS` — statuts (CSV)
- `?assignees=12,34` — IDs assignés (CSV)
- `?due=overdue|today|next7|next30|none` — catégorie d'échéance

Permet de partager un lien filtré ou de revenir en arrière en gardant la sélection. Les query params inconnus sont ignorés au parsing.

### Empty state filtré

Si `group.tasks.length > 0` mais qu'aucune tâche ne correspond aux filtres actifs, un message dédié `gestion.tasks.filters.no_match` s'affiche à la place du listing (distinct de l'empty state « groupe vide »).

## Vue « Mes tâches » (utilisateurs assignés)

La page `/editions/[id]/mes-taches` est destinée aux utilisateurs assignés à des tâches **sans nécessiter le droit `canManageTasks`**. Elle permet aux bénévoles d'avoir une vue d'ensemble de leurs propres tâches sur une édition donnée.

### Endpoint

`GET /api/editions/:id/tasks/mine` ([server/api/editions/[id]/tasks/mine.get.ts](../server/api/editions/%5Bid%5D/tasks/mine.get.ts)) :

- **Permission** : auth simple (`requireAuth`), pas de `canManageTasks`
- **Logique** : `prisma.task.findMany` filtré par `assignments.some.userId = user.id` ET `group.editionId = id`
- **Retour** : `{ success: true, data: { tasks: [...] } }` — chaque tâche inclut son groupe (`{ id, name }`) et tous ses assignés
- **404** si l'édition n'existe pas ou si `tasksEnabled` est `false`

### Frontend

- **Page** : [app/pages/editions/[id]/mes-taches.vue](../app/pages/editions/%5Bid%5D/mes-taches.vue)
  - Liste groupée par `TaskGroup` (header + badge count par groupe)
  - Filtres `TasksTaskFilters` avec `hide-assignees` (inutile puisque c'est forcément l'utilisateur courant)
  - Au click sur une tâche : ouvre `TasksTaskViewModal` (lecture seule + commentaires)
- **Composant** `TasksTaskViewModal` ([app/components/tasks/TaskViewModal.vue](../app/components/tasks/TaskViewModal.vue)) :
  - Affichage en lecture seule : titre, badges statut/groupe/échéance, assignés (avatars), description Markdown rendue
  - Section commentaires : réutilise `TasksTaskComments` avec `canPost=true`, `canModerate=false` (le serveur valide via `canCommentTask`)
- **Lien** dans `EditionHeader` ([app/components/edition/Header.vue](../app/components/edition/Header.vue)) — onglet « Mes tâches » visible si `tasksEnabled && isAuthenticated` (la page elle-même affiche un empty state si l'utilisateur n'a aucune tâche).

### Pourquoi pas dans `/gestion/` ?

Le préfixe `/editions/:id/gestion/` requiert `canManageTasks` (organisateur). Pour permettre à un bénévole assigné d'accéder à ses tâches, la page est placée à `/editions/:id/mes-taches` (hors gestion). Les permissions de lecture des commentaires et de l'endpoint `mine` sont validées côté serveur via les assignations.

## Évolutions possibles

Propositions classées par valeur métier × effort estimé. Les éléments **planifiés pour la prochaine itération** sont marqués 🚧.

### Quick wins (haute valeur / faible effort)

#### Rappels de retard (J+1, J+3)

- Relances pour les tâches **en retard** (deadline passée, statut non terminé).
- À ajouter dans la même tâche cron `task-deadlines-reminders` avec un nouveau `kind` (`J_PLUS_1`, `J_PLUS_3`).
- **Effort estimé** : 0,5 j.

#### Réordonnancement des groupes (vue index)

- Le DnD intra-colonne Kanban est implémenté. Il reste à permettre de réordonner les **groupes** dans la page index via drag & drop.
- **Effort estimé** : 0,5 j (réutilise l'endpoint `reorder` ou en créer un dédié pour les groupes).

### Fonctionnalités à fort impact (effort moyen)

#### 🚧 5. Sous-tâches / checklist

- Champ `parentTaskId` sur `Task`, **ou** (préférable) table `TaskChecklistItem` (titre + done) — items légers, sans cycle complet TODO/IN_PROGRESS/DONE.
- Progression auto-calculée affichée sur la card (ex: « 3/7 »).
- **Bénéfice** : on découpe les grosses tâches sans polluer le Kanban.
- **Effort estimé** : 2-3 j.

#### 6. Templates de groupes / tâches

- Les conventions reviennent souvent chaque année avec les mêmes phases (logistique, comm, bénévolat…). Permettre :
  - Cloner depuis une édition précédente.
  - Créer des templates réutilisables au niveau convention.
- **Bénéfice** : gain de temps important inter-éditions.
- **Effort estimé** : 2 j (endpoint de duplication, modal de sélection source).

#### 7. Journal d'activité (audit log)

- Table `TaskActivity` enregistrant changements de statut, réassignations, modifications de deadline, etc.
- Affichée dans le modal de la tâche (timeline) à côté des commentaires.
- **Bénéfice** : traçabilité utile en cas de désaccord ou de turnover dans l'équipe.
- **Effort estimé** : 2-3 j.

#### 8. Pièces jointes

- Upload de fichiers (devis, plans, contrats…) attachés à une tâche.
- Réutiliser l'infrastructure Firebase Storage déjà en place dans le projet.
- **Bénéfice** : centralise les ressources liées à une tâche.
- **Effort estimé** : 2 j.

### Fonctionnalités avancées (effort important, ROI à valider)

#### 9. Tags / labels personnalisés

- Tags définis au niveau édition (couleurs + nom), liés via une table de liaison `TaskTag`.
- Filtrage par tag, affichage sur les cards.
- **Bénéfice** : transversalité (ex: « urgent », « matériel », « à valider RH ») indépendante des groupes.
- **Effort estimé** : 2 j.

#### 10. Vue calendrier

- 3ᵉ vue (en plus de Liste / Kanban) affichant les tâches sur leur échéance.
- FullCalendar est déjà dans les dépendances du projet.
- **Bénéfice** : vision temporelle, utile pour repérer les pics avant l'événement.
- **Effort estimé** : 2 j.

#### 11. Dépendances entre tâches

- Relation N-N self-referencing : « X dépend de Y ».
- Empêcher le passage à `DONE` si des dépendances ne sont pas terminées.
- **Bénéfice** : utile pour les phases logistiques séquentielles.
- **Effort estimé** : 3-4 j. À valider seulement si la demande terrain est confirmée — risque de complexifier fortement l'UI.

#### 12. Vue agrégée multi-édition (convention)

- Page au niveau convention listant toutes les tâches de toutes les éditions actives.
- **Bénéfice** : pertinent pour les grosses conventions multi-éditions, faible pour les petites.
- **Effort estimé** : 2-3 j.

#### 13. Mentions @utilisateur dans les commentaires

- `@pseudo` dans un commentaire déclenche une notification ciblée pour l'utilisateur mentionné.
- **Bénéfice** : engagement, conversation plus fluide.
- **Effort estimé** : 2 j.

---

Dernière mise à jour : 2026-05-28.
