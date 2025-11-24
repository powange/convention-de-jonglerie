# Mocks Firebase pour les Tests

## Vue d'ensemble

Firebase SDK (client et serveur) ne peut pas fonctionner dans l'environnement Node.js/Vitest des tests. Cette documentation explique comment les modules Firebase sont mockés pour permettre l'exécution des tests.

## Problème

### Erreur sans mock

Lorsque Vitest tente d'exécuter les tests qui importent Firebase :

```
Error: Failed to resolve import "firebase/app" from "app/plugins/firebase.client.ts"
Error: Failed to resolve import "firebase/messaging" from "app/plugins/firebase.client.ts"
Error: Failed to resolve import "firebase-admin" from "server/utils/firebase-admin.ts"
```

### Cause

- **Firebase Client SDK** (`firebase/app`, `firebase/messaging`) : Bibliothèques client qui s'attendent à un environnement navigateur
- **Firebase Admin SDK** (`firebase-admin`) : Bibliothèque serveur qui nécessite des dépendances natives Node.js non disponibles dans Vitest
- **Résolution Vite** : Vite résout les imports au moment de la compilation, **avant** que Vitest puisse appliquer les mocks runtime

## Solution : Aliasing au niveau Vite

### Approche

Utiliser la configuration `resolve.alias` de Vite pour rediriger les imports Firebase vers des fichiers mock au moment de la **compilation**.

**Pourquoi pas `vi.mock()` seul ?**

