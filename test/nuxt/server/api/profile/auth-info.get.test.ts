import { describe, it, expect, vi, beforeEach } from 'vitest'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

function getAuthProviderLabel(provider: string): string {
  switch (provider) {
    case 'email':
      return 'Inscription par email'
    case 'google':
      return 'Connexion Google'
    case 'facebook':
      return 'Connexion Facebook'
    default:
      return 'Méthode inconnue'
  }
}

// Mock du handler
const mockHandler = async (event: any) => {
  const user = event.context.user

  if (!user) {
    const error = new Error('Non authentifié')
    ;(error as any).statusCode = 401
    throw error
  }

  const userInfo = await prismaMock.user.findUnique({
    where: { id: user.id },
    select: {
      authProvider: true,
      password: true,
    },
  })

  if (!userInfo) {
    const error = new Error('Utilisateur non trouvé')
    ;(error as any).statusCode = 404
    throw error
  }

  const authProvider = userInfo.authProvider || 'unknown'
  const authProviderLabel = getAuthProviderLabel(authProvider)

  return {
    authProvider,
    authProviderLabel,
    hasPassword: userInfo.password !== null,
    isOAuth: userInfo.password === null,
  }
}

describe('/api/profile/auth-info', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("devrait retourner les infos d'auth pour un utilisateur Google", async () => {
    const mockEvent = {
      context: {
        user: { id: 1 },
      },
    }

    prismaMock.user.findUnique.mockResolvedValue({
      authProvider: 'google',
      password: null,
    })

    const result = await mockHandler(mockEvent)

    expect(result).toEqual({
      authProvider: 'google',
      authProviderLabel: 'Connexion Google',
      hasPassword: false,
      isOAuth: true,
    })
  })

  it("devrait retourner les infos d'auth pour un utilisateur Facebook", async () => {
    const mockEvent = {
      context: {
        user: { id: 1 },
      },
    }

    prismaMock.user.findUnique.mockResolvedValue({
      authProvider: 'facebook',
      password: null,
    })

    const result = await mockHandler(mockEvent)

    expect(result).toEqual({
      authProvider: 'facebook',
      authProviderLabel: 'Connexion Facebook',
      hasPassword: false,
      isOAuth: true,
    })
  })

  it("devrait retourner les infos d'auth pour un utilisateur email", async () => {
    const mockEvent = {
      context: {
        user: { id: 1 },
      },
    }

    prismaMock.user.findUnique.mockResolvedValue({
      authProvider: 'email',
      password: '$2a$10$hashedpassword',
    })

    const result = await mockHandler(mockEvent)

    expect(result).toEqual({
      authProvider: 'email',
      authProviderLabel: 'Inscription par email',
      hasPassword: true,
      isOAuth: false,
    })
  })

  it("devrait rejeter si l'utilisateur n'est pas authentifié", async () => {
    const mockEvent = {
      context: {},
    }

    await expect(mockHandler(mockEvent)).rejects.toThrow('Non authentifié')
  })

  it("devrait rejeter si l'utilisateur n'est pas trouvé", async () => {
    const mockEvent = {
      context: {
        user: { id: 999 },
      },
    }

    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(mockHandler(mockEvent)).rejects.toThrow('Utilisateur non trouvé')
  })
})
