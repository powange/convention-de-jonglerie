# Gestion des Tarifs (Tiers)

Les tarifs définissent les différents types de billets disponibles pour une édition (adulte, enfant, pass weekend, etc.).

## Caractéristiques

### Types de Tarifs

1. **Tarifs HelloAsso** (synchronisés)
   - Importés automatiquement depuis HelloAsso
   - Champ `helloAssoTierId` non null
   - Informations non modifiables (sauf relations)
   - Suppression impossible

2. **Tarifs Manuels**
   - Créés manuellement par l'organisateur
   - Champ `helloAssoTierId` null
   - Entièrement modifiables
   - Supprimables

### Propriétés d'un Tarif

```typescript
interface TierData {
  name: string // Nom du tarif (ex: "Adulte", "Enfant")
  description?: string | null // Description optionnelle
  price: number // Prix en centimes
  minAmount?: number | null // Montant minimum (tarifs libres)
  maxAmount?: number | null // Montant maximum (tarifs libres)
  position: number // Ordre d'affichage
  isActive: boolean // Tarif actif ou non
  quotaIds?: number[] // Quotas associés
  returnableItemIds?: number[] // Items à restituer associés
}
```

## Modèle de Données

### Table `HelloAssoTier`

```prisma
model HelloAssoTier {
  id                  Int      @id @default(autoincrement())
  externalTicketingId String?  // Null si tarif manuel
  helloAssoTierId     Int?     // ID HelloAsso, null si manuel
  editionId           Int      // Lien vers l'édition
  name                String
  description         String?  @db.Text
  price               Int      // Prix en centimes
  minAmount           Int?     // Pour tarifs libres
  maxAmount           Int?     // Pour tarifs libres
  isActive            Boolean  @default(true)
  position            Int      @default(0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  externalTicketing ExternalTicketing?     @relation(...)
  edition           Edition                 @relation(...)
  quotas            TierQuota[]            // Relations quotas
  returnableItems   TierReturnableItem[]   // Relations items
  orderItems        HelloAssoOrderItem[]   // Billets vendus

  @@unique([externalTicketingId, helloAssoTierId])
  @@index([externalTicketingId])
  @@index([editionId])
}
```

### Relations

#### TierQuota

Associe un tarif à un ou plusieurs quotas.

```prisma
model TierQuota {
  id      Int @id @default(autoincrement())
  tierId  Int
  quotaId Int

  tier  HelloAssoTier  @relation(...)
  quota TicketingQuota @relation(...)

  @@unique([tierId, quotaId])
}
```

**Exemple** : Le tarif "Adulte avec repas" consomme le quota "Places totales" ET le quota "Repas".

#### TierReturnableItem

Associe un tarif à un ou plusieurs items à restituer.

```prisma
model TierReturnableItem {
  id               Int @id @default(autoincrement())
  tierId           Int
  returnableItemId Int

  tier           HelloAssoTier  @relation(...)
  returnableItem ReturnableItem @relation(...)

  @@unique([tierId, returnableItemId])
}
```

**Exemple** : Le tarif "Pass Weekend" nécessite de restituer un "Badge" et un "T-shirt".

## API Routes

### Récupérer les Tarifs

**Route** : `GET /api/editions/:id/ticketing/tiers`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
HelloAssoTier[] // Avec relations quotas et returnableItems
```

**Utilisation** : Liste complète des tarifs pour la gestion

---

### Récupérer les Tarifs Disponibles

**Route** : `GET /api/editions/:id/ticketing/tiers/available`

**Permission** : Publique (si édition accessible)

**Réponse** :

```typescript
{
  tiers: HelloAssoTier[] // Seulement les tarifs actifs
}
```

**Utilisation** : Affichage public des tarifs disponibles (ex: formulaire d'inscription)

---

### Créer un Tarif Manuel

**Route** : `POST /api/editions/:id/ticketing/tiers`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  name: string              // Obligatoire
  description?: string
  price: number            // En centimes, >= 0
  minAmount?: number       // En centimes, >= 0
  maxAmount?: number       // En centimes, >= 0
  position?: number        // Défaut: 0
  isActive?: boolean       // Défaut: true
  quotaIds?: number[]      // Défaut: []
  returnableItemIds?: number[] // Défaut: []
}
```

**Réponse** :

