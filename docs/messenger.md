# Module Messagerie (Messenger)

## Vue d'ensemble

Le module Messagerie offre des **conversations en temps réel** entre utilisateurs : discussions privées 1-à-1, groupes d'équipes bénévoles, communications entre bénévoles et organisateurs, groupe d'organisateurs d'une édition, et conversations spécifiques aux candidatures artistes.

L'interface principale est accessible via `/messenger`.

## Concepts clés

### Conversation

Espace de discussion typé via l'enum `ConversationType` :

| Type                      | Description                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `TEAM_GROUP`              | Discussion de groupe d'une équipe bénévole                                                 |
| `TEAM_LEADER_PRIVATE`     | Conversation privée avec le responsable d'équipe                                           |
| `VOLUNTEER_TO_ORGANIZERS` | Conversation entre un bénévole et les organisateurs avec droits de gestion bénévoles       |
| `ORGANIZERS_GROUP`        | Groupe de tous les organisateurs d'une édition                                             |
| `PRIVATE`                 | Conversation privée 1-à-1 (non liée à une édition)                                         |
| `ARTIST_APPLICATION`      | Conversation entre un artiste candidat et les organisateurs (liée à une `ShowApplication`) |

### ConversationParticipant

Lien `(Conversation, User)` avec gestion d'historique :

- `joinedAt` / `leftAt` : préserve les anciens participants (soft leave)
- `lastReadMessageId` : utilisé pour calculer les badges "non lu"

### Message

- `content` (Text)
- `replyToId` : réponse à un message (threading léger)
- `editedAt`, `deletedAt` : édition et soft delete

## Architecture

### Modèles Prisma

Fichier : `prisma/schema/messenger.prisma`

```prisma
enum ConversationType { TEAM_GROUP TEAM_LEADER_PRIVATE VOLUNTEER_TO_ORGANIZERS ORGANIZERS_GROUP PRIVATE ARTIST_APPLICATION }

model Conversation {
  id                String           @id @default(cuid())
  editionId         Int?
  teamId            String?
  showApplicationId Int?             @unique
  type              ConversationType
}

model ConversationParticipant {
  id                String   @id @default(cuid())
  conversationId    String
  userId            Int
  joinedAt          DateTime @default(now())
  leftAt            DateTime?
  lastReadMessageId String?
  @@unique([conversationId, userId])
}

model Message {
  id             String    @id @default(cuid())
  conversationId String
  participantId  String
  content        String    @db.Text
  replyToId      String?
  editedAt       DateTime?
  deletedAt      DateTime?
}
```

## API REST

Préfixe : `/api/messenger/`.

### Création / accès aux conversations typées

| Méthode | Endpoint                   | Description                                                               |
| ------- | -------------------------- | ------------------------------------------------------------------------- |
| POST    | `/private`                 | Crée (ou récupère) une conversation privée 1-à-1                          |
| POST    | `/team-conversation`       | Crée la conversation d'une équipe (`TEAM_GROUP` ou `TEAM_LEADER_PRIVATE`) |
| POST    | `/organizers-group`        | Crée le groupe d'organisateurs d'une édition                              |
| POST    | `/volunteer-to-organizers` | Crée la conversation entre un bénévole et les organisateurs               |
| GET     | `/editions`                | Liste des éditions concernées par l'utilisateur                           |
| GET     | `/private-conversations`   | Liste des conversations privées de l'utilisateur                          |
| GET     | `/conversations`           | Liste agrégée des conversations de l'utilisateur                          |
| GET     | `/unread-count`            | Nombre total de messages non lus                                          |
| GET     | `/status`                  | État global (présence, badges, etc.)                                      |

### Conversation individuelle

| Méthode | Endpoint                                             | Description                                  |
| ------- | ---------------------------------------------------- | -------------------------------------------- |
| GET     | `/conversations/:conversationId/messages`            | Liste paginée des messages                   |
| POST    | `/conversations/:conversationId/messages`            | Envoyer un message (avec `replyToId?`)       |
| PATCH   | `/conversations/:conversationId/messages/:messageId` | Éditer ou supprimer (soft) un message        |
| PATCH   | `/conversations/:conversationId/mark-read`           | Mettre à jour `lastReadMessageId`            |
| POST    | `/conversations/:conversationId/typing`              | Indiquer que l'on tape                       |
| GET     | `/conversations/:conversationId/presence`            | Liste des participants en ligne              |
| GET     | `/conversations/:conversationId/stream`              | SSE (Server-Sent Events) pour les nouveautés |

### Temps réel

Le streaming utilise des **Server-Sent Events** sur `/conversations/:id/stream` pour pousser les nouveaux messages, indicateurs de frappe et présence. Le composable côté serveur `server/utils/conversation-presence-service.ts` gère le tracking de présence.

## Notifications

Les messages déclenchent des **notifications push** (in-app + browser) vers les autres participants actifs (`leftAt: null`), sauf ceux qui sont actuellement en train de regarder la conversation.

Voir [`docs/system/NOTIFICATION_SYSTEM.md`](system/NOTIFICATION_SYSTEM.md).

## Permissions

Les conversations typées appliquent leur propre logique d'accès :

- `TEAM_GROUP` / `TEAM_LEADER_PRIVATE` : ouvert aux membres de l'équipe (et team leaders).
- `ORGANIZERS_GROUP` : ouvert aux organisateurs avec accès édition.
- `VOLUNTEER_TO_ORGANIZERS` : ouvert au bénévole concerné + organisateurs avec `canManageVolunteers`.
- `ARTIST_APPLICATION` : ouvert au candidat artiste + organisateurs avec `canManageArtists`.
- `PRIVATE` : ouvert aux 2 utilisateurs concernés.

L'unicité de participation est garantie par `@@unique([conversationId, userId])`.

## Frontend

- `app/pages/messenger.vue` — Layout 2 colonnes (liste de conversations + détail).
- `app/components/messenger/` — Composants (liste, header, fil de messages, composer, indicateurs de présence).

## Évolutions possibles

- Pièces jointes / images dans les messages
- Réactions emoji
- Mentions @utilisateur avec notification ciblée
- Recherche full-text dans une conversation
- Archivage / mute par utilisateur

---

Dernière mise à jour : 2026-05-18.
