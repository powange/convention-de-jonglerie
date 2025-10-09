import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock des modules spécifiques - DOIT être avant les imports
vi.mock('../../../../../server/utils/emailService', () => ({
  sendEmail: vi.fn(),
  generatePasswordResetEmailHtml: vi.fn(),
}))

import { sendEmail, generatePasswordResetEmailHtml } from '../../../../../server/utils/emailService'
import requestPasswordResetHandler from '../../../../../server/api/auth/request-password-reset.post'
import { prismaMock } from '../../../../__mocks__/prisma'

const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>
const mockGeneratePasswordResetEmailHtml = generatePasswordResetEmailHtml as ReturnType<typeof vi.fn>

describe('API Request Password Reset', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    prenom: 'Jean',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSendEmail.mockResolvedValue(true)
    mockGeneratePasswordResetEmailHtml.mockReturnValue('<html>Reset link</html>')
  })

  it('devrait envoyer un email de réinitialisation pour un utilisateur existant', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.passwordResetToken.create.mockResolvedValue({
      id: 1,
      token: 'mock-reset-token-12345',
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 3600000), // 1 heure
    })

    const requestBody = {
      email: 'test@example.com',
    }

    const mockEvent = {
      request: {
        url: 'http://localhost:3000/api/auth/request-password-reset',
      },
    }
    global.readBody.mockResolvedValue(requestBody)

    const result = await requestPasswordResetHandler(mockEvent)

    expect(result).toEqual({
      message:
        'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques minutes.',
    })

    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: mockUser.id,
        expiresAt: expect.any(Date),
      }),
    })

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: mockUser.email,
        subject: 'Réinitialisation de votre mot de passe - Conventions de Jonglerie',
        html: expect.stringContaining('Reset link'),
      })
    )
  })

  it('devrait retourner le même message pour un email inexistant', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const requestBody = {
      email: 'nonexistent@example.com',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await requestPasswordResetHandler(mockEvent)

    expect(result).toEqual({
      message:
        'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques minutes.',
    })

    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it("devrait valider le format de l'email", async () => {
    const requestBody = {
      email: 'invalid-email',
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(requestPasswordResetHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait générer un token unique', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.passwordResetToken.create.mockResolvedValue({
      id: 1,
      token: 'generated-token',
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 3600000),
    })

    const requestBody = {
      email: 'test@example.com',
    }

    const mockEvent = {
      request: {
        url: 'http://localhost:3000/api/auth/request-password-reset',
      },
    }
    global.readBody.mockResolvedValue(requestBody)

    await requestPasswordResetHandler(mockEvent)

    // Vérifier que le token a été créé avec un userId
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: mockUser.id,
      }),
    })
  })

  it('devrait créer un lien de réinitialisation correct', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.passwordResetToken.create.mockResolvedValue({
      id: 1,
      token: 'test-token',
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 3600000),
    })

    const requestBody = {
      email: 'test@example.com',
    }

    const mockEvent = {
      request: {
        url: 'http://localhost:3000/api/auth/request-password-reset',
      },
    }
    global.readBody.mockResolvedValue(requestBody)

    await requestPasswordResetHandler(mockEvent)

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: mockUser.email,
        subject: 'Réinitialisation de votre mot de passe - Conventions de Jonglerie',
        text: expect.stringContaining('http://localhost:3000/auth/reset-password?token='),
      })
    )
  })

  it("devrait gérer les erreurs lors de l'envoi d'email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    mockSendEmail.mockRejectedValue(new Error('Email service error'))

    const requestBody = {
      email: 'test@example.com',
    }

    const mockEvent = {
      request: {
        url: 'http://localhost:3000/api/auth/request-password-reset',
      },
    }
    global.readBody.mockResolvedValue(requestBody)

    await expect(requestPasswordResetHandler(mockEvent)).rejects.toThrow(
      'Erreur lors de la demande de réinitialisation'
    )
  })
})
