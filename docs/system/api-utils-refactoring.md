# Refactoring API - Utilitaires Centralisés

## 📋 Vue d'ensemble

Ce document décrit les utilitaires créés pour éliminer la duplication de code dans les endpoints API et standardiser les patterns courants.

**Statut : ✅ Refactoring terminé**

**Résultats :**

- ~2700+ lignes de code économisées (~10% de réduction)
- 78 fichiers migrés avec succès
- 517 utilisations de `wrapApiHandler` dans le codebase

## 📁 Structure des utilitaires

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
import { USER_ADMIN_SELECT } from '#server/utils/prisma-selects'

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

## 📊 Exemple complet d'utilisation

Voici un exemple complet montrant l'utilisation de plusieurs utilitaires :

```typescript
import { wrapApiHandler } from '#server/utils/api-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { EDITION_DETAIL_SELECT } from '#server/utils/prisma-selects'

export default wrapApiHandler(
  async (event) => {
    // Validation de l'ID (remplace 4 lignes)
    const editionId = validateEditionId(event)

    // Fetch avec vérification 404 automatique (remplace 6 lignes)
    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      select: EDITION_DETAIL_SELECT, // Constante réutilisable
      errorMessage: 'Édition introuvable',
    })

    return edition
  },
  { operationName: 'GetEditionDetails' }
)
```

**Avant : ~35 lignes | Après : ~20 lignes (43% de réduction)**

---

## 📚 Références

- **Fichiers source** : `server/utils/`
- **Tests** : `test/unit/utils/`
- **Documentation Prisma** : https://www.prisma.io/docs
- **Documentation Zod** : https://zod.dev

---

**Dernière mise à jour** : Novembre 2025
