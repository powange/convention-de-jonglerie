# Migration vers le système d'authentification admin mutualisé

## Problème résolu

Avant, chaque API admin devait dupliquer le code de vérification des droits administrateur :

```typescript
// Code dupliqué dans chaque API admin 😞
const { user } = await requireUserSession(event)

if (!user?.id) {
  throw createError({
    statusCode: 401,
    statusMessage: 'Non authentifié',
  })
}

const currentUser = await prisma.user.findUnique({
  where: { id: user.id },
  select: { isGlobalAdmin: true },
})

if (!currentUser?.isGlobalAdmin) {
  throw createError({
    statusCode: 403,
    statusMessage: 'Accès refusé - Droits super administrateur requis',
  })
}
```

## Solution : Fonction mutualisée

Créé `server/utils/admin-auth.ts` avec deux fonctions :

### `requireGlobalAdmin(event)` - Version sécurisée

- Vérifie la session utilisateur
- Fait une requête DB pour confirmer `isGlobalAdmin`
- Retourne les infos utilisateur complètes
- Recommandé pour les opérations sensibles

### `requireGlobalAdminFast(event)` - Version rapide

- Utilise directement les données de session
- Pas de requête DB supplémentaire
- Plus rapide mais moins sûre
- Pour les opérations peu sensibles

## Migration d'une API existante

**Avant :**

```typescript
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isGlobalAdmin: true },
  })

  if (!currentUser?.isGlobalAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Accès refusé' })
  }

  // Logique API...
})
```

**Après :**

```typescript
import { requireGlobalAdmin } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  // Une seule ligne ! 🎉
  await requireGlobalAdmin(event)

  // Logique API...
})
```

## État de la migration

✅ **Migration terminée !** Toutes les APIs admin ont été migrées vers le système mutualisé.

**Statistiques :**
- 34 fichiers API dans `/server/api/admin/` utilisent `requireGlobalAdmin` ou `requireGlobalAdminFast`
- 63 occurrences totales des fonctions d'authentification admin
- 0 API restant à migrer

**APIs migrées incluent :**
- `/api/admin/users/*` (gestion utilisateurs)
- `/api/admin/feedback/*` (gestion feedback)
- `/api/admin/notifications/*` (notifications)
- `/api/admin/error-logs/*` (logs d'erreurs)
- `/api/admin/backup/*` (sauvegardes)
- `/api/admin/tasks/*` (tâches planifiées)
- `/api/admin/conventions.get.ts` (liste conventions)
- `/api/admin/editions/[id]/export.get.ts` (export éditions)
- Et toutes les autres routes admin

## Bénéfices

- ✅ **DRY** : Plus de duplication de code
- ✅ **Consistance** : Même vérification partout
- ✅ **Maintenabilité** : Un seul endroit à modifier
- ✅ **Lisibilité** : Code plus propre
- ✅ **Performance** : Option rapide disponible
