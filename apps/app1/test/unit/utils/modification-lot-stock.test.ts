import { describe, expect, it } from 'vitest'

import {
  changementsEnLot,
  destinatairesDesChampsDEmprunt,
} from '../../../server/utils/modification-lot-stock'

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

/**
 * Les deux jalons d'un emprunt, posés en lot : le camion revient d'un bloc, et ouvrir quinze
 * fiches pour cocher quinze cases n'a pas de sens.
 */
describe('changementsEnLot — jalons d’emprunt', () => {
  it('convertit la récupération en date', () => {
    const { emprunt } = changementsEnLot({ pickedUpAt: '2026-10-02T10:00:00.000Z' })

    expect(emprunt.pickedUpAt).toBeInstanceOf(Date)
    expect((emprunt.pickedUpAt as Date).toISOString()).toBe('2026-10-02T10:00:00.000Z')
  })

  it('convertit le retour en date', () => {
    const { emprunt } = changementsEnLot({ returnedAt: '2026-10-05T18:00:00.000Z' })

    expect((emprunt.returnedAt as Date).toISOString()).toBe('2026-10-05T18:00:00.000Z')
  })

  it('laisse annuler un jalon', () => {
    // Sans ce cas, `new Date(null)` poserait le 1er janvier 1970 — une récupération qui n'a
    // jamais eu lieu se lirait comme très ancienne au lieu de disparaître.
    expect(changementsEnLot({ pickedUpAt: null }).emprunt).toEqual({ pickedUpAt: null })
    expect(changementsEnLot({ returnedAt: null }).emprunt).toEqual({ returnedAt: null })
  })

  it('range les jalons avec les champs d’emprunt', () => {
    // Ils ne concernent que le matériel prêté : posés ailleurs, ils dateraient une récupération
    // qui n'a pas de sens sur du matériel qui nous appartient.
    const { communs, emprunt } = changementsEnLot({
      location: 'Local',
      pickedUpAt: '2026-10-02T10:00:00.000Z',
    })

    expect(communs).toEqual({ location: 'Local' })
    expect(Object.keys(emprunt)).toEqual(['pickedUpAt'])
  })
})

/**
 * Le statut de prêt lui-même se modifie désormais par lot.
 *
 * Les six champs qui en dépendent — propriétaire, dates, lieux, responsables — se modifiaient déjà
 * par lot, mais pas l'interrupteur qui décide de leur existence : déclarer dix objets comme prêtés
 * demandait d'ouvrir dix fiches, et tant que ce n'était pas fait, les champs de prêt restaient
 * sans effet sur eux.
 */
describe('statut de prêt en lot', () => {
  const objets = [
    { id: 1, isExternalLoan: false },
    { id: 2, isExternalLoan: false },
    { id: 3, isExternalLoan: true },
  ]

  it('applique le statut à toute la sélection', () => {
    expect(changementsEnLot({ isExternalLoan: true }).communs).toEqual({ isExternalLoan: true })
    expect(changementsEnLot({ isExternalLoan: false }).communs).toEqual({ isExternalLoan: false })
  })

  it('ne touche pas au statut quand la case n’est pas cochée', () => {
    // L'absence du champ vaut « laisser tel quel » : c'est toute la mécanique de cette modale.
    expect(changementsEnLot({ location: 'Hangar' }).communs).not.toHaveProperty('isExternalLoan')
  })

  it('applique les champs de prêt à ceux qui le DEVIENNENT', () => {
    // Le cas qui motive ce lot : on reçoit dix perches d'un prêteur, on les marque prêtées ET on
    // renseigne le propriétaire dans la même requête. Sans cela, il faut s'y reprendre à deux fois.
    expect(destinatairesDesChampsDEmprunt({ isExternalLoan: true }, objets)).toEqual([1, 2, 3])
  })

  it('n’applique les champs de prêt à personne quand la sélection cesse d’être prêtée', () => {
    expect(destinatairesDesChampsDEmprunt({ isExternalLoan: false }, objets)).toEqual([])
  })

  it('s’en tient à ceux déjà prêtés quand le statut n’est pas touché', () => {
    expect(destinatairesDesChampsDEmprunt({ ownerContact: 'Marie' }, objets)).toEqual([3])
  })

  it('n’efface aucun champ de prêt en retirant le statut', () => {
    // Décocher « prêté » ne vide ni le propriétaire, ni les dates, ni les lieux : la fiche cesse
    // de les montrer, et l'objet les retrouve s'il redevient un prêt.
    const { communs, emprunt } = changementsEnLot({ isExternalLoan: false })

    expect(communs).toEqual({ isExternalLoan: false })
    expect(emprunt).toEqual({})
  })
})
