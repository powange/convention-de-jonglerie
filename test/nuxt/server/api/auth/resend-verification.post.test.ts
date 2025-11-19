import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/emailService', () => ({
  sendEmail: vi.fn(),
  generateVerificationCode: vi.fn(),
  generateVerificationEmailHtml: vi.fn(),
  getSiteUrl: vi.fn(() => 'http://localhost:3000'),
}))

vi.mock('../../../../../server/utils/rate-limiter', () => ({
  emailRateLimiter: vi.fn(),
}))

import {
  sendEmail,
  generateVerificationCode,
  generateVerificationEmailHtml,
} from '../../../../../server/utils/emailService'
import { emailRateLimiter } from '../../../../../server/utils/rate-limiter'
import handler from '../../../../../server/api/auth/resend-verification.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>
const mockGenerateVerificationCode = generateVerificationCode as ReturnType<typeof vi.fn>
const mockGenerateVerificationEmailHtml = generateVerificationEmailHtml as ReturnType<typeof vi.fn>
const mockEmailRateLimiter = emailRateLimiter as ReturnType<typeof vi.fn>

interface TestEventContext {
  body?: any
}
const mockEvent: { context: TestEventContext } = {
  context: {},
}

const mockUser = {
  id: 1,
  email: 'user@example.com',
  pseudo: 'testuser',
  nom: 'Doe',
  prenom: 'John',
  isEmailVerified: false,
  emailVerificationCode: '123456',
  verificationCodeExpiry: new Date(Date.now() + 15 * 60 * 1000),
}

