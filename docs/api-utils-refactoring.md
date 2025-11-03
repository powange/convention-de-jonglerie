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
