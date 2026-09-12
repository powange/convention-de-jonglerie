import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())
const mockBroadcast = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

vi.mock('#server/utils/ticketing-counter-sse', () => ({
  broadcastCounterUpdate: mockBroadcast,
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/counters/[counterId]/reset.patch'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', counterId: '12' }, user: { id: 7, pseudo: 'orga' } },
}

/**
 * La remise à zéro d'un compteur est le seul geste de ce module réservé aux **gestionnaires**.
 * L'incrément et le décrément restent ouverts à qui détient le lien — c'est le principe du partage
 * par QR code, assumé et commenté dans le code. Mais effacer un décompte de soirée n'est pas du
 * même ordre qu'ajouter une entrée : c'est irréversible, et rien ne permet de retrouver la valeur.
 *
 * La route jumelle `counters/token/[token]/reset` a été supprimée en même temps que ce test a été
 * écrit. Sans cela, masquer le bouton dans l'écran n'aurait rien protégé : le lien suffisait à
 * appeler l'API. Ces assertions existent pour que la garde ne reparte pas avec une refonte.
 */
describe('PATCH /api/editions/[id]/ticketing/counters/[counterId]/reset', () => {
  const compteur = { id: 12, name: 'Gala', value: 147, editionId: 22 }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.ticketingCounter.findFirst.mockResolvedValue(compteur)
    prismaMock.ticketingCounter.update.mockResolvedValue({ ...compteur, value: 0 })
  })

  const appeler = () => handler(evenement as any)

  describe('qui a le droit de remettre à zéro', () => {
    it('refuse un compte sans droit sur la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(appeler()).rejects.toMatchObject({ statusCode: 403 })
    })

    it('ne touche pas au compteur pour un compte refusé', async () => {
      // L'ordre compte : lire puis refuser laisserait passer une écriture qu'on ne peut pas défaire.
      mockCanManage.mockResolvedValue(false)

      await expect(appeler()).rejects.toBeDefined()

      expect(prismaMock.ticketingCounter.findFirst).not.toHaveBeenCalled()
      expect(prismaMock.ticketingCounter.update).not.toHaveBeenCalled()
      expect(mockBroadcast).not.toHaveBeenCalled()
    })

    it('s’en remet à la garde de gestion de la billetterie', async () => {
      // L'assertion porte sur *quelle* garde : le module des permissions est mocké avec cette
      // seule fonction, donc un endpoint qui en appellerait une autre échouerait ici.
      await appeler()

      expect(mockCanManage).toHaveBeenCalledWith(22, 7, evenement)
      expect(mockCanManage).toHaveBeenCalledTimes(1)
    })
  })

  describe('ce qu’elle fait', () => {
    it('remet la valeur à zéro, et rien d’autre', async () => {
      await appeler()

      const ecrit = prismaMock.ticketingCounter.update.mock.calls[0][0]
      expect(ecrit.where).toEqual({ id: 12 })
      expect(ecrit.data).toEqual({ value: 0 })
    })

    it('reste cantonnée à l’édition de l’URL', async () => {
      // Sans `editionId`, l'identifiant d'un compteur d'une autre édition suffirait à l'effacer.
      await appeler()

      expect(prismaMock.ticketingCounter.findFirst.mock.calls[0][0].where).toEqual({
        id: 12,
        editionId: 22,
      })
    })

    it('répond 404 pour un compteur qui n’est pas de cette édition', async () => {
      prismaMock.ticketingCounter.findFirst.mockResolvedValue(null)

      await expect(appeler()).rejects.toMatchObject({ statusCode: 404 })
      expect(prismaMock.ticketingCounter.update).not.toHaveBeenCalled()
    })

    it('prévient les écrans connectés', async () => {
      // Les compteurs partagés s'affichent en temps réel : sans diffusion, un appareil resté
      // ouvert continuerait d'afficher l'ancien total et le ferait repartir de là.
      await appeler()

      expect(mockBroadcast).toHaveBeenCalledWith(22, 12, expect.objectContaining({ value: 0 }))
    })
  })
})
