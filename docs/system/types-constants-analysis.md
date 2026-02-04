# Analyse : Types partagés et constantes

**Date d'analyse** : 12 novembre 2025

Ce document analyse l'état actuel du codebase par rapport aux recommandations de "Types partagés" dans `codebase_analysis.md`.

---

## 📊 État actuel vs Recommandations

### 1. Types partagés - Interfaces API standardisées

#### ✅ **PARTIELLEMENT IMPLÉMENTÉ**

**Fichiers existants** :

- `server/types/prisma-helpers.ts` (219 lignes)
- `server/utils/api-helpers.ts` (fonctions de réponse)

**Ce qui existe** :

```typescript
// server/utils/api-helpers.ts (lignes 144-168)
export function createSuccessResponse<T>(data: T, message?: string) {
  return {
    success: true,
    ...(message && { message }),
    data,
  }
}

export function createPaginatedResponse<T>(items: T[], total: number, page: number, limit: number) {
  return {
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  }
}
```

**Utilisations** :

- `createSuccessResponse` : utilisé dans 5 fichiers
- `createPaginatedResponse` : utilisé dans 5 fichiers

**Ce qui manque** :

❌ **Interface `ApiResponse<T>` générique** non définie
❌ **Interface `ApiError`** non définie (mais `HttpError` existe)

**Écart avec la recommandation** :

- Les fonctions existent mais pas les types TypeScript correspondants
- Pas d'interface générique pour typer les réponses API
- Les endpoints retournent des types ad-hoc plutôt qu'un type standardisé

**Impact** :

- Manque de cohérence dans les types de retour API
- Difficulté à créer des wrappers génériques côté client
- Pas de garantie de structure uniforme

---

### 2. Types d'erreur HTTP

#### ✅ **IMPLÉMENTÉ**

**Fichier** : `server/types/prisma-helpers.ts` (lignes 61-78)

```typescript
/**
 * Type pour les erreurs avec code de statut HTTP
 */
export interface HttpError extends Error {
  statusCode: number
  data?: unknown
}

/**
 * Type guard pour vérifier si une erreur est une HttpError
 */
export function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as HttpError).statusCode === 'number'
  )
}
```

**Également dans** : `server/utils/api-helpers.ts` (ligne 30)

```typescript
export function isHttpError(error: unknown): error is { statusCode: number; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as any).statusCode === 'number'
  )
}
```

**Problème** : ⚠️ **Duplication de code** - `isHttpError` existe dans 2 fichiers différents

---

### 3. Constants centralisées - Droits des organisateurs

#### ❌ **NON IMPLÉMENTÉ**

**État actuel** : Les droits sont utilisés comme **magic strings** dans le code.

**Occurrences** :

- `'canEditConvention'` : **6 occurrences** dans 3 fichiers
- `'canDeleteConvention'` : dispersé dans le code
- `'canManageOrganizers'` : dispersé dans le code
- `'canAddEdition'` : dispersé dans le code
- `'canEditAllEditions'` : dispersé dans le code
- `'canDeleteAllEditions'` : dispersé dans le code
- `'canManageVolunteers'` : dispersé dans le code

**Fichiers principaux** :

- `server/utils/permissions/convention-permissions.ts`
- `server/utils/permissions/edition-permissions.ts`
- `server/types/prisma-helpers.ts` (interface `OrganizerPermissionSnapshot`)

**Exemple de duplication** :

```typescript
// server/utils/permissions/convention-permissions.ts
type ConventionPermissionRight = 'canEditConvention' | 'canDeleteConvention' | 'canManageOrganizers'
// ...

// server/utils/permissions/edition-permissions.ts
type EditionPermissionRight = 'canEditConvention' | 'canDeleteConvention' | 'canManageOrganizers'
// ...

// server/types/prisma-helpers.ts
export interface OrganizerPermissionSnapshot {
  rights: {
    canEditConvention: boolean
    canDeleteConvention: boolean
    canManageOrganizers: boolean
    // ...
  }
}
```

**Impact** :

- Risque de typos et d'incohérences
- Difficulté à renommer ou ajouter des droits
- Code dupliqué dans 3+ endroits
- Pas de source unique de vérité

---

### 4. Error handling standardisé - Classes d'erreurs

#### ❌ **NON IMPLÉMENTÉ**

**État actuel** : Pas de classes d'erreurs personnalisées.

**Méthode actuelle** :

```typescript
// Pattern utilisé dans 358 fichiers TypeScript côté serveur
throw createError({
  statusCode: 404,
  message: 'Ressource introuvable',
})
```

**Ce qui manque** :

- ❌ Classes `NotFoundError`, `ForbiddenError`, `ValidationError`
- ❌ Hiérarchie d'erreurs typées
- ❌ Gestion d'erreurs plus sémantique

**Pourquoi ce n'est pas implémenté** :

- Nuxt utilise `createError()` de H3 (framework sous-jacent)
- Approche fonctionnelle plutôt qu'orientée objet
- `wrapApiHandler` gère déjà les erreurs de manière centralisée

---

## 📈 Statistiques du codebase

- **Fichiers TypeScript serveur** : 358 fichiers
- **Utilisation de `createSuccessResponse`** : 5 fichiers
- **Utilisation de `createPaginatedResponse`** : 5 fichiers
- **Magic strings pour permissions** : 6+ occurrences dispersées
- **Duplication de `isHttpError`** : 2 fichiers

---

## 🎯 Recommandations d'amélioration

### Priorité HAUTE

