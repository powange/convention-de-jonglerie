import { config } from '@vue/test-utils'
import { vi } from 'vitest'
import { createError as h3CreateError } from 'h3'

// Configuration globale pour les tests
config.global.stubs = {
  // Stub des composants Nuxt UI si nécessaire
}

// Eviter de sur-mocker #app dans l'environnement Nuxt: on conserve les vrais APIs Nuxt
// (si besoin de surcharger des composables spécifiques, utiliser mockNuxtImport dans chaque test)

// Mock Prisma pour les tests Nuxt (routes serveur) afin d'éviter l'accès DB réel
vi.mock('../server/utils/prisma', async () => {
  const { prismaMock } = await import('./__mocks__/prisma')
  return { prisma: prismaMock }
})

// Mock des utilitaires Nitro/H3 (en conservant le vrai createError)
vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
  defineEventHandler: vi.fn((handler) => handler),
  getRouterParam: vi.fn((event: any, name: string) => event?.context?.params?.[name]),
  getRouterParams: vi.fn((event: any) => event?.context?.params ?? {}),
    readBody: vi.fn(),
    sendError: vi.fn(),
    // IMPORTANT: garder le vrai createError sinon Nuxt plante dans app/composables/error
    createError: actual.createError,
    getQuery: vi.fn(),
    getCookie: vi.fn(),
    setCookie: vi.fn(),
    deleteCookie: vi.fn(),
    setResponseStatus: vi.fn(),
    getHeader: vi.fn(),
    setHeader: vi.fn(),
    readMultipartFormData: vi.fn(),
    getRequestURL: vi.fn(() => new URL('http://localhost:3000')),
    sendRedirect: vi.fn()
  }
})

// Fournir les globals Nitro nécessaires à l'évaluation des fichiers server/*
// (les routes exportent directement defineEventHandler(...))
// Nuxt devrait les injecter, mais on ajoute une sauvegarde ici pour les imports directs.
declare global {
  // eslint-disable-next-line no-var
  var defineEventHandler: <T>(fn: T) => T
  // optional helpers that some tests set on global
  // eslint-disable-next-line no-var
  var readBody: ((...args: unknown[]) => unknown) | undefined
  // h3 helpers as globals (Nitro exposes these globally at runtime)
  // eslint-disable-next-line no-var
  var getRouterParam: ((event: unknown, name: string) => unknown) | undefined
  // eslint-disable-next-line no-var
  var getRouterParams: ((event: unknown) => Record<string, unknown>) | undefined
  // eslint-disable-next-line no-var
  var getHeader: ((event: unknown, name: string) => string | undefined) | undefined
  // eslint-disable-next-line no-var
  var setHeader: ((event: unknown, name: string, value: string) => void) | undefined
  // eslint-disable-next-line no-var
  var getCookie: ((event: unknown, name: string) => string | undefined) | undefined
  // eslint-disable-next-line no-var
  var setCookie: ((event: unknown, name: string, value: string) => void) | undefined
  // eslint-disable-next-line no-var
  var deleteCookie: ((event: unknown, name: string) => void) | undefined
  // eslint-disable-next-line no-var
  var getRequestURL: ((event: unknown) => URL) | undefined
}
// Rendre mockable par les tests (mockImplementation, etc.)
// Par défaut, passe-plat
globalThis.defineEventHandler = vi.fn((fn) => fn) as unknown as typeof globalThis.defineEventHandler

// Exposer createError global comme mock déléguant au vrai createError pour permettre aux tests de le surcharger
// Si déjà défini par un test, ne pas l’écraser
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).createError) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).createError = vi.fn((input: any) => h3CreateError(input))
}

// Permettre aux tests d'écrire global.readBody.mockResolvedValue(...)
// même si h3.readBody est mocké ci-dessus
if (!globalThis.readBody) globalThis.readBody = vi.fn()

// Installer des sauvegardes globales pour les helpers h3 utilisés en global dans le code serveur
if (!globalThis.getRouterParam) (globalThis as any).getRouterParam = vi.fn((event: any, name: string) => event?.context?.params?.[name])
if (!globalThis.getRouterParams) (globalThis as any).getRouterParams = vi.fn((event: any) => event?.context?.params ?? {})
if (!globalThis.getHeader) (globalThis as any).getHeader = vi.fn()
if (!globalThis.setHeader) (globalThis as any).setHeader = vi.fn()
if (!globalThis.getCookie) (globalThis as any).getCookie = vi.fn()
if (!globalThis.setCookie) (globalThis as any).setCookie = vi.fn()
if (!globalThis.deleteCookie) (globalThis as any).deleteCookie = vi.fn()
if (!globalThis.getRequestURL) (globalThis as any).getRequestURL = vi.fn(() => new URL('http://localhost:3000'))

// Fournir un useRuntimeConfig par défaut pour les tests Nuxt
// (les tests peuvent le surcharger via vi.mock('#imports') ou global.useRuntimeConfig)
vi.mock('#imports', async () => {
  // Ne pas casser d'autres imports Nuxt, on étend le module réel
  const actual = await vi.importActual<any>('#imports')
  return {
    ...actual,
    useRuntimeConfig: vi.fn(() => ({ jwtSecret: 'test-secret' }))
  }
})

// Neutraliser le rate limiter côté serveur pour éviter l'accès à event.node.req
vi.mock('../server/utils/rate-limiter', () => {
  const noop = vi.fn()
  return {
    createRateLimiter: vi.fn(() => noop),
    authRateLimiter: vi.fn(),
    registerRateLimiter: vi.fn(),
    emailRateLimiter: vi.fn(),
  }
})

// Fournir également une implémentation globale de useRuntimeConfig pour les routes serveur qui l'appellent en global
;(globalThis as any).useRuntimeConfig = vi.fn(() => ({ jwtSecret: 'test-secret' }))

// Forcer la valeur utilisée par nuxt.config.ts au cas où le runtime lirait la config réelle
process.env.JWT_SECRET = 'test-secret'