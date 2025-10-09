import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock des modules spécifiques - DOIT être avant les imports
vi.mock('../../../../../server/utils/emailService', () => ({
  sendEmail: vi.fn(),
  generateVerificationCode: vi.fn(),
  generateVerificationEmailHtml: vi.fn(),
}))

import {
  sendEmail,
  generateVerificationCode,
  generateVerificationEmailHtml,
} from '../../../../../server/utils/emailService'
import bcrypt from 'bcryptjs'
import registerHandler from '../../../../../server/api/auth/register.post'
import { prismaMock } from '../../../../__mocks__/prisma'

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>
const mockGenerateVerificationCode = generateVerificationCode as ReturnType<typeof vi.fn>
const mockGenerateVerificationEmailHtml = generateVerificationEmailHtml as ReturnType<typeof vi.fn>

describe('API Register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()

    // Réinitialiser les mocks
    mockSendEmail.mockResolvedValue(true)
    mockGenerateVerificationCode.mockReturnValue('123456')
    mockGenerateVerificationEmailHtml.mockReturnValue('<html>Code: 123456</html>')
  })

  it('devrait créer un nouvel utilisateur avec succès', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
      isEmailVerified: false,
    }

    prismaMock.user.create.mockResolvedValue(mockUser)

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await registerHandler(mockEvent)

    expect(result).toEqual({
      message: 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.',
      requiresVerification: true,
      email: 'test@example.com',
    })

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
        pseudo: 'testuser',
        nom: 'Nom',
        prenom: 'Prenom',
        isEmailVerified: false,
        emailVerificationCode: '123456',
      }),
    })

    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: '🤹 Vérifiez votre compte - Conventions de Jonglerie',
      html: expect.stringContaining('123456'),
      text: expect.stringContaining('123456'),
    })
  })

  it("devrait valider le format de l'email", async () => {
    const requestBody = {
      email: 'invalid-email',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(registerHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait valider la force du mot de passe', async () => {
    const requestBody = {
      email: 'test@example.com',
      password: 'weak',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(registerHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait gérer les emails déjà utilisés', async () => {
    prismaMock.user.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['email'] },
    })

    const requestBody = {
      email: 'existing@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(registerHandler(mockEvent)).rejects.toThrow('Email ou pseudo déjà utilisé')
  })

  it('devrait hacher le mot de passe avant de le stocker', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    prismaMock.user.create.mockResolvedValue(mockUser)
    const hashSpy = vi.spyOn(bcrypt, 'hash')

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await registerHandler(mockEvent)

    expect(hashSpy).toHaveBeenCalledWith('Password123!', 10)
  })

  it("devrait normaliser l'email en minuscules", async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    prismaMock.user.create.mockResolvedValue(mockUser)

    const requestBody = {
      email: 'TEST@EXAMPLE.COM',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await registerHandler(mockEvent)

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
      }),
    })
  })

  it("devrait continuer même si l'envoi d'email échoue", async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    prismaMock.user.create.mockResolvedValue(mockUser)
    sendEmail.mockResolvedValue(false)

    const requestBody = {
      email: 'test@example.com',
      password: 'Password123!',
      pseudo: 'testuser',
      nom: 'Nom',
      prenom: 'Prenom',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await registerHandler(mockEvent)

    expect(result).toEqual({
      message: 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.',
      requiresVerification: true,
      email: 'test@example.com',
    })
  })
})
