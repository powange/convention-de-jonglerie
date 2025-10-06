# Gestion des Options

Les options sont des champs supplémentaires lors de l'inscription permettant de collecter des informations personnalisées (régime alimentaire, allergies, taille de t-shirt, etc.).

## Caractéristiques

### Types d'Options

1. **Options HelloAsso** (synchronisées)
   - Importées automatiquement depuis HelloAsso
   - Champ `helloAssoOptionId` non null
   - Informations non modifiables (sauf relations)
   - Suppression impossible

2. **Options Manuelles**
   - Créées manuellement par l'organisateur
   - Champ `helloAssoOptionId` null
   - Entièrement modifiables
   - Supprimables

### Propriétés d'une TicketingOption

```typescript
interface OptionData {
  name: string // Nom de l'option (ex: "Régime alimentaire")
  description?: string | null // Description optionnelle
  type: string // Type de champ (voir types ci-dessous)
  isRequired: boolean // Champ obligatoire ou non
  choices?: string[] | null // Choix possibles (Select, Radio, etc.)
  position: number // Ordre d'affichage
  quotaIds?: number[] // Quotas associés
  returnableItemIds?: number[] // Items à restituer associés
}
```

### Types de Champs

HelloAsso supporte différents types de champs personnalisés :

| Type             | Description                | Exemple            |
| ---------------- | -------------------------- | ------------------ |
| `TextInput`      | Champ texte simple         | Nom, prénom        |
| `TextArea`       | Zone de texte multi-lignes | Commentaires       |
| `CheckBox`       | Case à cocher unique       | J'accepte les CGV  |
| `Select`         | Liste déroulante           | Régime alimentaire |
| `Radio`          | Boutons radio              | Taille de t-shirt  |
| `MultipleChoice` | Cases à cocher multiples   | Allergies          |
| `Date`           | Sélecteur de date          | Date de naissance  |
| `Number`         | Nombre                     | Âge                |

## Modèle de Données

### Table `TicketingOption`

```prisma
model TicketingOption {
  id                  Int      @id @default(autoincrement())
  externalTicketingId String?  // Null si option manuelle
  helloAssoOptionId   String?  // ID HelloAsso, null si manuel
  editionId           Int      // Lien vers l'édition
  name                String
  description         String?  @db.Text
  type                String   // TextInput, Select, CheckBox, etc.
  isRequired          Boolean  @default(false)
  choices             Json?    // Array de choix pour Select/Radio
  position            Int      @default(0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  externalTicketing ExternalTicketing?      @relation(...)
  edition           Edition                 @relation(...)
  quotas            TicketingOptionQuota[]           // Relations quotas
  returnableItems   TicketingOptionReturnableItem[]  // Relations items

  @@unique([externalTicketingId, helloAssoOptionId])
  @@index([externalTicketingId])
  @@index([editionId])
}
```

### Relations

#### TicketingOptionQuota

Associe une option (avec une valeur spécifique) à un quota.

```prisma
model TicketingOptionQuota {
  id       Int @id @default(autoincrement())
  optionId Int
  quotaId  Int

  option TicketingOption @relation(...)
  quota  TicketingQuota  @relation(...)

  @@unique([optionId, quotaId])
}
```

**Exemple** : L'option "Régime alimentaire = Végétarien" consomme le quota "Repas végétariens".

#### TicketingOptionReturnableItem

Associe une option (avec une valeur spécifique) à un item à restituer.

```prisma
model TicketingOptionReturnableItem {
  id               Int @id @default(autoincrement())
  optionId         Int
  returnableItemId Int

  option         TicketingOption @relation(...)
  returnableItem TicketingReturnableItem  @relation(...)

  @@unique([optionId, returnableItemId])
}
```

**Exemple** : L'option "T-shirt = Oui" nécessite de restituer un "Badge textile".

## API Routes

### Récupérer les Options

**Route** : `GET /api/editions/:id/ticketing/options`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
TicketingOption[] // Avec relations quotas et returnableItems
```

---

### Créer une TicketingOption Manuelle

**Route** : `POST /api/editions/:id/ticketing/options`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  name: string              // Obligatoire
  description?: string
  type: string             // Obligatoire (voir types)
  isRequired?: boolean     // Défaut: false
  choices?: string[]       // Requis pour Select/Radio/MultipleChoice
  position?: number        // Défaut: 0
  quotaIds?: number[]      // Défaut: []
  returnableItemIds?: number[] // Défaut: []
}
```

**Validation Zod** :

```typescript
const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.string().min(1),
  isRequired: z.boolean().default(false),
  choices: z.array(z.string()).nullable().optional(),
  position: z.number().int().min(0).default(0),
  quotaIds: z.array(z.number().int()).optional().default([]),
  returnableItemIds: z.array(z.number().int()).optional().default([]),
})
```

**Réponse** :

```typescript
{
  success: true
  option: TicketingOption
}
```

**Erreurs** :

- `400` : Aucune configuration de billeterie externe trouvée

---

### Modifier une TicketingOption

