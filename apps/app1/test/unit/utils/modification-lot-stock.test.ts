import { describe, expect, it } from 'vitest'

import { changementsEnLot } from '../../../server/utils/modification-lot-stock'

/**
 * Modifier vingt objets d'un coup ne se relit pas objet par objet : ce qui part est ce qui reste.
 * La nuance qui compte est celle entre « ne pas y toucher » (champ absent) et « vider » (`null`),
 * qu'un formulaire ordinaire ne sait pas exprimer et que l'écran confie à une case à cocher.
 */
describe('changementsEnLot', () => {
  it("n'écrit rien pour une demande vide", () => {
    const { communs, emprunt } = changementsEnLot({})

    expect(communs).toEqual({})
    expect(emprunt).toEqual({})
  })

  it('ne touche que le groupe quand on ne demande que le groupe', () => {
    // C'est le déplacement par lot : l'emplacement des objets ne doit pas y passer.
    const { communs } = changementsEnLot({ stockGroupId: 7 })

    expect(communs).toEqual({ stockGroupId: 7 })
  })

  it('distingue le champ vidé du champ absent', () => {
    expect(changementsEnLot({ location: null }).communs).toEqual({ location: null })
    expect(changementsEnLot({}).communs).not.toHaveProperty('location')
  })

  it('traite un texte vide comme un effacement', () => {
    // Le champ coché mais laissé vide : l'écran promet que cela efface.
    expect(changementsEnLot({ location: '' }).communs).toEqual({ location: null })
    expect(changementsEnLot({ ownerContact: '' }).emprunt).toEqual({ ownerContact: null })
  })

  it('efface le marqueur quand on pose une zone', () => {
    // Les deux désignent le même emplacement sur la carte : les garder ensemble laisserait un objet
    // dont rien ne dit où il est rangé.
    expect(changementsEnLot({ zoneId: 3 }).communs).toEqual({ zoneId: 3, markerId: null })
  })

  it('efface la zone quand on pose un marqueur', () => {
    expect(changementsEnLot({ markerId: 9 }).communs).toEqual({ zoneId: null, markerId: 9 })
  })

  it('efface les deux quand on retire le repère de carte', () => {
    expect(changementsEnLot({ zoneId: null }).communs).toEqual({ zoneId: null, markerId: null })
  })

  it('laisse le repère de carte tranquille quand seul le texte libre change', () => {
    const { communs } = changementsEnLot({ location: 'Étagère du fond' })

    expect(communs).toEqual({ location: 'Étagère du fond' })
    expect(communs).not.toHaveProperty('zoneId')
    expect(communs).not.toHaveProperty('markerId')
  })

  it("met les champs d'emprunt à part", () => {
    // Ils ne s'appliqueront qu'au matériel prêté : mélangés aux autres, ils rempliraient des fiches
    // qui n'affichent pas ce bloc.
    const { communs, emprunt } = changementsEnLot({
      location: 'Local technique',
      pickupLocation: 'Chez Marie',
      returnContact: '06 00 00 00 00',
    })

    expect(communs).toEqual({ location: 'Local technique' })
    expect(emprunt).toEqual({ pickupLocation: 'Chez Marie', returnContact: '06 00 00 00 00' })
  })

  it('convertit la date de retour en date', () => {
    const { emprunt } = changementsEnLot({ returnDueAt: '2026-10-05T18:00:00.000Z' })

    expect(emprunt.returnDueAt).toBeInstanceOf(Date)
    expect((emprunt.returnDueAt as Date).toISOString()).toBe('2026-10-05T18:00:00.000Z')
  })

  it('laisse effacer la date de retour', () => {
    // Sans ce cas, `new Date(null)` aurait posé le 1er janvier 1970 comme échéance.
    expect(changementsEnLot({ returnDueAt: null }).emprunt).toEqual({ returnDueAt: null })
  })

  it('garde un responsable désigné et sait le retirer', () => {
    expect(changementsEnLot({ pickupResponsibleId: 12 }).emprunt).toEqual({
      pickupResponsibleId: 12,
    })
    expect(changementsEnLot({ pickupResponsibleId: null }).emprunt).toEqual({
      pickupResponsibleId: null,
    })
  })
})
