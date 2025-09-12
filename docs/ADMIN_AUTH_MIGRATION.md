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

## APIs déjà migrées

- ✅ `/api/admin/notifications/stats.get.ts`
- ✅ `/api/admin/notifications/recent.get.ts`

## APIs à migrer

- [ ] `/api/admin/users/*.ts`
- [ ] `/api/admin/feedback/*.ts`
- [ ] `/api/admin/conventions.get.ts`
- [ ] Toutes les autres APIs dans `server/api/admin/`

## Bénéfices

- ✅ **DRY** : Plus de duplication de code
- ✅ **Consistance** : Même vérification partout
- ✅ **Maintenabilité** : Un seul endroit à modifier
- ✅ **Lisibilité** : Code plus propre
- ✅ **Performance** : Option rapide disponible
