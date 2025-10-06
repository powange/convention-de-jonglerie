# Gestion des Quotas

Les quotas permettent de limiter le nombre de participants par catégorie (places totales, repas végétariens, t-shirts, etc.).

## Modèle de Données

### Table `TicketingQuota`

```prisma
model TicketingQuota {
  id          Int      @id @default(autoincrement())
  editionId   Int
  title       String
  description String?  @db.Text
  quantity    Int      // Nombre total disponible
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  edition Edition       @relation(...)
  tiers   TicketingTierQuota[]   // Tarifs qui consomment ce quota
  options OptionQuota[] // Options qui consomment ce quota

  @@index([editionId])
}
```

### Propriétés

```typescript
interface QuotaData {
  title: string // Nom du quota (ex: "Places totales")
  description?: string // Description optionnelle
  quantity: number // Nombre disponible (toujours positif)
}
```

## API Routes

### Lister les Quotas

**Route** : `GET /api/editions/:id/ticketing/quotas`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
TicketingQuota[]
```

---

### Statistiques des Quotas

**Route** : `GET /api/editions/:id/ticketing/quotas/stats`

**Permission** : `canAccessEditionData`

**Réponse** :

```typescript
{
  stats: Array<{
    quota: TicketingQuota
    consumed: number // Nombre consommé
    remaining: number // Nombre restant
    percentage: number // % d'utilisation
  }>
}
```

**Logique de Calcul** :

Le calcul se fait en comptant les `TicketingOrderItem` qui ont :

1. Un tarif (`tierId`) lié au quota via `TicketingTierQuota`
2. OU une réponse à une option (`customFields`) liée au quota via `OptionQuota`

**Exemple** :

```typescript
// Quota "Repas végétariens" : 50
// - 30 personnes avec tarif "Adulte + repas végétarien"
// - 15 personnes qui ont répondu "Végétarien" à l'option "Régime"
// Consumed: 45, Remaining: 5, Percentage: 90%
```

---

### Créer un Quota

**Route** : `POST /api/editions/:id/ticketing/quotas`

**Permission** : `canManageEditionVolunteers`

**Body** :

```typescript
{
  title: string        // Obligatoire
  description?: string
  quantity: number     // >= 0, obligatoire
}
```

**Validation Zod** :

```typescript
const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  quantity: z.number().int().min(0),
})
```

**Réponse** :

```typescript
{
  success: true
  quota: TicketingQuota
}
```

---

### Modifier un Quota

**Route** : `PUT /api/editions/:id/ticketing/quotas/:quotaId`

**Permission** : `canManageEditionVolunteers`

**Body** : Identique à la création

**Réponse** :

```typescript
{
  success: true
  quota: TicketingQuota
}
```

---

### Supprimer un Quota

**Route** : `DELETE /api/editions/:id/ticketing/quotas/:quotaId`

**Permission** : `canManageEditionVolunteers`

**Réponse** :

```typescript
{
  success: true
}
```

**Note** : La suppression supprime également les relations `TicketingTierQuota` et `OptionQuota` (cascade).

---

## Utilitaire Serveur

**Fichier** : `server/utils/editions/ticketing/quota-stats.ts`

### Fonction `getQuotaStats(editionId: number)`

Calcule les statistiques de consommation pour tous les quotas d'une édition.

```typescript
const stats = await getQuotaStats(editionId)
// Retourne:
[
  {
    quota: { id: 1, title: "Places totales", quantity: 200, ... },
    consumed: 150,
    remaining: 50,
    percentage: 75
  },
  {
    quota: { id: 2, title: "Repas végétariens", quantity: 50, ... },
    consumed: 30,
    remaining: 20,
    percentage: 60
  }
]
```

**Algorithme** :

1. Récupère tous les quotas de l'édition
2. Pour chaque quota :
   - Compte les items via `TicketingTierQuota` (items avec un `tierId` lié)
   - Compte les items via `OptionQuota` (items avec réponse à option liée)
   - Somme les deux (en évitant les doublons si un item consomme le même quota 2 fois)
3. Calcule `remaining` et `percentage`

---

## Composants Vue

### `QuotasList.vue`

**Localisation** : `app/components/ticketing/QuotasList.vue`

**Fonctionnalités** :

- Affiche la liste des quotas
- Affiche la quantité totale
- Boutons d'édition/suppression

### `QuotaStatsCard.vue`

**Localisation** : `app/components/ticketing/stats/QuotaStatsCard.vue`

**Fonctionnalités** :

- Affiche les statistiques en temps réel
- Barre de progression visuelle
- Code couleur selon le % d'utilisation :
  - Vert : < 70%
  - Orange : 70-90%
  - Rouge : > 90%

**Props** :

```typescript
{
  editionId: number
}
```

**Exemple** :

```vue
<QuotaStatsCard :edition-id="editionId" />
```

---

## Cas d'Usage

### 1. Créer un Quota "Places Totales"

```typescript
const quota = await $fetch(`/api/editions/${editionId}/ticketing/quotas`, {
  method: 'POST',
  body: {
    title: 'Places totales',
    description: 'Nombre maximum de participants',
    quantity: 200,
  },
})
```

### 2. Créer un Quota "Repas Végétariens"

```typescript
const quota = await $fetch(`/api/editions/${editionId}/ticketing/quotas`, {
  method: 'POST',
  body: {
    title: 'Repas végétariens',
    description: 'Nombre de repas végétariens disponibles',
    quantity: 50,
  },
})
```

### 3. Augmenter un Quota

```typescript
// Récupérer le quota actuel
const quota = await $fetch(`/api/editions/${editionId}/ticketing/quotas`).then((quotas) =>
  quotas.find((q) => q.id === quotaId)
)

