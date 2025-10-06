# Gestion des Commandes

Les commandes représentent les achats de billets, qu'ils proviennent de HelloAsso ou d'ajouts manuels par les organisateurs.

## Modèle de Données

### Table `TicketingOrder`

```prisma
model TicketingOrder {
  id                  Int      @id @default(autoincrement())
  externalTicketingId String?  // Null pour commandes manuelles
  helloAssoOrderId    Int?     // Null pour commandes manuelles
  editionId           Int      // Lien direct vers l'édition

  // Informations du payeur
  payerFirstName      String
  payerLastName       String
  payerEmail          String

  // Montant et statut
  amount              Int      // Montant total en centimes
  status              String   // Processed, Refunded, etc.

  // Date de la commande
  orderDate           DateTime

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  edition             Edition                @relation(...)
  externalTicketing   ExternalTicketing?     @relation(...)
  items               TicketingOrderItem[]   // Participants/billets

  @@unique([externalTicketingId, helloAssoOrderId])
  @@index([externalTicketingId])
  @@index([editionId])
  @@index([payerEmail])
}
```

### Table `TicketingOrderItem`

```prisma
model TicketingOrderItem {
  id              Int      @id @default(autoincrement())
  orderId         Int      // Lien vers TicketingOrder
  helloAssoItemId Int?     // Null pour ajouts manuels
  tierId          Int?     // Lien vers le tarif

  // Informations du participant (peut différer du payeur)
  firstName       String?
  lastName        String?
  email           String?

  // Détails du billet
  name            String?  // Nom du tarif
  type            String?  // Donation, Payment, Membership, etc.
  amount          Int      // Prix payé en centimes
  state           String   // Processed, Refunded, etc.
  qrCode          String?  // Code QR pour contrôle d'accès

  // Champs personnalisés (réponses aux options)
  customFields    Json?

  // Validation d'entrée
  entryValidated  Boolean  @default(false)
  entryValidatedAt DateTime?
  entryValidatedBy Int?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  order           TicketingOrder @relation(...)
  tier            TicketingTier? @relation(...)

  @@index([orderId])
  @@index([tierId])
  @@index([helloAssoItemId])
  @@index([email])
  @@index([qrCode])
  @@index([entryValidated])
}
```

## Types de Commandes

### 1. Commandes HelloAsso (Synchronisées)

**Caractéristiques** :

- `externalTicketingId` non null
- `helloAssoOrderId` non null
- Importées automatiquement via l'API HelloAsso
- Contiennent les informations complètes du payeur et des participants

**Exemple** :

```typescript
{
  id: 123,
  externalTicketingId: "ext_abc123",
  helloAssoOrderId: 987654,
  editionId: 5,
  payerFirstName: "Jean",
  payerLastName: "Dupont",
  payerEmail: "jean.dupont@example.com",
  amount: 5000, // 50€
  status: "Processed",
  orderDate: "2024-01-15T10:30:00Z",
  items: [
    {
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean.dupont@example.com",
      tierId: 1,
      amount: 2500,
      qrCode: "QR_ABC123"
    },
    {
      firstName: "Marie",
      lastName: "Dupont",
      email: "marie.dupont@example.com",
      tierId: 2,
      amount: 2500,
      qrCode: "QR_DEF456"
    }
  ]
}
```

### 2. Commandes Manuelles

**Caractéristiques** :

- `externalTicketingId` null
- `helloAssoOrderId` null
- Créées via l'interface par les organisateurs
- Utilisées pour les paiements hors ligne (espèces, chèque, virement)

**Exemple** :

```typescript
{
  id: 124,
  externalTicketingId: null,
  helloAssoOrderId: null,
  editionId: 5,
  payerFirstName: "Pierre",
  payerLastName: "Martin",
  payerEmail: "pierre.martin@example.com",
  amount: 2000, // 20€
  status: "Processed",
  orderDate: "2024-01-16T14:00:00Z",
  items: [
    {
      firstName: "Pierre",
      lastName: "Martin",
      email: "pierre.martin@example.com",
      tierId: 3,
      amount: 2000,
      qrCode: "MANUAL_GHI789"
    }
  ]
}
```

