# Module Stock matériel

## Vue d'ensemble

Le module Stock matériel permet aux organisateurs et aux responsables d'équipes bénévoles de **suivre le matériel** d'une édition (éclairage, sonorisation, outillage, câblerie, etc.), de savoir **où il se trouve**, sa **disponibilité** à un instant T, et de **poser des réservations** pour un usage précis sur une période donnée.

Le module est **désactivé par défaut** sur chaque édition. Il s'active depuis `Édition → Gestion → Fonctionnalités → Stock matériel`.

## Concepts clés

### StockGroup

Catégorie libre permettant de regrouper des objets connexes (ex: « Éclairage », « Sonorisation », « Câblerie »). Nom + description optionnelle.

### StockItem

Un matériel concret, ex: « Rallonge 10m pour projecteur ». Rattaché à un groupe. Champs :

- **Nom & description**
- **Quantité** possédée (`quantity`, ≥ 1) — utile si plusieurs exemplaires identiques
- **Localisation** : champ texte requis (ex: « Tente technique B »)
- **Zone optionnelle** : lien vers une `EditionZone` de la carte du site
- **Marqueur optionnel** : lien vers un `EditionMarker` de la carte
- **Notes** internes

### StockReservation

Réservation d'un objet sur une période :

- `startsAt`, `endsAt` (DateTime)
- `usage` : pourquoi on réserve (texte requis, ex: « Spectacle de feu samedi 22h »)
- `quantityReserved` : nombre d'exemplaires posés (≤ `quantity` total ET ≤ dispo restante sur la période)
- `userId` : auteur de la réservation
- `status` : `RESERVED` (par défaut), `PICKED_UP` (sorti), `RETURNED` (rendu), `CANCELLED`

## Architecture

### Modèles Prisma

Fichier : `prisma/schema/stock.prisma`

```prisma
enum StockReservationStatus { RESERVED PICKED_UP RETURNED CANCELLED }

model StockGroup {
  id           Int      @id @default(autoincrement())
  editionId    Int
  name         String
  description  String?  @db.Text
  displayOrder Int      @default(0)
  edition      Edition  @relation(fields: [editionId], references: [id], onDelete: Cascade)
  items        StockItem[]
}

model StockItem {
  id           Int      @id @default(autoincrement())
  stockGroupId Int
  name         String
  description  String?  @db.Text
  location     String
  zoneId       Int?
  markerId     Int?
  quantity     Int      @default(1)
  notes        String?  @db.Text
  displayOrder Int      @default(0)
  group        StockGroup       @relation(fields: [stockGroupId], references: [id], onDelete: Cascade)
  zone         EditionZone?     @relation(fields: [zoneId], references: [id], onDelete: SetNull)
  marker       EditionMarker?   @relation(fields: [markerId], references: [id], onDelete: SetNull)
  reservations StockReservation[]
}

model StockReservation {
  id               Int                    @id @default(autoincrement())
  stockItemId      Int
  userId           Int
  startsAt         DateTime
  endsAt           DateTime
  usage            String                 @db.Text
  quantityReserved Int                    @default(1)
  status           StockReservationStatus @default(RESERVED)
  stockItem        StockItem @relation(fields: [stockItemId], references: [id], onDelete: Cascade)
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([stockItemId, startsAt, endsAt])
}
```

Toggle d'activation : `Edition.stockEnabled` (`Boolean @default(false)`).

## Permissions

Voir [`docs/system/ORGANIZER_PERMISSIONS.md`](system/ORGANIZER_PERMISSIONS.md).

Le droit dédié est `canManageStock` (convention + per-edition). En complément, les **responsables d'équipes bénévoles** (`isLeader = true` sur au moins une `ApplicationTeamAssignment` de l'édition) ont aussi accès en consultation / réservation.

### Matrice des accès

| Action                                                 | `canManageStock` | Team leader bénévole |
| ------------------------------------------------------ | ---------------- | -------------------- |
| Voir les groupes / items / réservations                | ✅               | ✅                   |
| Créer / éditer / supprimer un groupe                   | ✅               | ❌                   |
| Créer / éditer / supprimer un item                     | ✅               | ❌                   |
| Créer une réservation                                  | ✅               | ✅                   |
| Éditer / supprimer sa propre réservation               | ✅               | ✅                   |
| Modérer (éditer / supprimer) les réservations d'autrui | ✅               | ❌                   |

Helpers serveur (`server/utils/stock-helpers.ts`) :

- `canManageStock(edition, user)` — sync, dans `permissions/edition-permissions.ts`
- `canAccessStock(edition, user)` — async (inclut les team leaders)
- `isAnyTeamLeaderOnEdition(userId, editionId)` — async
- `getReservedQuantityOnPeriod(stockItemId, startsAt, endsAt, excludeReservationId?)` — somme les quantités déjà engagées sur la période (statuts `RESERVED` et `PICKED_UP`)

## API REST

Tous les endpoints exigent une authentification. Préfixe : `/api/editions/:id/`.

### Groupes

