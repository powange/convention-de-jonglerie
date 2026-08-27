import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/messenger/show-group.post'

const prismaMock = (globalThis as any).prisma

const ensureShowGroupConversation = vi.hoisted(() => vi.fn())
const canManageArtistsById = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/messenger-helpers', () => ({ ensureShowGroupConversation }))
vi.mock('#server/utils/permissions/edition-permissions', () => ({ canManageArtistsById }))

const g = global as any

describe('/api/messenger/show-group POST', () => {
  const evenement = { context: { user: { id: 9 } } }

  const corps = (body: unknown) => {
    g.readBody = vi.fn().mockResolvedValue(body)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    g.requireAuth = vi.fn().mockReturnValue({ id: 9 })
    canManageArtistsById.mockResolvedValue(true)
    ensureShowGroupConversation.mockResolvedValue('conv-1')
    prismaMock.show.findUnique.mockResolvedValue({ editionId: 7, _count: { artists: 2 } })
    corps({ showId: 42 })
  })

  it('ouvre le groupe et rend son identifiant', async () => {
    const resultat = await handler(evenement as any)

    expect(resultat.data.conversationId).toBe('conv-1')
    expect(ensureShowGroupConversation).toHaveBeenCalledWith(42)
  })

  it('refuse une requête sans identifiant de spectacle', async () => {
    corps({})

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(ensureShowGroupConversation).not.toHaveBeenCalled()
  })

  it('refuse un identifiant qui n’en est pas un', async () => {
    corps({ showId: 'quarante-deux' })

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(prismaMock.show.findUnique).not.toHaveBeenCalled()
  })

  it('refuse un spectacle introuvable', async () => {
    prismaMock.show.findUnique.mockResolvedValue(null)

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(ensureShowGroupConversation).not.toHaveBeenCalled()
  })

  it('refuse un organisateur sans droits sur les artistes', async () => {
    // Le droit se vérifie sur l'édition du spectacle, pas sur une valeur fournie par l'appelant
    canManageArtistsById.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(canManageArtistsById).toHaveBeenCalledWith(7, 9, evenement)
    expect(ensureShowGroupConversation).not.toHaveBeenCalled()
  })

  it('refuse un spectacle sans distribution', async () => {
    // Ouvrir le groupe laisserait l'organisateur seul face à lui-même
    prismaMock.show.findUnique.mockResolvedValue({ editionId: 7, _count: { artists: 0 } })

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(ensureShowGroupConversation).not.toHaveBeenCalled()
  })
})
