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

| Helper          | Déclencheur                       | Destinataires                     | Type   |
| --------------- | --------------------------------- | --------------------------------- | ------ |
| `taskAssigned`  | Nouvelle assignation              | Le nouvel assigné (hors auteur)   | `INFO` |
| `taskCommented` | Nouveau commentaire sur une tâche | Les autres assignés (hors auteur) | `INFO` |

Toutes deux ont :

- **Catégorie** : `task`
- **Action URL** : `/editions/:id/gestion/tasks`
- **Clés i18n** sous `notifications.task.{assigned|commented}.{title,message,action}`

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

## Évolutions possibles

- Drag & drop pour réordonner les tâches (et changer de groupe / statut au sein du Kanban).
- Filtrage des tâches par assigné, statut, échéance.
- Notifications de rappel J-1 sur les échéances.
- Commentaires sur les tâches.
- Pièces jointes / liens externes.
- Vue agrégée multi-édition pour le suivi global d'une convention.

---

Dernière mise à jour : 2026-05-13.
