import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/feedback/mine.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const utilisateur = { id: 7, email: 'jongleur@test.com', pseudo: 'jongleur' }

const retourEnBase = {
  id: 1,
  type: 'BUG',
  subject: 'Le calendrier déborde sur mobile',
  message: 'Sur iOS, les cases du calendrier sortent de l écran en mode paysage.',
  url: 'https://juggling-convention.com/editions/6',
  status: 'IN_PROGRESS',
  adminReply: "C'est reproduit, un correctif est prévu.",
  repliedAt: new Date('2026-08-15T10:00:00Z'),
  createdAt: new Date('2026-08-12T09:00:00Z'),
  updatedAt: new Date('2026-08-15T10:00:00Z'),
}

describe('/api/feedback/mine GET', () => {
  beforeEach(() => {
    prismaMock.feedback.findMany.mockReset()
    prismaMock.feedback.findMany.mockResolvedValue([retourEnBase])
  })

  it("retourne les retours de l'utilisateur connecté", async () => {
    const result = await handler({ context: { user: utilisateur } } as any)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].subject).toBe('Le calendrier déborde sur mobile')
  })

  it('ne remonte que les retours rattachés à ce compte', async () => {
    await handler({ context: { user: utilisateur } } as any)

    expect(prismaMock.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7 } })
    )
  })

  it("n'expose jamais les notes internes de l'équipe", async () => {
    await handler({ context: { user: utilisateur } } as any)

    const { select } = prismaMock.feedback.findMany.mock.calls[0][0]
    // La sélection est explicite : `adminNotes` ne doit y figurer sous aucune forme,
    // et la réponse destinée à l'auteur, elle, doit bien y être.
    expect(select.adminNotes).toBeUndefined()
    expect(select.adminReply).toBe(true)
    expect(select.status).toBe(true)
  })

  it('refuse un visiteur non connecté', async () => {
    await expect(handler({ context: {} } as any)).rejects.toMatchObject({ statusCode: 401 })

    expect(prismaMock.feedback.findMany).not.toHaveBeenCalled()
  })

  it('présente les retours du plus récent au plus ancien', async () => {
    await handler({ context: { user: utilisateur } } as any)

    expect(prismaMock.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    )
  })
})
