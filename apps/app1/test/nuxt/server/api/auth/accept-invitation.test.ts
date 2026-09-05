import bcrypt from 'bcryptjs'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('nuxt-auth-utils', () => ({
  setUserSession: vi.fn(),
}))

vi.mock('#server/utils/notification-service', () => ({
  NotificationHelpers: { welcome: vi.fn() },
}))

import acceptInvitationHandler from '../../../../../../../layers/auth/server/api/auth/accept-invitation.post'
import { global } from '../../../globales-nitro'
import type { H3Event } from 'h3'

// Mock global de Prisma (test/setup-common.ts)
const prismaMock = (globalThis as any).prisma

describe('API Accept Invitation', () => {
  const mockToken = {
    id: 1,
    token: 'valid-invitation-token',
    userId: 1,
    // TTL long (invitation) : 7 jours dans le futur
    expiresAt: new Date(Date.now() + 7 * 24 * 3600000),
    used: false,
    user: { id: 1, email: 'test@example.com' },
  }

  const mockUpdatedUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'john.doe',
    nom: 'Doe',
    prenom: 'John',
    phone: null,
    isGlobalAdmin: false,
    isVolunteer: false,
    isArtist: true,
    isOrganizer: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    isEmailVerified: true,
  }

  const mockEvent = {} as unknown as H3Event

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(bcrypt, 'hash').mockImplementation((password) => Promise.resolve(`hashed_${password}`))
    prismaMock.user.update.mockResolvedValue(mockUpdatedUser)
  })

  it('active le compte : mot de passe haché + email vérifié + tokens supprimés', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockToken)
    global.readBody.mockResolvedValue({
      token: 'valid-invitation-token',
      password: 'NewPassword123!',
    })

    const result = await acceptInvitationHandler(mockEvent)

    // RÉGRESSION : contrairement au reset, l'invitation VÉRIFIE l'email.
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        password: 'hashed_NewPassword123!',
        isEmailVerified: true,
      }),
    })
    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1 },
    })
    expect(result.success).toBe(true)
    expect(result.data.user.isEmailVerified).toBe(true)
  })

  it("rejette un lien d'invitation invalide", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null)
    global.readBody.mockResolvedValue({ token: 'nope', password: 'NewPassword123!' })

    await expect(acceptInvitationHandler(mockEvent)).rejects.toThrow("Lien d'invitation invalide")
  })

  it("rejette un lien d'invitation expiré", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      ...mockToken,
      expiresAt: new Date(Date.now() - 3600000),
    })
    global.readBody.mockResolvedValue({ token: 'expired', password: 'NewPassword123!' })

    await expect(acceptInvitationHandler(mockEvent)).rejects.toThrow(
      "Le lien d'invitation a expiré"
    )
  })

  it('rejette un lien déjà utilisé', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({ ...mockToken, used: true })
    global.readBody.mockResolvedValue({ token: 'used', password: 'NewPassword123!' })

    await expect(acceptInvitationHandler(mockEvent)).rejects.toThrow('Ce lien a déjà été utilisé')
  })

  it('valide la force du mot de passe', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockToken)
    global.readBody.mockResolvedValue({ token: 'valid-invitation-token', password: 'weak' })

    await expect(acceptInvitationHandler(mockEvent)).rejects.toThrow()
  })
})
