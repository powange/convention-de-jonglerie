# Analyse du typage des retours de l'API

> **Note** : Les statistiques de ce document datent d'avant la Phase 2 de migration `createSuccessResponse`.
> Pour les chiffres à jour et la roadmap d'uniformisation, voir `docs/api-uniformisation-roadmap.md`.
>
> **État au 26/02/2026** : 175 endpoints utilisent `createSuccessResponse` (48%), 10 utilisent `createPaginatedResponse` (3%).

## Statistiques globales (avant Phase 2 — obsolètes)

- **Total d'endpoints analysés** : 303 fichiers
- **Endpoints avec typage explicite** : 0 (0%)
- **Endpoints avec helpers standardisés** : 27 (9%)
  - Utilisant `createPaginatedResponse` : 10 endpoints
  - Utilisant `createSuccessResponse` : 17 endpoints
- **Endpoints sans typage explicite** : 303 (100%)

## 🔍 Constat principal

**Aucun endpoint de l'API ne déclare explicitement son type de retour.**

Tous les endpoints suivent ce pattern :

```typescript
export default wrapApiHandler(
  async (event) => {
    // ... logique
    return { ... }  // ← Pas de ": Promise<Type>" explicite
  },
  { operationName: 'OperationName' }
)
```

Au lieu de :

```typescript
export default wrapApiHandler<ReturnType>(
  async (event): Promise<ReturnType> => {
    // ... logique
    return { ... }
  },
  { operationName: 'OperationName' }
)
```

## 📋 Exemples analysés

### 1. Endpoints retournant des objets simples

**Fichier** : `server/api/profile/stats.get.ts`

```typescript
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    // ... logique
    return {
      conventionsCreated,
      editionsFavorited: editionsFavorited?._count.favoriteEditions || 0,
      favoritesReceived: totalFavoritesReceived,
    }
  },
  { operationName: 'GetProfileStats' }
)
```

**Type inféré** : TypeScript infère le type basé sur l'objet retourné
**Problème** : Aucun contrat explicite, difficile pour les consommateurs de l'API

### 2. Endpoints utilisant `createPaginatedResponse`

**Fichier** : `server/api/editions/index.get.ts`

```typescript
export default wrapApiHandler(
  async (event) => {
    // ... logique de récupération
    return createPaginatedResponse(transformedEditions, totalCount, pageNumber, limitNumber)
  },
  { operationName: 'GetEditions' }
)
```

