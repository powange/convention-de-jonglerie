# Gestion des Items à Remettre

Les items à remettre sont des objets prêtés aux participants qui doivent être rendus en fin d'événement (badges, t-shirts, clés, etc.).

## Modèle de Données

### Table `TicketingHandoutItem`

```prisma
model TicketingHandoutItem {
  id        Int      @id @default(autoincrement())
  editionId Int
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  edition                   Edition                          @relation(...)
  tiers                     TicketingTierHandoutItem[]             // Tarifs liés
  options                   TicketingOptionHandoutItem[]           // Options liées
  volunteerHandoutItems  EditionVolunteerHandoutItem[] // Bénévoles

  @@index([editionId])
}
```

### Propriétés

```typescript
interface HandoutItemData {
  name: string // Nom de l'item (ex: "Badge réutilisable")
}
```

## Types d'Items

### 1. Items Généraux (Tarifs)

Items associés à des tarifs via `TicketingTierHandoutItem`.

**Exemple** : Tous les participants avec le tarif "Pass Weekend" reçoivent un badge.

### 2. Items Conditionnels (Options)

Items associés à des options via `TicketingOptionHandoutItem`.

**Exemple** : Les participants qui répondent "Oui" à "T-shirt souven ir" reçoivent un badge textile.

### 3. Items Bénévoles

Items spécifiques aux bénévoles via `EditionVolunteerHandoutItem`.

**Exemple** : Tous les bénévoles reçoivent une clé de local.

## API Routes

### Lister les Items

**Route** : `GET /api/editions/:id/ticketing/handout-items`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
TicketingHandoutItem[]
```

---

### Créer un Item

**Route** : `POST /api/editions/:id/ticketing/handout-items`

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
TicketingHandoutItem
```

---

### Modifier un Item

**Route** : `PUT /api/editions/:id/ticketing/handout-items/:itemId`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  name: string // Obligatoire
}
```

**Réponse** :

```typescript
TicketingHandoutItem
```

**Erreurs** :

- `404` : Item introuvable
- `403` : L'item n'appartient pas à cette édition

---

### Supprimer un Item

**Route** : `DELETE /api/editions/:id/ticketing/handout-items/:itemId`

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

**Fichier** : `server/utils/editions/ticketing/handout-items.ts`

### Fonctions Disponibles

#### `getHandoutItems(editionId: number)`

Récupère tous les items d'une édition.

```typescript
const items = await getHandoutItems(editionId)
// Retourne: TicketingHandoutItem[]
```

#### `createHandoutItem(editionId: number, data: HandoutItemData)`

Crée un nouvel item.

```typescript
const item = await createHandoutItem(editionId, {
  name: 'Badge réutilisable',
})
```

#### `updateHandoutItem(itemId: number, editionId: number, data: HandoutItemData)`

Met à jour un item existant.

**Validations** :

- L'item doit exister
- L'item doit appartenir à l'édition

```typescript
const item = await updateHandoutItem(itemId, editionId, {
  name: 'Badge réutilisable (modifié)',
})
```

#### `deleteHandoutItem(itemId: number, editionId: number)`

Supprime un item.

**Validations** :

- L'item doit exister
- L'item doit appartenir à l'édition

```typescript
await deleteHandoutItem(itemId, editionId)
// Retourne: { success: true }
```

---

## Items pour Bénévoles

### Table `EditionVolunteerHandoutItem`

```prisma
model EditionVolunteerHandoutItem {
  id               Int      @id @default(autoincrement())
  editionId        Int
  handoutItemId Int
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  edition        Edition        @relation(...)
  handoutItem TicketingHandoutItem @relation(...)

  @@unique([editionId, handoutItemId])
  @@index([editionId])
  @@index([handoutItemId])
}
```

### API Routes Bénévoles

#### Lister les Items Bénévoles

**Route** : `GET /api/editions/:id/ticketing/volunteers/handout-items`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
Array<{
  id: number
  handoutItem: TicketingHandoutItem
}>
```

#### Ajouter un Item aux Bénévoles

**Route** : `POST /api/editions/:id/ticketing/volunteers/handout-items`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  handoutItemId: number
}
```

**Réponse** :

```typescript
EditionVolunteerHandoutItem
```

#### Retirer un Item des Bénévoles

**Route** : `DELETE /api/editions/:id/ticketing/volunteers/handout-items/:itemId`

**Permission** : `canManageEditionVolunteers`

**Réponse** :

```typescript
{
  success: true
}
```

---

## Composants Vue

### `HandoutItemsList.vue`

**Localisation** : `app/components/ticketing/HandoutItemsList.vue`

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

### `TicketingVolunteerHandoutItemsList.vue`

**Localisation** : `app/components/ticketing/TicketingVolunteerHandoutItemsList.vue`

**Fonctionnalités** :

- Affiche les items à remettre pour les bénévoles
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
const item = await $fetch(`/api/editions/${editionId}/ticketing/handout-items`, {
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
    handoutItemIds: [badgeId, tshirtId],
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
    handoutItemIds: [badgeTextileId],
  },
})
```

### 4. Ajouter un Item pour tous les Bénévoles

```typescript
await $fetch(`/api/editions/${editionId}/ticketing/volunteers/handout-items`, {
  method: 'POST',
  body: { handoutItemId: cleLocalId },
})
```

### 5. Renommer un Item

```typescript
await $fetch(`/api/editions/${editionId}/ticketing/handout-items/${itemId}`, {
  method: 'PUT',
  body: { name: 'Badge réutilisable (nouveau nom)' },
})
```

---

## Flux de Gestion

### À l'Arrivée du Participant

1. **Scan du QR code** ou recherche manuelle
2. **Affichage des items à remettre** dans `ParticipantDetailsModal`
   - Items du tarif
   - Items des options sélectionnées
   - Items bénévole (si applicable)
3. **Remise des items** au participant

### Au Départ du Participant

1. **Scan du QR code** ou recherche manuelle
2. **Affichage des items à remettre**
3. **Vérification** que tous les items sont remiss
4. **Validation** du départ (optionnel)

### Implémentation Recommandée

```vue
<!-- ParticipantDetailsModal.vue -->
<template>
  <div v-if="handoutItems.length > 0">
    <h3>Items à remettre</h3>
    <ul>
      <li v-for="item in handoutItems" :key="item.id">
        <UCheckbox v-model="returnedItems[item.id]" :label="item.name" />
      </li>
    </ul>
  </div>
</template>

<script setup>
const handoutItems = computed(() => {
  const items = []

  // Items du tarif
  if (participant.tier?.handoutItems) {
    items.push(...participant.tier.handoutItems.map((r) => r.handoutItem))
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

- ✅ Badge avec puce RFID (à remettre)
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

Implementez une validation qui vérifie que tous les items sont remiss avant de valider le départ d'un participant.

---

## Dépannage

### Item n'apparaît pas dans la liste

**Cause** : L'item n'est pas associé au tarif/option du participant
**Solution** : Vérifiez les relations `TicketingTierHandoutItem` et `TicketingOptionHandoutItem`.

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
- [Contrôle d'Accès](./access-control.md) - Remise et remise des items
