import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/counters/[counterId]/regenerate-token.patch'

const prismaMock = (globalThis as any).prisma

const evenementAvec = (counterId: string) => ({
  context: { params: { id: '22', counterId }, user: { id: 7, pseudo: 'orga' } },
})

/**
 * Cet endpoint désigne le compteur par son **jeton**, alors que les six autres de
 * `counters/[counterId]` le désignent par son identifiant. C'est l'incohérence P2 de l'audit, et
 * elle est assumée : la corriger (#385) a cassé la production.
 *
 * L'écran du compteur est adressé par jeton — c'est tout ce que portent son URL et son QR code. Le
 * faire appeler par identifiant rendait l'API incompatible avec tout client encore sur le bundle
 * précédent, et un écran laissé ouvert à une entrée de convention est exactement ce cas. Le
 * déploiement a aggravé la chose en continuant de servir la page supprimée par #385, qui appelait
 * donc toujours avec un jeton.
 *
 * Ces tests pinnent la résolution par jeton pour qu'un retour de P2 soit un choix conscient, pas
 * une régression silencieuse.
 */
describe('PATCH /api/editions/[id]/ticketing/counters/[counterId]/regenerate-token', () => {
  const compteur = { id: 88, name: 'Entrée principale', token: 'ancien-jeton', editionId: 22 }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.ticketingCounter.findFirst.mockResolvedValue(compteur)
    prismaMock.ticketingCounter.update.mockImplementation(async ({ data }: any) => ({
      ...compteur,
      ...data,
    }))
  })

  const clauseRecherchee = () => prismaMock.ticketingCounter.findFirst.mock.calls[0][0].where

  describe('ce que le segment désigne', () => {
    it('cherche le compteur par son jeton', async () => {
      await handler(evenementAvec('ancien-jeton') as any)

      expect(clauseRecherchee()).toEqual({ token: 'ancien-jeton', editionId: 22 })
      expect(clauseRecherchee()).not.toHaveProperty('id')
    })

    it('accepte un jeton non numérique', async () => {
      // Les jetons sont des cuid à la création (`@default(cuid())`) et des UUID après
      // régénération. Les contraindre à un entier — ce qu'a fait #385 — refuse tout jeton réel :
      // c'est exactement la panne qu'a subie la production.
      for (const jeton of ['cmt7fitrc000701pety4i61nm', crypto.randomUUID()]) {
        vi.clearAllMocks()
        prismaMock.ticketingCounter.findFirst.mockResolvedValue(compteur)
        prismaMock.ticketingCounter.update.mockResolvedValue(compteur)

        await expect(handler(evenementAvec(jeton) as any)).resolves.toBeDefined()
        expect(clauseRecherchee().token).toBe(jeton)
      }
    })

    it('reste cantonné à l’édition de l’URL', async () => {
      // Sans `editionId`, le jeton d'un compteur d'une autre édition suffirait à le régénérer —
      // et à couper l'appareil qui l'utilise.
      await handler(evenementAvec('ancien-jeton') as any)

      expect(clauseRecherchee().editionId).toBe(22)
    })

    it('répond 404 pour un compteur qui n’est pas de cette édition', async () => {
      prismaMock.ticketingCounter.findFirst.mockResolvedValue(null)

      await expect(handler(evenementAvec('ancien-jeton') as any)).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe('qui a le droit de régénérer', () => {
    it('refuse un compte sans droit sur la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(handler(evenementAvec('ancien-jeton') as any)).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('ne cherche pas le compteur avant d’avoir vérifié le droit', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(handler(evenementAvec('ancien-jeton') as any)).rejects.toBeDefined()

      expect(prismaMock.ticketingCounter.findFirst).not.toHaveBeenCalled()
      expect(prismaMock.ticketingCounter.update).not.toHaveBeenCalled()
    })
  })

  describe('ce qu’elle écrit', () => {
    it('remplace le jeton par un autre, et rend le nouveau', async () => {
      const reponse: any = await handler(evenementAvec('ancien-jeton') as any)

      const ecrit = prismaMock.ticketingCounter.update.mock.calls[0][0]
      expect(ecrit.where).toEqual({ id: 88 })
      expect(ecrit.data.token).not.toBe(compteur.token)
      expect(reponse.data.token).toBe(ecrit.data.token)
    })
  })
})