// Augmenter de 20
await $fetch(`/api/editions/${editionId}/ticketing/quotas/${quotaId}`, {
  method: 'PUT',
  body: {
    ...quota,
    quantity: quota.quantity + 20,
  },
})
```

### 4. Vérifier si un Quota est Dépassé

```typescript
const { stats } = await $fetch(`/api/editions/${editionId}/ticketing/quotas/stats`)

const quotasDepasses = stats.filter((s) => s.remaining < 0)
if (quotasDepasses.length > 0) {
  console.warn('Quotas dépassés:', quotasDepasses)
}
```

---

## Bonnes Pratiques

### 1. Quotas Généraux

Créez toujours un quota "Places totales" :

```typescript
{
  title: 'Places totales',
  quantity: 200
}
```

Associez-le à TOUS les tarifs.

### 2. Quotas Spécifiques

Créez des quotas pour chaque limitation :

- Repas végétariens
- T-shirts par taille
- Places atelier jonglage
- Chambres disponibles

### 3. Nommage Clair

Utilisez des titres explicites :

- ✅ "Repas végétariens"
- ❌ "Végé"

### 4. Description Utile

Ajoutez toujours une description :

```typescript
{
  title: "T-shirts taille M",
  description: "Nombre de t-shirts en taille M disponibles à la vente"
}
```

### 5. Surveillance Active

Utilisez `QuotaStatsCard` pour surveiller l'utilisation en temps réel et ajuster les quantités si nécessaire.

---

## Dépannage

### Les statistiques ne se mettent pas à jour

**Cause** : Les relations `TicketingTierQuota` ou `OptionQuota` ne sont pas créées
**Solution** : Associez les tarifs et options aux quotas correspondants.

### Quota négatif (plus de consommés que disponibles)

**Cause** : Augmentation du nombre de participants après définition du quota
**Solution** : C'est normal, cela indique un dépassement. Augmentez la `quantity` si nécessaire.

### Pourcentage incorrect

**Cause** : Doublons dans le calcul (un item compte pour 2 quotas identiques)
**Solution** : Le calcul utilise `DISTINCT` pour éviter les doublons, vérifiez la logique dans `quota-stats.ts`.

---

## Voir Aussi

- [Tarifs](./tiers.md) - Association tarifs ↔ quotas
- [Options](./options.md) - Association options ↔ quotas
- [Commandes](./orders.md) - Consommation des quotas
