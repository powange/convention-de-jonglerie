import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../../layers/artists/server/api/editions/[id]/artists/notification/[groupId]/confirm.post'

const prismaMock = (globalThis as any).prisma

const g = global as any

describe('/api/editions/[id]/artists/notification/[groupId]/confirm POST', () => {
  const evenement = { context: { user: { id: 101 } } }

  const envoi = {
    id: 'grp-1',
    title: 'Artistes - Jongle en Zik',
    message: 'Répétition à 14 h',
    sentAt: new Date('2026-08-27T10:00:00Z'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    g.requireAuth = vi.fn().mockReturnValue({ id: 101 })
    g.getRouterParam = vi.fn((_e: unknown, nom: string) => (nom === 'groupId' ? 'grp-1' : '7'))
    prismaMock.artistNotificationGroup.findFirst.mockResolvedValue(envoi)
    prismaMock.artistNotificationConfirmation.findFirst.mockResolvedValue({
      id: 'conf-1',
      confirmedAt: null,
    })
    prismaMock.artistNotificationConfirmation.update.mockResolvedValue({})
  })

  it('enregistre la lecture au premier passage', async () => {
    const resultat = await handler(evenement as any)

    expect(resultat.data.alreadyConfirmed).toBe(false)
    expect(prismaMock.artistNotificationConfirmation.update).toHaveBeenCalledWith({
      where: { id: 'conf-1' },
      data: { confirmedAt: expect.any(Date) },
    })
    // Le message accompagne la réponse : la page le ré-affiche sans second appel
    expect(resultat.data.message).toBe('Répétition à 14 h')
  })

  it('ne réécrit pas la date si la lecture était déjà confirmée', async () => {
    const dejaLu = new Date('2026-08-27T11:00:00Z')
    prismaMock.artistNotificationConfirmation.findFirst.mockResolvedValue({
      id: 'conf-1',
      confirmedAt: dejaLu,
    })

    const resultat = await handler(evenement as any)

    expect(resultat.data.alreadyConfirmed).toBe(true)
    expect(resultat.data.confirmedAt).toBe(dejaLu)
    expect(prismaMock.artistNotificationConfirmation.update).not.toHaveBeenCalled()
  })

  it('refuse quelqu’un qui n’était pas destinataire', async () => {
    // L'autorisation repose sur la ligne créée à l'envoi, pas sur le statut d'artiste
    // au moment du clic : c'est elle qui atteste que la personne était visée.
    prismaMock.artistNotificationConfirmation.findFirst.mockResolvedValue(null)

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(prismaMock.artistNotificationConfirmation.update).not.toHaveBeenCalled()
  })

  it('refuse un envoi introuvable sur cette édition', async () => {
    prismaMock.artistNotificationGroup.findFirst.mockResolvedValue(null)

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(prismaMock.artistNotificationConfirmation.findFirst).not.toHaveBeenCalled()
  })
})