## API Routes

### Récupérer les Commandes depuis HelloAsso

**Route** : `GET /api/editions/:id/ticketing/helloasso/orders`

**Permission** : `canAccessEditionData`

**Fonctionnalité** :

- Récupère les commandes depuis l'API HelloAsso
- Synchronise avec la base de données locale
- Crée/met à jour les commandes et items

**Réponse** :

```typescript
{
  orders: TicketingOrder[]
  stats: {
    totalOrders: number
    totalItems: number
  }
}
```

**Processus** :

1. Récupère la configuration HelloAsso
2. Authentifie avec OAuth2
3. Récupère les commandes via l'API HelloAsso
4. Pour chaque commande :
   - Crée/met à jour `TicketingOrder`
   - Pour chaque item :
     - Cherche le tarif correspondant
     - Crée/met à jour `TicketingOrderItem`
     - Génère un QR code unique si absent

---

### Synchroniser les Commandes HelloAsso

**Route** : `POST /api/editions/:id/ticketing/helloasso/orders`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  clientId: string
  clientSecret: string
  organizationSlug: string
  formType: string
  formSlug: string
}
```

**Utilisation** : Synchronisation manuelle sans sauvegarder la configuration (pour test).

---

### Récupérer les Commandes depuis la DB

**Route** : `GET /api/editions/:id/ticketing/orders`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
{
  orders: Array<
    TicketingOrder & {
      items: TicketingOrderItem[]
      _count: { items: number }
    }
  >
  stats: {
    totalOrders: number
    totalItems: number
    totalAmount: number
    validatedEntries: number
  }
}
```

**Note** : Cette route lit depuis la base de données locale, pas depuis HelloAsso.

---

### Ajouter un Participant Manuellement

**Route** : `POST /api/editions/:id/ticketing/add-participant-manually`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  // Informations participant
  firstName: string
  lastName: string
  email: string

  // Tarif
  tierId: number
  tierQuantities: Record<number, number>  // { tierId: quantity }

  // Options personnalisées
  customFields?: Array<{
    name: string
    answer: string
  }>

  // Informations paiement
  paymentMethod: 'cash' | 'check' | 'transfer' | 'other'
  amount: number  // Montant payé en centimes
}
```

**Validation Zod** :

```typescript
const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  tierId: z.number().int().positive(),
  tierQuantities: z.record(z.number().int().nonnegative()),
  customFields: z
    .array(
      z.object({
        name: z.string(),
        answer: z.string(),
      })
    )
    .optional(),
  paymentMethod: z.enum(['cash', 'check', 'transfer', 'other']),
  amount: z.number().int().nonnegative(),
})
```

**Processus** :

1. Valide les données
2. Crée une commande manuelle (`TicketingOrder`)
3. Pour chaque quantité de tarif :
   - Crée un `TicketingOrderItem`
   - Génère un QR code unique
   - Stocke les `customFields`

**Réponse** :

```typescript
{
  success: true
  order: TicketingOrder
  items: TicketingOrderItem[]
}
```

---

## Utilitaire Serveur

**Fichier** : `server/utils/editions/ticketing/helloasso.ts`

### Fonctions Disponibles

#### `fetchOrdersFromHelloAsso(config, editionId)`

Récupère et synchronise les commandes depuis HelloAsso.

```typescript
const { orders, stats } = await fetchOrdersFromHelloAsso(
  {
    clientId: '...',
    clientSecret: '...',
    organizationSlug: 'ma-convention',
    formType: 'Event',
    formSlug: 'edition-2024',
  },
  editionId
)
```

**Algorithme** :

1. Authentification OAuth2 avec HelloAsso
2. Récupération des commandes via `GET /v5/organizations/{slug}/forms/{formType}/{formSlug}/orders`
3. Pour chaque commande :
   - Upsert `TicketingOrder`
   - Pour chaque item :
     - Recherche du tarif correspondant par nom
     - Upsert `TicketingOrderItem`
     - Génération QR code si absent

---

## Structure des Données HelloAsso

### Format de Réponse API

```json
{
  "data": [
    {
      "id": 987654,
      "date": "2024-01-15T10:30:00Z",
      "amount": {
        "total": 5000
      },
      "state": "Processed",
      "payer": {
        "firstName": "Jean",
        "lastName": "Dupont",
        "email": "jean.dupont@example.com"
      },
      "items": [
        {
          "id": 123456,
          "name": "Adulte",
          "type": "Payment",
          "amount": 2500,
          "state": "Processed",
          "user": {
            "firstName": "Jean",
            "lastName": "Dupont",
            "email": "jean.dupont@example.com"
          },
          "customFields": [
            {
              "name": "Régime alimentaire",
              "answer": "Végétarien"
            }
          ]
        }
      ]
    }
  ]
}
```

### Mapping vers la Base de Données

```typescript
// TicketingOrder
{
  helloAssoOrderId: order.id,
  payerFirstName: order.payer.firstName,
  payerLastName: order.payer.lastName,
  payerEmail: order.payer.email,
  amount: order.amount.total,
  status: order.state,
  orderDate: order.date
}

