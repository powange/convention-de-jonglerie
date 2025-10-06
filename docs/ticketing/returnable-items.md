# Gestion des Items à Restituer

Les items à restituer sont des objets prêtés aux participants qui doivent être rendus en fin d'événement (badges, t-shirts, clés, etc.).

## Modèle de Données

### Table `TicketingReturnableItem`

```prisma
model TicketingReturnableItem {
  id        Int      @id @default(autoincrement())
  editionId Int
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  edition                   Edition                          @relation(...)
  tiers                     TicketingTierReturnableItem[]             // Tarifs liés
  options                   TicketingOptionReturnableItem[]           // Options liées
  volunteerReturnableItems  EditionVolunteerReturnableItem[] // Bénévoles

  @@index([editionId])
}
```

### Propriétés

```typescript
interface ReturnableItemData {
  name: string // Nom de l'item (ex: "Badge réutilisable")
}
```

## Types d'Items

### 1. Items Généraux (Tarifs)

Items associés à des tarifs via `TicketingTierReturnableItem`.

**Exemple** : Tous les participants avec le tarif "Pass Weekend" reçoivent un badge.

### 2. Items Conditionnels (Options)

Items associés à des options via `TicketingOptionReturnableItem`.

**Exemple** : Les participants qui répondent "Oui" à "T-shirt souven ir" reçoivent un badge textile.

### 3. Items Bénévoles

Items spécifiques aux bénévoles via `EditionVolunteerReturnableItem`.

**Exemple** : Tous les bénévoles reçoivent une clé de local.

## API Routes

### Lister les Items

**Route** : `GET /api/editions/:id/ticketing/returnable-items`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
TicketingReturnableItem[]
```

---

### Créer un Item

**Route** : `POST /api/editions/:id/ticketing/returnable-items`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  name: string // Obligatoire
}
```

**Validation Zod** :

```typescript
const createItemSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
})
```

**Réponse** :

```typescript
TicketingReturnableItem
```

---

### Modifier un Item

**Route** : `PUT /api/editions/:id/ticketing/returnable-items/:itemId`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  name: string // Obligatoire
}
```

**Réponse** :

```typescript
TicketingReturnableItem
```

**Erreurs** :

- `404` : Item introuvable
- `403` : L'item n'appartient pas à cette édition

---

### Supprimer un Item

**Route** : `DELETE /api/editions/:id/ticketing/returnable-items/:itemId`

**Permission** : `canManageEditionVolunteers`

**Réponse** :

```typescript
{
  success: true
}
```

**Note** : La suppression supprime également les relations (cascade).

---

## Utilitaire Serveur

**Fichier** : `server/utils/editions/ticketing/returnable-items.ts`

### Fonctions Disponibles

#### `getReturnableItems(editionId: number)`

Récupère tous les items d'une édition.

```typescript
const items = await getReturnableItems(editionId)
// Retourne: TicketingReturnableItem[]
```

#### `createReturnableItem(editionId: number, data: ReturnableItemData)`

Crée un nouvel item.

```typescript
const item = await createReturnableItem(editionId, {
  name: 'Badge réutilisable',
})
```

#### `updateReturnableItem(itemId: number, editionId: number, data: ReturnableItemData)`

Met à jour un item existant.

**Validations** :

- L'item doit exister
- L'item doit appartenir à l'édition

```typescript
const item = await updateReturnableItem(itemId, editionId, {
  name: 'Badge réutilisable (modifié)',
})
```

#### `deleteReturnableItem(itemId: number, editionId: number)`

Supprime un item.

**Validations** :

- L'item doit exister
- L'item doit appartenir à l'édition

```typescript
await deleteReturnableItem(itemId, editionId)
// Retourne: { success: true }
```

---

## Items pour Bénévoles

### Table `EditionVolunteerReturnableItem`

```prisma
model EditionVolunteerReturnableItem {
  id               Int      @id @default(autoincrement())
  editionId        Int
  returnableItemId Int
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  edition        Edition        @relation(...)
  returnableItem TicketingReturnableItem @relation(...)

  @@unique([editionId, returnableItemId])
  @@index([editionId])
  @@index([returnableItemId])
}
```

### API Routes Bénévoles

#### Lister les Items Bénévoles

**Route** : `GET /api/editions/:id/ticketing/volunteers/returnable-items`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
Array<{
  id: number
  returnableItem: TicketingReturnableItem
}>
```

#### Ajouter un Item aux Bénévoles