describe('/api/auth/resend-verification POST', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.update.mockReset()
    mockSendEmail.mockReset()
    mockGenerateVerificationCode.mockReset()
    mockGenerateVerificationEmailHtml.mockReset()
    mockEmailRateLimiter.mockReset()
    global.readBody = vi.fn()

    // Valeurs par défaut pour les mocks
    mockGenerateVerificationCode.mockReturnValue('654321')
    mockGenerateVerificationEmailHtml.mockReturnValue('<html>Email HTML</html>')
    mockSendEmail.mockResolvedValue(true)
    mockEmailRateLimiter.mockResolvedValue(undefined)
  })

  it('devrait renvoyer un code de vérification avec succès', async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.user.update.mockResolvedValue({
      ...mockUser,
      emailVerificationCode: '654321',
      verificationCodeExpiry: expect.any(Date),
    })

    const result = await handler(mockEvent as any)

    expect(result).toEqual({
      message: 'Nouveau code de vérification envoyé avec succès',
    })

    expect(mockEmailRateLimiter).toHaveBeenCalledWith(mockEvent)
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    })
    expect(mockGenerateVerificationCode).toHaveBeenCalled()
  })

  it("devrait normaliser l'email (trim et lowercase)", async () => {
    const requestBody = {
      email: 'USER@EXAMPLE.COM', // Email valide pour Zod (sans espaces)
    }

    const normalizedUser = {
      ...mockUser,
      email: 'user@example.com', // Email en base en minuscules
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(normalizedUser)
    prismaMock.user.update.mockResolvedValue(normalizedUser)

    await handler(mockEvent as any)

    // Vérifier que l'email est bien converti en minuscules pour la recherche
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    })
  })

  it('devrait stocker le body dans le contexte pour le rate limiter', async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.user.update.mockResolvedValue(mockUser)

    await handler(mockEvent as any)

    expect(mockEvent.context.body).toEqual(requestBody)
  })

  it("devrait mettre à jour l'utilisateur avec un nouveau code et expiry", async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.user.update.mockResolvedValue(mockUser)

    await handler(mockEvent as any)

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        emailVerificationCode: '654321',
        verificationCodeExpiry: expect.any(Date),
      },
    })

    // Vérifier que l'expiry est dans environ 15 minutes (avec tolérance de 1 minute)
    const updateCall = prismaMock.user.update.mock.calls[0][0]
    const expiryTime = updateCall.data.verificationCodeExpiry.getTime()
    const expectedTime = Date.now() + 15 * 60 * 1000
    const toleranceMs = 60 * 1000 // 1 minute

    expect(Math.abs(expiryTime - expectedTime)).toBeLessThan(toleranceMs)
  })

  it('devrait envoyer un email avec le bon contenu', async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.user.update.mockResolvedValue(mockUser)

    await handler(mockEvent as any)

    expect(mockGenerateVerificationEmailHtml).toHaveBeenCalledWith(
      '654321',
      'John',
      'user@example.com'
    )

    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: '🤹 Nouveau code de vérification - Conventions de Jonglerie',
      html: '<html>Email HTML</html>',
      text: expect.stringContaining('654321'),
    })
  })

  it("devrait inclure l'URL de vérification dans le texte de l'email", async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.user.update.mockResolvedValue(mockUser)

    await handler(mockEvent as any)

    const emailCall = mockSendEmail.mock.calls[0][0]
    expect(emailCall.text).toContain('/verify-email?email=user%40example.com')
    expect(emailCall.text).toContain('votre nouveau code de vérification est : 654321')
  })

  it("devrait rejeter si l'email est invalide", async () => {
    const requestBody = {
      email: 'email-invalide',
    }

    global.readBody.mockResolvedValue(requestBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it("devrait rejeter si l'utilisateur n'existe pas", async () => {
    const requestBody = {
      email: 'nonexistent@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Utilisateur non trouvé')
  })

  it("devrait rejeter si l'email est déjà vérifié", async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    const verifiedUser = {
      ...mockUser,
      isEmailVerified: true,
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(verifiedUser)

    await expect(handler(mockEvent as any)).rejects.toThrow('Email déjà vérifié')
  })

  it("devrait gérer l'échec du rate limiting", async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    const rateLimitError = Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 })

    global.readBody.mockResolvedValue(requestBody)
    mockEmailRateLimiter.mockRejectedValue(rateLimitError)

    await expect(handler(mockEvent as any)).rejects.toThrow('Rate limit exceeded')
  })

  it("devrait réussir même si l'envoi d'email échoue", async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.user.update.mockResolvedValue(mockUser)
    mockSendEmail.mockResolvedValue(false) // Échec de l'envoi

    const result = await handler(mockEvent as any)

    expect(result).toEqual({
      message: 'Nouveau code de vérification envoyé avec succès',
    })

    // Le code devrait quand même être mis à jour en base
    expect(prismaMock.user.update).toHaveBeenCalled()
  })

  it("devrait logger un warning si l'envoi d'email échoue", async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.user.update.mockResolvedValue(mockUser)
    mockSendEmail.mockResolvedValue(false)

    await handler(mockEvent as any)

    expect(consoleSpy).toHaveBeenCalledWith("Échec de l'envoi d'email pour user@example.com")

    consoleSpy.mockRestore()
  })

  it('devrait gérer les erreurs de base de données lors de la recherche', async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait gérer les erreurs de base de données lors de la mise à jour', async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.user.update.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait relancer les erreurs HTTP existantes', async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    const httpError = {
      statusCode: 503,
      statusMessage: 'Service unavailable',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it("devrait gérer les erreurs du service d'email", async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.user.update.mockResolvedValue(mockUser)
    mockSendEmail.mockRejectedValue(new Error('Email service error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait gérer les champs manquants dans la requête', async () => {
    const requestBody = {} // Email manquant

    global.readBody.mockResolvedValue(requestBody)

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it("devrait gérer les caractères spéciaux dans l'email pour l'URL", async () => {
    const requestBody = {
      email: 'user+test@example.com',
    }

    const userWithSpecialEmail = {
      ...mockUser,
      email: 'user+test@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(userWithSpecialEmail)
    prismaMock.user.update.mockResolvedValue(userWithSpecialEmail)

    await handler(mockEvent as any)

    const emailCall = mockSendEmail.mock.calls[0][0]
    expect(emailCall.text).toContain('user%2Btest%40example.com') // URL encoded
  })

  it("devrait utiliser l'URL de base de la configuration", async () => {
    const requestBody = {
      email: 'user@example.com',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.user.update.mockResolvedValue(mockUser)

    await handler(mockEvent as any)

    const emailCall = mockSendEmail.mock.calls[0][0]
    // L'URL doit contenir /verify-email (peu importe le domaine qui vient de la config)
    expect(emailCall.text).toContain('/verify-email')
    expect(emailCall.text).toMatch(/https?:\/\/[^/]+\/verify-email/)
  })
})
