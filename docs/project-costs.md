# Module Coûts du projet (Project Costs)

## Vue d'ensemble

Le module Project Costs permet de :

1. **Documenter** les coûts d'exploitation du projet (hébergement, domaine, matériel, électricité…)
2. **Estimer** le temps de développement investi (heures fixes + heures hebdomadaires)
3. **Recevoir des donations** via Stripe (« offrir un café »)

Ce module est **admin-only** pour la configuration. La page publique `/project-costs` présente les chiffres aux visiteurs et offre un bouton de don.

## Concepts clés

### ProjectExpense

Un poste de dépense : nom, description, catégorie (`DOMAIN`, `HOSTING`, `HARDWARE`, `ELECTRICITY`, `SOFTWARE`, `SERVICE`, `OTHER`), icône, ordre d'affichage.

### ProjectExpenseRate

Un **tarif historique** appliqué à un poste de dépense sur une période. Permet de tracer les évolutions de prix. Période : `MONTHLY`, `YEARLY`, `ONE_TIME`. Champs `startDate` et `endDate` (nullable = encore actif).

### TimeEstimateConfig

Configuration unique : `fixedHours` (heures déjà comptabilisées à `referenceDate`) + `weeklyHours` (heures par semaine après cette date). Permet de calculer l'estimation totale du temps investi.

### StripeConfig

Stocke les clés Stripe (chiffrées AES-256-GCM via [`server/utils/encryption.ts`](../../server/utils/encryption.ts)) pour les donations café.

### CoffeeDonation

Historique des donations reçues : ID Stripe, quantité, total/frais/net en centimes, email/nom du donateur, statut.

## Architecture

### Modèles Prisma

Fichier : `prisma/schema/project-costs.prisma`

```prisma
enum ProjectExpenseCategory { DOMAIN HOSTING HARDWARE ELECTRICITY SOFTWARE SERVICE OTHER }
enum ProjectExpensePeriod   { MONTHLY YEARLY ONE_TIME }

model ProjectExpense {
  id          Int
  name        String
  description String? @db.Text
  category    ProjectExpenseCategory
  icon        String?
  isActive    Boolean @default(true)
  sortOrder   Int     @default(0)
  rates       ProjectExpenseRate[]
}

model ProjectExpenseRate {
  id        Int
  expenseId Int
  amount    Decimal              @db.Decimal(10, 2)
  currency  String               @default("EUR")
  period    ProjectExpensePeriod
  startDate DateTime
  endDate   DateTime?
  note      String? @db.Text
}

model StripeConfig {
  publicKey     String @db.Text  // Encrypted
  secretKey     String @db.Text  // Encrypted
  webhookSecret String @db.Text  // Encrypted
  isActive      Boolean @default(true)
}

model TimeEstimateConfig {
  fixedHours    Decimal  @db.Decimal(10, 1)
  referenceDate DateTime
  weeklyHours   Decimal  @db.Decimal(5, 1)
}

model CoffeeDonation {
  stripeSessionId String   @unique
  quantity        Int
  totalCents      Int
  feeCents        Int?
  netCents        Int?
  email           String?
  customerName    String?
  status          String   @default("completed")
}
```

## API REST

### Public (`/api/project-costs/`)

| Méthode | Endpoint     | Description                                           |
| ------- | ------------ | ----------------------------------------------------- |
| GET     | `/`          | Liste des postes de dépense (avec tarif actif)        |
| GET     | `/donations` | Liste publique des donations (anonymisée)             |
| POST    | `/checkout`  | Crée une session Stripe Checkout pour un don          |
| POST    | `/webhook`   | Webhook Stripe (réception des événements de paiement) |

### Admin (`/api/admin/project-costs/`)

| Méthode | Endpoint             | Description                                  |
| ------- | -------------------- | -------------------------------------------- |
| GET     | `/`                  | Liste complète (admin) des postes            |
| POST    | `/`                  | Crée un poste de dépense                     |
| PUT     | `/:id`               | Met à jour un poste                          |
| DELETE  | `/:id`               | Supprime un poste (cascade sur tarifs)       |
| POST    | `/:id/rates`         | Ajoute un tarif au poste                     |
| PUT     | `/:id/rates/:rateId` | Met à jour un tarif                          |
| DELETE  | `/:id/rates/:rateId` | Supprime un tarif                            |
| GET     | `/time-estimate`     | Lit la config d'estimation du temps          |
| POST    | `/time-estimate`     | Met à jour la config d'estimation            |
| GET     | `/stripe-config`     | Lit la config Stripe (avec valeurs masquées) |
| POST    | `/stripe-config`     | Met à jour la config Stripe (clés chiffrées) |

## Permissions

- **Lecture publique** : `GET /api/project-costs/*` accessible à tous.
- **Admin** : `/api/admin/project-costs/*` nécessite `isGlobalAdmin` + mode admin actif.

## Sécurité

- Les clés Stripe sont **chiffrées en base** (AES-256-GCM) via `server/utils/encryption.ts`.
- Le webhook vérifie la signature Stripe avant de traiter l'événement.
- Les donations sont enregistrées avec leurs détails (frais Stripe inclus pour transparence).

## Frontend

### Pages publiques

- `app/pages/project-costs/index.vue` — Page principale : liste des coûts, estimation du temps, total cumulé, bouton de don
- `app/pages/project-costs/success.vue` — Page de confirmation après don
- `app/pages/project-costs/cancel.vue` — Page d'annulation de checkout

### Page admin

- `app/pages/admin/project-costs.vue` — Configuration des postes, tarifs, time-estimate, Stripe

## Évolutions possibles

- Affichage du « coût mensuel actuel » calculé en temps réel à partir des tarifs actifs
- Graphique d'évolution des coûts dans le temps
- Notifications admin quand une donation arrive
- Récap annuel public des donations vs coûts

---

Dernière mise à jour : 2026-05-18.
