# Module Workshops (Ateliers)

## Vue d'ensemble

Le module Workshops permet aux **participants** d'une édition de proposer des ateliers à animer pendant la convention. Chaque atelier a un titre, une description, des horaires, un lieu et une jauge optionnelle. Les utilisateurs peuvent **favoriser** des ateliers.

Le module est désactivé par défaut. Activation : `Édition → Gestion → Fonctionnalités → Ateliers`.

## Concepts clés

### Workshop

Atelier ponctuel proposé par un utilisateur (`creator`). Comprend :

- **Titre & description**
- **Plage horaire** (`startDateTime` → `endDateTime`)
- **Capacité maximale** (optionnelle, `maxParticipants`)
- **Lieu** (optionnel, lien vers `WorkshopLocation`)

### WorkshopLocation

Lieu nommé d'une édition où peuvent se tenir des ateliers. Peut être lié à une zone (`EditionZone`) ou à un marqueur (`EditionMarker`) sur la carte du site.

L'organisateur peut configurer une liste fixe de lieux, ou autoriser la **saisie libre** des lieux par les créateurs (toggle `Edition.workshopLocationsFreeInput`).

### WorkshopFavorite

Favori utilisateur sur un atelier. Permet de retrouver ses ateliers d'intérêt et alimente potentiellement un planning personnel.

## Architecture

### Modèles Prisma

Fichier : `prisma/schema/workshops.prisma`

```prisma
model Workshop {
  id              Int      @id @default(autoincrement())
  editionId       Int
  creatorId       Int
  title           String
  description     String?  @db.Text
  startDateTime   DateTime
  endDateTime     DateTime
  maxParticipants Int?
  locationId      Int?
  edition   Edition           @relation(fields: [editionId], references: [id], onDelete: Cascade)
  creator   User              @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  location  WorkshopLocation? @relation(fields: [locationId], references: [id], onDelete: SetNull)
  favorites WorkshopFavorite[]
}

model WorkshopLocation {
  id        Int     @id @default(autoincrement())
  editionId Int
  name      String
  zoneId    Int?
  markerId  Int?
  edition   Edition        @relation(fields: [editionId], references: [id], onDelete: Cascade)
  zone      EditionZone?   @relation(fields: [zoneId], references: [id], onDelete: SetNull)
  marker    EditionMarker? @relation(fields: [markerId], references: [id], onDelete: SetNull)
  workshops Workshop[]
}

model WorkshopFavorite {
  id         Int @id @default(autoincrement())
  workshopId Int
  userId     Int
  @@unique([workshopId, userId])
}
```

Toggle d'activation : `Edition.workshopsEnabled` (`Boolean @default(false)`).

## Permissions

- **Lecture** : tout utilisateur authentifié peut consulter les ateliers d'une édition publiée.
- **Création** : tout utilisateur authentifié peut créer un atelier (la fonctionnalité est destinée aux participants). L'endpoint `GET /workshops/can-create` retourne les conditions.
- **Édition / Suppression** :
  - Le créateur de l'atelier
  - Les organisateurs de la convention (vue d'ensemble dans `docs/system/ORGANIZER_PERMISSIONS.md`)
- **Configuration des lieux** : organisateurs uniquement.

## API REST

Préfixe : `/api/editions/:id/workshops/`.

### Workshops

| Méthode | Endpoint              | Description                                  |
| ------- | --------------------- | -------------------------------------------- |
| GET     | `/`                   | Liste des ateliers de l'édition              |
| POST    | `/`                   | Crée un nouvel atelier                       |
| PUT     | `/:workshopId`        | Met à jour un atelier                        |
| DELETE  | `/:workshopId`        | Supprime un atelier (cascade sur favoris)    |
| GET     | `/can-create`         | Indique si l'utilisateur courant peut créer  |
| POST    | `/extract-from-image` | Extraction OCR/IA depuis une image (affiche) |

### Favoris

| Méthode | Endpoint                | Description        |
| ------- | ----------------------- | ------------------ |
| POST    | `/:workshopId/favorite` | Ajoute aux favoris |
| DELETE  | `/:workshopId/favorite` | Retire des favoris |

### Lieux (organisateurs)

| Méthode | Endpoint                 | Description      |
| ------- | ------------------------ | ---------------- |
| GET     | `/locations`             | Liste les lieux  |
| POST    | `/locations`             | Crée un lieu     |
| DELETE  | `/locations/:locationId` | Supprime un lieu |

## Frontend

### Pages

- `app/pages/editions/[id]/workshops.vue` : page publique (consultation + favoris).
- `app/pages/editions/[id]/gestion/workshops/index.vue` : vue de gestion pour organisateurs.

### Navigation

- Une entrée **Workshops** apparaît dans la sidebar du dashboard édition si `workshopsEnabled` est activé et que l'utilisateur est organisateur.

## Extraction depuis une image

L'endpoint `POST /workshops/extract-from-image` permet d'extraire automatiquement les informations d'un atelier (titre, description, horaire, lieu) à partir d'une affiche scannée. Utilise l'intégration Anthropic (cf. [`docs/integrations/anthropic-integration.md`](integrations/anthropic-integration.md)).

## i18n

Toutes les clés sont sous `gestion.workshops.*` et `workshops.json` :

- `gestion.workshops.title`, `gestion.workshops.manage_title`, `gestion.workshops.manage_description`
- `gestion.features.workshops_description`

## Évolutions possibles

- Inscription / liste d'attente sur les ateliers à capacité limitée
- Validation des ateliers par les organisateurs avant publication
- Catégories / niveaux (débutant / avancé)
- Vue calendrier dédiée aux ateliers
- Notifications J-1 aux participants favoris

---

Dernière mise à jour : 2026-05-13.
