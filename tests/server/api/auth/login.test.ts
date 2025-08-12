import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prismaMock } from '../../../__mocks__/prisma'

// Mock de jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('fake-jwt-token')
  }
}))

// Import du handler après les mocks
import loginHandler from '../../../../server/api/auth/login.post'

describe('API Login', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    password: '$2a$10$hashedpassword',
    nom: 'Nom',
    prenom: 'Prenom',
    profilePicture: null,
    isGlobalAdmin: false,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(bcrypt, 'compare').mockImplementation((password, hash) => {
      return Promise.resolve(password === 'Password123!')
    })
  })

  it('devrait connecter un utilisateur avec email valide', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser)

    const requestBody = {
        identifier: 'test@example.com',
        password: 'Password123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await loginHandler(mockEvent)

    expect(result).toEqual({
      token: 'fake-jwt-token',
      user: {
        id: mockUser.id,
        email: mockUser.email,
        pseudo: mockUser.pseudo,
        nom: mockUser.nom,
        prenom: mockUser.prenom,
        profilePicture: mockUser.profilePicture,
        isGlobalAdmin: mockUser.isGlobalAdmin,
        isEmailVerified: mockUser.isEmailVerified,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt
      }
    })

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' }
    })
  })

  it('devrait connecter un utilisateur avec pseudo valide', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // Pas trouvé par email
      .mockResolvedValueOnce(mockUser) // Trouvé par pseudo

    const requestBody = {
        identifier: 'testuser',
        password: 'Password123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await loginHandler(mockEvent)

    expect(result.token).toBe('fake-jwt-token')
    expect(prismaMock.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { pseudo: 'testuser' }
    })
  })

  it('devrait rejeter si l\'utilisateur n\'existe pas', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const requestBody = {
        identifier: 'nonexistent@example.com',
        password: 'Password123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(loginHandler(mockEvent)).rejects.toThrow('Identifiants invalides')
  })

  it('devrait rejeter si le mot de passe est incorrect', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser)

    const requestBody = {
        identifier: 'test@example.com',
        password: 'WrongPassword'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(loginHandler(mockEvent)).rejects.toThrow('Identifiants invalides')
  })

  it('devrait rejeter si l\'email n\'est pas vérifié', async () => {
    const unverifiedUser = { ...mockUser, isEmailVerified: false }
    prismaMock.user.findUnique.mockResolvedValueOnce(unverifiedUser)

    const requestBody = {
        identifier: 'test@example.com',
        password: 'Password123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(loginHandler(mockEvent)).rejects.toThrow('Email non vérifié')
  })

  it('devrait valider les champs requis', async () => {
    const requestBody = {
        identifier: '',
        password: ''
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(loginHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait nettoyer les espaces dans les identifiants', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser)

    const requestBody = {
      identifier: '  test@example.com  ',
      password: '  Password123!  '
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await loginHandler(mockEvent)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' }
    })
  })

  it('devrait générer un token JWT valide', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser)

    const requestBody = {
      identifier: 'test@example.com',
      password: 'Password123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await loginHandler(mockEvent)

    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: mockUser.id },
      expect.any(String),
      { expiresIn: '7d' }
    )
  })

  it('devrait appliquer le rate limiting', async () => {
    const { authRateLimiter } = await import('../../../../server/utils/rate-limiter')
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser)

    const requestBody = {
      identifier: 'test@example.com',
      password: 'Password123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await loginHandler(mockEvent)

    expect(authRateLimiter).toHaveBeenCalledWith(mockEvent)
  })
})