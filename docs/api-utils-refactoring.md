# Refactoring API - Utilitaires Centralisés

## 📋 Vue d'ensemble

Ce document décrit les nouveaux utilitaires créés pour éliminer la duplication de code dans les endpoints API et standardiser les patterns courants.

**Gain estimé : ~9000+ lignes de code dupliqué**

## 📁 Structure des nouveaux utilitaires

```
server/utils/
├── api-helpers.ts          # Wrappers API et gestion d'erreurs
├── validation-helpers.ts   # Validation d'IDs et unicité
├── file-helpers.ts         # Gestion des fichiers temporaires
├── prisma-helpers.ts       # Helpers Prisma (fetch, update, pagination)
└── prisma-selects.ts       # Constantes de select réutilisables
```

---

## 1️⃣ api-helpers.ts - Gestion d'erreurs et wrappers

### `wrapApiHandler()` - Wrapper standardisé pour endpoints

**Avant :**

```typescript
export default defineEventHandler(async (event) => {
  try {
    // logique métier
    return result
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, message: 'Données invalides', data: error.errors })
    }
    if ((error as any)?.statusCode) {
      throw error
    }
    console.error('Erreur...', error)
    throw createError({ statusCode: 500, message: 'Erreur serveur' })
  }
})
```

**Après :**

```typescript
export default wrapApiHandler(
  async (event) => {
    // logique métier pure, sans try-catch
    return result
  },
  { operationName: 'MyOperation' }
)
```

**Avantages :**

- Gestion automatique des erreurs HTTP, Zod et génériques
- Logs automatiques avec nom d'opération
- 15-20 lignes économisées par endpoint

---

### `handleValidationError()` - Erreurs Zod standardisées

```typescript
// Auto-géré par wrapApiHandler, mais utilisable manuellement
try {
  const data = schema.parse(body)
} catch (error) {
  if (error instanceof z.ZodError) {
    handleValidationError(error) // Lance createError 400 avec détails
  }
}
```

---

### `handlePrismaError()` - Erreurs Prisma standardisées

```typescript
try {
  await prisma.user.create({ data })
} catch (error) {
  handlePrismaError(error, 'Utilisateur')
  // Gère P2002 (unique), P2025 (not found), P2003 (foreign key)
}
```

---

### Helpers de réponse

```typescript
// Réponse de succès
return createSuccessResponse(data, 'Utilisateur créé')
// { success: true, message: '...', data: {...} }

// Réponse paginée
return createPaginatedResponse(items, total, page, limit)
// { success: true, data: [...], pagination: { page, limit, total, ... } }
```

---

## 2️⃣ validation-helpers.ts - Validation et sanitisation

### `validateResourceId()` - Validation d'ID générique

**Avant (répété ~150 fois) :**

```typescript
const offerId = parseInt(getRouterParam(event, 'id') as string)
if (isNaN(offerId)) {
  throw createError({ statusCode: 400, message: "ID d'offre invalide" })
}
```

**Après :**

```typescript
const offerId = validateResourceId(event, 'id', 'offre')
```

**Alias disponibles :**

```typescript
const conventionId = validateConventionId(event)
const editionId = validateEditionId(event)
const userId = validateUserId(event)
```

---

### `checkUniqueness()` - Vérification d'unicité générique

**Avant (répété ~3 fois avec 25 lignes chacune) :**

```typescript
if (email !== user.email) {
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser && existingUser.id !== user.id) {
    throw createError({ statusCode: 400, message: 'Email déjà utilisé' })
  }
}
```

**Après :**

```typescript
if (email !== user.email) {
  await checkEmailUniqueness(email, user.id)
}

// Ou pour d'autres champs :
await checkUniqueness(prisma.workshop, 'slug', slug, workshopId, 'Ce slug est déjà utilisé')
```

---

### `sanitizeString()` et `sanitizeEmail()`

```typescript
const cleanEmail = sanitizeEmail(data.email) // lowercase + trim
const cleanName = sanitizeString(data.name) // trim + null si vide
const cleanData = sanitizeObject(data) // trim tous les strings
```

---

### `validateDateRange()` - Validation de plages de dates

```typescript
validateDateRange(startDate, endDate, 'endDate')
// Lance une erreur si endDate < startDate
```

---

### `validatePagination()` - Extraction de paramètres de pagination

