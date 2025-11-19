import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock des modules spécifiques - DOIT être avant les imports
vi.mock('../../../../../server/utils/emailService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    sendEmail: vi.fn(),
    generateVerificationCode: vi.fn(),
    generateVerificationEmailHtml: vi.fn(() => Promise.resolve('<html>Code: 123456</html>')),
  }
})

// Mock bcrypt pour accélérer les tests (éviter les vraies opérations cryptographiques)
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((password) => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn(() => Promise.resolve(true)),
  },
}))

import {
  sendEmail,
  generateVerificationCode,
  generateVerificationEmailHtml,
} from '../../../../../server/utils/emailService'
import bcrypt from 'bcryptjs'
import registerHandler from '../../../../../server/api/auth/register.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>
const mockGenerateVerificationCode = generateVerificationCode as ReturnType<typeof vi.fn>
const mockGenerateVerificationEmailHtml = generateVerificationEmailHtml as ReturnType<typeof vi.fn>

describe('API Register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getHeader = vi.fn(() => 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7')

    // Réinitialiser les mocks
    mockSendEmail.mockResolvedValue(true)
    mockGenerateVerificationCode.mockReturnValue('123456')
    mockGenerateVerificationEmailHtml.mockResolvedValue('<html>Code: 123456</html>')
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

    // Vérifier que bcrypt.hash a été appelé avec le mot de passe
    expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10)

    // Vérifier que le mot de passe haché a été utilisé
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        password: 'hashed_Password123!',
      }),
    })
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
    mockSendEmail.mockResolvedValue(false)

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