// TicketingOrderItem
{
  helloAssoItemId: item.id,
  firstName: item.user.firstName,
  lastName: item.user.lastName,
  email: item.user.email,
  name: item.name,
  type: item.type,
  amount: item.amount,
  state: item.state,
  customFields: item.customFields,
  qrCode: generateQRCode() // Généré si absent
}
```

---

## Génération de QR Codes

### Format

```
ORD_{orderId}_ITEM_{itemId}_{randomString}
```

**Exemple** : `ORD_123_ITEM_456_a1b2c3d4`

### Implémentation

```typescript
function generateQRCode(orderId: number, itemId: number): string {
  const random = Math.random().toString(36).substring(2, 10)
  return `ORD_${orderId}_ITEM_${itemId}_${random}`
}
```

### Utilisation

Le QR code est scanné lors du contrôle d'accès via :

- `POST /api/editions/:id/ticketing/verify-qrcode`

---

## Composants Vue

### `ParticipantDetailsModal.vue`

**Localisation** : `app/components/ticketing/ParticipantDetailsModal.vue`

**Fonctionnalités** :

- Affiche les détails d'un participant (item)
- Affiche le QR code
- Affiche les informations de la commande
- Affiche les réponses aux options (`customFields`)
- Affiche les items à restituer
- Bouton de validation d'entrée

**Props** :

```typescript
{
  participant: TicketingOrderItem & {
    order: TicketingOrder
    tier: TicketingTier
  }
  editionId: number
}
```

### `AddParticipantModal.vue`

**Localisation** : `app/components/ticketing/AddParticipantModal.vue`

**Fonctionnalités** :

- Formulaire d'ajout manuel de participants
- Sélection du tarif
- Sélection de la quantité par tarif
- Réponse aux options
- Choix du mode de paiement
- Validation et création de la commande

**Props** :

```typescript
{
  editionId: number
}
```

---

## Pages de Gestion

### `orders.vue`

**Localisation** : `app/pages/editions/[id]/gestion/ticketing/orders.vue`

**Fonctionnalités** :

- Liste toutes les commandes
- Recherche par nom, email, commande
- Filtres par statut, tarif
- Affichage des statistiques
- Export CSV (optionnel)

**Affichage** :

- Tableau avec tri et pagination
- Colonne : Date, Payeur, Email, Montant, Statut, Nb participants
- Ligne extensible pour voir les items

---

## Cas d'Usage

### 1. Synchroniser les Commandes HelloAsso

```typescript
const { orders, stats } = await $fetch(`/api/editions/${editionId}/ticketing/helloasso/orders`)