**Type inféré** : `ApiPaginatedResponse<unknown>` (car le type générique n'est pas spécifié)
**Avantage** : Utilise un helper qui garantit une structure cohérente
**Problème** : Le type des items (`transformedEditions`) n'est pas explicite

### 3. Endpoints utilisant `createSuccessResponse`

**Fichier** : `server/api/editions/[id]/posts/[postId]/pin.patch.ts`

```typescript
export default wrapApiHandler(
  async (event) => {
    // ... logique
    return createSuccessResponse(
      { post: updatedPost },
      pinned ? 'Publication épinglée avec succès' : 'Publication désépinglée avec succès'
    )
  },
  { operationName: 'PinEditionPost' }
)
```

**Type inféré** : `ApiSuccessResponse<{ post: unknown }>`
**Avantage** : Structure de réponse standardisée avec `success: true` et `message`
**Problème** : Le type de `post` n'est pas explicite

### 4. Endpoints retournant des entités Prisma

**Fichier** : `server/api/carpool-offers/[id]/index.put.ts`

```typescript
export default wrapApiHandler(
  async (event) => {
    // ... logique de mise à jour
    const updatedOffer = await prisma.carpoolOffer.update({
      where: { id: offerId },
      data: updateData,
      include: {
        user: {
          select: { id: true, pseudo: true, profilePicture: true },
        },
      },
    })

    return updatedOffer
  },
  { operationName: 'UpdateCarpoolOffer' }
)
```

**Type inféré** : Prisma infère automatiquement le type basé sur le `include` et `select`
**Avantage** : Les types Prisma sont très précis
**Problème** : Le type retourné n'est pas nommé ni exporté, impossible de le réutiliser côté frontend

### 5. Endpoints retournant des streams (SSE)

**Fichier** : `server/api/editions/[id]/ticketing/stats-sse.get.ts`

```typescript
export default wrapApiHandler(
  async (event) => {
    // ... configuration SSE
    return eventStream.send()
  },
  { operationName: 'GET ticketing stats-sse' }
)
```

**Type inféré** : Type spécifique de h3 pour les event streams
**Cas particulier** : Ce type d'endpoint ne peut pas facilement avoir de type explicite

### 6. Endpoints avec suppressions

**Fichier** : `server/api/admin/users/[id].delete.ts`

```typescript
export default wrapApiHandler(
  async (event) => {
    // ... logique de suppression
    return {
      success: true,
      message: `Compte ${deletedUser.pseudo} supprimé avec succès`,
      reason: deletionReason.title,
      deletedUser: {
        id: deletedUser.id,
        pseudo: deletedUser.pseudo,
      },
    }
  },
  { operationName: 'DeleteUser' }
)
```

**Type inféré** : Objet avec structure ad-hoc
**Problème** : Structure unique non standardisée, devrait utiliser `createSuccessResponse`

## 🏗️ Infrastructure existante

Le projet dispose déjà d'une excellente infrastructure de typage :

### Types API standardisés (`server/types/api.ts`)

```typescript
// Réponse de succès générique
export interface ApiSuccessResponse<T = unknown> {
  success: true
  message?: string
  data: T
}

// Réponse paginée
export interface ApiPaginatedResponse<T = unknown> {
  success: true
  data: T[]
  pagination: ApiPagination
}

// Union de tous les types de réponse
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse
```

### Wrapper d'API avec support générique (`server/utils/api-helpers.ts`)

```typescript
export function wrapApiHandler<T = any>(
  handler: (event: H3Event<EventHandlerRequest>) => Promise<T> | T,
  options: ApiHandlerOptions = {}
)
```

### Helpers de réponse standardisée

- `createSuccessResponse<T>(data: T, message?: string)` : 17 utilisations
- `createPaginatedResponse<T>(items: T[], total, page, limit)` : 10 utilisations

## 📊 Analyse des patterns actuels

### Pattern 1 : Retour direct d'objet (93%)

**Utilisé par** : 276 endpoints (~91%)

```typescript
return {
  id: user.id,
  email: user.email,
  // ...
}
```

**Avantages** :

- Simple et direct
- Types Prisma bien inférés

**Inconvénients** :

- Pas de standardisation
- Pas de contrat explicite
- Difficile à consommer côté frontend

### Pattern 2 : Helper `createSuccessResponse` (6%)

**Utilisé par** : 17 endpoints (~6%)

```typescript
return createSuccessResponse({ post: updatedPost }, 'Message de succès')
```

**Avantages** :

- Structure cohérente avec `success: true`
- Message de succès standardisé
- Type générique supporté

**Inconvénients** :

- Peu utilisé (seulement 6% des endpoints)
- Type générique rarement spécifié

### Pattern 3 : Helper `createPaginatedResponse` (3%)

**Utilisé par** : 10 endpoints (~3%)

```typescript
return createPaginatedResponse(items, total, page, limit)
```

**Avantages** :

- Structure de pagination cohérente
- Métadonnées complètes (totalPages, hasNextPage, etc.)
- Type générique supporté

**Inconvénients** :

- Type générique rarement spécifié
- Limité aux endpoints avec pagination

## 🎯 Recommandations

### Niveau 1 : Typage minimal (Quick wins)

**Effort** : Faible | **Impact** : Moyen

1. **Spécifier le type générique pour `wrapApiHandler`**

```typescript
// Avant
export default wrapApiHandler(async (event) => {
  return { id: 1, name: 'Test' }
})

// Après
type GetUserResponse = { id: number; name: string }

export default wrapApiHandler<GetUserResponse>(async (event) => {
  return { id: 1, name: 'Test' }
})
```

2. **Utiliser systématiquement les helpers de réponse**

```typescript
// Remplacer
return { success: true, message: 'OK', data: user }

// Par
return createSuccessResponse(user, 'OK')
```

### Niveau 2 : Typage intermédiaire (Recommandé)

**Effort** : Moyen | **Impact** : Élevé

1. **Créer des types de réponse dans `server/types/api-responses.ts`**

```typescript
// Nouveau fichier: server/types/api-responses.ts
import type { Edition, User, Convention } from '@prisma/client'

// Types pour les réponses d'éditions
export type EditionListItem = Pick<
  Edition,
  'id' | 'name' | 'description' | 'startDate' | 'endDate' | 'city' | 'country'
> & {
  creator: Pick<User, 'id' | 'pseudo'>
  convention: Pick<Convention, 'id' | 'name' | 'logo'>
}

export type GetEditionsResponse = ApiPaginatedResponse<EditionListItem>

// Types pour les réponses d'authentification
export type LoginResponse = {
  user: Pick<User, 'id' | 'email' | 'pseudo' | 'isGlobalAdmin'>
}

// Types pour les statistiques
export type ProfileStatsResponse = {
  conventionsCreated: number
  editionsFavorited: number
  favoritesReceived: number
}
```

2. **Utiliser ces types dans les endpoints**

```typescript
// server/api/editions/index.get.ts
import type { GetEditionsResponse } from '#server/types/api-responses'

export default wrapApiHandler<GetEditionsResponse>(
  async (event) => {
    // ... logique
    return createPaginatedResponse(transformedEditions, totalCount, pageNumber, limitNumber)
  },
  { operationName: 'GetEditions' }
)
```

3. **Créer un fichier d'index pour l'export des types**

```typescript
// server/types/index.ts
export * from './api'
export * from './api-responses'
export * from './prisma-helpers'
```

### Niveau 3 : Typage avancé (Optionnel)

**Effort** : Élevé | **Impact** : Très élevé

1. **Générer automatiquement les types à partir de Prisma**

```typescript
// server/types/prisma-generated.ts
import type { Prisma } from '@prisma/client'

// Helper pour créer des types de réponse Prisma
export type EditionWithCreator = Prisma.EditionGetPayload<{
  include: {
    creator: {
      select: {
        id: true
        pseudo: true
      }
    }
  }
}>
```

2. **Créer un SDK frontend typé**

```typescript
// frontend/utils/api-client.ts
import type { GetEditionsResponse, LoginResponse } from '~/server/types/api-responses'

export const api = {
  editions: {
    list: async (params?: EditionListParams): Promise<GetEditionsResponse> => {
      return await $fetch('/api/editions', { params })
    },
  },
  auth: {
    login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
      return await $fetch('/api/auth/login', { method: 'POST', body: credentials })
    },
  },
}
```

3. **Utiliser tRPC pour une sécurité type end-to-end** (Alternative complète)

Si le projet grandit, envisager de migrer vers tRPC pour une sécurité type complète entre frontend et backend.

## 📈 Plan de migration progressif

### Phase 1 : Standardisation (1-2 semaines)

1. ✅ Remplacer tous les retours directs de `{ success: true, ... }` par `createSuccessResponse`
2. ✅ Créer le fichier `server/types/api-responses.ts`
3. ✅ Documenter les 10-15 endpoints les plus utilisés avec leurs types

**Endpoints prioritaires** :

- `/api/auth/login.post.ts`
- `/api/editions/index.get.ts`
- `/api/editions/[id]/index.get.ts`
- `/api/profile/stats.get.ts`
- `/api/conventions/index.get.ts`

### Phase 2 : Typage systématique (2-4 semaines)

1. ✅ Ajouter les types de réponse pour tous les endpoints de l'API publique
2. ✅ Ajouter les types pour les endpoints d'authentification
3. ✅ Ajouter les types pour les endpoints d'administration

### Phase 3 : Automatisation (1 semaine)

1. ✅ Créer un script pour vérifier que tous les endpoints ont des types
2. ✅ Ajouter une règle ESLint personnalisée pour forcer le typage
3. ✅ Documenter le pattern dans `CLAUDE.md`

## 🔧 Script d'aide à la migration

Créer un script `scripts/check-api-types.ts` :

```typescript
import { glob } from 'glob'
import { readFile } from 'fs/promises'

async function checkApiTypes() {
  const apiFiles = await glob('server/api/**/*.ts')
  const untyped: string[] = []

  for (const file of apiFiles) {
    const content = await readFile(file, 'utf-8')

    // Vérifier si le fichier utilise wrapApiHandler sans type générique
    const hasWrapper = content.includes('wrapApiHandler')
    const hasGenericType = /wrapApiHandler<[^>]+>/.test(content)

    if (hasWrapper && !hasGenericType) {
      untyped.push(file)
    }
  }

  console.log(`📊 Endpoints sans type explicite : ${untyped.length}/${apiFiles.length}`)

  if (untyped.length > 0) {
    console.log('\n❌ Fichiers à typer :')
    untyped.forEach((file) => console.log(`  - ${file}`))
    process.exit(1)
  }

  console.log('✅ Tous les endpoints sont typés !')
}

checkApiTypes()
```

## 💡 Exemples de conversion

### Exemple 1 : Endpoint simple

**Avant** :

```typescript
// server/api/profile/stats.get.ts
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    // ...
    return {
      conventionsCreated,
      editionsFavorited: editionsFavorited?._count.favoriteEditions || 0,
      favoritesReceived: totalFavoritesReceived,
    }
  },
  { operationName: 'GetProfileStats' }
)
```

**Après** :

```typescript
// server/types/api-responses.ts
export type ProfileStatsResponse = {
  conventionsCreated: number
  editionsFavorited: number
  favoritesReceived: number
}

// server/api/profile/stats.get.ts
import type { ProfileStatsResponse } from '#server/types/api-responses'

export default wrapApiHandler<ProfileStatsResponse>(
  async (event): Promise<ProfileStatsResponse> => {
    const user = requireAuth(event)
    // ...
    return {
      conventionsCreated,
      editionsFavorited: editionsFavorited?._count.favoriteEditions || 0,
      favoritesReceived: totalFavoritesReceived,
    }
  },
  { operationName: 'GetProfileStats' }
)
```

### Exemple 2 : Endpoint avec helper

**Avant** :

```typescript
// server/api/editions/[id]/posts/[postId]/pin.patch.ts
export default wrapApiHandler(
  async (event) => {
    // ...
    return createSuccessResponse(
      { post: updatedPost },
      pinned ? 'Publication épinglée' : 'Publication désépinglée'
    )
  },
  { operationName: 'PinEditionPost' }
)
```

**Après** :

```typescript
// server/types/api-responses.ts
export type PinPostResponse = ApiSuccessResponse<{
  post: Pick<EditionPost, 'id' | 'title' | 'pinned' | 'createdAt'>
}>

// server/api/editions/[id]/posts/[postId]/pin.patch.ts
import type { PinPostResponse } from '#server/types/api-responses'

export default wrapApiHandler<PinPostResponse>(
  async (event): Promise<PinPostResponse> => {
    // ...
    return createSuccessResponse(
      { post: updatedPost },
      pinned ? 'Publication épinglée' : 'Publication désépinglée'
    )
  },
  { operationName: 'PinEditionPost' }
)
```

### Exemple 3 : Endpoint paginé

**Avant** :

```typescript
// server/api/editions/index.get.ts
export default wrapApiHandler(
  async (event) => {
    // ...
    return createPaginatedResponse(transformedEditions, totalCount, pageNumber, limitNumber)
  },
  { operationName: 'GetEditions' }
)
```

**Après** :

```typescript
// server/types/api-responses.ts
export type EditionListItem = Pick<
  Edition,
  'id' | 'name' | 'description' | 'startDate' | 'endDate' | 'city' | 'country' | 'imageUrl'
> & {
  creator: Pick<User, 'id' | 'pseudo'>
  convention: Pick<Convention, 'id' | 'name' | 'logo'>
}

export type GetEditionsResponse = ApiPaginatedResponse<EditionListItem>

// server/api/editions/index.get.ts
import type { GetEditionsResponse } from '#server/types/api-responses'

export default wrapApiHandler<GetEditionsResponse>(
  async (event): Promise<GetEditionsResponse> => {
    // ...
    return createPaginatedResponse<EditionListItem>(
      transformedEditions,
      totalCount,
      pageNumber,
      limitNumber
    )
  },
  { operationName: 'GetEditions' }
)
```

## 🎓 Bénéfices attendus

### Pour les développeurs backend

1. **Sécurité type** : Détection des erreurs à la compilation
2. **IntelliSense** : Autocomplétion dans l'éditeur
3. **Refactoring** : Modifications sûres avec détection automatique des impacts

### Pour les développeurs frontend

1. **Types disponibles** : Importation directe depuis `~/server/types`
2. **Documentation vivante** : Les types servent de documentation
3. **Moins d'erreurs runtime** : Validation TypeScript complète

### Pour le projet

1. **Maintenabilité** : Code plus facile à comprendre et à maintenir
2. **Onboarding** : Nouveaux développeurs comprennent plus vite l'API
3. **Qualité** : Moins de bugs liés aux mauvais types de données

## 📚 Ressources

- [TypeScript Handbook - Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [Nuxt 4 - Type Safety](https://nuxt.com/docs/4.x/getting-started/type-safety)
- [Prisma - Generated Types](https://www.prisma.io/docs/concepts/components/prisma-client/advanced-type-safety)
- [tRPC - End-to-end typesafety](https://trpc.io/)

## 📝 Conclusion

Le projet dispose d'une excellente infrastructure de typage (`wrapApiHandler<T>`, types API standardisés, helpers), mais **cette infrastructure n'est pas utilisée à son plein potentiel**.

**Recommandation principale** : Implémenter le **Niveau 2 (Typage intermédiaire)** de manière progressive sur 4-6 semaines, en commençant par les endpoints les plus critiques et les plus utilisés.

Cette approche offre le **meilleur rapport effort/bénéfice** et améliore significativement la maintenabilité du code sans nécessiter une refonte complète.