```typescript
const { page, limit, skip, take } = validatePagination(event)
// Extrait ?page=1&limit=10 avec validation (max 100, min 1)
```

---

## 3️⃣ file-helpers.ts - Gestion des fichiers

### `moveTemporaryFile()` - Déplacer un fichier temporaire

**Avant (répété dans 4 fichiers avec 100-150 lignes chacun) :**

```typescript
if (validatedData.logo && validatedData.logo.includes('/temp/')) {
  try {
    const tempFilename = validatedData.logo.split('/').pop()
    const tempPath = `temp/conventions/${conventionId}/${tempFilename}`
    const finalPath = `conventions/${conventionId}`

    const tempFilePath = getFileLocally(tempPath)
    const fileBuffer = await readFile(tempFilePath)
    const base64 = fileBuffer.toString('base64')
    const dataUrl = `data:image/png;base64,${base64}`

    const serverFile = {
      name: tempFilename,
      content: dataUrl,
      size: dataUrl.length.toString(),
      type: 'image/png',
      lastModified: Date.now().toString(),
    }

    const newFilename = await storeFileLocally(serverFile, 8, finalPath)
    await deleteFile(tempPath)
    finalLogoFilename = newFilename
  } catch (error) {
    console.error('Erreur...', error)
    finalLogoFilename = tempFilename || null
  }
}
```

**Après :**

```typescript
const result = await moveTemporaryFile(validatedData.logo, {
  resourceId: conventionId,
  resourceType: 'conventions',
})
finalLogoFilename = result.filename
```

**600 lignes économisées !**

---

### `deleteOldFile()` - Supprimer un ancien fichier

```typescript
await deleteOldFile(existingConvention.logo, conventionId, 'conventions')
```

---

### `handleFileUpload()` - Gestion complète (nouveau + suppression ancien)

```typescript
// Gère automatiquement :
// - Déplacement du nouveau fichier temporaire
// - Suppression de l'ancien fichier
// - Cas null (suppression)
const finalLogo = await handleFileUpload(validatedData.logo, existingConvention.logo, {
  resourceId: conventionId,
  resourceType: 'conventions',
})
```

---

## 4️⃣ prisma-helpers.ts - Helpers Prisma

### `fetchResourceOrFail()` - Fetch + vérification 404

**Avant (répété ~124 fois) :**

```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { ... }
})

if (!user) {
  throw createError({ statusCode: 404, message: 'Utilisateur introuvable' })
}
```

**Après :**

```typescript
const user = await fetchResourceOrFail(
  prisma.user,
  userId,
  {
    include: { ... },
    errorMessage: 'Utilisateur introuvable'
  }
)
```

---

### `buildUpdateData()` - Construction d'objet de mise à jour

**Avant (répété ~30 fois avec 30 lignes chacune) :**

```typescript
const updateData: any = {}
if (validatedData.tripDate) updateData.tripDate = new Date(validatedData.tripDate)
if (validatedData.locationCity) updateData.locationCity = validatedData.locationCity.trim()
if (validatedData.availableSeats !== undefined)
  updateData.availableSeats = validatedData.availableSeats
// ... 8 autres champs
```

**Après :**

```typescript
const updateData = buildUpdateData(validatedData, {
  trimStrings: true,
  transform: {
    tripDate: (val) => new Date(val),
  },
})
```

**~900 lignes économisées !**

---

### `fetchPaginated()` - Récupération paginée

```typescript
const result = await fetchPaginated(prisma.user, {
  page: 1,
  limit: 10,
  where: { isEmailVerified: true },
  orderBy: { createdAt: 'desc' },
})
// Retourne { items, total, page, limit, totalPages, hasNext, hasPrev }
```

---

### Helpers de vérification d'existence

```typescript
// Vérifier qu'une ressource existe (sans la récupérer)
await assertResourceExists(prisma.edition, editionId, 'Édition introuvable')

// Vérifier que plusieurs ressources existent
await assertResourcesExist(prisma.workshop, [1, 2, 3], 'Certains ateliers introuvables')
```

---

## 5️⃣ prisma-selects.ts - Constantes de select

**Avant (répété ~50 fois) :**

```typescript
select: {
  id: true,
  email: true,
  pseudo: true,
  nom: true,
  prenom: true,
  phone: true,
  isEmailVerified: true,
  isGlobalAdmin: true,
  createdAt: true,
  updatedAt: true,
  profilePicture: true,
  _count: {
    select: {
      createdConventions: true,
      createdEditions: true,
      favoriteEditions: true,
    },
  },
}
```

