import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireAdmin = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

import handler from '../../../../../server/api/admin/feedback/[id]/resolve.put'

const prismaMock = (globalThis as any).prisma

const existant = {
  id: 3,
  subject: 'Le calendrier déborde sur mobile',
  status: 'NEW',
  adminNotes: null,
  adminReply: null,
  repliedAt: null,
}

const evenement = { context: { params: { id: '3' } } }

/** Données transmises à `prisma.feedback.update` lors du dernier appel */
const donneesEcrites = () => prismaMock.feedback.update.mock.calls[0][0].data

describe('/api/admin/feedback/[id]/resolve PUT', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.feedback.findUnique.mockReset()
    prismaMock.feedback.update.mockReset()
    prismaMock.feedback.findUnique.mockResolvedValue(existant)
    prismaMock.feedback.update.mockResolvedValue({ ...existant, status: 'IN_PROGRESS' })
  })

  const enregistrer = (body: Record<string, unknown>) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return handler(evenement as any)
  }

  it('enregistre le statut choisi', async () => {
    await enregistrer({ status: 'IN_PROGRESS' })

    expect(donneesEcrites().status).toBe('IN_PROGRESS')
  })

  it('refuse un statut inconnu', async () => {
    await expect(enregistrer({ status: 'PENDING' })).rejects.toBeDefined()

    expect(prismaMock.feedback.update).not.toHaveBeenCalled()
  })

  it('date la réponse lorsqu’elle est écrite pour la première fois', async () => {
    await enregistrer({ status: 'RESOLVED', adminReply: 'Corrigé dans la dernière version.' })

    const data = donneesEcrites()
    expect(data.adminReply).toBe('Corrigé dans la dernière version.')
    expect(data.repliedAt).toBeInstanceOf(Date)
  })

  it('ne redate pas une réponse inchangée', async () => {
    const dejaRepondu = new Date('2026-08-15T10:00:00Z')
    prismaMock.feedback.findUnique.mockResolvedValue({
      ...existant,
      adminReply: 'Déjà répondu.',
      repliedAt: dejaRepondu,
    })

    // Seul le statut bouge : la date affichée à l'auteur ne doit pas sauter à aujourd'hui
    await enregistrer({ status: 'RESOLVED', adminReply: 'Déjà répondu.' })

    expect(donneesEcrites()).not.toHaveProperty('repliedAt')
  })

  it('efface la réponse et sa date quand le texte est vidé', async () => {
    prismaMock.feedback.findUnique.mockResolvedValue({
      ...existant,
      adminReply: 'Réponse à retirer.',
      repliedAt: new Date('2026-08-15T10:00:00Z'),
    })

    await enregistrer({ status: 'IN_PROGRESS', adminReply: '   ' })

    const data = donneesEcrites()
    expect(data.adminReply).toBeNull()
    expect(data.repliedAt).toBeNull()
  })

  it("n'accepte pas un appel sans droits d'administration", async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Forbidden'))

    await expect(enregistrer({ status: 'RESOLVED' })).rejects.toBeDefined()

    expect(prismaMock.feedback.update).not.toHaveBeenCalled()
  })
})
