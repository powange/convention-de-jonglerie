import { describe, it, expect, beforeEach, vi } from 'vitest'

import { deleteTier } from '../../../../server/utils/editions/ticketing/tiers'

const prismaMock = (globalThis as any).prisma

/**
 * Supprimer un tarif, et ce que cela ferait aux billets déjà vendus.
 *
 * `TicketingOrderItem.tierId` est en `ON DELETE SET NULL` — la SEULE des six clés étrangères qui
 * pointent vers `TicketingTier`, les cinq autres étant en `CASCADE`. Supprimer un tarif ne
 * supprimait donc pas ses billets : il les DÉTACHAIT, en silence. Or c'est le tarif qui porte ce qui
 * fait le sens d'un billet — ses quotas, ses articles à remettre, ses repas, ses champs
 * personnalisés et son `countAsParticipant`. Le billet subsistait, vidé.
 *
 * Douze billets de la base portent cette trace, tous de la marchandise sur une même édition, dont
 * les tarifs ont vraisemblablement été supprimés une fois la vente close.
 *
 * Refusé côté application plutôt qu'en passant la clé en `RESTRICT` : la synchronisation HelloAsso
 * fait la même suppression à l'intérieur d'une transaction, où une erreur de la base ferait échouer
 * la synchronisation entière. Ce fichier n'avait aucun test — seul le `deleteTier` du CLIENT en
 * avait un, ce qui est un homonyme.
 */
describe('deleteTier — un tarif vendu ne se supprime pas', () => {
  const TARIF_MANUEL = { id: 5, editionId: 42, name: 'Pass week-end', helloAssoTierId: null }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.ticketingTier.findFirst.mockResolvedValue(TARIF_MANUEL)
    prismaMock.ticketingOrderItem.count.mockResolvedValue(0)
    prismaMock.ticketingTier.delete.mockResolvedValue(TARIF_MANUEL)
  })

  it('refuse quand des billets l’utilisent, en les comptant', async () => {
    prismaMock.ticketingOrderItem.count.mockResolvedValue(12)

    await expect(deleteTier(5, 42)).rejects.toThrow(/12 billet/)
    expect(prismaMock.ticketingTier.delete).not.toHaveBeenCalled()
  })

  it('dit ce que la suppression ferait perdre', async () => {
    // Le message est lu par un organisateur : « impossible » sans raison le pousse à contourner.
    prismaMock.ticketingOrderItem.count.mockResolvedValue(3)

    await expect(deleteTier(5, 42)).rejects.toThrow(/quotas|repas|articles/)
  })

  it('supprime un tarif que personne n’a acheté', async () => {
    // La contrepartie : sans elle, la garde pourrait tout bloquer et le test précédent passerait
    // encore. Un tarif créé par erreur doit rester supprimable.
    const resultat = await deleteTier(5, 42)

    expect(prismaMock.ticketingTier.delete).toHaveBeenCalledWith({ where: { id: 5 } })
    expect(resultat.success).toBe(true)
  })

  it('compte les billets de CE tarif, et d’aucun autre', async () => {
    await deleteTier(5, 42)

    expect(prismaMock.ticketingOrderItem.count).toHaveBeenCalledWith({ where: { tierId: 5 } })
  })

  it('refuse toujours un tarif synchronisé depuis HelloAsso', async () => {
    // La garde qui existait déjà : on ne l'a pas remplacée, et elle passe AVANT le comptage — un
    // tarif HelloAsso n'est pas supprimable ici, qu'il ait été vendu ou non.
    prismaMock.ticketingTier.findFirst.mockResolvedValue({ ...TARIF_MANUEL, helloAssoTierId: 100 })

    await expect(deleteTier(5, 42)).rejects.toThrow(/HelloAsso/)
    expect(prismaMock.ticketingOrderItem.count).not.toHaveBeenCalled()
  })

  it('refuse un tarif qui n’appartient pas à l’édition', async () => {
    prismaMock.ticketingTier.findFirst.mockResolvedValue(null)

    await expect(deleteTier(5, 42)).rejects.toThrow(/introuvable/)
  })
})
