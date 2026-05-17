# Module Covoiturage (Carpool)

## Vue d'ensemble

Le module Covoiturage permet aux participants d'une édition de **proposer des offres** de transport (« je conduis et j'ai des places ») ou de **publier des demandes** (« je cherche un trajet »), puis de se mettre en relation via des **réservations** et des **commentaires**.

Toujours actif sur une édition (pas de toggle dédié).

## Concepts clés

### CarpoolOffer

Un conducteur propose un trajet : date, lieu, places disponibles, sens (`TO_EVENT` ou `FROM_EVENT`), description, préférences (fumeur, animaux, musique), téléphone.

### CarpoolRequest

Un passager publie une demande : date, ville, nombre de places nécessaires, sens, description.

### CarpoolBooking

Demande de réservation sur une offre. Statut : `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`. Peut être liée à une `CarpoolRequest` (lien entre une demande et une offre).

### CarpoolPassenger

Passager confirmé sur une offre (ajout direct par le conducteur, sans booking). Garantit l'unicité `(offerId, userId)`.

### CarpoolComment / CarpoolRequestComment

Fil de discussion attaché à une offre ou à une demande.

## Architecture

### Modèles Prisma

Fichier : `prisma/schema/carpool.prisma`

```prisma
enum CarpoolDirection { TO_EVENT FROM_EVENT }
enum BookingStatus    { PENDING ACCEPTED REJECTED CANCELLED }

model CarpoolOffer {
  id              Int
  userId          Int
  editionId       Int
  tripDate        DateTime
  locationCity    String
  locationAddress String
  availableSeats  Int
  direction       CarpoolDirection @default(TO_EVENT)
  description     String?  @db.Text
  phoneNumber     String?
  smokingAllowed  Boolean  @default(false)
  petsAllowed     Boolean  @default(false)
  musicAllowed    Boolean  @default(false)
  // Relations : bookings, comments, passengers
}

model CarpoolRequest {
  id           Int
  userId       Int
  editionId    Int
  tripDate     DateTime
  locationCity String
  seatsNeeded  Int @default(1)
  direction    CarpoolDirection @default(TO_EVENT)
  // Relations : bookings, comments
}

model CarpoolBooking {
  id             Int
  carpoolOfferId Int
  requestId      Int?
  requesterId    Int
  seats          Int
  message        String? @db.Text
  status         BookingStatus @default(PENDING)
}

model CarpoolPassenger {
  id             Int
  carpoolOfferId Int
  userId         Int
  addedById      Int
  @@unique([carpoolOfferId, userId])
}
```

## Permissions

- **Lecture** : tout utilisateur connecté peut voir les offres et demandes d'une édition.
- **Création / édition / suppression** : uniquement l'auteur de l'offre/demande.
- **Acceptation / refus d'un booking** : uniquement le propriétaire de l'offre.
- **Ajout direct d'un passager** : uniquement le propriétaire de l'offre.
- **Commentaires** : tout utilisateur connecté.

## API REST

### Offres rattachées à une édition

| Méthode | Endpoint                             | Description                   |
| ------- | ------------------------------------ | ----------------------------- |
| GET     | `/api/editions/:id/carpool-offers`   | Liste des offres de l'édition |
| POST    | `/api/editions/:id/carpool-offers`   | Crée une offre                |
| GET     | `/api/editions/:id/carpool-requests` | Liste des demandes            |
| POST    | `/api/editions/:id/carpool-requests` | Crée une demande              |

### Offre individuelle

| Méthode | Endpoint                                      | Description                                 |
| ------- | --------------------------------------------- | ------------------------------------------- |
| GET     | `/api/carpool-offers/:id`                     | Détail d'une offre                          |
| PUT     | `/api/carpool-offers/:id`                     | Met à jour une offre                        |
| DELETE  | `/api/carpool-offers/:id`                     | Supprime une offre                          |
| GET     | `/api/carpool-offers/:id/comments`            | Commentaires de l'offre                     |
| POST    | `/api/carpool-offers/:id/comments`            | Ajouter un commentaire                      |
| GET     | `/api/carpool-offers/:id/bookings`            | Réservations sur l'offre                    |
| POST    | `/api/carpool-offers/:id/bookings`            | Demander une réservation                    |
| PUT     | `/api/carpool-offers/:id/bookings/:bookingId` | Accepter / refuser / annuler la réservation |
| POST    | `/api/carpool-offers/:id/passengers`          | Ajouter directement un passager             |
| DELETE  | `/api/carpool-offers/:id/passengers/:userId`  | Retirer un passager                         |

### Demande individuelle

| Méthode | Endpoint                             | Description            |
| ------- | ------------------------------------ | ---------------------- |
| GET     | `/api/carpool-requests/:id`          | Détail d'une demande   |
| PUT     | `/api/carpool-requests/:id`          | Met à jour une demande |
| DELETE  | `/api/carpool-requests/:id`          | Supprime une demande   |
| GET     | `/api/carpool-requests/:id/comments` | Commentaires           |
| POST    | `/api/carpool-requests/:id/comments` | Ajouter un commentaire |

## Notifications

Helpers dans `server/utils/notification-service.ts` :

- `carpoolBookingReceived` — Demande de réservation reçue → propriétaire de l'offre
- `carpoolBookingAccepted` — Réservation acceptée → passager
- `carpoolBookingRejected` — Réservation refusée → passager
- `carpoolBookingCancelled` — Réservation annulée par le passager → propriétaire

Voir [`docs/system/NOTIFICATION_SYSTEM.md`](system/NOTIFICATION_SYSTEM.md).

## Frontend

### Pages

- `app/pages/editions/[id]/carpool/index.vue` — Liste des offres et demandes (avec onglets).
- `app/pages/editions/[id]/carpool/offers/[offerId].vue` — Détail d'une offre + fil de commentaires + réservations.
- `app/pages/editions/[id]/carpool/requests/[requestId].vue` — Détail d'une demande + commentaires.

## Évolutions possibles

- Calcul d'un itinéraire estimé / partage de carte
- Filtrage avancé (ville, date, sens)
- Système de matching automatique offre ↔ demande
- Rappels J-1 du trajet aux passagers/conducteur

---

Dernière mise à jour : 2026-05-18.