console.log(`${stats.totalOrders} commandes, ${stats.totalItems} participants`)
```

### 2. Ajouter un Participant Payant en Espèces

```typescript
const result = await $fetch(`/api/editions/${editionId}/ticketing/add-participant-manually`, {
  method: 'POST',
  body: {
    firstName: 'Sophie',
    lastName: 'Bernard',
    email: 'sophie.bernard@example.com',
    tierId: adulteId,
    tierQuantities: { [adulteId]: 1 },
    customFields: [
      { name: 'Régime alimentaire', answer: 'Végan' },
      { name: 'Allergies', answer: 'Noix' },
    ],
    paymentMethod: 'cash',
    amount: 2500, // 25€
  },
})

console.log('QR Code:', result.items[0].qrCode)
```

### 3. Ajouter Plusieurs Participants (Famille)

```typescript
const result = await $fetch(`/api/editions/${editionId}/ticketing/add-participant-manually`, {
  method: 'POST',
  body: {
    firstName: 'Paul',
    lastName: 'Durand',
    email: 'paul.durand@example.com',
    tierId: adulteId,
    tierQuantities: {
      [adulteId]: 2, // 2 adultes
      [enfantId]: 1, // 1 enfant
    },
    paymentMethod: 'check',
    amount: 6000, // 60€
  },
})

console.log(`${result.items.length} billets créés`)
```

### 4. Lister les Commandes Non Validées

```typescript
const { orders } = await $fetch(`/api/editions/${editionId}/ticketing/orders`)

const nonValidees = orders.filter((order) => order.items.some((item) => !item.entryValidated))

console.log(`${nonValidees.length} commandes avec entrées non validées`)
```

### 5. Rechercher un Participant par Email

```typescript
const { orders } = await $fetch(`/api/editions/${editionId}/ticketing/orders`)

const participant = orders
  .flatMap((order) => order.items)
  .find((item) => item.email === 'jean.dupont@example.com')

if (participant) {
  console.log('Participant trouvé:', participant)
}
```

---

## Bonnes Pratiques

### 1. Synchronisation Régulière

Synchronisez les commandes HelloAsso régulièrement :

- Toutes les heures pendant la période de vente
- Toutes les 10 minutes le jour J

### 2. Gestion des Doublons

L'upsert basé sur `helloAssoOrderId` et `helloAssoItemId` évite les doublons.

### 3. QR Codes Uniques

Vérifiez l'unicité des QR codes lors de la génération :

```typescript
let qrCode = generateQRCode()
while (await prisma.orderItem.findUnique({ where: { qrCode } })) {
  qrCode = generateQRCode()
}
```

### 4. Gestion des Remboursements

Surveillez le champ `state` :

- `Processed` : Commande payée
- `Refunded` : Commande remboursée
- `Canceled` : Commande annulée

Ne validez pas les entrées pour les commandes remboursées/annulées.

### 5. CustomFields

Stockez toujours les `customFields` même si vous ne les utilisez pas immédiatement, pour référence future.

---

## Dépannage

### Les commandes ne se synchronisent pas

**Causes possibles** :

- Configuration HelloAsso incorrecte
- Formulaire HelloAsso inexistant ou slug incorrect
- Credentials expirés

**Solution** : Testez la connexion via `POST /ticketing/helloasso/test`.

### Tarifs non trouvés lors de la synchronisation

**Cause** : Le nom du tarif HelloAsso ne correspond à aucun tarif en DB
**Solution** : Synchronisez d'abord les tarifs via `GET /ticketing/helloasso/tiers`.

### QR codes en double

**Cause** : Race condition lors de la génération
**Solution** : Utilisez une transaction et vérifiez l'unicité.

### Items sans email

**Cause** : HelloAsso peut ne pas fournir d'email pour certains items
**Solution** : Utilisez l'email du payeur (`order.payerEmail`) comme fallback.

---

## Voir Aussi

- [Tarifs](./tiers.md) - Liaison items ↔ tarifs
- [Options](./options.md) - Réponses dans customFields
- [Contrôle d'Accès](./access-control.md) - Validation des entrées
- [Intégration HelloAsso](./external-integration.md) - Configuration et synchronisation
