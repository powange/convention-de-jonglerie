import { describe, it, expect, vi, beforeEach } from 'vitest'

import hasPasswordHandler from '../../../../../server/api/profile/has-password.get'
import { prismaMock } from '../../../../__mocks__/prisma'

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event.context.user) {
      const error = new Error('Non authentifié')
      ;(error as any).statusCode = 401
      throw error
    }
    return event.context.user
  }),
}))

describe('/api/profile/has-password', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    isGlobalAdmin: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devrait retourner hasPassword: true pour un utilisateur avec mot de passe', async () => {
    const mockEvent = {
      context: {
        user: mockUser,
      },
    }

    prismaMock.user.findUnique.mockResolvedValue({
      password: '$2a$10$hashedpassword',
    })

    const result = await hasPasswordHandler(mockEvent)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: {
        password: true,
      },
    })
    expect(result).toEqual({
      hasPassword: true,
    })
  })

  it('devrait retourner hasPassword: false pour un utilisateur OAuth sans mot de passe', async () => {
    const mockEvent = {
      context: {
        user: { ...mockUser, id: 2 },
      },
    }

    prismaMock.user.findUnique.mockResolvedValue({
      password: null,
    })

    const result = await hasPasswordHandler(mockEvent)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 2 },
      select: {
        password: true,
      },
    })
    expect(result).toEqual({
      hasPassword: false,
    })
  })

  it("devrait rejeter avec 401 si l'utilisateur n'est pas authentifié", async () => {
    const mockEvent = {
      context: {},
    }

    await expect(hasPasswordHandler(mockEvent)).rejects.toThrow('Non authentifié')

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it("devrait rejeter avec 404 si l'utilisateur n'est pas trouvé en base", async () => {
    const mockEvent = {
      context: {
        user: { ...mockUser, id: 999 },
      },
    }

    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(hasPasswordHandler(mockEvent)).rejects.toThrow('Utilisateur non trouvé')

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 999 },
      select: {
        password: true,
      },
    })
  })

  it('devrait gérer les erreurs de base de données', async () => {
    const mockEvent = {
      context: {
        user: mockUser,
      },
    }

    const dbError = new Error('Database connection error')
    prismaMock.user.findUnique.mockRejectedValue(dbError)

    await expect(hasPasswordHandler(mockEvent)).rejects.toThrow('Erreur lors de la vérification')
  })

  it('devrait retourner hasPassword: false pour un mot de passe vide (edge case)', async () => {
    const mockEvent = {
      context: {
        user: { ...mockUser, id: 3 },
      },
    }

    prismaMock.user.findUnique.mockResolvedValue({
      password: '',
    })

    const result = await hasPasswordHandler(mockEvent)

    expect(result).toEqual({
      hasPassword: false,
    })
  })
})