```typescript
{
  success: true
  tier: HelloAssoTier
}
```

**Validation Zod** :

```typescript
const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0),
  minAmount: z.number().int().min(0).nullable().optional(),
  maxAmount: z.number().int().min(0).nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  quotaIds: z.array(z.number().int()).optional().default([]),
  returnableItemIds: z.array(z.number().int()).optional().default([]),
})
```

---

### Modifier un Tarif

**Route** : `PUT /api/editions/:id/ticketing/tiers/:tierId`

**Permission** : `canManageEditionVolunteers`

**Body** : Identique à la création

**Comportement** :

- **Tarif HelloAsso** : Seules les relations (quotas, returnableItems) sont modifiables
- **Tarif manuel** : Tous les champs sont modifiables

**Réponse** :

```typescript
{
  success: true
  tier: HelloAssoTier
}
```

**Erreurs** :

- `404` : Tarif introuvable
- `403` : Tarif n'appartient pas à cette édition

---

### Supprimer un Tarif Manuel

**Route** : `DELETE /api/editions/:id/ticketing/tiers/:tierId`

**Permission** : `canManageEditionVolunteers`

**Réponse** :

```typescript
{
  success: true
  message: 'Tarif supprimé avec succès'
}
```

**Erreurs** :

- `404` : Tarif introuvable
- `403` : Impossible de supprimer un tarif HelloAsso (synchronisé)

---

## Utilitaire Serveur

**Fichier** : `server/utils/editions/ticketing/tiers.ts`

### Fonctions Disponibles

#### `getEditionTiers(editionId: number)`

Récupère tous les tarifs d'une édition avec leurs relations.

```typescript
const tiers = await getEditionTiers(editionId)
// Retourne: HelloAssoTier[] avec quotas et returnableItems
```

#### `createTier(editionId: number, data: TierData)`

Crée un nouveau tarif manuel.

```typescript
const tier = await createTier(editionId, {
  name: 'Tarif Étudiant',
  price: 1500, // 15€
  position: 2,
  isActive: true,
  quotaIds: [1, 3],
  returnableItemIds: [2],
})
```

#### `updateTier(tierId: number, editionId: number, data: TierData)`

Met à jour un tarif existant.

**Logique** :

1. Vérifie que le tarif existe et appartient à l'édition
2. Détermine si c'est un tarif HelloAsso ou manuel
3. Supprime les anciennes relations
4. Met à jour les champs (tous si manuel, seulement relations si HelloAsso)
5. Recrée les nouvelles relations

```typescript
const tier = await updateTier(5, editionId, {
  name: 'Tarif Étudiant - Modifié',
  price: 1200, // 12€
  quotaIds: [1], // Supprime le quota 3
  returnableItemIds: [],
})
```

#### `deleteTier(tierId: number, editionId: number)`

Supprime un tarif manuel.

**Validations** :

- Le tarif doit exister et appartenir à l'édition
- Le tarif ne doit pas être un tarif HelloAsso (`helloAssoTierId` doit être null)

```typescript
await deleteTier(5, editionId)
// Retourne: { success: true, message: "..." }
```

---

## Composants Vue

### `TiersList.vue`

**Localisation** : `app/components/ticketing/TiersList.vue`

**Fonctionnalités** :

- Affiche la liste des tarifs
- Indique les tarifs HelloAsso (badge)
- Affiche le prix formaté
- Affiche les quotas et items associés
- Boutons d'édition/suppression (si manuel)

**Props** :

```typescript
{
  editionId: number
}
```

### `TierModal.vue`

**Localisation** : `app/components/ticketing/TierModal.vue`

**Fonctionnalités** :

- Formulaire de création/modification
- Sélection multiple de quotas
- Sélection multiple d'items à restituer
- Validation côté client
- Champs désactivés pour tarifs HelloAsso (sauf relations)

**Props** :

```typescript
{
  editionId: number
  tier?: HelloAssoTier | null // Si modification
  quotas: TicketingQuota[]
  returnableItems: ReturnableItem[]
}
```

---

## Utilitaires Client

**Fichier** : `app/utils/ticketing/tiers.ts`

### Fonctions Helper

