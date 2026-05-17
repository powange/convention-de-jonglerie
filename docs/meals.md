# Module Repas (Meals)

## Vue d'ensemble

Le module Repas permet aux organisateurs de planifier les **repas servis** durant l'événement (avant, pendant et après), de récolter les **sélections** des bénévoles et artistes, de **valider** la consommation à l'entrée du buffet, et d'**intégrer les repas dans la billetterie** (tarifs et options).

Le module est désactivé par défaut. Activation : `Édition → Gestion → Fonctionnalités → Repas`.

## Concepts clés

### VolunteerMeal

Un **créneau de repas** sur une date et un type donné (`BREAKFAST`, `LUNCH`, `DINNER`). Un même type ne peut exister qu'une fois par jour (`@@unique([editionId, date, mealType])`). Les phases applicables (`SETUP`, `EVENT`, `TEARDOWN`) sont stockées sous forme de tableau JSON pour indiquer durant quelles périodes le repas est servi (utile pour les bénévoles dont la disponibilité varie).

> Le nom du modèle est historiquement `VolunteerMeal` mais s'applique à toutes les sélections (bénévoles, artistes, participants billetterie).

### VolunteerMealSelection / ArtistMealSelection

Sélection d'un repas pour un bénévole (`EditionVolunteerApplication`) ou un artiste (`EditionArtist`). Stocke `accepted` (le bénéficiaire prend le repas) et `consumedAt` (timestamp de validation à l'entrée).

### TicketingTierMeal / TicketingOptionMeal

Associations N:N entre un tarif (ou option) de billetterie et un repas. Permet de dire « tel pass week-end inclut le déjeuner du samedi ».

### TicketingOrderItemMeal