**Après :**

```typescript
import { USER_ADMIN_SELECT } from '@@/server/utils/prisma-selects'

select: USER_ADMIN_SELECT
```

### Constantes disponibles :

**User :**

- `USER_PUBLIC_SELECT` - Infos publiques (id, pseudo, profilePicture)
- `USER_PROFILE_SELECT` - Profil complet utilisateur
- `USER_ADMIN_SELECT` - Vue admin complète
- `USER_MINIMAL_SELECT` - Minimal (id, pseudo)
- `AUTHOR_SELECT` - Auteur d'une ressource

**Convention :**

- `CONVENTION_LIST_SELECT` - Liste publique
- `CONVENTION_DETAIL_SELECT` - Détails complets

**Edition :**

- `EDITION_CARD_SELECT` - Carte/liste
- `EDITION_DETAIL_SELECT` - Détails complets

**Workshop :**

- `WORKSHOP_LIST_SELECT` - Liste
- `WORKSHOP_DETAIL_SELECT` - Détails complets

**Carpool :**

- `CARPOOL_OFFER_SELECT` - Offre de covoiturage
- `CARPOOL_REQUEST_SELECT` - Demande de covoiturage

**Ticketing :**

- `TICKET_TIER_SELECT` - Tier de billetterie
- `TICKET_OPTION_SELECT` - Option de billetterie
- `TICKET_ORDER_SELECT` - Commande

**Autres :**

- `NOTIFICATION_SELECT` - Notification
- `VOLUNTEER_APPLICATION_SELECT` - Candidature bénévole

---

## 📊 Exemples complets de refactoring

### Exemple 1 : Update utilisateur admin

**Avant (134 lignes) :**

```typescript
export default defineEventHandler(async (event) => {
  await requireGlobalAdminWithDbCheck(event)

  const userId = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(userId)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  try {
    const body = await readBody(event)
    const validatedData = updateUserSchema.parse(body)

    const existingUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!existingUser) {
      throw createError({ statusCode: 404, message: 'Utilisateur introuvable' })
    }

    // Vérification unicité email (25 lignes)
    // Vérification unicité pseudo (25 lignes)

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { ... },
      select: { /* 20 lignes */ }
    })

    return updatedUser
  } catch (error) {
    // Gestion d'erreur (20 lignes)
  }
})
```

**Après (61 lignes, -55%) :**

```typescript
export default wrapApiHandler(async (event) => {
  await requireGlobalAdminWithDbCheck(event)

  const userId = validateUserId(event)
  const body = await readBody(event)
  const validatedData = updateUserSchema.parse(body)

  const existingUser = await fetchResourceOrFail(prisma.user, userId)

  if (validatedData.email !== existingUser.email) {
    await checkEmailUniqueness(validatedData.email, userId)
  }

  if (validatedData.pseudo !== existingUser.pseudo) {
    await checkPseudoUniqueness(validatedData.pseudo, userId)
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { ... },
    select: USER_ADMIN_SELECT
  })

  return updatedUser
}, { operationName: 'UpdateUser' })
```

---

### Exemple 2 : Update offre de covoiturage

**Avant (132 lignes) :**

```typescript
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const offerId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(offerId)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  try {
    const body = await readBody(event)
    const validatedData = updateCarpoolOfferSchema.parse(body)

    const existingOffer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
      include: { user: { select: { id: true, pseudo: true } } },
    })

    if (!existingOffer) {
      throw createError({ statusCode: 404, message: 'Offre introuvable' })
    }

    if (existingOffer.userId !== user.id) {
      throw createError({ statusCode: 403, message: 'Droits insuffisants' })
    }

    // Construction updateData (30 lignes de if)
    const updateData: any = {}
    if (validatedData.tripDate) updateData.tripDate = new Date(validatedData.tripDate)
    if (validatedData.locationCity) updateData.locationCity = validatedData.locationCity.trim()
    // ... 8 autres champs

    const updatedOffer = await prisma.carpoolOffer.update({
      where: { id: offerId },
      data: updateData,
      include: { user: { select: { id: true, pseudo: true, profilePicture: true } } },
    })

    return updatedOffer
  } catch (error) {
    // Gestion d'erreur (20 lignes)
  }
})
```

