import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../../layers/artists/server/api/editions/[id]/artists/notifications.post'

const prismaMock = (globalThis as any).prisma

const canManageArtistsById = vi.hoisted(() => vi.fn())
const creerNotification = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({ canManageArtistsById }))
vi.mock('#server/utils/notification-service', () => ({
  NotificationService: { create: creerNotification },
}))

const g = global as any

describe('/api/editions/[id]/artists/notifications POST', () => {
  const evenement = { context: { user: { id: 9 } } }

  const corps = (body: unknown) => {
    g.readBody = vi.fn().mockResolvedValue(body)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    g.requireAuth = vi.fn().mockReturnValue({ id: 9 })
    g.getRouterParam = vi.fn().mockReturnValue('7')
    canManageArtistsById.mockResolvedValue(true)
    creerNotification.mockResolvedValue(undefined)
    prismaMock.edition.findUnique.mockResolvedValue({
      id: 7,
      name: 'Jongle en Zik',
      convention: { name: 'Zik' },
    })
    prismaMock.editionArtist.findMany.mockResolvedValue([{ userId: 101 }, { userId: 102 }])
    prismaMock.artistNotificationGroup.create.mockResolvedValue({ id: 'grp-1' })
    prismaMock.artistNotificationConfirmation.createMany.mockResolvedValue({ count: 2 })
    corps({ targetType: 'all', message: 'Répétition à 14 h' })
  })

  it('prévient tous les artistes et consigne l’envoi', async () => {
    const resultat = await handler(evenement as any)

    expect(resultat.data.recipientCount).toBe(2)
    expect(prismaMock.artistNotificationGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetType: 'all', recipientCount: 2, senderId: 9 }),
      })
    )
    expect(creerNotification).toHaveBeenCalledTimes(2)
  })

  it('crée une ligne de confirmation par destinataire, non confirmée', async () => {
    await handler(evenement as any)

    // La ligne existe dès l'envoi : c'est elle qui distingue « pas encore lu »
    // de « jamais destinataire »
    expect(prismaMock.artistNotificationConfirmation.createMany).toHaveBeenCalledWith({
      data: [
        { artistNotificationGroupId: 'grp-1', userId: 101, confirmedAt: null },
        { artistNotificationGroupId: 'grp-1', userId: 102, confirmedAt: null },
      ],
    })
  })

  it('joint le lien de confirmation à la notification', async () => {
    const resultat = await handler(evenement as any)

    expect(resultat.data.confirmationUrl).toBe('/editions/7/artists/notification/grp-1/confirm')
    expect(creerNotification).toHaveBeenCalledWith(
      expect.objectContaining({ actionUrl: '/editions/7/artists/notification/grp-1/confirm' })
    )
  })

  it('restreint aux artistes des spectacles visés, sans doublon', async () => {
    corps({ targetType: 'shows', selectedShows: [3, 4], message: 'Plateau à 14 h' })

    await handler(evenement as any)

    const requete = prismaMock.editionArtist.findMany.mock.calls[0][0]
    expect(requete.where.shows).toEqual({ some: { showId: { in: [3, 4] } } })
    // Un artiste jouant dans les deux spectacles ne doit recevoir qu'un message
    expect(requete.distinct).toEqual(['userId'])
  })

  it('refuse un périmètre par spectacle sans spectacle choisi', async () => {
    corps({ targetType: 'shows', selectedShows: [], message: 'Plateau à 14 h' })

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(prismaMock.artistNotificationGroup.create).not.toHaveBeenCalled()
  })

  it('refuse un organisateur sans droits sur les artistes', async () => {
    canManageArtistsById.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(prismaMock.editionArtist.findMany).not.toHaveBeenCalled()
  })

  it('refuse un message vide ou trop long', async () => {
    corps({ targetType: 'all', message: '' })
    await expect(handler(evenement as any)).rejects.toThrow()

    corps({ targetType: 'all', message: 'x'.repeat(501) })
    await expect(handler(evenement as any)).rejects.toThrow()

    expect(prismaMock.artistNotificationGroup.create).not.toHaveBeenCalled()
  })

  it('refuse un envoi sans destinataire', async () => {
    prismaMock.editionArtist.findMany.mockResolvedValue([])

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(prismaMock.artistNotificationGroup.create).not.toHaveBeenCalled()
  })
})