Lien entre un participant payant (`TicketingOrderItem`) et un repas, avec `consumedAt` pour la validation individuelle (typiquement après scan QR à l'entrée du buffet).

### VolunteerMealReturnableItem

Lien entre un repas et un article à restituer (`TicketingReturnableItem`) — par exemple, si chaque petit-déjeuner inclut une consigne pour une éco-tasse.

## Architecture

### Modèles Prisma

Fichier : `prisma/schema/meals.prisma`

```prisma
enum VolunteerMealType { BREAKFAST LUNCH DINNER }
enum VolunteerMealPhase { SETUP EVENT TEARDOWN }

model VolunteerMeal {
  id        Int               @id @default(autoincrement())
  editionId Int
  date      DateTime          @db.Date
  mealType  VolunteerMealType
  enabled   Boolean           @default(true)
  phases    Json              @default("[]")
  // Relations vers tous les sous-systèmes
  mealSelections         VolunteerMealSelection[]
  artistMealSelections   ArtistMealSelection[]
  returnableItems        VolunteerMealReturnableItem[]
  tiers                  TicketingTierMeal[]
  options                TicketingOptionMeal[]
  participantValidations TicketingOrderItemMeal[]
  @@unique([editionId, date, mealType])
}
```

Toggle d'activation : `Edition.mealsEnabled` (`Boolean @default(false)`).

## Permissions

Voir [`docs/system/ORGANIZER_PERMISSIONS.md`](system/ORGANIZER_PERMISSIONS.md).

- **Configuration** des repas : droit `canManageMeals` (au niveau convention ou per-edition), créateur d'édition, auteur de convention, admin global.
- **Validation à l'entrée** : peut être déléguée à des bénévoles via le système des **équipes de validation des repas**. Helper backend : `canAccessMealValidation` (et `canManageMeals`). Endpoint dédié : `GET /api/editions/:id/permissions/can-access-meal-validation`.

## API REST

Préfixe : `/api/editions/:id/meals/`.

### Configuration & lecture

| Méthode | Endpoint         | Description                                                          |
| ------- | ---------------- | -------------------------------------------------------------------- |
| GET     | `/`              | Liste des repas configurés sur l'édition                             |
| GET     | `/participants`  | Liste des participants ayant droit à des repas (bénévoles + payants) |
| GET     | `/:mealId/stats` | Statistiques de consommation pour un repas                           |

### Validation à l'entrée

| Méthode | Endpoint            | Description                                         |
| ------- | ------------------- | --------------------------------------------------- |
| GET     | `/:mealId/pending`  | Liste des personnes attendues (non encore consommé) |
| GET     | `/:mealId/search`   | Recherche d'un participant (par nom, QR, etc.)      |
| POST    | `/:mealId/validate` | Valide la consommation (set `consumedAt`)           |
| POST    | `/:mealId/cancel`   | Annule une validation (reset `consumedAt`)          |

### Sélections individuelles

| Méthode | Endpoint                                          | Description                                                   |
| ------- | ------------------------------------------------- | ------------------------------------------------------------- |
| GET     | `/api/editions/:id/volunteers/my-meals`           | Sélections du bénévole connecté                               |
| PUT     | `/api/editions/:id/volunteers/my-meals`           | Met à jour ses propres sélections                             |
| GET     | `/api/editions/:id/my-meals`                      | Vue unifiée pour l'utilisateur courant (toutes sources)       |
| PUT     | `/api/editions/:id/my-meals`                      | Met à jour ses sélections (selon source : bénévole / artiste) |
| GET/PUT | `/api/editions/:id/volunteers/:volunteerId/meals` | Lecture/écriture par un organisateur sur un bénévole          |
| GET/PUT | `/api/editions/:id/artists/:artistId/meals`       | Lecture/écriture par un organisateur sur un artiste           |
| GET     | `/api/editions/:id/volunteers/meals`              | Vue agrégée organisateur : toutes les sélections              |
| PUT     | `/api/editions/:id/volunteers/meals`              | Mise à jour bulk                                              |

### Intégration billetterie

Configurable depuis la billetterie : associer un repas à un tarif (`TicketingTier`) ou à une option (`TicketingOption`). Quand un participant achète le tarif/option, des entrées `TicketingOrderItemMeal` sont créées automatiquement, le rendant éligible à la consommation.

Voir [`docs/ticketing/`](ticketing/) pour les détails.

## Frontend

### Pages organisateur

- `app/pages/editions/[id]/gestion/meals/index.vue` — Configuration des repas (création, dates, phases, articles à restituer, intégration billetterie).
- `app/pages/editions/[id]/gestion/meals/list.vue` — Vue agrégée (qui prend quoi).
- `app/pages/editions/[id]/gestion/meals/validate.vue` — Interface de validation à l'entrée du buffet (scan QR, recherche, etc.).

### Pages utilisateur

- Sélection des repas dans le formulaire de candidature bénévole
- Page « mes repas » accessible aux bénévoles / artistes pour ajuster leurs sélections après acceptation

### Navigation

- Sidebar : entrée **Repas** si `mealsEnabled` ET (`isOrganizer` OU `canAccessMealValidation`).
- Pour les bénévoles habilités à la validation uniquement, seule la sous-entrée « Validation » est visible.

## Liens connexes

- [`docs/volunteers/`](volunteers/) — Module bénévoles
- [`docs/ticketing/`](ticketing/) — Module billetterie (intégration repas)
- [`docs/system/ORGANIZER_PERMISSIONS.md`](system/ORGANIZER_PERMISSIONS.md) — Système de droits

## i18n

Toutes les clés sont sous `gestion.meals.*` :

- `gestion.meals.title`, `gestion.meals.configuration_title`, `gestion.meals.list_title`, `gestion.meals.validation_title`
- `gestion.features.meals_description`
- `permissions.manageMeals`

## Évolutions possibles

- Gestion fine des **régimes alimentaires** (allergies, végétarien, vegan) au niveau du repas
- Notifications push pour rappeler aux participants leurs sélections
- Statistiques avancées (taux de no-show, gaspillage, etc.)
- Export CSV des participants par repas (pour le traiteur)

---

Dernière mise à jour : 2026-05-13.
