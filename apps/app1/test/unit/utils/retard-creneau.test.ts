import { describe, it, expect } from 'vitest'

import {
  decalageTraduisible,
  horairesEffectifs,
} from '../../../../../layers/volunteers/app/utils/retard-creneau'

/**
 * Le retard d'un créneau n'était appliqué que par deux surfaces sur six. Selon l'écran, le même
 * créneau n'avait donc pas la même heure — et la modale de détail en gestion, celle qu'on ouvre
 * justement pour vérifier, montrait l'heure périmée.
 *
 * Les instants portent un `Z` explicite : sans lui, ces tests dépendraient du fuseau de la
 * machine qui les exécute et ne prouveraient plus rien.
 */
const DEBUT = '2026-10-02T12:00:00.000Z'
const FIN = '2026-10-02T14:00:00.000Z'

describe('horairesEffectifs', () => {
  it('décale les deux bornes du retard', () => {
    const h = horairesEffectifs(DEBUT, FIN, 30)!

    expect(h.debut.toISOString()).toBe('2026-10-02T12:30:00.000Z')
    expect(h.fin.toISOString()).toBe('2026-10-02T14:30:00.000Z')
  })

  it('conserve les horaires prévus, pour pouvoir montrer le déplacement', () => {
    // C'est ce qui permet de barrer l'ancienne heure à côté de la nouvelle, comme le fait déjà
    // la carte « mes créneaux ».
    const h = horairesEffectifs(DEBUT, FIN, 30)!

    expect(h.debutPrevu.toISOString()).toBe(DEBUT)
    expect(h.finPrevue.toISOString()).toBe(FIN)
  })

  it('préserve la durée du créneau', () => {
    // Un retard déplace le créneau, il ne le rallonge pas. Décaler une seule borne était une
    // erreur facile à commettre en recopiant la règle.
    const h = horairesEffectifs(DEBUT, FIN, 45)!

    expect(h.fin.getTime() - h.debut.getTime()).toBe(h.finPrevue.getTime() - h.debutPrevu.getTime())
  })

  it('ne signale aucun décalage quand il n’y en a pas', () => {
    const h = horairesEffectifs(DEBUT, FIN)!

    expect(h.decale).toBe(false)
    expect(h.decalageMinutes).toBe(0)
    expect(h.debut.toISOString()).toBe(DEBUT)
  })

  it('ignore un décalage nul', () => {
    expect(horairesEffectifs(DEBUT, FIN, 0)!.decale).toBe(false)
  })

  it('applique une AVANCE, c’est-à-dire un décalage négatif', () => {
    // Le champ de saisie annonce « négatif pour une avance », le serveur l'accepte et la modale
    // en montre l'aperçu — mais les deux surfaces qui décalaient testaient `> 0`, si bien qu'une
    // avance était enregistrée puis ignorée partout.
    const h = horairesEffectifs(DEBUT, FIN, -15)!

    expect(h.decale).toBe(true)
    expect(h.decalageMinutes).toBe(-15)
    expect(h.debut.toISOString()).toBe('2026-10-02T11:45:00.000Z')
    expect(h.fin.toISOString()).toBe('2026-10-02T13:45:00.000Z')
  })

  it('traverse minuit sans se tromper de jour', () => {
    // Un créneau de fin de soirée retardé bascule au lendemain : c'est l'intérêt de passer par
    // des instants plutôt que de bricoler les heures.
    const h = horairesEffectifs('2026-10-02T22:45:00Z', '2026-10-02T23:45:00Z', 30)!

    expect(h.debut.toISOString()).toBe('2026-10-02T23:15:00.000Z')
    expect(h.fin.toISOString()).toBe('2026-10-03T00:15:00.000Z')
  })

  it('rend null sur une borne manquante ou illisible', () => {
    // L'appelant retombe alors sur son propre rendu vide, plutôt qu'une date inventée.
    expect(horairesEffectifs(null, FIN, 30)).toBeNull()
    expect(horairesEffectifs(DEBUT, undefined, 30)).toBeNull()
    expect(horairesEffectifs('pas une date', FIN, 30)).toBeNull()
  })
})

describe('decalageTraduisible', () => {
  it('annonce un retard en minutes', () => {
    expect(decalageTraduisible(30)).toEqual({
      cle: 'volunteers.delay_minutes',
      valeurs: { minutes: 30 },
    })
  })

  it('annonce une avance avec ses propres clés', () => {
    // Le signe ne se glisse pas dans la valeur : « +-15 min » serait le résultat d'une seule clé
    // pour les deux sens.
    expect(decalageTraduisible(-15)).toEqual({
      cle: 'volunteers.advance_minutes',
      valeurs: { minutes: 15 },
    })
  })

  it('bascule en heures à partir de 60 minutes', () => {
    expect(decalageTraduisible(90)).toEqual({
      cle: 'volunteers.delay_hours_minutes',
      valeurs: { hours: 1, minutes: 30 },
    })
    expect(decalageTraduisible(120)).toEqual({
      cle: 'volunteers.delay_hours',
      valeurs: { hours: 2 },
    })
    expect(decalageTraduisible(-90)).toEqual({
      cle: 'volunteers.advance_hours_minutes',
      valeurs: { hours: 1, minutes: 30 },
    })
  })

  it('ne rend rien quand il n’y a rien à annoncer', () => {
    expect(decalageTraduisible(0)).toBeNull()
    expect(decalageTraduisible(null)).toBeNull()
    expect(decalageTraduisible(undefined)).toBeNull()
  })
})
