import { vi } from 'vitest'

// Mock global de Prisma centralisé
vi.mock('../server/utils/prisma', async () => {
  const { prismaMock } = await import('./__mocks__/prisma')
  return {
    prisma: prismaMock
  }
})

// Mock global de defineEventHandler pour les tests
global.defineEventHandler = vi.fn((handler) => handler)

// Mock de useRuntimeConfig
global.useRuntimeConfig = vi.fn(() => ({
  jwtSecret: 'test-jwt-secret',
  emailEnabled: 'false',
  smtpUser: '',
  smtpPass: '',
  public: {}
}))

// Mock de readBody
global.readBody = vi.fn((event) => event.body)

// Mock de createError
global.createError = vi.fn((options) => {
  const error = new Error(options.statusMessage)
  error.statusCode = options.statusCode
  error.data = options.data
  return error
})

// Mock de getRequestURL
global.getRequestURL = vi.fn((event) => new URL(event.request?.url || 'http://localhost:3000'))

// Mock du rate limiter
vi.mock('../server/utils/rate-limiter', () => ({
  authRateLimiter: vi.fn().mockResolvedValue(undefined),
  registerRateLimiter: vi.fn().mockResolvedValue(undefined),
  resetPasswordRateLimiter: vi.fn().mockResolvedValue(undefined)
}))

export {}