**Route** : `POST /api/editions/:id/ticketing/volunteers/returnable-items`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  returnableItemId: number
}
```

**Réponse** :

```typescript
EditionVolunteerReturnableItem
```

#### Retirer un Item des Bénévoles

**Route** : `DELETE /api/editions/:id/ticketing/volunteers/returnable-items/:itemId`

**Permission** : `canManageEditionVolunteers`

**Réponse** :

```typescript
{
  success: true
}
```

---

## Composants Vue

### `ReturnableItemsList.vue`

**Localisation** : `app/components/ticketing/ReturnableItemsList.vue`

**Fonctionnalités** :

- Affiche la liste des items
- Boutons d'édition/suppression
- Modal de création/modification

**Props** :

```typescript
{
  editionId: number
}
```

### `TicketingVolunteerReturnableItemsList.vue`

**Localisation** : `app/components/ticketing/TicketingVolunteerReturnableItemsList.vue`

**Fonctionnalités** :

- Affiche les items à restituer pour les bénévoles
- Ajouter/retirer des items
- Sélection parmi les items existants

**Props** :

```typescript
{
  editionId: number
}
```

---

## Cas d'Usage

### 1. Créer un Item "Badge Réutilisable"

```typescript
const item = await $fetch(`/api/editions/${editionId}/ticketing/returnable-items`, {
  method: 'POST',
  body: { name: 'Badge réutilisable' },
})
```

### 2. Associer un Item à un Tarif

```typescript
// Via la modification du tarif
await $fetch(`/api/editions/${editionId}/ticketing/tiers/${tierId}`, {
  method: 'PUT',
  body: {
    ...tier,
    returnableItemIds: [badgeId, tshirtId],
  },
})
```

### 3. Associer un Item à une TicketingOption

```typescript
// Via la modification de l'option
await $fetch(`/api/editions/${editionId}/ticketing/options/${optionId}`, {
  method: 'PUT',
  body: {
    ...option,
    returnableItemIds: [badgeTextileId],
  },
})
```

### 4. Ajouter un Item pour tous les Bénévoles

```typescript
await $fetch(`/api/editions/${editionId}/ticketing/volunteers/returnable-items`, {
  method: 'POST',
  body: { returnableItemId: cleLocalId },
})
```

### 5. Renommer un Item

```typescript
await $fetch(`/api/editions/${editionId}/ticketing/returnable-items/${itemId}`, {
  method: 'PUT',
  body: { name: 'Badge réutilisable (nouveau nom)' },
})
```

---

## Flux de Gestion

### À l'Arrivée du Participant

1. **Scan du QR code** ou recherche manuelle
2. **Affichage des items à restituer** dans `ParticipantDetailsModal`
   - Items du tarif
   - Items des options sélectionnées
   - Items bénévole (si applicable)
3. **Remise des items** au participant

### Au Départ du Participant

1. **Scan du QR code** ou recherche manuelle
2. **Affichage des items à restituer**
3. **Vérification** que tous les items sont restitués
4. **Validation** du départ (optionnel)

### Implémentation Recommandée

```vue
<!-- ParticipantDetailsModal.vue -->
<template>
  <div v-if="returnableItems.length > 0">
    <h3>Items à restituer</h3>
    <ul>
      <li v-for="item in returnableItems" :key="item.id">
        <UCheckbox v-model="returnedItems[item.id]" :label="item.name" />
      </li>
    </ul>
  </div>
</template>

<script setup>
const returnableItems = computed(() => {
  const items = []

  // Items du tarif
  if (participant.tier?.returnableItems) {
    items.push(...participant.tier.returnableItems.map((r) => r.returnableItem))
  }

  // Items des options (à implémenter selon votre logique)

  // Items bénévole
  if (participant.isVolunteer) {
    items.push(...volunteerItems.value)
  }

  return items
})
</script>
```

---

## Bonnes Pratiques

### 1. Nommage Clair

Soyez explicite sur le type d'item :

- ✅ "Badge réutilisable avec clip"
- ❌ "Badge"

### 2. Items Réutilisables vs Consommables

Seuls les items réutilisables doivent être dans cette liste :

- ✅ Badge avec puce RFID (à restituer)
- ❌ Bracelet jetable (ne pas créer d'item)

### 3. Suivi des Items

Pour un suivi précis, implémentez un système de numérotation :

```typescript
{
  name: 'Badge réutilisable #001-100'
}
```

### 4. Items Bénévoles Séparés

Créez des items spécifiques pour les bénévoles :

- "Clé du local bénévoles"
- "Badge bénévole avec accès backstage"

### 5. Validation au Départ

Implementez une validation qui vérifie que tous les items sont restitués avant de valider le départ d'un participant.

---

## Dépannage

### Item n'apparaît pas dans la liste

**Cause** : L'item n'est pas associé au tarif/option du participant
**Solution** : Vérifiez les relations `TicketingTierReturnableItem` et `TicketingOptionReturnableItem`.

### Impossible de supprimer un item

**Cause** : L'item est utilisé dans des relations actives
**Solution** : La suppression en cascade devrait fonctionner. Vérifiez les contraintes de la base de données.

### Items en double dans l'affichage

**Cause** : Un participant a plusieurs tarifs/options qui référencent le même item
**Solution** : Utilisez `Set` ou `Array.from(new Map(...))` pour dédupliquer.

---

## Voir Aussi

- [Tarifs](./tiers.md) - Association tarifs ↔ items
- [Options](./options.md) - Association options ↔ items
- [Contrôle d'Accès](./access-control.md) - Remise et restitution des items