#### 1. ✅ Créer des types API standardisés

**Fichier à créer** : `server/types/api.ts`

```typescript
/**
 * Type générique pour les réponses API de succès
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true
  message?: string
  data: T
}

/**
 * Type générique pour les réponses paginées
 */
export interface ApiPaginatedResponse<T = unknown> {
  success: true
  data: T[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

/**
 * Type générique pour les réponses API (succès ou erreur)
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Type pour les erreurs API
 */
export interface ApiErrorResponse {
  success: false
  statusCode: number
  message: string
  operationName?: string
  data?: unknown
}
```

**Impact** :

- Typage fort des réponses API
- Facilite la création de clients typés
- Cohérence garantie par TypeScript

**Effort** : 1-2 heures

---

#### 2. ✅ Centraliser les constantes de permissions

**Fichier à créer** : `server/constants/permissions.ts`

```typescript
/**
 * Droits des organisateurs de convention
 */
export const ORGANIZER_RIGHTS = {
  EDIT_CONVENTION: 'canEditConvention',
  DELETE_CONVENTION: 'canDeleteConvention',
  MANAGE_ORGANIZERS: 'canManageOrganizers',
  ADD_EDITION: 'canAddEdition',
  EDIT_ALL_EDITIONS: 'canEditAllEditions',
  DELETE_ALL_EDITIONS: 'canDeleteAllEditions',
  MANAGE_VOLUNTEERS: 'canManageVolunteers',
} as const

/**
 * Type des droits d'organisateur (union des valeurs)
 */
export type OrganizerRight = (typeof ORGANIZER_RIGHTS)[keyof typeof ORGANIZER_RIGHTS]

/**
 * Type pour les objets de permissions complètes
 */
export type OrganizerPermissions = {
  [K in OrganizerRight]: boolean
}

/**
 * Liste de tous les droits (utile pour les boucles)
 */
export const ALL_ORGANIZER_RIGHTS = Object.values(ORGANIZER_RIGHTS)
```

**Migrations à effectuer** :

1. Remplacer tous les `'canEditConvention'` par `ORGANIZER_RIGHTS.EDIT_CONVENTION`
2. Remplacer les types union par `OrganizerRight`
3. Utiliser `OrganizerPermissions` dans les interfaces

**Fichiers à modifier** :

- `server/utils/permissions/convention-permissions.ts`
- `server/utils/permissions/edition-permissions.ts`
- `server/types/prisma-helpers.ts`
- Tous les fichiers utilisant ces permissions (6+ fichiers)

**Impact** :

- Source unique de vérité
- Facilite l'ajout/modification de droits
- Élimine les risques de typos
- Meilleure maintenabilité

**Effort** : 2-3 heures

---

### Priorité MOYENNE

#### 3. ⚠️ Résoudre la duplication de `isHttpError`

**Problème** : Fonction dupliquée dans 2 fichiers

**Solution** :

1. Garder `isHttpError` dans `server/types/prisma-helpers.ts` (source canonique)
2. Importer depuis ce fichier dans `api-helpers.ts`
3. Exporter également depuis `api-helpers.ts` pour rétrocompatibilité

```typescript
// server/utils/api-helpers.ts
export { isHttpError } from '#server/types/prisma-helpers'
```

**Effort** : 30 minutes

---

### Priorité BASSE

#### 4. 🤔 Classes d'erreurs personnalisées (optionnel)

**Note** : Pas prioritaire car :

- `wrapApiHandler` gère déjà les erreurs de manière centralisée
- `createError()` de H3/Nuxt est idiomatique
- Approche fonctionnelle suffit pour la plupart des cas

**Si implémenté** :

- Créer `server/utils/errors.ts`
- Classes : `NotFoundError`, `ForbiddenError`, `ValidationError`
- Intégrer dans `wrapApiHandler`

**Effort** : 3-4 heures

---

## 📋 Plan d'action recommandé

### Phase 1 - Types API (1-2h)

1. ✅ Créer `server/types/api.ts` avec les interfaces
2. ✅ Mettre à jour `createSuccessResponse` et `createPaginatedResponse` pour retourner ces types
3. ✅ Migrer progressivement les endpoints vers les types standardisés
4. ✅ Créer des tests pour les types

### Phase 2 - Constantes de permissions (2-3h)

1. ✅ Créer `server/constants/permissions.ts`
2. ✅ Migrer `server/types/prisma-helpers.ts`
3. ✅ Migrer `server/utils/permissions/*.ts`
4. ✅ Rechercher et remplacer dans tous les fichiers
5. ✅ Tester que tout fonctionne

### Phase 3 - Cleanup (30min)

1. ✅ Résoudre la duplication de `isHttpError`
2. ✅ Mettre à jour la documentation

---

## ✅ Tests requis

Pour chaque changement :

- [ ] Tests unitaires passent (273 tests)
- [ ] Tests Nuxt passent (931 tests)
- [ ] Pas de régression fonctionnelle
- [ ] Lint passe sans erreurs

---

## 📚 Bénéfices attendus

### Types API standardisés

- ✅ Cohérence des réponses API
- ✅ Typage fort côté client
- ✅ Meilleure documentation automatique

### Constantes de permissions

- ✅ Source unique de vérité
- ✅ Élimination des magic strings
- ✅ Facilite la maintenance
- ✅ Réduction des bugs

### Duplication résolue

- ✅ Code plus propre
- ✅ Moins de confusion

---

**Dernière mise à jour** : 12 novembre 2025
