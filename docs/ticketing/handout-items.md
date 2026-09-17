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

**Note** : la suppression retire aussi toutes les associations de l'article — tarifs, options,
champs personnalisés, spectacles, artistes, équipes de bénévoles, organisateurs et repas.

Huit de ces neuf tables partent en **cascade**, par leur clé étrangère. La neuvième,
`EditionOrganizerHandoutItem`, ne déclare que la colonne `handoutItemId` : sans relation ni
contrainte, ses lignes survivaient à la suppression en pointant vers un identifiant disparu, et
l'écran des organisateurs les affichait « Article inconnu ». C'est désormais **l'écriture** qui
les retire, dans la même transaction que la suppression.

Le `GET` de la liste renvoie, pour chaque article, le décompte de ce que sa suppression
détacherait (champ `associations`) : la confirmation l'énonce avant d'agir.

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

### API Routes des populations présentes (bénévoles, artistes, organisateurs)

Les trois populations suivent **le même contrat** : une lecture, et un remplacement complet par
portée. Le couple `POST` + `DELETE` par association a été retiré.

Deux raisons à ce choix, et la seconde n'est pas cosmétique.

1. **Une quantité posée ne se modifiait plus.** Il fallait supprimer l'association puis la
   recréer, la liste n'offrant qu'un bouton « Supprimer ».
2. **Une écriture qui lit puis crée portait une course.** L'index unique
   `(editionId, handoutItemId, teamId)` NE PROTÈGE PAS la portée globale : sous MySQL, deux
   `NULL` sont considérés comme distincts, et `(edition, article, NULL)` pouvait donc être inséré
   deux fois — ce qui aurait doublé la quantité remise à *tous* les bénévoles. Le `POST` s'en
   défendait par un `SELECT … FOR UPDATE`, ce qui refermait la fenêtre sans supprimer la lecture
   qui l'ouvrait. Un remplacement de portée n'a plus rien à vérifier : on efface, on réécrit.

#### Lire les associations

| Population    | Route                                                  |
| ------------- | ------------------------------------------------------ |
| Bénévoles     | `GET /api/editions/:id/ticketing/volunteers/handout-items` |
| Artistes      | `GET /api/editions/:id/ticketing/artists/handout-items`    |
| Organisateurs | `GET /api/editions/:id/ticketing/organizers/handout-items` |

**Permission** : `canManageTicketingById`

La réponse rend **toutes les portées** de l'édition : chaque entrée porte sa portée
(`teamId` / `organizerId`, `null` pour la portée globale) et sa `quantity`.

#### Remplacer une portée

| Population    | Route                                                  | Portée              |
| ------------- | ------------------------------------------------------ | ------------------- |
| Bénévoles     | `PUT /api/editions/:id/ticketing/volunteers/handout-items` | `teamId` ou `null`  |
| Artistes      | `PUT /api/editions/:id/ticketing/artists/handout-items`    | l'édition entière   |
| Organisateurs | `PUT /api/editions/:id/ticketing/organizers/handout-items` | `organizerId` ou `null` |

**Permission** : `canManageTicketingById`, puis `exigerArticlesARemettreActifs`.

**Body** :

```typescript
{
  teamId?: string | null       // bénévoles : null ou absent = tous les bénévoles
  organizerId?: number | null  // organisateurs : null ou absent = tous les organisateurs
  handoutItemIds: Array<number | { handoutItemId: number; quantity?: number }>
}
```

La forme « nombre nu » reste acceptée et vaut un exemplaire, comme pour les tarifs et les options.
Les doublons sont écartés et les quantités bornées par `normalizeHandoutItemSelections`.

**Ce que le remplacement touche, et ce qu'il ne touche pas** : seule la portée envoyée est
réécrite. Régler la portée globale ne vide aucune équipe, et régler une équipe ne touche pas le
global. C'est la faute que cette forme rend facile — un `deleteMany` qui oublierait `teamId`
viderait tout — et un test la refuse explicitement.

**Erreurs** :

- `400` : un article n'appartient pas à cette édition
- `403` : droits insuffisants, ou articles à remettre désactivés sur l'édition
- `404` : équipe ou organisateur introuvable dans cette édition

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

### 4. Régler les Items remis à tous les Bénévoles

Le `PUT` remplace la portée entière : la liste envoyée devient la liste des articles remis, avec
leurs quantités. Envoyer un tableau vide vide la portée.

```typescript
await $fetch(`/api/editions/${editionId}/ticketing/volunteers/handout-items`, {
  method: 'PUT',
  body: {
    teamId: null, // tous les bénévoles ; un identifiant d'équipe pour une équipe précise
    handoutItemIds: [{ handoutItemId: cleLocalId, quantity: 1 }],
  },
})
```

⚠️ Les articles associés à une **équipe** REMPLACENT les articles globaux pour ses bénévoles —
mais seulement si l'équipe en porte au moins un. Une équipe sans article retombe sur le global.

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
