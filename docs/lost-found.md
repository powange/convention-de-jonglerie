# Module Objets trouvés (Lost & Found)

## Vue d'ensemble

Le module Lost & Found permet aux organisateurs et participants d'une édition de signaler un **objet trouvé** avec photo et description, puis de marquer l'objet comme **rendu** lorsqu'il retrouve son propriétaire. Un fil de commentaires accompagne chaque objet pour échanger autour de sa restitution.

Toujours actif sur une édition (pas de toggle dédié). Visible aux organisateurs et bénévoles.

## Concepts clés

### LostFoundItem

Un objet signalé : description, image optionnelle, statut (`LOST` ou `RETURNED`), créateur, édition.

### LostFoundComment

Commentaire libre attaché à un objet. Permet à un visiteur de revendiquer l'objet, ou à l'organisateur de donner des indications de récupération.

## Architecture

### Modèles Prisma

Fichier : `prisma/schema/misc.prisma`

```prisma
enum LostFoundStatus { LOST RETURNED }

model LostFoundItem {
  id          Int             @id @default(autoincrement())
  editionId   Int
  userId      Int
  description String          @db.Text
  imageUrl    String?
  status      LostFoundStatus @default(LOST)
  edition  Edition            @relation(fields: [editionId], references: [id], onDelete: Cascade)
  user     User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  comments LostFoundComment[]
}

model LostFoundComment {
  id              Int      @id @default(autoincrement())
  lostFoundItemId Int
  userId          Int
  content         String   @db.Text
  lostFoundItem LostFoundItem @relation(fields: [lostFoundItemId], references: [id], onDelete: Cascade)
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## API REST

| Méthode | Endpoint                                        | Description                             |
| ------- | ----------------------------------------------- | --------------------------------------- |
| GET     | `/api/editions/:id/lost-found`                  | Liste les objets de l'édition           |
| POST    | `/api/editions/:id/lost-found`                  | Crée un signalement                     |
| POST    | `/api/editions/:id/lost-found/:itemId/comments` | Ajoute un commentaire                   |
| PATCH   | `/api/editions/:id/lost-found/:itemId/return`   | Marque l'objet comme rendu (`RETURNED`) |
| POST    | `/api/files/lost-found`                         | Upload de l'image d'un objet            |

## Permissions

- **Lecture** : organisateurs et bénévoles de l'édition.
- **Création** : organisateurs et bénévoles.
- **Marquer comme rendu** : créateur de l'item ou organisateurs.
- **Commentaires** : utilisateurs autorisés à lire la liste.

L'entrée latérale est conditionnée par `!isTeamLeader || canEdit || canManageVolunteers` dans `app/layouts/edition-dashboard.vue` (les team leaders « purs » sont exclus de la rubrique par défaut).

## Frontend

### Page

- `app/pages/editions/[id]/lost-found.vue` — Vue unique avec :
  - Formulaire de création (description + upload image, limite 5 MB)
  - Grille des objets (perdus + rendus) avec filtre
  - Modal de détail avec fil de commentaires

### Navigation

- Sidebar du dashboard : entrée **Objets trouvés** (icône `i-heroicons-magnifying-glass`).
- Carte sur la page d'overview de gestion.

## Évolutions possibles

- Catégorisation des objets (vêtement, électronique, etc.)
- Notification automatique aux participants quand un objet est ajouté
- Marquage privé "réservé" en attendant la rencontre
- Archivage automatique des objets non récupérés après X jours

---

Dernière mise à jour : 2026-05-18.