**Après (81 lignes, -39%) :**

```typescript
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const offerId = validateResourceId(event, 'id', 'offre')

    const body = await readBody(event)
    const validatedData = updateCarpoolOfferSchema.parse(body)

    const existingOffer = await fetchResourceOrFail(prisma.carpoolOffer, offerId, {
      include: { user: { select: { id: true, pseudo: true } } },
      errorMessage: 'Offre de covoiturage introuvable',
    })

    if (existingOffer.userId !== user.id) {
      throw createError({ statusCode: 403, message: 'Droits insuffisants' })
    }

    const updateData = buildUpdateData(validatedData, {
      trimStrings: true,
      transform: {
        tripDate: (val) => new Date(val),
      },
    })

    const updatedOffer = await prisma.carpoolOffer.update({
      where: { id: offerId },
      data: updateData,
      include: { user: { select: { id: true, pseudo: true, profilePicture: true } } },
    })

    return updatedOffer
  },
  { operationName: 'UpdateCarpoolOffer' }
)
```

---

## ✅ Checklist de migration d'un endpoint

Lors de la refactorisation d'un endpoint existant, suivre cette checklist :

### 1. Wrapper principal

- [ ] Remplacer `defineEventHandler` par `wrapApiHandler`
- [ ] Supprimer le bloc try-catch global
- [ ] Ajouter `operationName` dans les options

### 2. Validation d'ID

- [ ] Remplacer `parseInt + isNaN` par `validateResourceId()` ou alias

### 3. Fetch de ressource

- [ ] Remplacer `findUnique + if (!resource)` par `fetchResourceOrFail()`

### 4. Vérification d'unicité

- [ ] Remplacer les blocs de vérification par `checkEmailUniqueness()` ou `checkUniqueness()`

### 5. Construction de mise à jour

- [ ] Remplacer les blocs `if (field !== undefined)` par `buildUpdateData()`

### 6. Select Prisma

- [ ] Remplacer les objets select manuels par les constantes de `prisma-selects.ts`

### 7. Gestion de fichiers

- [ ] Remplacer les blocs de gestion de fichiers par `moveTemporaryFile()` ou `handleFileUpload()`

---

## 🎯 Prochaines étapes

### Migration progressive recommandée

1. **Phase 1 : Nouveaux endpoints**
   - Utiliser systématiquement les nouveaux utilitaires

2. **Phase 2 : Endpoints critiques**
   - Migrer les endpoints admin
   - Migrer les endpoints d'authentification

3. **Phase 3 : Endpoints métier**
   - Migrer les endpoints conventions/editions
   - Migrer les endpoints covoiturage

4. **Phase 4 : Endpoints restants**
   - Migrer workshops, shows, artists
   - Migrer ticketing, volunteers

### Outils de migration

Utiliser le script de recherche pour identifier les candidats :

```bash
# Trouver tous les endpoints avec parseInt + isNaN
grep -r "parseInt.*isNaN" server/api/

# Trouver tous les endpoints avec try-catch
grep -r "try {" server/api/ | wc -l

# Trouver tous les selects manuels User
grep -r "select: {" server/api/ | grep "email: true"
```

---

## 📈 Métriques de succès

**Objectifs :**

- ✅ Réduction de 30-50% des lignes de code par endpoint
- ✅ Standardisation de la gestion d'erreurs (100% des nouveaux endpoints)
- ✅ Élimination des duplications de select Prisma
- ✅ Tests passants sans régression

**Résultats actuels :**

- ✅ 5 nouveaux fichiers utilitaires créés
- ✅ 2 endpoints refactorisés avec succès (-55% et -39% de code)
- ✅ 273 tests unitaires passants
- ✅ Lint sans erreurs

---

## 📚 Références

