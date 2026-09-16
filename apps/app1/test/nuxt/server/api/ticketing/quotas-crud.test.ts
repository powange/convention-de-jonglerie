import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

import deleteHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/quotas/[quotaId].delete'
import putHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/quotas/[quotaId].put'
import postHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/quotas/index.post'
import reorderHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/quotas/reorder.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Les quatre opérations de gestion d'un quota — créer, modifier, supprimer, réordonner.
 *
 * Elles n'avaient AUCUN test, alors que ce sont les plus employées du module : les associations
 * en avaient dix-huit et le calcul une trentaine. C'est ce déséquilibre qui a laissé passer deux
 * choses, toutes deux corrigées depuis et tenues ici :
 *
 * - un piège de Zod 4 avait transformé un message de validation en 500, parce que `error.errors`
 *   n'existe plus et qu'on lisait `undefined[0]` ;
 * - `reorder` répondait 500 à une tentative d'écrire sur le quota d'une autre édition, faute de
 *   garde explicite — l'erreur Prisma était happée par un `catch` générique.
 */
describe('quotas — les quatre opérations de gestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    // Par défaut, les quotas demandés appartiennent bien à l'édition.
    prismaMock.ticketingQuota.findMany.mockImplementation(async ({ where }: any) =>
      where.id.in.map((id: number) => ({ id }))
    )
  })

  describe('création', () => {
    const envoyer = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return postHandler({
        context: { params: { id: '22' }, user: { id: 1, pseudo: 'orga' } },
      } as any)
    }

    it('crée le quota sur l’édition de la route', async () => {
      prismaMock.ticketingQuota.create.mockResolvedValue({ id: 5 })

      const result: any = await envoyer({ title: 'Gala', quantity: 260, description: null })

      expect(result.success).toBe(true)
      expect(prismaMock.ticketingQuota.create.mock.calls[0][0].data).toMatchObject({
        editionId: 22,
        title: 'Gala',
        quantity: 260,
      })
    })

    it('refuse un titre vide, et le DIT', async () => {
      // Le message compte autant que le refus : c'est lui qui apprend quoi corriger. Un piège de
      // Zod 4 l'avait déjà transformé en 500 une fois.
      await expect(envoyer({ title: '', quantity: 10 })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Le titre est obligatoire',
      })
    })

    it('refuse une quantité nulle ou négative', async () => {
      await expect(envoyer({ title: 'Gala', quantity: 0 })).rejects.toMatchObject({
        statusCode: 400,
        message: 'La quantité doit être un nombre positif',
      })
      await expect(envoyer({ title: 'Gala', quantity: -3 })).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer({ title: 'Gala', quantity: 10 })).rejects.toMatchObject({
        statusCode: 403,
      })
      expect(prismaMock.ticketingQuota.create).not.toHaveBeenCalled()
    })
  })

  describe('modification', () => {
    const evenement = {
      context: { params: { id: '22', quotaId: '5' }, user: { id: 1, pseudo: 'orga' } },
    }

    const envoyer = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return putHandler(evenement as any)
    }

    beforeEach(() => {
      prismaMock.ticketingQuota.update.mockResolvedValue({ id: 5 })
    })

    it('modifie le quota', async () => {
      const result: any = await envoyer({ title: 'Gala 2026', quantity: 300 })

      expect(result.success).toBe(true)
      expect(prismaMock.ticketingQuota.update.mock.calls[0][0].data).toMatchObject({
        title: 'Gala 2026',
        quantity: 300,
      })
    })

    it('refuse un quota d’une autre édition, sans rien écrire', async () => {
      prismaMock.ticketingQuota.findMany.mockResolvedValue([])

      await expect(envoyer({ title: 'Gala', quantity: 10 })).rejects.toMatchObject({
        statusCode: 400,
      })
      expect(prismaMock.ticketingQuota.update).not.toHaveBeenCalled()
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer({ title: 'Gala', quantity: 10 })).rejects.toMatchObject({
        statusCode: 403,
      })
    })
  })

  describe('suppression', () => {
    const evenement = {
      context: { params: { id: '22', quotaId: '5' }, user: { id: 1, pseudo: 'orga' } },
    }

    beforeEach(() => {
      prismaMock.ticketingQuota.delete.mockResolvedValue({ id: 5 })
    })

    it('supprime le quota', async () => {
      const result: any = await deleteHandler(evenement as any)

      expect(result.success).toBe(true)
      expect(prismaMock.ticketingQuota.delete).toHaveBeenCalledWith({ where: { id: 5 } })
    })

    it('refuse un quota d’une autre édition, sans rien supprimer', async () => {
      prismaMock.ticketingQuota.findMany.mockResolvedValue([])

      await expect(deleteHandler(evenement as any)).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.ticketingQuota.delete).not.toHaveBeenCalled()
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(deleteHandler(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('réordonnancement', () => {
    const envoyer = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return reorderHandler({
        context: { params: { id: '22' }, user: { id: 1, pseudo: 'orga' } },
      } as any)
    }

    beforeEach(() => {
      prismaMock.$transaction.mockResolvedValue([])
      prismaMock.ticketingQuota.update.mockReturnValue({})
    })

    it('écrit les nouvelles positions', async () => {
      const result: any = await envoyer({
        positions: [
          { id: 5, position: 0 },
          { id: 6, position: 1 },
        ],
      })

      expect(result.success).toBe(true)
      expect(prismaMock.$transaction).toHaveBeenCalled()
    })

    /**
     * Le constat B7 : un quota étranger produisait un 500, parce que l'erreur Prisma levée par
     * l'`update` sans correspondance était happée par le `catch` générique. Une tentative
     * d'écriture croisée se présentait donc comme une panne du serveur.
     */
    it('refuse un quota d’une autre édition par un 400, non par un 500', async () => {
      prismaMock.ticketingQuota.findMany.mockResolvedValue([{ id: 5 }])

      await expect(
        envoyer({
          positions: [
            { id: 5, position: 0 },
            { id: 999, position: 1 },
          ],
        })
      ).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer({ positions: [] })).rejects.toMatchObject({ statusCode: 403 })
    })
  })
})
