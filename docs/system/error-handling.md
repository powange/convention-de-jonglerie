# Système de gestion des erreurs

## Vue d'ensemble

L'application utilise un système de gestion d'erreurs standardisé avec des classes d'erreur typées qui facilitent la création d'erreurs HTTP cohérentes à travers toute l'API.

## Architecture

### Classes d'erreur disponibles

Toutes les classes d'erreur sont disponibles dans `server/utils/errors.ts` et réexportées par `server/utils/api-helpers.ts` pour faciliter l'usage.

#### `ApiError` (classe de base)

Classe de base pour toutes les erreurs API. Toutes les autres classes d'erreur héritent de celle-ci.

```typescript
class ApiError extends Error {
  statusCode: number
  operationName?: string
}
```

#### `BadRequestError` (400)

Utilisée pour les erreurs de validation ou de paramètres invalides.

```typescript
throw new BadRequestError('Format d\'email invalide')
```

#### `UnauthorizedError` (401)

Utilisée quand l'authentification est requise mais absente ou invalide.

```typescript
throw new UnauthorizedError('Authentification requise')
// ou avec message personnalisé
throw new UnauthorizedError('Token expiré')
```

#### `ForbiddenError` (403)

Utilisée quand l'utilisateur est authentifié mais n'a pas les permissions nécessaires.

```typescript
throw new ForbiddenError() // "Action non autorisée"
// ou avec message personnalisé
throw new ForbiddenError('Vous n\'avez pas les droits pour supprimer cette convention')
```

#### `NotFoundError` (404)

Utilisée quand une ressource demandée n'existe pas.

```typescript
throw new NotFoundError('Convention') // "Convention non trouvé(e)"
throw new NotFoundError('Édition') // "Édition non trouvé(e)"
```

#### `ConflictError` (409)

Utilisée pour les conflits de données (ex: contrainte unique violée).

```typescript
throw new ConflictError('Cet email est déjà utilisé')
throw new ConflictError('Un organisateur avec cet email existe déjà')
```

#### `ValidationError` (422)

Utilisée pour les erreurs de validation métier avec possibilité de fournir des erreurs détaillées par champ.

```typescript
throw new ValidationError('Données invalides', {
  email: ['Email invalide', 'Email déjà utilisé'],
  password: ['Mot de passe trop court']
})
```

#### `InternalServerError` (500)

Utilisée pour les erreurs serveur inattendues.

```typescript
throw new InternalServerError()
// ou avec message personnalisé
throw new InternalServerError('Erreur lors de la connexion à la base de données')
```

## Utilisation dans les endpoints API

### Exemple basique

```typescript
import { wrapApiHandler, NotFoundError, ForbiddenError } from '@@/server/utils/api-helpers'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const conventionId = validateConventionId(event)

  const convention = await prisma.convention.findUnique({
    where: { id: conventionId }
  })

  if (!convention) {
    throw new NotFoundError('Convention')
  }

  if (convention.authorId !== user.id && !user.isGlobalAdmin) {
    throw new ForbiddenError('Vous ne pouvez modifier que vos propres conventions')
  }

  // ... logique métier
}, { operationName: 'UpdateConvention' })
```

### Exemple avec validation métier

```typescript
import { wrapApiHandler, BadRequestError, ValidationError } from '@@/server/utils/api-helpers'

export default wrapApiHandler(async (event) => {
  const body = await readBody(event)

  // Validation simple
  if (!body.email) {
    throw new BadRequestError('Email requis')
  }

  // Validation complexe avec erreurs détaillées
  const errors: Record<string, string[]> = {}

  if (!body.email.includes('@')) {
    errors.email = ['Format d\'email invalide']
  }

  if (body.password.length < 8) {
    errors.password = ['Le mot de passe doit contenir au moins 8 caractères']
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation échouée', errors)
  }

  // ... logique métier
})
```

### Exemple avec gestion d'erreur personnalisée

```typescript
import { wrapApiHandler, ConflictError, InternalServerError } from '@@/server/utils/api-helpers'

export default wrapApiHandler(async (event) => {
  try {
    await sendEmail(user.email, 'Bienvenue !')
  } catch (error) {
    console.error('Erreur lors de l\'envoi d\'email:', error)
    throw new InternalServerError('Impossible d\'envoyer l\'email de confirmation')
  }

  try {
    await prisma.user.create({ data: userData })
  } catch (error) {
    if (error.code === 'P2002') {
      throw new ConflictError('Cet email est déjà utilisé')
    }
    throw error
  }
})
```