**Route** : `PUT /api/editions/:id/ticketing/options/:optionId`

**Permission** : `canManageEditionVolunteers`

**Body** : Identique à la création

**Comportement** :

- **TicketingOption HelloAsso** : Seules les relations (quotas, returnableItems) sont modifiables
- **TicketingOption manuelle** : Tous les champs sont modifiables

**Réponse** :

```typescript
{
  success: true
  option: TicketingOption
}
```

**Erreurs** :

- `404` : TicketingOption introuvable

---

### Supprimer une TicketingOption Manuelle

**Route** : `DELETE /api/editions/:id/ticketing/options/:optionId`

**Permission** : `canManageEditionVolunteers`

**Réponse** :

```typescript
{
  success: true
}
```

**Erreurs** :

- `404` : TicketingOption introuvable
- `400` : Impossible de supprimer une option HelloAsso

---

## Utilitaire Serveur

**Fichier** : `server/utils/editions/ticketing/options.ts`

### Fonctions Disponibles

#### `getEditionOptions(editionId: number)`

Récupère toutes les options d'une édition avec leurs relations.

```typescript
const options = await getEditionOptions(editionId)
// Retourne: TicketingOption[] avec quotas et returnableItems
```

#### `createOption(editionId: number, data: OptionData)`

Crée une nouvelle option manuelle.

**Prérequis** : Une configuration de billeterie externe doit exister.

```typescript
const option = await createOption(editionId, {
  name: 'Régime alimentaire',
  type: 'Select',
  isRequired: true,
  choices: ['Omnivore', 'Végétarien', 'Végan', 'Sans gluten'],
  position: 1,
  quotaIds: [quotaVegetarienId],
})
```

#### `updateOption(optionId: number, editionId: number, data: OptionData)`

Met à jour une option existante.

**Logique** :

1. Vérifie que l'option existe et appartient à l'édition
2. Détermine si c'est une option HelloAsso ou manuelle
3. Supprime les anciennes relations
4. Met à jour les champs (tous si manuel, seulement relations si HelloAsso)
5. Recrée les nouvelles relations

```typescript
const option = await updateOption(5, editionId, {
  name: 'Régime alimentaire (modifié)',
  type: 'Select',
  isRequired: false,
  choices: ['Omnivore', 'Végétarien', 'Végan'],
  quotaIds: [],
  returnableItemIds: [],
})
```

#### `deleteOption(optionId: number, editionId: number)`

Supprime une option manuelle.

**Validations** :

- L'option doit exister et appartenir à l'édition
- L'option ne doit pas être une option HelloAsso

```typescript
await deleteOption(5, editionId)
// Retourne: { success: true }
```

---

## Composants Vue

### `OptionsList.vue`

**Localisation** : `app/components/ticketing/OptionsList.vue`

**Fonctionnalités** :

- Affiche la liste des options
- Indique les options HelloAsso (badge)
- Affiche le type et si obligatoire
- Affiche les choix pour Select/Radio
- Affiche les quotas et items associés
- Boutons d'édition/suppression (si manuel)

**Props** :

```typescript
{
  editionId: number
}
```

### `OptionModal.vue`

**Localisation** : `app/components/ticketing/OptionModal.vue`

**Fonctionnalités** :

- Formulaire de création/modification
- Sélection du type de champ
- Édition des choix (pour Select/Radio/MultipleChoice)
- Sélection multiple de quotas
- Sélection multiple d'items à restituer
- Validation côté client
- Champs désactivés pour options HelloAsso (sauf relations)

**Props** :

```typescript
{
  editionId: number
  option?: TicketingOption | null
  quotas: TicketingQuota[]
  returnableItems: TicketingReturnableItem[]
}
```

---

## Utilitaires Client

**Fichier** : `app/utils/ticketing/options.ts`

### Fonctions Helper

```typescript
// Déterminer si une option est HelloAsso
export function isHelloAssoOption(option: TicketingOption): boolean {
  return option.helloAssoOptionId !== null
}

// Vérifier si une option a des choix
export function hasChoices(option: TicketingOption): boolean {
  const typesWithChoices = ['Select', 'Radio', 'MultipleChoice']
  return typesWithChoices.includes(option.type)
}

// Formater le type pour l'affichage
export function formatOptionType(type: string): string {
  const typeLabels: Record<string, string> = {
    TextInput: 'Texte',
    TextArea: 'Zone de texte',
    CheckBox: 'Case à cocher',
    Select: 'Liste déroulante',
    Radio: 'Choix unique',
    MultipleChoice: 'Choix multiples',
    Date: 'Date',
    Number: 'Nombre',
  }
  return typeLabels[type] || type
}
```

---

## Cas d'Usage

### 1. Créer une TicketingOption "Régime Alimentaire"

```typescript
const option = await $fetch(`/api/editions/${editionId}/ticketing/options`, {
  method: 'POST',
  body: {
    name: 'Régime alimentaire',
    description: 'Sélectionnez votre régime alimentaire pour les repas',
    type: 'Select',
    isRequired: true,
    choices: ['Omnivore', 'Végétarien', 'Végan', 'Sans gluten'],
    position: 1,
    quotaIds: [quotaVegetarienId, quotaVeganId],
  },
})
```

