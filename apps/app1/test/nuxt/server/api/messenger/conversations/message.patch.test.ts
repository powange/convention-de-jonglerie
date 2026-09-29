import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import messagePatchHandler from '../../../../../../server/api/messenger/conversations/[conversationId]/messages/[messageId].patch'
import { global } from '../../../../globales-nitro'
import type { H3Event } from 'h3'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1, pseudo: 'TestUser' })),
}))

/**
 * Modifier ou supprimer un message. Ce qui est protégé ici : le délai de 15 minutes (qu'on ne
 * contourne pas en appelant l'API), la suppression qui reste permise au-delà, et la citation que
 * la réponse doit porter — sans elle, l'écran perdait la citation d'une réponse modifiée.
 */
describe('API PATCH /messenger/conversations/[conversationId]/messages/[messageId]', () => {
  const maintenant = new Date('2026-09-29T10:00:00Z')
  const ilYA = (minutes: number) => new Date(maintenant.getTime() - minutes * 60 * 1000)

  const messageEnBase = (createdAt: Date) => ({
    id: 'msg-1',
    conversationId: 'conv-1',
    participantId: 'participant-1',
    content: 'Texte initial',
    replyToId: 'msg-0',
    createdAt,
    editedAt: null,
    deletedAt: null,
  })

  const messageRenvoye = (overrides: Record<string, unknown> = {}) => ({
    ...messageEnBase(ilYA(5)),
    participant: { id: 'participant-1', user: { id: 1, pseudo: 'TestUser' } },
    replyTo: {
      id: 'msg-0',
      content: 'Message cité',
      createdAt: ilYA(10),
      deletedAt: null,
      participant: { user: { id: 2, pseudo: 'Autre' } },
    },
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(maintenant)
    global.getRouterParam = vi.fn((_event: unknown, name: string) =>
      name === 'conversationId' ? 'conv-1' : 'msg-1'
    )
    global.readBody = vi.fn()
    /*
     * Les autres participants, à qui la modification est diffusée. Un `findMany` réel rend TOUJOURS
     * un tableau : un mock qui ne le simule pas rend `undefined`, et le handler tombe sur
     * `.length` — ce qui a été le cas en ajoutant la diffusion. Complété ici plutôt que de rendre
     * le handler tolérant à une valeur que Prisma ne produit jamais.
     */
    prismaMock.conversationParticipant.findMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('modifie un message récent, le marque modifié et renvoie sa citation', async () => {
    prismaMock.message.findFirst.mockResolvedValueOnce(messageEnBase(ilYA(5)))
    prismaMock.message.update.mockResolvedValueOnce(
      messageRenvoye({ content: 'Texte corrigé', editedAt: maintenant })
    )
    global.readBody.mockResolvedValue({ content: '  Texte corrigé \n' })

    const result = await messagePatchHandler({} as unknown as H3Event)

    expect(prismaMock.message.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { content: 'Texte corrigé', editedAt: maintenant },
      include: expect.objectContaining({
        participant: expect.any(Object),
        replyTo: expect.any(Object),
      }),
    })
    expect(result.data.replyTo).toEqual(expect.objectContaining({ content: 'Message cité' }))
    expect(result.data).not.toHaveProperty('participantId')
  })

  it('refuse la modification passé 15 minutes', async () => {
    prismaMock.message.findFirst.mockResolvedValueOnce(messageEnBase(ilYA(15)))
    global.readBody.mockResolvedValue({ content: 'Trop tard' })

    await expect(messagePatchHandler({} as unknown as H3Event)).rejects.toThrow(
      /15 minutes après son envoi/
    )
    expect(prismaMock.message.update).not.toHaveBeenCalled()
  })

  it('permet encore la suppression passé 15 minutes', async () => {
    prismaMock.message.findFirst.mockResolvedValueOnce(messageEnBase(ilYA(60)))
    prismaMock.message.update.mockResolvedValueOnce(messageRenvoye({ deletedAt: maintenant }))
    global.readBody.mockResolvedValue({ deleted: true })

    const result = await messagePatchHandler({} as unknown as H3Event)

    expect(prismaMock.message.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: maintenant } })
    )
    expect(result.data.content).toBe('Message supprimé')
  })

  it('refuse un contenu fait seulement de blancs', async () => {
    global.readBody.mockResolvedValue({ content: '   \n ' })

    await expect(messagePatchHandler({} as unknown as H3Event)).rejects.toThrow()
    expect(prismaMock.message.update).not.toHaveBeenCalled()
  })

  it("refuse de modifier le message de quelqu'un d'autre", async () => {
    // La recherche filtre sur l'auteur : le message d'un autre n'est pas trouvé.
    prismaMock.message.findFirst.mockResolvedValueOnce(null)
    global.readBody.mockResolvedValue({ content: 'Réécriture' })

    await expect(messagePatchHandler({} as unknown as H3Event)).rejects.toThrow(/non trouvé/)
    expect(prismaMock.message.findFirst).toHaveBeenCalledWith({
      where: { id: 'msg-1', conversationId: 'conv-1', participant: { userId: 1 } },
    })
  })
})