```typescript
// Formater le prix en euros
export function formatTierPrice(priceInCents: number): string {
  return `${(priceInCents / 100).toFixed(2)}€`
}

// Déterminer si un tarif est HelloAsso
export function isHelloAssoTier(tier: HelloAssoTier): boolean {
  return tier.helloAssoTierId !== null
}

// Vérifier si un tarif est un tarif libre
export function isFreePriceTier(tier: HelloAssoTier): boolean {
  return tier.minAmount !== null || tier.maxAmount !== null
}
```

---

## Cas d'Usage

### 1. Créer un Tarif "Étudiant"

```typescript
const tier = await $fetch(`/api/editions/${editionId}/ticketing/tiers`, {
  method: 'POST',
  body: {
    name: 'Étudiant',
    description: 'Tarif réduit pour les étudiants',
    price: 1000, // 10€
    position: 3,
    isActive: true,
    quotaIds: [quotaPlacesId],
    returnableItemIds: [badgeId],
  },
})
```

### 2. Modifier les Quotas d'un Tarif HelloAsso

```typescript
// Seules les relations peuvent être modifiées
await $fetch(`/api/editions/${editionId}/ticketing/tiers/${tierId}`, {
  method: 'PUT',
  body: {
    name: tier.name, // Obligatoire mais ignoré
    price: tier.price, // Obligatoire mais ignoré
    quotaIds: [1, 2, 5], // Nouvelle liste de quotas
    returnableItemIds: tier.returnableItems.map((i) => i.id),
  },
})
```

### 3. Désactiver un Tarif Manuel

```typescript
await $fetch(`/api/editions/${editionId}/ticketing/tiers/${tierId}`, {
  method: 'PUT',
  body: {
    ...tier,
    isActive: false, // Le tarif n'apparaîtra plus dans "available"
  },
})
```

### 4. Afficher les Tarifs Disponibles (Public)

```typescript
const { tiers } = await $fetch(`/api/editions/${editionId}/ticketing/tiers/available`)

// Trie par position puis par prix
const sortedTiers = tiers.sort((a, b) => {
  if (a.position !== b.position) return a.position - b.position
  return b.price - a.price
})
```

---

## Bonnes Pratiques

### 1. Position des Tarifs

Utilisez `position` pour contrôler l'ordre d'affichage :

- Position 0 : Tarifs principaux (Adulte, Enfant)
- Position 1 : Tarifs secondaires (Étudiant, Senior)
- Position 2 : Tarifs spéciaux (Bénévole, Organisateur)

### 2. Tarifs Libres

Pour les tarifs à prix libre, définissez `minAmount` et/ou `maxAmount` :

```typescript
{
  name: "Don libre",
  price: 500, // Prix suggéré: 5€
  minAmount: 100, // Minimum: 1€
  maxAmount: 10000 // Maximum: 100€
}
```

### 3. Relations Quotas

Associez systématiquement les tarifs aux quotas pertinents :

- Quota "Places totales" → Tous les tarifs
- Quota "Repas végétarien" → Tarifs avec repas végétarien
- Quota "Pass 2 jours" → Tarifs multi-jours

### 4. Items à Restituer

N'associez des items que si nécessaire :

- Badge réutilisable → À restituer
- T-shirt offert → Pas à restituer
- Clé de casier → À restituer

### 5. Synchronisation HelloAsso

Après modification de la configuration HelloAsso, rechargez les tarifs pour synchroniser les changements.

---

## Dépannage

### Erreur : "Impossible de supprimer un tarif synchronisé depuis HelloAsso"

**Cause** : Tentative de suppression d'un tarif HelloAsso
**Solution** : Les tarifs HelloAsso ne peuvent pas être supprimés. Désactivez-les via HelloAsso ou désactivez la synchronisation.

### Erreur : "Tarif introuvable"

**Cause** : Le `tierId` est invalide ou le tarif n'appartient pas à cette édition
**Solution** : Vérifiez que le tarif existe et appartient bien à l'édition.

### Les quotas ne se décomptent pas

**Cause** : Les relations `TierQuota` ne sont pas créées
**Solution** : Associez les tarifs aux quotas via l'interface ou l'API.

---

## Voir Aussi

- [Quotas](./quotas.md) - Gestion des quotas
- [Items à Restituer](./returnable-items.md) - Gestion des items
- [Commandes](./orders.md) - Utilisation des tarifs dans les commandes
- [Intégration HelloAsso](./external-integration.md) - Synchronisation des tarifs