### 2. Créer une TicketingOption "Allergies" (Texte)

```typescript
const option = await $fetch(`/api/editions/${editionId}/ticketing/options`, {
  method: 'POST',
  body: {
    name: 'Allergies',
    description: 'Indiquez vos allergies alimentaires',
    type: 'TextArea',
    isRequired: false,
    position: 2,
  },
})
```

### 3. Créer une TicketingOption "Taille T-shirt"

```typescript
const option = await $fetch(`/api/editions/${editionId}/ticketing/options`, {
  method: 'POST',
  body: {
    name: 'Taille de t-shirt',
    type: 'Select',
    isRequired: true,
    choices: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    position: 3,
    returnableItemIds: [tshirtId], // Si le t-shirt doit être restitué
  },
})
```

### 4. Modifier les Choix d'une TicketingOption

```typescript
await $fetch(`/api/editions/${editionId}/ticketing/options/${optionId}`, {
  method: 'PUT',
  body: {
    ...option,
    choices: ['Omnivore', 'Végétarien', 'Végan', 'Sans gluten', 'Sans lactose'],
  },
})
```

### 5. Rendre une TicketingOption Obligatoire

```typescript
await $fetch(`/api/editions/${editionId}/ticketing/options/${optionId}`, {
  method: 'PUT',
  body: {
    ...option,
    isRequired: true,
  },
})
```

---

## Stockage des Réponses

Les réponses aux options sont stockées dans le champ `customFields` de `TicketingOrderItem` (format JSON).

### Structure HelloAsso

```json
{
  "customFields": [
    {
      "name": "Régime alimentaire",
      "answer": "Végétarien"
    },
    {
      "name": "Allergies",
      "answer": "Arachides, fruits à coque"
    },
    {
      "name": "Taille de t-shirt",
      "answer": "M"
    }
  ]
}
```

### Extraction des Réponses

```typescript
// Récupérer une réponse spécifique
function getCustomFieldAnswer(item: TicketingOrderItem, optionName: string): string | null {
  const customFields = item.customFields as Array<{ name: string; answer: string }>
  const field = customFields?.find((f) => f.name === optionName)
  return field?.answer ?? null
}

// Exemple
const regime = getCustomFieldAnswer(item, 'Régime alimentaire')
// Retourne: "Végétarien"
```

---

## Bonnes Pratiques

### 1. Position des Options

Organisez les options par importance :

- Position 0-5 : Informations essentielles (régime, allergies)
- Position 6-10 : Informations secondaires (t-shirt, préférences)
- Position 11+ : Informations optionnelles (commentaires)

### 2. Types de Champs

Choisissez le type approprié :

- **Select** : Choix parmi plusieurs options prédéfinies (4-10 choix)
- **Radio** : Choix unique parmi 2-5 options
- **CheckBox** : Acceptation simple (CGV, newsletter)
- **MultipleChoice** : Sélection multiple (allergies, activités)
- **TextArea** : Commentaires libres
- **TextInput** : Informations courtes (nom, prénom)

### 3. Choix Obligatoires

Rendez obligatoires uniquement les options critiques :

- Informations médicales (allergies)
- Informations logistiques (régime alimentaire pour les repas)
- Informations légales (acceptation CGV)

### 4. Relations Quotas

Associez les options aux quotas pertinents uniquement si la réponse consomme un quota :

- "Régime = Végétarien" → Quota "Repas végétariens"
- "T-shirt = Oui" → Quota "T-shirts disponibles"

### 5. Libellés Clairs

Utilisez des noms et descriptions explicites :

```typescript
{
  name: "Régime alimentaire",
  description: "Cette information nous permet de préparer vos repas",
  // Pas de: name: "Régime"
}
```

---

## Dépannage

### Erreur : "Aucune configuration de billeterie externe trouvée"

**Cause** : Tentative de création d'option sans configuration HelloAsso
**Solution** : Configurez d'abord la billeterie externe via `/ticketing/external`.

### Erreur : "Les options HelloAsso ne peuvent pas être supprimées"

**Cause** : Tentative de suppression d'une option HelloAsso
**Solution** : Les options HelloAsso ne peuvent pas être supprimées. Modifiez-les via HelloAsso ou désactivez la synchronisation.

### Les choix ne s'affichent pas

**Cause** : Le champ `choices` est null pour un type Select/Radio
**Solution** : Définissez toujours `choices` pour les types qui en nécessitent.

### Les quotas ne se décomptent pas

**Cause** : La logique de décompte doit être implémentée côté application
**Solution** : Implémentez un système qui lit les `customFields` et décrémente les quotas correspondants.

---

## Voir Aussi

- [Quotas](./quotas.md) - Gestion des quotas
- [Items à Restituer](./returnable-items.md) - Gestion des items
- [Commandes](./orders.md) - Stockage des réponses aux options
- [Intégration HelloAsso](./external-integration.md) - Synchronisation des options
