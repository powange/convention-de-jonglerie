import bcrypt from 'bcryptjs'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import loginHandler from '../../../../../../../layers/auth/server/api/auth/login.post'
import { global } from '../../../globales-nitro'
import type { H3Event } from 'h3'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Import du handler après les mocks

vi.mock('nuxt-auth-utils', () => ({
  setUserSession: vi.fn(),
}))

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
    updatedAt: new Date(),
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
      password: 'Password123!',
    }

    const mockEvent = {} as unknown as H3Event
    global.readBody.mockResolvedValue(requestBody)

    const result = await loginHandler(mockEvent)

    expect(result).toEqual({
      success: true,
      data: {
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
          updatedAt: mockUser.updatedAt,
        },
      },
    })

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    })
  })

  it('devrait connecter un utilisateur avec pseudo valide', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null) // Pas trouvé par email
      .mockResolvedValueOnce(mockUser) // Trouvé par pseudo

    const requestBody = {
      identifier: 'testuser',
      password: 'Password123!',
    }

    const mockEvent = {} as unknown as H3Event
    global.readBody.mockResolvedValue(requestBody)

    const result = await loginHandler(mockEvent)

    expect(result.data.user.id).toBe(mockUser.id)
    expect(prismaMock.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { pseudo: 'testuser' },
    })
  })

  it("devrait rejeter si l'utilisateur n'existe pas", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const requestBody = {
      identifier: 'nonexistent@example.com',
      password: 'Password123!',
    }

    const mockEvent = {} as unknown as H3Event
    global.readBody.mockResolvedValue(requestBody)

    await expect(loginHandler(mockEvent)).rejects.toThrow('Identifiants invalides')
  })

  it('devrait rejeter si le mot de passe est incorrect', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser)

    const requestBody = {
      identifier: 'test@example.com',
      password: 'WrongPassword',
    }

    const mockEvent = {} as unknown as H3Event
    global.readBody.mockResolvedValue(requestBody)

    await expect(loginHandler(mockEvent)).rejects.toThrow('Identifiants invalides')
  })

  // RÉGRESSION : un compte OAuth a password: null en base. bcrypt.compare(string, null) levait
  // « Illegal arguments: string, object » — un 500 observé en production — au lieu d'expliquer
  // à l'utilisateur qu'il doit passer par le bouton de son fournisseur.
  it('devrait renvoyer une 401 explicite pour un compte Google, sans appeler bcrypt', async () => {
    const googleUser = { ...mockUser, password: null, authProvider: 'google' }
    // mockResolvedValue et non ...Once : le test appelle le handler deux fois, pour le message
    // puis pour la charge utile.
    prismaMock.user.findUnique.mockResolvedValue(googleUser)

    global.readBody.mockResolvedValue({
      identifier: 'test@example.com',
      password: 'Password123!',
    })

    await expect(loginHandler({} as unknown as H3Event)).rejects.toThrow('Google')
    await expect(loginHandler({} as unknown as H3Event)).rejects.toMatchObject({
      data: { requiresOAuth: true, provider: 'google' },
    })
    expect(bcrypt.compare).not.toHaveBeenCalled()
  })

  it("devrait renvoyer une 401 générique si le compte n'a ni mot de passe ni fournisseur connu", async () => {
    const sansMotDePasse = { ...mockUser, password: null, authProvider: 'email' }
    prismaMock.user.findUnique.mockResolvedValue(sansMotDePasse)

    global.readBody.mockResolvedValue({
      identifier: 'test@example.com',
      password: 'Password123!',
    })

    await expect(loginHandler({} as unknown as H3Event)).rejects.toThrow('Mot de passe oublié')
    // Pas de requiresOAuth ici : ces 35 comptes de production n'ont aucun fournisseur externe,
    // et l'annoncer enverrait le client afficher un bouton qui n'existe pas.
    await expect(loginHandler({} as unknown as H3Event)).rejects.toMatchObject({
      data: { requiresPasswordReset: true },
    })
    expect(bcrypt.compare).not.toHaveBeenCalled()
  })

  it("devrait rejeter si l'email n'est pas vérifié", async () => {
    const unverifiedUser = { ...mockUser, isEmailVerified: false }
    prismaMock.user.findUnique.mockResolvedValueOnce(unverifiedUser)

    const requestBody = {
      identifier: 'test@example.com',
      password: 'Password123!',
    }

    const mockEvent = {} as unknown as H3Event
    global.readBody.mockResolvedValue(requestBody)

    await expect(loginHandler(mockEvent)).rejects.toThrow('Email non vérifié')
  })

  it('devrait valider les champs requis', async () => {
    const requestBody = {
      identifier: '',
      password: '',
    }

    const mockEvent = {} as unknown as H3Event
    global.readBody.mockResolvedValue(requestBody)

    await expect(loginHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait nettoyer les espaces dans les identifiants', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser)

    const requestBody = {
      identifier: '  test@example.com  ',
      password: '  Password123!  ',
    }

    const mockEvent = {} as unknown as H3Event
    global.readBody.mockResolvedValue(requestBody)

    await loginHandler(mockEvent)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    })
  })

  // plus de génération de JWT: la session est utilisée

  it('devrait appliquer le rate limiting', async () => {
    const { authRateLimiter } = await import('../../../../../server/utils/rate-limiter')
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser)

    const requestBody = {
      identifier: 'test@example.com',
      password: 'Password123!',
    }

    const mockEvent = {} as unknown as H3Event
    global.readBody.mockResolvedValue(requestBody)

    await loginHandler(mockEvent)

    expect(authRateLimiter).toHaveBeenCalledWith(mockEvent)
  })
})
