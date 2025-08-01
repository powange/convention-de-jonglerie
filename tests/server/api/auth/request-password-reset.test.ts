import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../../../__mocks__/prisma'

// Mock des modules spécifiques
vi.mock('../../../../server/utils/emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  generatePasswordResetEmailHtml: vi.fn().mockReturnValue('<html>Reset link</html>')
}))

// Import des mocks après leur définition
import { sendEmail } from '../../../../server/utils/emailService'

// Import du handler après les mocks
import requestPasswordResetHandler from '../../../../server/api/auth/request-password-reset.post'

describe('API Request Password Reset', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    prenom: 'Jean'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devrait envoyer un email de réinitialisation pour un utilisateur existant', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.passwordResetToken.create.mockResolvedValue({
      id: 1,
      token: 'mock-reset-token-12345',
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 3600000) // 1 heure
    })

    const mockEvent = {
      body: {
        email: 'test@example.com'
      },
      request: {
        url: 'http://localhost:3000/api/auth/request-password-reset'
      }
    }

    const result = await requestPasswordResetHandler(mockEvent)

    expect(result).toEqual({
      message: "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques minutes."
    })

    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: mockUser.id,
        expiresAt: expect.any(Date)
      })
    })

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: mockUser.email,
        subject: 'Réinitialisation de votre mot de passe - Conventions de Jonglerie',
        html: expect.stringContaining('Reset link')
      })
    )
  })

  it('devrait retourner le même message pour un email inexistant', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const mockEvent = {
      body: {
        email: 'nonexistent@example.com'
      }
    }

    const result = await requestPasswordResetHandler(mockEvent)

    expect(result).toEqual({
      message: "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques minutes."
    })

    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('devrait valider le format de l\'email', async () => {
    const mockEvent = {
      body: {
        email: 'invalid-email'
      }
    }

    await expect(requestPasswordResetHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait générer un token unique', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.passwordResetToken.create.mockResolvedValue({
      id: 1,
      token: 'generated-token',
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 3600000)
    })

    const mockEvent = {
      body: {
        email: 'test@example.com'
      },
      request: {
        url: 'http://localhost:3000/api/auth/request-password-reset'
      }
    }

    await requestPasswordResetHandler(mockEvent)

    // Vérifier que le token a été créé avec un userId
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: mockUser.id
      })
    })
  })

  it('devrait créer un lien de réinitialisation correct', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    prismaMock.passwordResetToken.create.mockResolvedValue({
      id: 1,
      token: 'test-token',
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 3600000)
    })

    const mockEvent = {
      body: {
        email: 'test@example.com'
      },
      request: {
        url: 'http://localhost:3000/api/auth/request-password-reset'
      }
    }

    await requestPasswordResetHandler(mockEvent)

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: mockUser.email,
        subject: 'Réinitialisation de votre mot de passe - Conventions de Jonglerie',
        text: expect.stringContaining('http://localhost:3000/auth/reset-password?token=')
      })
    )
  })

  it('devrait gérer les erreurs lors de l\'envoi d\'email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser)
    sendEmail.mockRejectedValue(new Error('Email service error'))

    const mockEvent = {
      body: {
        email: 'test@example.com'
      },
      request: {
        url: 'http://localhost:3000/api/auth/request-password-reset'
      }
    }

    await expect(requestPasswordResetHandler(mockEvent)).rejects.toThrow('Erreur lors de la demande de réinitialisation')
  })
})