| Méthode | Endpoint                 | Permission     | Description                              |
| ------- | ------------------------ | -------------- | ---------------------------------------- |
| GET     | `/stock-groups`          | canAccessStock | Liste les groupes avec leurs items       |
| POST    | `/stock-groups`          | canManageStock | Crée un groupe                           |
| PUT     | `/stock-groups/:groupId` | canManageStock | Met à jour un groupe                     |
| DELETE  | `/stock-groups/:groupId` | canManageStock | Supprime un groupe (cascade items/résas) |

### Items

| Méthode | Endpoint                            | Permission     | Description                                         |
| ------- | ----------------------------------- | -------------- | --------------------------------------------------- |
| POST    | `/stock-groups/:groupId/items`      | canManageStock | Crée un item dans un groupe                         |
| GET     | `/stock-items/:itemId`              | canAccessStock | Détail d'un item + ses réservations                 |
| PUT     | `/stock-items/:itemId`              | canManageStock | Met à jour un item (peut le déplacer entre groupes) |
| DELETE  | `/stock-items/:itemId`              | canManageStock | Supprime un item (cascade sur réservations)         |
| GET     | `/stock-items/:itemId/availability` | canAccessStock | Dispo sur une période `?at=ISO&until=ISO`           |

### Réservations

| Méthode | Endpoint                             | Permission           | Description                |
| ------- | ------------------------------------ | -------------------- | -------------------------- |
| POST    | `/stock-items/:itemId/reservations`  | canAccessStock       | Crée une réservation       |
| PUT     | `/stock-reservations/:reservationId` | auteur ou modérateur | Met à jour une réservation |
| DELETE  | `/stock-reservations/:reservationId` | auteur ou modérateur | Supprime une réservation   |

### Vérification de disponibilité

À la création (ou modification) d'une réservation, le serveur :

1. Vérifie que `endsAt > startsAt`
2. Vérifie que `quantityReserved ≤ quantity` du stock total
3. Calcule la quantité déjà engagée sur la période (`getReservedQuantityOnPeriod`), avec **chevauchement** :
   - `existing.startsAt < newEndsAt && existing.endsAt > newStartsAt`
   - Statuts comptés : `RESERVED` + `PICKED_UP` (les `RETURNED` / `CANCELLED` ne consomment plus le stock)
4. Refuse avec HTTP 409 si `quantityReserved > (quantity - alreadyReserved)`

À l'**édition** d'une réservation existante, la réservation elle-même est exclue du calcul (via `excludeReservationId`) pour ne pas se compter elle-même.

## Frontend

### Pages

- `app/pages/editions/[id]/gestion/stock/index.vue` — grille de cards par groupe, bouton « Nouveau groupe », menu contextuel pour éditer/supprimer (organisateurs uniquement).
- `app/pages/editions/[id]/gestion/stock/[groupId].vue` — détail d'un groupe : liste des items en grille avec quantité et localisation.
- `app/pages/editions/[id]/gestion/stock/items/[itemId].vue` — détail d'un item : description, localisation, badge de disponibilité « maintenant », liste chronologique des réservations, bouton « Réserver ».

### Composants

- `app/components/stock/StockGroupModal.vue` — création / édition d'un groupe
- `app/components/stock/StockItemModal.vue` — création / édition d'un item (avec sélection de zone/marqueur depuis la carte si configurée)
- `app/components/stock/StockReservationModal.vue` — création / édition d'une réservation (période, usage, quantité, statut si modérateur)

### Navigation

- Une entrée **Stock matériel** apparaît dans la sidebar du dashboard édition (`app/layouts/edition-dashboard.vue`) si `stockEnabled` est activé ET que l'utilisateur a accès (organisateur avec `canManageStock` OU team leader).
- Une carte **Stock matériel** apparaît sur l'overview de gestion (`app/pages/editions/[id]/gestion/index.vue`) avec les mêmes conditions.

## i18n

Toutes les clés sont sous `gestion.stock.*` (54 clés traduites dans les 12 langues). Exemples :

- `gestion.stock.title`
- `gestion.stock.new_group`, `gestion.stock.new_item`, `gestion.stock.new_reservation`
- `gestion.stock.status.{RESERVED,PICKED_UP,RETURNED,CANCELLED}`
- `gestion.stock.available_now` (avec params `{available}`, `{total}`)
- `gestion.stock.items_count` / `reservations_count` (avec pluriels)
- `gestion.features.stock_description` (description du toggle dans Fonctionnalités)
- `permissions.manageStock`
- `common.stock_short`

## Évolutions possibles

- Vue calendrier des réservations par item (au-delà de la liste chronologique)
- Notifications J-1 aux utilisateurs ayant une réservation qui démarre
- Sortie / retour rapide via scan QR sur l'item
- Historique des mouvements (qui a sorti, qui a rendu, à quelle heure)
- Import CSV d'inventaire
- Export PDF d'une fiche d'inventaire par groupe
- Demande de réservation soumise à validation (workflow REQUESTED → APPROVED)

---

Dernière mise à jour : 2026-05-18.
