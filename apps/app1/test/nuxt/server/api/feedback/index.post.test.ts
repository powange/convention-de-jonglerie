import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/feedback/index.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const utilisateur = { id: 7, email: 'jongleur@test.com', pseudo: 'jongleur' }

const retourValide = {
  type: 'general',
  subject: 'Un sujet assez long',
  message: 'Un message qui dépasse largement les vingt caractères exigés par le schéma.',
}

describe('/api/feedback POST', () => {
  beforeEach(() => {
    prismaMock.feedback.create.mockReset()
    prismaMock.feedback.create.mockResolvedValue({ id: 42 })
    global.getHeader = vi.fn()
  })

  const envoyer = (body: Record<string, unknown>) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return handler({ context: { user: utilisateur } } as any)
  }

  it('accepte une URL absolue comme page concernée', async () => {
    const result = await envoyer({
      ...retourValide,
      url: 'https://juggling-convention.com/editions/38',
    })

    expect(result.success).toBe(true)
    expect(prismaMock.feedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ url: 'https://juggling-convention.com/editions/38' }),
      })
    )
  })

  it('refuse un chemin relatif : le formulaire doit le compléter avant envoi', async () => {
    // La page de retour reçoit la page d'origine en relatif (`?from=/editions/38`) et la
    // complète avec l'origine du site ; sans cela, l'envoi échouait en 400.
    await expect(envoyer({ ...retourValide, url: '/editions/38' })).rejects.toBeDefined()

    expect(prismaMock.feedback.create).not.toHaveBeenCalled()
  })

  it('accepte une page concernée vide', async () => {
    const result = await envoyer({ ...retourValide, url: '' })

    expect(result.success).toBe(true)
  })

  it('crée le retour rattaché au compte, sans nom ni email saisis', async () => {
    await envoyer({ ...retourValide, url: 'https://juggling-convention.com/' })

    expect(prismaMock.feedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 7, name: null, email: null, type: 'GENERAL' }),
      })
    )
  })
})