- [Fichiers créés](#structure-des-nouveaux-utilitaires)
- [Analyse complète du code dupliqué](../docs/codebase_analysis.md)
- Exemples refactorisés :
  - `server/api/admin/users/[id].put.ts`
  - `server/api/carpool-offers/[id]/index.put.ts`

---

## 🎯 TODO List - Migration des endpoints restants

### 📊 Progrès global

| Catégorie         | Migrés | Restants | Total   | Progression |
| ----------------- | ------ | -------- | ------- | ----------- |
| **User**          | 4      | 0        | 4       | ✅ 100%     |
| **Conventions**   | 27     | 0        | 27      | ✅ 100%     |
| **Carpool**       | 10     | 0        | 10      | ✅ 100%     |
| **Auth**          | 8      | 0        | 8       | ✅ 100%     |
| **Admin**         | 32     | 0        | 32      | ✅ 100%     |
| **Notifications** | 10     | 0        | 10      | ✅ 100%     |
| **Feedback**      | 1      | 0        | 1       | ✅ 100%     |
| **Racine**        | 2      | 0        | 2       | ✅ 100%     |
| **Editions**      | 0      | 149      | 149     | 🔴 0%       |
| **TOTAL**         | **94** | **149**  | **243** | 🟡 **39%**  |

---

### Phase 5A : Notifications (10 endpoints) ✅ COMPLÉTÉ

**Priorité : HAUTE** - Système critique pour l'expérience utilisateur

- [x] `server/api/notifications/index.get.ts` - Liste des notifications utilisateur
- [x] `server/api/notifications/[id]/read.patch.ts` - Marquer comme lue
- [x] `server/api/notifications/[id]/unread.patch.ts` - Marquer comme non lue
- [x] `server/api/notifications/[id]/delete.delete.ts` - Supprimer une notification
- [x] `server/api/notifications/mark-all-read.patch.ts` - Tout marquer comme lu
- [x] `server/api/notifications/stats.get.ts` - Statistiques des notifications
- [x] `server/api/notifications/stream.get.ts` - Stream SSE des notifications
- [x] `server/api/notifications/push/subscribe.post.ts` - Abonnement aux push
- [x] `server/api/notifications/push/unsubscribe.post.ts` - Désabonnement push
- [x] `server/api/notifications/push/check.post.ts` - Vérification de l'abonnement

---

### Phase 5B : Feedback & Racine (3 endpoints) ✅ COMPLÉTÉ

**Priorité : MOYENNE** - Endpoints simples et isolés

#### Feedback (1)

- [x] `server/api/feedback/index.post.ts` - Soumettre un feedback (183→170 lignes)

#### Racine (2)

- [x] `server/api/countries.get.ts` - Liste des pays (34→30 lignes)
- [x] `server/api/site.webmanifest.get.ts` - Manifest PWA (53→58 lignes)

---

### Phase 5C : Editions - Racine (3 endpoints)

**Priorité : HAUTE** - CRUD principal des éditions

- [ ] `server/api/editions/favorites.get.ts` - Liste des favoris utilisateur
- [ ] `server/api/editions/index.post.ts` - Créer une édition
- [ ] `server/api/editions/[id]/index.put.ts` - Modifier une édition
- [ ] `server/api/editions/[id]/index.delete.ts` - Supprimer une édition

---

### Phase 5D : Editions - Artists (6 endpoints)

- [ ] `server/api/editions/[id]/artists/index.get.ts`
- [ ] `server/api/editions/[id]/artists/index.post.ts`
- [ ] `server/api/editions/[id]/artists/[artistId]/index.get.ts`
- [ ] `server/api/editions/[id]/artists/[artistId]/index.put.ts`
- [ ] `server/api/editions/[id]/artists/[artistId]/index.delete.ts`
- [ ] `server/api/editions/[id]/artists/[artistId]/image.put.ts`

---

### Phase 5E : Editions - Carpool (4 endpoints)

- [ ] `server/api/editions/[id]/carpool-offers/index.get.ts`
- [ ] `server/api/editions/[id]/carpool-offers/index.post.ts`
- [ ] `server/api/editions/[id]/carpool-requests/index.get.ts`
- [ ] `server/api/editions/[id]/carpool-requests/index.post.ts`

---

### Phase 5F : Editions - Lost & Found (4 endpoints)

- [ ] `server/api/editions/[id]/lost-found/index.get.ts`
- [ ] `server/api/editions/[id]/lost-found/index.post.ts`
- [ ] `server/api/editions/[id]/lost-found/[itemId]/index.put.ts`
- [ ] `server/api/editions/[id]/lost-found/[itemId]/index.delete.ts`

---

### Phase 5G : Editions - Meals (7 endpoints)

**Attention : Système complexe de validation de repas**

- [ ] `server/api/editions/[id]/meals/index.get.ts`
- [ ] `server/api/editions/[id]/meals/participants.get.ts`
- [ ] `server/api/editions/[id]/meals/[mealId]/search.get.ts`
- [ ] `server/api/editions/[id]/meals/[mealId]/stats.get.ts`
- [ ] `server/api/editions/[id]/meals/[mealId]/pending.get.ts`
- [ ] `server/api/editions/[id]/meals/[mealId]/validate.post.ts`
- [ ] `server/api/editions/[id]/meals/[mealId]/cancel.post.ts`

---

### Phase 5H : Editions - Posts & Comments (10 endpoints)

- [ ] `server/api/editions/[id]/posts/index.get.ts`
- [ ] `server/api/editions/[id]/posts/index.post.ts`
- [ ] `server/api/editions/[id]/posts/[postId]/index.get.ts`
- [ ] `server/api/editions/[id]/posts/[postId]/index.put.ts`
- [ ] `server/api/editions/[id]/posts/[postId]/index.delete.ts`
- [ ] `server/api/editions/[id]/posts/[postId]/comments/index.get.ts`
- [ ] `server/api/editions/[id]/posts/[postId]/comments/index.post.ts`
- [ ] `server/api/editions/[id]/posts/[postId]/comments/[commentId]/index.get.ts`
- [ ] `server/api/editions/[id]/posts/[postId]/comments/[commentId]/index.put.ts`
- [ ] `server/api/editions/[id]/posts/[postId]/comments/[commentId]/index.delete.ts`

---

### Phase 5I : Editions - Shows (1 endpoint)

- [ ] `server/api/editions/[id]/shows/index.get.ts`

---

### Phase 5J : Editions - Workshops (7 endpoints)

- [ ] `server/api/editions/[id]/workshops/index.get.ts`
- [ ] `server/api/editions/[id]/workshops/index.post.ts`
- [ ] `server/api/editions/[id]/workshops/locations/index.get.ts`
- [ ] `server/api/editions/[id]/workshops/[workshopId]/index.get.ts`
- [ ] `server/api/editions/[id]/workshops/[workshopId]/index.put.ts`
- [ ] `server/api/editions/[id]/workshops/[workshopId]/index.delete.ts`
- [ ] `server/api/editions/[id]/workshops/[workshopId]/register.post.ts`

---

### Phase 5K : Editions - Ticketing (40+ endpoints)

**Attention : Système le plus complexe, à traiter en dernier**

#### Tiers (6 endpoints)

- [ ] `server/api/editions/[id]/ticketing/tiers/index.get.ts`
- [ ] `server/api/editions/[id]/ticketing/tiers/index.post.ts`
- [ ] `server/api/editions/[id]/ticketing/tiers/[tierId].get.ts`
- [ ] `server/api/editions/[id]/ticketing/tiers/[tierId].put.ts`
- [ ] `server/api/editions/[id]/ticketing/tiers/[tierId].delete.ts`
- [ ] `server/api/editions/[id]/ticketing/tiers/reorder.post.ts`

#### Options (6 endpoints)

- [ ] `server/api/editions/[id]/ticketing/options/index.get.ts`
- [ ] `server/api/editions/[id]/ticketing/options/index.post.ts`
- [ ] `server/api/editions/[id]/ticketing/options/[optionId].get.ts`
- [ ] `server/api/editions/[id]/ticketing/options/[optionId].put.ts`
- [ ] `server/api/editions/[id]/ticketing/options/[optionId].delete.ts`
- [ ] `server/api/editions/[id]/ticketing/options/reorder.post.ts`

#### Custom Fields (5 endpoints)

- [ ] `server/api/editions/[id]/ticketing/custom-fields/index.get.ts`
- [ ] `server/api/editions/[id]/ticketing/custom-fields/index.post.ts`
- [ ] `server/api/editions/[id]/ticketing/custom-fields/[customFieldId].put.ts`
- [ ] `server/api/editions/[id]/ticketing/custom-fields/[customFieldId].delete.ts`
- [ ] `server/api/editions/[id]/ticketing/custom-fields/reorder.post.ts`

#### Returnable Items (8 endpoints)

- [ ] `server/api/editions/[id]/ticketing/returnable-items/index.get.ts`
- [ ] `server/api/editions/[id]/ticketing/returnable-items/index.post.ts`
- [ ] `server/api/editions/[id]/ticketing/returnable-items/[itemId].put.ts`
- [ ] `server/api/editions/[id]/ticketing/returnable-items/[itemId].delete.ts`
- [ ] `server/api/editions/[id]/ticketing/returnable-items/[itemId]/assign.post.ts`
- [ ] `server/api/editions/[id]/ticketing/returnable-items/[itemId]/return.post.ts`
- [ ] `server/api/editions/[id]/ticketing/returnable-items/[itemId]/force-return.post.ts`
- [ ] `server/api/editions/[id]/ticketing/returnable-items/assignments.get.ts`

#### Quotas (3 endpoints)

- [ ] `server/api/editions/[id]/ticketing/quotas/index.get.ts`
- [ ] `server/api/editions/[id]/ticketing/quotas/index.post.ts`
- [ ] `server/api/editions/[id]/ticketing/quotas/[quotaId].delete.ts`

#### Orders (5 endpoints)

- [ ] `server/api/editions/[id]/ticketing/orders/index.get.ts`
- [ ] `server/api/editions/[id]/ticketing/orders/[orderId].get.ts`
- [ ] `server/api/editions/[id]/ticketing/orders/[orderId]/cancel.post.ts`
- [ ] `server/api/editions/[id]/ticketing/orders/[orderId]/refund.post.ts`
- [ ] `server/api/editions/[id]/ticketing/orders/stats.get.ts`

#### External & HelloAsso (5 endpoints)

- [ ] `server/api/editions/[id]/ticketing/external/index.get.ts`
- [ ] `server/api/editions/[id]/ticketing/external/sync.post.ts`
- [ ] `server/api/editions/[id]/ticketing/helloasso/config.get.ts`
- [ ] `server/api/editions/[id]/ticketing/helloasso/config.put.ts`
- [ ] `server/api/editions/[id]/ticketing/helloasso/sync.post.ts`

#### Volunteers Ticketing (6 endpoints)

- [ ] `server/api/editions/[id]/ticketing/volunteers/index.get.ts`
- [ ] `server/api/editions/[id]/ticketing/volunteers/[volunteerId].get.ts`
- [ ] `server/api/editions/[id]/ticketing/volunteers/returnable-items/assign.post.ts`
- [ ] `server/api/editions/[id]/ticketing/volunteers/returnable-items/return.post.ts`
- [ ] `server/api/editions/[id]/ticketing/volunteers/returnable-items/force-return.post.ts`
- [ ] `server/api/editions/[id]/ticketing/volunteers/returnable-items/assignments.get.ts`

---

### Phase 5L : Editions - Volunteers (29 endpoints)

**Attention : Système complexe de gestion des bénévoles**

#### Applications (8 endpoints)

- [ ] `server/api/editions/[id]/volunteers/applications/index.get.ts`
- [ ] `server/api/editions/[id]/volunteers/applications/index.post.ts`
- [ ] `server/api/editions/[id]/volunteers/applications/[applicationId]/index.get.ts`
- [ ] `server/api/editions/[id]/volunteers/applications/[applicationId]/index.put.ts`
- [ ] `server/api/editions/[id]/volunteers/applications/[applicationId]/accept.post.ts`
- [ ] `server/api/editions/[id]/volunteers/applications/[applicationId]/reject.post.ts`
- [ ] `server/api/editions/[id]/volunteers/applications/[applicationId]/teams/index.post.ts`
- [ ] `server/api/editions/[id]/volunteers/applications/[applicationId]/teams/[teamId].delete.ts`

#### Teams (6 endpoints)

- [ ] `server/api/editions/[id]/volunteers/teams/index.get.ts`
- [ ] `server/api/editions/[id]/volunteers/teams/index.post.ts`
- [ ] `server/api/editions/[id]/volunteers/teams/[teamId].get.ts`
- [ ] `server/api/editions/[id]/volunteers/teams/[teamId].put.ts`
- [ ] `server/api/editions/[id]/volunteers/teams/[teamId].delete.ts`
- [ ] `server/api/editions/[id]/volunteers/teams/[teamId]/members.post.ts`

#### Access Control (3 endpoints)

- [ ] `server/api/editions/[id]/volunteers/access-control/index.get.ts`
- [ ] `server/api/editions/[id]/volunteers/access-control/check.post.ts`
- [ ] `server/api/editions/[id]/volunteers/access-control/grant.post.ts`

#### Catering (1 endpoint)

- [ ] `server/api/editions/[id]/volunteers/catering/index.get.ts`

#### Notifications (3 endpoints)

- [ ] `server/api/editions/[id]/volunteers/notification/index.get.ts`
- [ ] `server/api/editions/[id]/volunteers/notification/index.post.ts`
- [ ] `server/api/editions/[id]/volunteers/notification/[groupId].delete.ts`

#### Gestion (4 endpoints)

- [ ] `server/api/editions/[id]/volunteers/index.get.ts`
- [ ] `server/api/editions/[id]/volunteers/[volunteerId]/index.get.ts`
- [ ] `server/api/editions/[id]/volunteers/[volunteerId]/index.put.ts`
- [ ] `server/api/editions/[id]/volunteers/[volunteerId]/index.delete.ts`

#### Time Slots (4 endpoints)

- [ ] `server/api/editions/[id]/volunteer-time-slots/index.get.ts`
- [ ] `server/api/editions/[id]/volunteer-time-slots/index.post.ts`
- [ ] `server/api/editions/[id]/volunteer-time-slots/[slotId].delete.ts`
- [ ] `server/api/editions/[id]/volunteer-time-slots/[slotId]/assignments/index.post.ts`

#### Teams (Legacy - 4 endpoints)

- [ ] `server/api/editions/[id]/volunteer-teams/index.get.ts`
- [ ] `server/api/editions/[id]/volunteer-teams/index.post.ts`
- [ ] `server/api/editions/[id]/volunteer-teams/[teamId].put.ts`
- [ ] `server/api/editions/[id]/volunteer-teams/[teamId].delete.ts`

---

### Phase 5M : Editions - Permissions & Autres (3 endpoints)

- [ ] `server/api/editions/[id]/permissions/can-access-meal-validation.get.ts`
- [ ] `server/api/editions/[id]/attendance.post.ts`

---

## 🎯 Stratégie de migration recommandée

### Ordre suggéré

1. **Phase 5A** - Notifications (10) - Système critique, isolé
2. **Phase 5B** - Feedback & Racine (3) - Simples et rapides
3. **Phase 5C** - Editions racine (4) - CRUD principal
4. **Phase 5D** - Artists (6) - CRUD simple
5. **Phase 5E** - Carpool (4) - Déjà familier
6. **Phase 5F** - Lost & Found (4) - CRUD simple
7. **Phase 5I** - Shows (1) - Lecture seule
8. **Phase 5J** - Workshops (7) - CRUD modéré
9. **Phase 5H** - Posts & Comments (10) - CRUD imbriqué
10. **Phase 5G** - Meals (7) - Logique métier complexe
11. **Phase 5M** - Permissions & Autres (3) - Divers
12. **Phase 5L** - Volunteers (29) - Système complexe
13. **Phase 5K** - Ticketing (40+) - **LE PLUS COMPLEXE** - À faire en dernier

### Critères de priorisation

- ✅ **Isolement** : Moins de dépendances = migration plus facile
- ✅ **Simplicité** : CRUD simple avant logique métier complexe
- ✅ **Volume** : Petits groupes avant gros groupes
- ✅ **Criticité** : Fonctionnalités critiques en priorité

---

## 📝 Notes de migration

### Patterns récurrents identifiés

1. **Validation d'ID édition** : `validateEditionId(event)` sera massivement utilisé
2. **Permissions édition** : Beaucoup d'endpoints nécessitent `canManageEdition()` ou `canManageConvention()`
3. **Validation de ressources imbriquées** : Ex. workshop appartient à édition
4. **Pagination** : Beaucoup de listes (posts, comments, applications, orders)

### Helpers spécifiques à créer (si nécessaire)

- `validateWorkshopId()` - Validateur spécifique pour workshops
- `validatePostId()` / `validateCommentId()` - Pour les posts/comments
- `fetchEditionOrFail()` - Fetch édition avec vérification 404 (très utilisé)
- `requireEditionManagementAccess()` - Vérifier droits gestion édition

---

## ✅ Checklist de validation après chaque phase

- [ ] Tous les tests passent (unit + Nuxt)
- [ ] Lint sans erreurs
- [ ] Pas de régression fonctionnelle
- [ ] Commit avec message descriptif
- [ ] Mise à jour de cette TODO list (cocher les cases)
