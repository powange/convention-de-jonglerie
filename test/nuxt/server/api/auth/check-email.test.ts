import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/auth/check-email.post'

const prismaMock = (globalThis as any).prisma

describe('/api/auth/check-email POST', () => {
  beforeEach(() => {
    prismaMock.user.findFirst.mockReset()
    global.readBody = vi.fn()
  })

  const mockEvent = {} as any

  it('retourne exists: false / canActivate: false pour un email inconnu', async () => {
    global.readBody.mockResolvedValue({ email: 'nouveau@example.com' })
    prismaMock.user.findFirst.mockResolvedValue(null)

    const result = await handler(mockEvent)

    expect(result).toMatchObject({
      success: true,
      data: { exists: false, canActivate: false },
    })
  })

  it("retourne exists: true / canActivate: false pour un user 'email' vérifié", async () => {
    global.readBody.mockResolvedValue({ email: 'user@example.com' })
    prismaMock.user.findFirst.mockResolvedValue({
      authProvider: 'email',
      isEmailVerified: true,
    })

    const result = await handler(mockEvent)

    expect(result.data).toEqual({ exists: true, canActivate: false })
  })

  it("retourne exists: true / canActivate: false pour un user 'email' non vérifié", async () => {
    // Un user qui s'est inscrit mais n'a pas validé son email — il doit
    // se reconnecter via le code de vérification, pas s'inscrire à nouveau
    global.readBody.mockResolvedValue({ email: 'user@example.com' })
    prismaMock.user.findFirst.mockResolvedValue({
      authProvider: 'email',
      isEmailVerified: false,
    })

    const result = await handler(mockEvent)

    expect(result.data).toEqual({ exists: true, canActivate: false })
  })

  it('retourne exists: true / canActivate: true pour un user MANUAL non vérifié (peut être réclamé)', async () => {
    global.readBody.mockResolvedValue({ email: 'artist@example.com' })
    prismaMock.user.findFirst.mockResolvedValue({
      authProvider: 'MANUAL',
      isEmailVerified: false,
    })

    const result = await handler(mockEvent)

    expect(result.data).toEqual({ exists: true, canActivate: true })
  })

  it('retourne exists: true / canActivate: false pour un user MANUAL déjà vérifié (cas anormal)', async () => {
    global.readBody.mockResolvedValue({ email: 'artist@example.com' })
    prismaMock.user.findFirst.mockResolvedValue({
      authProvider: 'MANUAL',
      isEmailVerified: true,
    })

    const result = await handler(mockEvent)

    expect(result.data).toEqual({ exists: true, canActivate: false })
  })

  it('retourne exists: true / canActivate: false pour un user OAuth (google/facebook)', async () => {
    global.readBody.mockResolvedValue({ email: 'user@example.com' })
    prismaMock.user.findFirst.mockResolvedValue({
      authProvider: 'google',
      isEmailVerified: true,
    })

    const result = await handler(mockEvent)

    expect(result.data).toEqual({ exists: true, canActivate: false })
  })

  it('rejette un email invalide', async () => {
    global.readBody.mockResolvedValue({ email: 'pas-un-email' })

    await expect(handler(mockEvent)).rejects.toThrow('Invalid email')
  })

  it('supporte excludeUserIds dans la recherche', async () => {
    global.readBody.mockResolvedValue({
      email: 'user@example.com',
      excludeUserIds: [42, 99],
    })
    prismaMock.user.findFirst.mockResolvedValue(null)

    await handler(mockEvent)

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: 'user@example.com',
          id: { notIn: [42, 99] },
        }),
      })
    )
  })

  it("normalise l'email en minuscules pour la recherche", async () => {
    global.readBody.mockResolvedValue({ email: 'USER@EXAMPLE.COM' })
    prismaMock.user.findFirst.mockResolvedValue(null)

    await handler(mockEvent)

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: 'user@example.com' }),
      })
    )
  })
})
