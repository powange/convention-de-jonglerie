# Audit des APIs utilisant `createPaginatedResponse`

## Contexte

L'helper `createPaginatedResponse` retourne un objet standardisé avec la structure suivante :
```typescript
{
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

Certaines APIs reconstituent manuellement la réponse en renommant `data` en autre chose (comme `notifications`, `users`, `feedbacks`, etc.), ce qui crée une incohérence dans l'API et nécessite des ajustements frontend spécifiques.

## APIs auditées

### ✅ APIs avec format CORRECT

Ces APIs utilisent soit directement le retour de `createPaginatedResponse`, soit le spread pour ajouter des données supplémentaires :

1. **`/api/notifications`** (CORRIGÉ dans commit a6dbf6d0)
   - Utilise : `response.data`
   - Frontend : Store notifications

2. **`/api/editions`**
   - Utilise : `return createPaginatedResponse(...)`
   - Frontend : Pages éditions, composants

3. **`/api/editions/[id]/volunteers/applications`**
   - Utilise : `return createPaginatedResponse(...)`
   - Frontend : Pages gestion bénévoles

4. **`/api/editions/[id]/ticketing/orders`**
   - Utilise : `...createPaginatedResponse(...)`
   - Frontend : Pages gestion billeterie

5. **`/api/editions/[id]/meals/participants`**
   - Utilise : `...createPaginatedResponse(...)`
   - Frontend : Pages gestion repas

### ❌ APIs avec format INCORRECT

Ces APIs reconstruisent manuellement la réponse en renommant `data` :

#### 1. `/api/admin/notifications/recent`
**Fichier** : `server/api/admin/notifications/recent.get.ts:104-107`

**Format actuel** :
```typescript
const paginatedResponse = createPaginatedResponse(formattedNotifications, total, page, limit)

return {
  notifications: paginatedResponse.data,  // ❌ Devrait être "data"
  pagination: paginatedResponse.pagination,
}
```

**Utilisation frontend** : `app/pages/admin/notifications.vue:1510`
```typescript
recentNotifications.value = response.notifications || []  // Attend "notifications"
```

**Correction recommandée** :
```typescript
return createPaginatedResponse(formattedNotifications, total, page, limit)
// OU si besoin d'ajouter des champs :
return {
  ...createPaginatedResponse(formattedNotifications, total, page, limit),
}
```

#### 2. `/api/admin/feedback`
**Fichier** : `server/api/admin/feedback/index.get.ts:83-87`

**Format actuel** :
```typescript
const paginatedResponse = createPaginatedResponse(feedbacks, total, page, limit)

return {
  feedbacks: paginatedResponse.data,  // ❌ Devrait être "data"
  pagination: paginatedResponse.pagination,
  stats: statsFormatted,
}
```

**Utilisation frontend** : `app/pages/admin/feedback.vue` (à vérifier)

**Correction recommandée** :
```typescript
return {
  ...createPaginatedResponse(feedbacks, total, page, limit),
  stats: statsFormatted,
}
```

#### 3. `/api/admin/error-logs`
**Fichier** : `server/api/admin/error-logs.get.ts:296-299`

**Format actuel** :
```typescript
const paginatedResponse = createPaginatedResponse(errorLogs, total, page!, pageSize)
return {
  logs: paginatedResponse.data,  // ❌ Devrait être "data"
  pagination: paginatedResponse.pagination,
  stats: statsResponse,
}
```

**Utilisation frontend** : `app/pages/admin/error-logs.vue` (à vérifier)

**Correction recommandée** :
```typescript
return {
  ...createPaginatedResponse(errorLogs, total, page!, pageSize),
  stats: statsResponse,
}
```

#### 4. `/api/admin/users`
**Fichier** : `server/api/admin/users/index.get.ts:120-132`

**Format actuel** :
```typescript
const paginatedResponse = createPaginatedResponse(
  usersWithConnectionStatus,
  totalCount,
  page,
  limit
)

return {
  users: paginatedResponse.data,  // ❌ Devrait être "data"
  pagination: paginatedResponse.pagination,
  filters: { ... },
  connectionStats: { ... },
}
```

**Utilisation frontend** : `app/pages/admin/users/index.vue` (à vérifier)

**Correction recommandée** :
```typescript
return {
  ...createPaginatedResponse(usersWithConnectionStatus, totalCount, page, limit),
  filters: { ... },
  connectionStats: { ... },
}
```

## Bénéfices de la standardisation

1. **Cohérence de l'API** : Toutes les routes paginées retournent le même format
2. **Simplicité frontend** : Pas besoin de gérer des cas spéciaux selon l'API
3. **Maintenabilité** : Plus facile de modifier `createPaginatedResponse` si besoin
4. **Documentation** : Format API unifié et prévisible
5. **TypeScript** : Meilleur support du typage avec un format unique

## Plan d'action

Pour corriger ces incohérences :

1. **Backend** :
   - Modifier chaque API pour utiliser directement `return createPaginatedResponse(...)` ou le spread
   - Supprimer les renommages de `data` en `notifications`, `users`, `feedbacks`, `logs`

2. **Frontend** :
   - Mettre à jour les pages/composants pour utiliser `response.data` au lieu de `response.notifications`, etc.
   - Vérifier les tests unitaires et les mettre à jour

3. **Tests** :
   - Vérifier que tous les tests passent après les modifications
   - S'assurer qu'il n'y a pas de régression

## Statut

- ✅ `/api/notifications` - Corrigé (commit a6dbf6d0)
- ⏳ `/api/admin/notifications/recent` - À corriger
- ⏳ `/api/admin/feedback` - À corriger
- ⏳ `/api/admin/error-logs` - À corriger
- ⏳ `/api/admin/users` - À corriger
