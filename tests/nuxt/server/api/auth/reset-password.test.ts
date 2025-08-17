import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { prismaMock } from '../../../../__mocks__/prisma';

// Import du handler après les mocks
import resetPasswordHandler from '../../../../../server/api/auth/reset-password.post'

describe('API Reset Password', () => {
  const mockToken = {
    id: 1,
    token: 'valid-reset-token',
    userId: 1,
    expiresAt: new Date(Date.now() + 3600000), // 1 heure dans le futur
    used: false,
    user: {
      id: 1,
      email: 'test@example.com'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(bcrypt, 'hash').mockImplementation((password) => 
      Promise.resolve(`hashed_${password}`)
    )
  })

  it('devrait réinitialiser le mot de passe avec un token valide', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockToken)
    
    const requestBody = {
      token: 'valid-reset-token',
      newPassword: 'NewPassword123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await resetPasswordHandler(mockEvent)

    expect(result).toEqual({
      message: 'Votre mot de passe a été réinitialisé avec succès'
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: mockToken.userId },
      data: { password: 'hashed_NewPassword123!' }
    })

    expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: mockToken.id },
      data: { used: true }
    })
  })

  it('devrait rejeter un token invalide', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null)

    const requestBody = {
      token: 'invalid-token',
      newPassword: 'NewPassword123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(resetPasswordHandler(mockEvent)).rejects.toThrow('Token de réinitialisation invalide')
  })

  it('devrait rejeter un token expiré', async () => {
    const expiredToken = {
      ...mockToken,
      expiresAt: new Date(Date.now() - 3600000) // 1 heure dans le passé
    }
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(expiredToken)

    const requestBody = {
      token: 'expired-token',
      newPassword: 'NewPassword123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(resetPasswordHandler(mockEvent)).rejects.toThrow('Le token de réinitialisation a expiré')
  })

  it('devrait rejeter un token déjà utilisé', async () => {
    const usedToken = {
      ...mockToken,
      used: true
    }
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(usedToken)

    const requestBody = {
      token: 'used-token',
      newPassword: 'NewPassword123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(resetPasswordHandler(mockEvent)).rejects.toThrow('Ce token a déjà été utilisé')
  })

  it('devrait valider la force du nouveau mot de passe', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockToken)

    const requestBody = {
      token: 'valid-reset-token',
      newPassword: 'weak'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(resetPasswordHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait hacher le nouveau mot de passe', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockToken)
    const hashSpy = vi.spyOn(bcrypt, 'hash')

    const requestBody = {
      token: 'valid-reset-token',
      newPassword: 'NewPassword123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await resetPasswordHandler(mockEvent)

    expect(hashSpy).toHaveBeenCalledWith('NewPassword123!', 10)
  })

  it('devrait gérer les dates UTC correctement', async () => {
    // Token qui expire dans exactement 30 minutes
    const futureDate = new Date()
    futureDate.setMinutes(futureDate.getMinutes() + 30)
    
    const tokenWithUTCDate = {
      ...mockToken,
      expiresAt: futureDate
    }
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(tokenWithUTCDate)

    const requestBody = {
      token: 'valid-reset-token',
      newPassword: 'NewPassword123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    const result = await resetPasswordHandler(mockEvent)

    expect(result).toEqual({
      message: 'Votre mot de passe a été réinitialisé avec succès'
    })
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockToken)
    prismaMock.user.update.mockRejectedValue(new Error('Database error'))

    const requestBody = {
      token: 'valid-reset-token',
      newPassword: 'NewPassword123!'
    }

    const mockEvent = {}
    global.readBody.mockResolvedValue(requestBody)

    await expect(resetPasswordHandler(mockEvent)).rejects.toThrow('Erreur lors de la réinitialisation du mot de passe')
  })
})