# Authentification par sessions (nuxt-auth-utils)

Ce projet utilise des sessions scellées (nuxt-auth-utils) au lieu de JWT. Cette note résume l’usage côté serveur et la stratégie de test/mocks.

## Prérequis

- Variable d’environnement obligatoire: `NUXT_SESSION_PASSWORD` (32+ caractères, robuste).
- Plus de dépendances JWT; aucun en-tête Authorization n’est attendu côté client.

## Utilisation côté serveur

### Middleware serveur `server/middleware/auth.ts`

- Objectif: autoriser quelques routes publiques (GET) et protéger toutes les autres routes `/api/*`.
- Hydratation du contexte serveur uniquement via la session:

```ts
export default defineEventHandler(async (event) => {
  const { getUserSession } = await import('#imports')
  // ... routes publiques ...
  if (event.path.startsWith('/api/')) {
    const session = await getUserSession(event)
    if (session?.user) {
      event.context.user = session.user
      return
    }
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
```

Pourquoi import dynamique ?

- En tests Nuxt, `#imports` est moqué via Vitest. L’import dynamique garantit que le mock est résolu au runtime, évitant les erreurs du type "getUserSession is not a function".

### Handlers API

- Pour exiger l’auth, utilisez `requireUserSession(event)` et récupérez `user.id`.
- Import dynamique également recommandé dans les handlers:

```ts
export default defineEventHandler(async (event) => {
  const { requireUserSession } = await import('#imports')
  const { user } = await requireUserSession(event)
  const userId = user.id
  // ... logique métier ...
})
```

- Pour autoriser anonymes mais lier l’utilisateur si connecté (ex: POST `/api/feedback`):

```ts
const { getUserSession } = await import('#imports')
const session = await getUserSession(event)
event.context.user = session?.user || null
```

## Stratégie de tests (Vitest / @nuxt/test-utils)

### Mocks globaux

- `test/setup.ts` étend `#imports` et fournit des stubs par défaut pour `getUserSession` et `requireUserSession`.

### Mocks locaux par fichier de test

- Vous pouvez surcharger localement:

```ts
vi.mock('#imports', async () => {
  const actual = await vi.importActual<any>('#imports')
  return { ...actual, requireUserSession: vi.fn(async () => ({ user: { id: 1 } })) }
})
```

- Récupérez une référence stable dans `beforeEach` afin d’utiliser `mockResolvedValueOnce`/`mockRejectedValueOnce`:

```ts
let mockRequireUserSession: ReturnType<typeof vi.fn>

beforeEach(async () => {
  const mod: any = await import('#imports')
  mockRequireUserSession = mod.requireUserSession as ReturnType<typeof vi.fn>
  mockRequireUserSession.mockReset?.()
})
```

- Pour simuler un 401 propre sans tomber en 500 générique:

```ts
mockRequireUserSession.mockRejectedValueOnce(
  Object.assign(new Error('Unauthorized'), { statusCode: 401 })
)
```

- Pour éviter les fuites d’état entre tests, préférez `mockResolvedValueOnce`/`mockRejectedValueOnce` plutôt que `mockResolvedValue` global.

## Pièges fréquents et solutions

- Erreur "getUserSession is not a function":
  - Assurez-vous d’un mock local `vi.mock('#imports', ...)` qui retourne bien une `vi.fn` et privilégiez les imports dynamiques (`await import('#imports')`) dans le code serveur testé.

- Erreurs 500 inattendues en tests:
  - Les handlers rattrapent les erreurs et ne relancent que celles avec `statusCode`. Quand vous simulez une erreur d’auth, attachez `statusCode: 401` à l’Error.

- Conflits de mocks `#imports`:
  - Un mock local remplace le mock global. Si vous en définissez un, fournissez toutes les fonctions dont le test a besoin (au minimum celles que vous utilisez) ou récupérez le module réel avec `vi.importActual` puis surchargez.

## Bonnes pratiques

- Utiliser `getUserSession` pour hydrater contextuellement (middleware, endpoints optionnels).
- Utiliser `requireUserSession` dans les endpoints protégés, et relayer les erreurs HTTP (ne pas écraser les `statusCode`).
- Préférer les imports dynamiques pour `#imports` côté serveur.
- En tests: `mockRejectedValueOnce(Object.assign(new Error(msg), { statusCode }))` pour simuler des erreurs HTTP précises.
