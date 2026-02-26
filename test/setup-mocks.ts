import { vi } from 'vitest'

// Mock de #app pour les tests unitaires
vi.mock('#app', () => ({
  useRuntimeConfig: vi.fn(() => ({
    public: {},
    emailEnabled: 'false',
  })),
  navigateTo: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
  useRoute: vi.fn(() => ({
    params: {},
    query: {},
  })),
  defineNuxtPlugin: vi.fn((plugin) => plugin),
  useNuxtApp: vi.fn(() => ({
    $pinia: {},
    vueApp: {},
  })),
  useAsyncData: vi.fn(),
  useFetch: vi.fn(),
  useState: vi.fn(),
  useCookie: vi.fn(),
  useRequestHeaders: vi.fn(() => ({})),
  useHead: vi.fn(),
  useSeoMeta: vi.fn(),
}))

// Mock de #imports pour les tests unitaires
vi.mock('#imports', () => ({
  createError: vi.fn((options) => {
    const error: any = new Error(options.statusMessage || options.message)
    error.statusCode = options.statusCode
    error.data = options.data
    throw error
  }),
  defineEventHandler: vi.fn((handler) => handler),
  useRuntimeConfig: vi.fn(() => ({
    emailEnabled: 'false',
    smtpUser: '',
    smtpPass: '',
    public: {},
  })),
  readBody: vi.fn(),
  getRequestURL: vi.fn((event) => new URL(event.request?.url || 'http://localhost:3000')),
  getRouterParam: vi.fn((event, param) => {
    return event.context?.params?.[param] || undefined
  }),
  setHeader: vi.fn(),
  sendStream: vi.fn(),
}))

// Mock global de Prisma centralisé
vi.mock('../server/utils/prisma', async () => {
  const { prismaMock } = await import('./__mocks__/prisma')
  return {
    prisma: prismaMock,
  }
})

// Mock global de defineEventHandler pour les tests
global.defineEventHandler = vi.fn((handler) => handler)

// Mock de useRuntimeConfig
global.useRuntimeConfig = vi.fn(() => ({
  emailEnabled: 'false',
  smtpUser: '',
  smtpPass: '',
  public: {},
}))

// Mock de readBody
global.readBody = vi.fn()

// Mock de createError
global.createError = vi.fn((options) => {
  const error: any = new Error(options.statusMessage || options.message)
  error.statusCode = options.statusCode
  error.data = options.data
  // Dans un contexte Nuxt/H3, createError lance directement l'erreur
  throw error
})

// Mock de getRequestURL
global.getRequestURL = vi.fn((event) => new URL(event.request?.url || 'http://localhost:3000'))

// Mock de getRouterParam
global.getRouterParam = vi.fn((event, param) => {
  return event.context?.params?.[param] || undefined
})

// Mock de getRouterParams
global.getRouterParams = vi.fn((event) => {
  return event.context?.params || {}
})

// Mock de getQuery
global.getQuery = vi.fn((event) => {
  return event.context?.query || {}
})

// Mock de getCookie
global.getCookie = vi.fn()

// Mock de setCookie
global.setCookie = vi.fn()

// Mock de deleteCookie
global.deleteCookie = vi.fn()

// Mock de setResponseStatus
global.setResponseStatus = vi.fn()

// Mock de getHeader
global.getHeader = vi.fn()

// Mock de setHeader
global.setHeader = vi.fn()

// Mock de sendStream
global.sendStream = vi.fn()

// Mock de sendError
global.sendError = vi.fn()

// Mock de createSuccessResponse (auto-importé par Nitro depuis server/utils/)
if (!global.createSuccessResponse) {
  global.createSuccessResponse = vi.fn((data: unknown, message?: string) => ({
    success: true,
    ...(message && { message }),
    data,
  }))
}

// Mock de readMultipartFormData
global.readMultipartFormData = vi.fn()

// Mock de sendRedirect
global.sendRedirect = vi.fn()

// Mock du rate limiter
vi.mock('../server/utils/rate-limiter', () => ({
  authRateLimiter: vi.fn().mockResolvedValue(undefined),
  registerRateLimiter: vi.fn().mockResolvedValue(undefined),
  resetPasswordRateLimiter: vi.fn().mockResolvedValue(undefined),
}))

export {}
