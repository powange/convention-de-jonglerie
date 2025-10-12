import { describe, it, expect, beforeEach } from 'vitest'

import checkEmailHandler from '../../../../../server/api/auth/check-email.post'
import { prismaMock } from '../../../../__mocks__/prisma'

describe('API Check Email', () => {
  const mockUser = {
    id: 1,
    email: 'existing@example.com',
    pseudo: 'existinguser',
    password: '$2a$10$hashedpassword',
    nom: 'Nom',
    prenom: 'Prenom',
    profilePicture: null,
    isGlobalAdmin: false,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    authProvider: null,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
  }

  beforeEach(() => {
    global.readBody = vi.fn()
  })

  it("devrait retourner exists: true si l'email existe", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser)

    const requestBody = {
      email: 'existing@example.com',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await checkEmailHandler(mockEvent)

    expect(result).toEqual({ exists: true })
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'existing@example.com' },
    })
  })

  it("devrait retourner exists: false si l'email n'existe pas", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null)

    const requestBody = {
      email: 'nonexistent@example.com',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await checkEmailHandler(mockEvent)

    expect(result).toEqual({ exists: false })
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'nonexistent@example.com' },
    })
  })

  it('devrait convertir les emails en minuscules', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(mockUser)

    const requestBody = {
      email: 'EXISTING@EXAMPLE.COM',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await checkEmailHandler(mockEvent)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'existing@example.com' },
    })
  })

  it('devrait rejeter si email invalide', async () => {
    const requestBody = {
      email: 'not-an-email',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(checkEmailHandler(mockEvent)).rejects.toThrow('Invalid email')
  })

  it('devrait rejeter si email manquant', async () => {
    const requestBody = {}

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(checkEmailHandler(mockEvent)).rejects.toThrow('Invalid email')
  })

  it('devrait rejeter si email est vide', async () => {
    const requestBody = {
      email: '',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(checkEmailHandler(mockEvent)).rejects.toThrow('Invalid email')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.user.findUnique.mockRejectedValueOnce(new Error('Database error'))

    const requestBody = {
      email: 'test@example.com',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(checkEmailHandler(mockEvent)).rejects.toThrow('Database error')
  })

  it('devrait accepter des emails valides variés', async () => {
    const validEmails = [
      'simple@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'user_name@example-domain.com',
    ]

    for (const email of validEmails) {
      prismaMock.user.findUnique.mockResolvedValueOnce(null)

      const requestBody = { email }
      const mockEvent = {}
      global.readBody.mockResolvedValue(requestBody)

      const result = await checkEmailHandler(mockEvent)
      expect(result).toEqual({ exists: false })
    }
  })
})
