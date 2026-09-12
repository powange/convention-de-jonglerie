import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanAcceder = vi.hoisted(() => vi.fn())
const mockGetSettings = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAcceder,
}))

vi.mock('#server/ticketing/ports/registry', () => ({
  useTicketingPorts: () => ({ event: { getSettings: mockGetSettings } }),
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/settings.get'

const evenement = {
  context: { params: { id: '22' }, user: { id: 7, pseudo: 'quelquun' } },
}

/**
 * Cet endpoint n'appelait **aucune** garde — pas même `requireAuth`. Il rend les moyens de paiement
 * acceptés, l'autorisation d'inscription sur place, celle des commandes anonymes et l'activation de
 * SumUp. Rien de secret n'en sort, et la route n'étant pas déclarée publique, le middleware exigeait
 * déjà une session ; mais un endpoint d'un module de paiement sans aucune autorisation vérifiée
 * laisse n'importe quel compte lire la configuration de n'importe quelle édition.
 *
 * La garde retenue est celle des lectures voisines (`tiers/index.get`, `options/index.get`), et pas
 * `canManageTicketing` : le second écran qui consomme ces réglages est le **contrôle d'accès**,
 * ouvert aux bénévoles en créneau actif. C'est lui qui décide s'il propose l'inscription sur place
 * et quels moyens de paiement il affiche.
 */
describe('GET /api/editions/[id]/ticketing/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAcceder.mockResolvedValue(true)
    mockGetSettings.mockResolvedValue({ paymentCash: false, sumupEnabled: true })
  })

  const appeler = () => handler(evenement as any)

  describe('qui a le droit de lire ces réglages', () => {
    it('refuse un compte sans droit sur cette édition', async () => {
      mockCanAcceder.mockResolvedValue(false)

      await expect(appeler()).rejects.toMatchObject({ statusCode: 403 })
    })

    it('ne lit pas les réglages avant d’avoir vérifié le droit', async () => {
      mockCanAcceder.mockResolvedValue(false)

      await expect(appeler()).rejects.toBeDefined()

      expect(mockGetSettings).not.toHaveBeenCalled()
    })

    it('s’en remet à la garde qui couvre aussi le contrôle d’accès', async () => {
      // L'assertion porte sur *quelle* garde, pas seulement sur le fait qu'il y en ait une : le
      // second écran qui lit ces réglages est le scanner de l'entrée, tenu par un bénévole en
      // créneau actif. Poser `canManageTicketing` le priverait de savoir s'il propose
      // l'inscription sur place et quels moyens de paiement afficher.
      //
      // Le module des permissions est mocké avec cette seule fonction : un endpoint qui en
      // appellerait une autre échouerait ici plutôt que de passer en silence.
      await expect(appeler()).resolves.toBeDefined()

      expect(mockCanAcceder).toHaveBeenCalledWith(22, 7, evenement)
      expect(mockCanAcceder).toHaveBeenCalledTimes(1)
    })
  })

  describe('ce qu’elle rend', () => {
    it('rend les réglages enregistrés', async () => {
      const reglages = await appeler()

      expect(reglages.paymentCash).toBe(false)
      expect(reglages.sumupEnabled).toBe(true)
    })

    it('comble les réglages absents par leur défaut', async () => {
      // Une édition jamais configurée n'a aucun de ces champs : sans défauts, l'écran de contrôle
      // d'accès n'afficherait plus aucun moyen de paiement.
      mockGetSettings.mockResolvedValue({})

      expect(await appeler()).toEqual({
        allowOnsiteRegistration: true,
        allowAnonymousOrders: false,
        paymentCash: true,
        paymentCard: true,
        paymentCheck: true,
        sumupEnabled: false,
        handoutItemsEnabled: true,
      })
    })

    it('répond 404 pour une édition inconnue', async () => {
      mockGetSettings.mockResolvedValue(null)

      await expect(appeler()).rejects.toMatchObject({ statusCode: 404 })
    })
  })
})
