import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

import champHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/custom-fields/[customFieldId]/quotas.put'
import optionHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/options/[optionId]/quotas.put'
import tarifHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/tiers/[tierId]/quotas.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Les trois endpoints qui associent des quotas — aux tarifs, aux options, aux champs
 * personnalisés.
 *
 * Ils existent parce que les endpoints génériques réécrivent sans condition des relations qu'on
 * ne leur envoie pas : le PUT d'un tarif remet ses repas, celui d'une option aussi, et
 * `/associations` efface les tarifs d'un champ. N'y faire passer que les quotas aurait détruit
 * tout le reste, silencieusement.
 *
 * C'est donc la SEULE voie d'écriture des quotas, et ce qu'elle garantit mérite d'être tenu ici
 * plutôt qu'au seul niveau du parcours de bout en bout : droits, appartenance à l'édition,
 * remplacement complet, et dédoublonnage.
 */
describe('association des quotas — les trois cibles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
    // Par défaut, tous les quotas demandés appartiennent bien à l'édition.
    prismaMock.ticketingQuota.count.mockImplementation(async ({ where }: any) => where.id.in.length)
  })

  describe('tarifs', () => {
    const evenement = {
      context: { params: { id: '22', tierId: '88' }, user: { id: 1, pseudo: 'orga' } },
    }

    beforeEach(() => {
      prismaMock.ticketingTier.findFirst.mockResolvedValue({ id: 88 })
      prismaMock.ticketingTierQuota.deleteMany.mockResolvedValue({ count: 0 })
      prismaMock.ticketingTierQuota.createMany.mockResolvedValue({ count: 2 })
    })

    const envoyer = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return tarifHandler(evenement as any)
    }

    it('remplace l’ensemble des associations', async () => {
      const result: any = await envoyer({ quotaIds: [5, 6] })

      expect(result.success).toBe(true)
      // La suppression précède la création : c'est ce qui fait du PUT un remplacement.
      expect(prismaMock.ticketingTierQuota.deleteMany).toHaveBeenCalledWith({
        where: { tierId: 88 },
      })
      expect(prismaMock.ticketingTierQuota.createMany.mock.calls[0][0].data).toEqual([
        { tierId: 88, quotaId: 5 },
        { tierId: 88, quotaId: 6 },
      ])
    })

    it('vide les associations quand on n’envoie rien', async () => {
      await envoyer({ quotaIds: [] })

      expect(prismaMock.ticketingTierQuota.deleteMany).toHaveBeenCalled()
      expect(prismaMock.ticketingTierQuota.createMany).not.toHaveBeenCalled()
    })

    it('dédoublonne : l’unicité en base porte sur le couple (tarif, quota)', async () => {
      await envoyer({ quotaIds: [5, 5, 6] })

      expect(prismaMock.ticketingTierQuota.createMany.mock.calls[0][0].data).toEqual([
        { tierId: 88, quotaId: 5 },
        { tierId: 88, quotaId: 6 },
      ])
    })

    it('refuse un quota d’une autre édition, sans rien écrire', async () => {
      prismaMock.ticketingQuota.count.mockResolvedValue(1) // un seul des deux appartient à l'édition

      await expect(envoyer({ quotaIds: [5, 999] })).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.ticketingTierQuota.deleteMany).not.toHaveBeenCalled()
    })

    it('refuse un tarif d’une autre édition', async () => {
      prismaMock.ticketingTier.findFirst.mockResolvedValue(null)

      await expect(envoyer({ quotaIds: [5] })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer({ quotaIds: [5] })).rejects.toMatchObject({ statusCode: 403 })
      expect(prismaMock.ticketingTier.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('options', () => {
    const evenement = {
      context: { params: { id: '22', optionId: '77' }, user: { id: 1, pseudo: 'orga' } },
    }

    beforeEach(() => {
      prismaMock.ticketingOption.findFirst.mockResolvedValue({ id: 77 })
      prismaMock.ticketingOptionQuota.deleteMany.mockResolvedValue({ count: 0 })
      prismaMock.ticketingOptionQuota.createMany.mockResolvedValue({ count: 1 })
    })

    const envoyer = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return optionHandler(evenement as any)
    }

    it('remplace l’ensemble des associations', async () => {
      const result: any = await envoyer({ quotaIds: [9] })

      expect(result.success).toBe(true)
      expect(prismaMock.ticketingOptionQuota.createMany.mock.calls[0][0].data).toEqual([
        { optionId: 77, quotaId: 9 },
      ])
    })

    it('refuse une option d’une autre édition', async () => {
      prismaMock.ticketingOption.findFirst.mockResolvedValue(null)

      await expect(envoyer({ quotaIds: [9] })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer({ quotaIds: [9] })).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('champs personnalisés', () => {
    const evenement = {
      context: { params: { id: '22', customFieldId: '42' }, user: { id: 1, pseudo: 'orga' } },
    }

    beforeEach(() => {
      prismaMock.ticketingTierCustomField.findFirst.mockResolvedValue({ id: 42 })
      prismaMock.ticketingTierCustomFieldQuota.deleteMany.mockResolvedValue({ count: 0 })
      prismaMock.ticketingTierCustomFieldQuota.createMany.mockResolvedValue({ count: 2 })
    })

    const envoyer = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return champHandler(evenement as any)
    }

    /**
     * Le cas qui distingue les champs personnalisés des deux autres cibles : l'unicité porte sur
     * le TRIPLET (champ, quota, choix). Le même quota peut donc viser deux réponses, et
     * dédoublonner sur le seul quota en perdrait une.
     */
    it('garde le même quota sur deux réponses différentes', async () => {
      await envoyer({
        quotas: [
          { quotaId: 3, choiceValue: 'S' },
          { quotaId: 3, choiceValue: 'M' },
        ],
      })

      expect(prismaMock.ticketingTierCustomFieldQuota.createMany.mock.calls[0][0].data).toEqual([
        { customFieldId: 42, quotaId: 3, choiceValue: 'S' },
        { customFieldId: 42, quotaId: 3, choiceValue: 'M' },
      ])
    })

    it('dédoublonne le couple (quota, choix) répété', async () => {
      await envoyer({
        quotas: [
          { quotaId: 3, choiceValue: 'S' },
          { quotaId: 3, choiceValue: 'S' },
        ],
      })

      expect(prismaMock.ticketingTierCustomFieldQuota.createMany.mock.calls[0][0].data).toEqual([
        { customFieldId: 42, quotaId: 3, choiceValue: 'S' },
      ])
    })

    it('écrit `null` pour une association valable quelle que soit la réponse', async () => {
      // `null` et « pas de clé » doivent aboutir au même état : le choix absent n'est pas une
      // réponse vide, c'est l'absence de condition.
      await envoyer({ quotas: [{ quotaId: 3 }] })

      expect(prismaMock.ticketingTierCustomFieldQuota.createMany.mock.calls[0][0].data).toEqual([
        { customFieldId: 42, quotaId: 3, choiceValue: null },
      ])
    })

    it('refuse un champ d’une autre édition', async () => {
      prismaMock.ticketingTierCustomField.findFirst.mockResolvedValue(null)

      await expect(envoyer({ quotas: [{ quotaId: 3 }] })).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer({ quotas: [{ quotaId: 3 }] })).rejects.toMatchObject({
        statusCode: 403,
      })
    })
  })
})