## Intégration avec `wrapApiHandler`

Le wrapper `wrapApiHandler` gère automatiquement toutes les classes d'erreur :

1. **Erreurs HTTP (h3)** : Relancées directement (compatibilité)
2. **Erreurs ApiError** : Converties en erreurs h3 avec le bon status code
3. **Erreurs Zod** : Transformées en erreur 400 avec détails de validation
4. **Erreurs génériques** : Loggées et transformées en erreur 500

```typescript
// Dans wrapApiHandler
if (isApiError(error)) {
  throw createError({
    statusCode: error.statusCode,
    message: error.message,
  })
}
```

## Fonctions utilitaires

### `isApiError(error: unknown): boolean`

Vérifie si une erreur est une instance d'ApiError.

```typescript
if (isApiError(error)) {
  console.log(`Erreur ${error.statusCode}: ${error.message}`)
}
```

### `toApiError(error: unknown, defaultMessage?: string): ApiError`

Convertit une erreur quelconque en ApiError. Utile pour normaliser les erreurs.

```typescript
try {
  // Opération risquée
} catch (error) {
  const apiError = toApiError(error, 'Erreur lors du traitement')
  // apiError est toujours une ApiError
}
```

## Gestion des erreurs Prisma

La fonction `handlePrismaError` continue de gérer les erreurs Prisma spécifiques :

```typescript
try {
  await prisma.user.create({ data: userData })
} catch (error) {
  handlePrismaError(error, 'Utilisateur')
}
```

Codes Prisma gérés :
- **P2002** : Contrainte unique violée → 409 Conflict
- **P2025** : Enregistrement non trouvé → 404 Not Found
- **P2003** : Contrainte de clé étrangère violée → 400 Bad Request

## Bonnes pratiques

### 1. Toujours utiliser les classes d'erreur appropriées

```typescript
// ❌ Mauvais
throw new Error('Convention non trouvée')

// ✅ Bon
throw new NotFoundError('Convention')
```

### 2. Fournir des messages clairs et actionnables

```typescript
// ❌ Mauvais
throw new ForbiddenError()

// ✅ Bon
throw new ForbiddenError('Seuls les organisateurs de cette convention peuvent la modifier')
```

### 3. Utiliser ValidationError pour les erreurs de validation détaillées

```typescript
// ❌ Mauvais
throw new BadRequestError('Email et password invalides')

// ✅ Bon
throw new ValidationError('Validation échouée', {
  email: ['Format invalide'],
  password: ['Doit contenir au moins 8 caractères']
})
```

### 4. Logger les erreurs importantes

```typescript
try {
  await criticalOperation()
} catch (error) {
  console.error('[CriticalOp] Erreur:', error)
  throw new InternalServerError('Opération critique échouée')
}
```

### 5. Ne pas exposer les détails techniques

```typescript
// ❌ Mauvais
throw new InternalServerError(error.stack)

// ✅ Bon
console.error('Erreur technique:', error)
throw new InternalServerError('Erreur lors du traitement')
```

## Migration du code existant

Pour migrer progressivement vers ce système :

```typescript
// Avant
throw createError({
  statusCode: 404,
  message: 'Convention non trouvée'
})

// Après
throw new NotFoundError('Convention')
```

Les deux syntaxes continuent de fonctionner grâce à `wrapApiHandler` qui gère les deux types d'erreur.

## Tests

Exemple de test avec les nouvelles classes d'erreur :

```typescript
import { NotFoundError, ForbiddenError } from '@@/server/utils/api-helpers'

describe('API Endpoint', () => {
  it('devrait lancer NotFoundError si la convention n\'existe pas', async () => {
    await expect(handler(event)).rejects.toThrow(NotFoundError)
  })

  it('devrait lancer ForbiddenError si l\'utilisateur n\'a pas les droits', async () => {
    await expect(handler(event)).rejects.toThrow(ForbiddenError)
  })
})
```

## Références

- Classes d'erreur : `server/utils/errors.ts`
- Intégration : `server/utils/api-helpers.ts`
- Types API : `server/types/api.ts`
