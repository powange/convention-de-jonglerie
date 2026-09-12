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
 * Sous `counters/[counterId]`, six endpoints résolvent le compteur par son **identifiant**. Celui-ci
 * cherchait par **jeton**, dans une variable pourtant nommée `counterId`. Ça marchait — l'écran
 * l'appelait bien avec un jeton — mais rien dans la route ne le disait, et le prochain endpoint
 * ajouté là aurait eu une chance sur deux de se tromper, avec un 404 pour tout symptôme.
 *
 * La règle est désormais sans exception : `[counterId]` est un identifiant, `token/[token]` est un
 * jeton. Ce fichier de test existe pour qu'elle le reste.
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
    it('cherche le compteur par son identifiant, pas par son jeton', async () => {
      await handler(evenementAvec('88') as any)

      expect(clauseRecherchee()).toEqual({ id: 88, editionId: 22 })
      expect(clauseRecherchee()).not.toHaveProperty('token')
    })

    it('refuse un jeton là où un identifiant est attendu', async () => {
      // C'est le sens qui compte : avant, cette valeur était *la* clé de recherche. Elle doit
      // maintenant être rejetée avant toute requête, et non chercher un compteur inexistant.
      await expect(handler(evenementAvec('ancien-jeton') as any)).rejects.toMatchObject({
        statusCode: 400,
      })

      expect(prismaMock.ticketingCounter.findFirst).not.toHaveBeenCalled()
    })

    it('reste cantonné à l’édition de l’URL', async () => {
      // Sans `editionId`, l'identifiant d'un compteur d'une autre édition suffirait à en
      // régénérer le jeton — et à couper l'appareil qui l'utilise.
      await handler(evenementAvec('88') as any)

      expect(clauseRecherchee().editionId).toBe(22)
    })

    it('répond 404 pour un compteur qui n’est pas de cette édition', async () => {
      prismaMock.ticketingCounter.findFirst.mockResolvedValue(null)

      await expect(handler(evenementAvec('88') as any)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('qui a le droit de régénérer', () => {
    it('refuse un compte sans droit sur la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(handler(evenementAvec('88') as any)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('ne cherche pas le compteur avant d’avoir vérifié le droit', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(handler(evenementAvec('88') as any)).rejects.toBeDefined()

      expect(prismaMock.ticketingCounter.findFirst).not.toHaveBeenCalled()
      expect(prismaMock.ticketingCounter.update).not.toHaveBeenCalled()
    })
  })

  describe('ce qu’elle écrit', () => {
    it('remplace le jeton par un autre, et rend le nouveau', async () => {
      const reponse: any = await handler(evenementAvec('88') as any)

      const ecrit = prismaMock.ticketingCounter.update.mock.calls[0][0]
      expect(ecrit.where).toEqual({ id: 88 })
      expect(ecrit.data.token).not.toBe(compteur.token)
      expect(reponse.data.token).toBe(ecrit.data.token)
    })
  })
})