- `vi.mock()` est un mock **runtime** (s'exécute après la résolution des modules)
- Vite doit résoudre les imports **avant** que Vitest n'exécute le code
- Solution : Combiner aliasing Vite (compilation) + `vi.mock()` (runtime)

## Configuration

### 1. Fichier `vitest.config.ts`

Ajouter les alias dans la configuration du projet Nuxt :

```typescript
await defineVitestProject({
  resolve: {
    alias: [
      // Mock Firebase modules pour les tests
      {
        find: 'firebase/app',
        replacement: resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'test/__mocks__/firebase-app.ts'
        ),
      },
      {
        find: 'firebase/messaging',
        replacement: resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'test/__mocks__/firebase-messaging.ts'
        ),
      },
      {
        find: 'firebase-admin',
        replacement: resolve(
          fileURLToPath(new URL('.', import.meta.url)),
          'test/__mocks__/firebase-admin.ts'
        ),
      },
      // ... autres alias
    ],
  },
  // ... reste de la config
})
```

### 2. Fichier `test/setup.ts`

Ajouter les mocks runtime pour compléter la configuration :

```typescript
// Mock Firebase modules pour éviter les erreurs de résolution dans les tests
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]', options: {} })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: '[DEFAULT]', options: {} })),
}))

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  isSupported: vi.fn(async () => false),
  getToken: vi.fn(async () => 'mock-fcm-token'),
  onMessage: vi.fn(() => vi.fn()),
}))

vi.mock('firebase-admin', () => {
  const admin = {
    apps: [],
    initializeApp: vi.fn((config?: any) => {
      const app = { name: '[DEFAULT]', options: config || {} }
      admin.apps.push(app)
      return app
    }),
    messaging: vi.fn(() => ({
      send: vi.fn(async () => 'mock-message-id'),
      sendEachForMulticast: vi.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
      subscribeToTopic: vi.fn(async () => undefined),
      unsubscribeFromTopic: vi.fn(async () => undefined),
    })),
    credential: {
      cert: vi.fn((serviceAccount: any) => ({
        projectId: serviceAccount.projectId || serviceAccount.project_id,
      })),
    },
  }
  return { default: admin }
})
```

## Fichiers Mock

### `test/__mocks__/firebase-app.ts`

Mock minimal pour `firebase/app` :

```typescript
export const initializeApp = () => ({
  name: '[DEFAULT]',
  options: {},
  automaticDataCollectionEnabled: false,
})

export const getApps = () => []

export const getApp = () => ({
  name: '[DEFAULT]',
  options: {},
  automaticDataCollectionEnabled: false,
})

export type FirebaseApp = ReturnType<typeof initializeApp>
```

### `test/__mocks__/firebase-messaging.ts`

Mock minimal pour `firebase/messaging` :

```typescript
export const getMessaging = () => ({})

export const isSupported = async () => false

export const getToken = async () => 'mock-fcm-token'

export const onMessage = () => {
  return () => {} // Unsubscribe function
}

export type Messaging = ReturnType<typeof getMessaging>

export type MessagePayload = {
  notification?: {
    title?: string
    body?: string
    icon?: string
  }
  data?: Record<string, string>
}
```

### `test/__mocks__/firebase-admin.ts`

Mock pour Firebase Admin SDK avec support des types :

```typescript
import { vi } from 'vitest'

export interface MockApp {
  name: string
  options: Record<string, unknown>
}

export interface MockMessaging {
  send: ReturnType<typeof vi.fn>
  sendEachForMulticast: ReturnType<typeof vi.fn>
  subscribeToTopic: ReturnType<typeof vi.fn>
  unsubscribeFromTopic: ReturnType<typeof vi.fn>
}

const admin = {
  apps: [] as MockApp[],

  initializeApp: vi.fn((config?: any) => {
    const app: MockApp = {
      name: '[DEFAULT]',
      options: config || {},
    }
    admin.apps.push(app)
    return app
  }),

  messaging: vi.fn(
    (app?: MockApp): MockMessaging => ({
      send: vi.fn(async () => 'mock-message-id'),
      sendEachForMulticast: vi.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
      subscribeToTopic: vi.fn(async () => undefined),
      unsubscribeFromTopic: vi.fn(async () => undefined),
    })
  ),

  credential: {
    cert: vi.fn((serviceAccount: any) => ({
      projectId: serviceAccount.projectId || serviceAccount.project_id,
      privateKey: serviceAccount.privateKey || serviceAccount.private_key,
      clientEmail: serviceAccount.clientEmail || serviceAccount.client_email,
    })),
  },
}

// Export namespace types pour compatibilité TypeScript
export namespace admin {
  export namespace app {
    export type App = MockApp
  }

  export namespace messaging {
    export type Messaging = MockMessaging

    export interface Message {
      notification?: { title?: string; body?: string }
      data?: Record<string, string>
      topic?: string
      token?: string
    }

    export interface MulticastMessage {
      notification?: { title?: string; body?: string }
      data?: Record<string, string>
      tokens: string[]
    }

    export interface BatchResponse {
      successCount: number
      failureCount: number
      responses: Array<{
        success: boolean
        error?: { code?: string; message?: string }
      }>
    }
  }

  export namespace credential {
    export interface ServiceAccount {
      projectId?: string
      project_id?: string
      privateKey?: string
      private_key?: string
      clientEmail?: string
      client_email?: string
    }
  }
}

export default admin
```

## Utilisation dans les Tests

### Test avec Firebase Client

```typescript
import { describe, it, expect, vi } from 'vitest'
import { initializeApp } from 'firebase/app'
import { getMessaging, getToken } from 'firebase/messaging'

describe('Firebase Client Plugin', () => {
  it('should initialize Firebase app', () => {
    const app = initializeApp({})
    expect(app.name).toBe('[DEFAULT]')
  })

  it('should get messaging instance', async () => {
    const messaging = getMessaging()
    expect(messaging).toBeDefined()

    const token = await getToken(messaging)
    expect(token).toBe('mock-fcm-token')
  })
})
```

### Test avec Firebase Admin

```typescript
import { describe, it, expect } from 'vitest'
import admin from 'firebase-admin'

describe('Firebase Admin Service', () => {
  it('should initialize admin app', () => {
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: 'test-project',
        privateKey: 'test-key',
        clientEmail: 'test@test.com',
      }),
    })

    expect(app.name).toBe('[DEFAULT]')
  })

  it('should send notification', async () => {
    const messaging = admin.messaging()
    const result = await messaging.sendEachForMulticast({
      notification: { title: 'Test', body: 'Message' },
      tokens: ['token1', 'token2'],
    })

    expect(result.successCount).toBe(1)
    expect(result.failureCount).toBe(0)
  })
})
```

## Personnalisation des Mocks

### Surcharger le comportement dans un test spécifique

```typescript
import { vi } from 'vitest'
import admin from 'firebase-admin'

describe('Test avec erreur Firebase', () => {
  it('should handle firebase error', async () => {
    // Surcharger le mock pour ce test
    const mockMessaging = admin.messaging()
    mockMessaging.sendEachForMulticast = vi.fn(async () => ({
      successCount: 0,
      failureCount: 2,
      responses: [
        {
          success: false,
          error: {
            code: 'messaging/invalid-registration-token',
            message: 'Invalid token',
          },
        },
      ],
    }))

    const result = await mockMessaging.sendEachForMulticast({
      notification: { title: 'Test', body: 'Message' },
      tokens: ['invalid-token'],
    })

    expect(result.failureCount).toBe(2)
  })
})
```

## Résultats

Avec cette configuration :

- ✅ **109/109** fichiers de tests passent
- ✅ **978** tests individuels réussissent
- ✅ Pas d'erreurs de résolution de modules
- ✅ Les tests peuvent importer et utiliser Firebase normalement

## Maintenance

### Ajouter de nouvelles fonctions Firebase

Si le code utilise de nouvelles fonctions Firebase non mockées :

1. Ajouter la fonction dans le fichier mock approprié (`test/__mocks__/firebase-*.ts`)
2. Ajouter une implémentation mock qui retourne des valeurs de test appropriées
3. Mettre à jour les types TypeScript si nécessaire

Exemple pour ajouter `deleteToken` :

```typescript
// Dans test/__mocks__/firebase-messaging.ts
export const deleteToken = async () => true
```

### Mettre à jour les mocks lors des upgrades Firebase

Lors de la mise à jour de Firebase SDK, vérifier que :

1. Les signatures de fonctions n'ont pas changé
2. Les types exportés sont toujours compatibles
3. Les tests passent toujours

## Références

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Vite Resolve Alias](https://vitejs.dev/config/shared-options.html#resolve-alias)
- [Firebase JavaScript SDK](https://firebase.google.com/docs/web/setup)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
