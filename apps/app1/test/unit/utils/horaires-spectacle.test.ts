import { describe, expect, it } from 'vitest'

import { finDeRepresentation } from '../../../../../layers/artists/app/utils/horaires-spectacle'

/**
 * L'heure de fin d'un passage.
 *
 * Ce qui s'éprouve ici : le calcul porte sur l'instant et non sur une heure lue — d'où le cas du
 * changement d'heure — et tout ce qui ne permet pas de conclure rend `null` plutôt qu'une date
 * qu'on afficherait comme une information.
 */
describe('finDeRepresentation', () => {
  it('ajoute la durée au début', () => {
    const fin = finDeRepresentation('2026-08-12T20:00:00.000Z', 90)

    expect(fin?.toISOString()).toBe('2026-08-12T21:30:00.000Z')
  })

  it('accepte une date déjà construite', () => {
    const fin = finDeRepresentation(new Date('2026-08-12T20:00:00.000Z'), 15)

    expect(fin?.toISOString()).toBe('2026-08-12T20:15:00.000Z')
  })

  it('traverse minuit', () => {
    // Un cabaret qui commence à 23h et dure deux heures finit le lendemain : l'écran doit pouvoir
    // le dire, et c'est pourquoi il compare les jours plutôt que d'afficher l'heure toute seule.
    const fin = finDeRepresentation('2026-08-12T23:00:00.000Z', 120)

    expect(fin?.toISOString()).toBe('2026-08-13T01:00:00.000Z')
  })

  it('avance d’une durée réelle à travers le changement d’heure', () => {
    // Nuit du 25 octobre 2026 : à 03:00 Paris on revient à 02:00. Un spectacle commencé à 02h30
    // heure de Paris (00:30 UTC) et durant 60 minutes finit à 02h30 AFFICHÉES — une heure s'est
    // pourtant écoulée. C'est l'instant qui fait foi, pas l'heure lue au cadran.
    const fin = finDeRepresentation('2026-10-25T00:30:00.000Z', 60)

    expect(fin?.toISOString()).toBe('2026-10-25T01:30:00.000Z')
    expect(
      fin?.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
      })
    ).toBe('02:30')
  })

  it('ne conclut pas sans durée', () => {
    expect(finDeRepresentation('2026-08-12T20:00:00.000Z', null)).toBeNull()
    expect(finDeRepresentation('2026-08-12T20:00:00.000Z', undefined)).toBeNull()
  })

  it('ne conclut pas sur une durée nulle ou négative', () => {
    // Une fin antérieure au début se lirait comme un défaut d'affichage, alors que c'est la saisie
    // qu'il faut corriger.
    expect(finDeRepresentation('2026-08-12T20:00:00.000Z', 0)).toBeNull()
    expect(finDeRepresentation('2026-08-12T20:00:00.000Z', -30)).toBeNull()
  })

  it('ne conclut pas sans début lisible', () => {
    expect(finDeRepresentation(null, 90)).toBeNull()
    expect(finDeRepresentation(undefined, 90)).toBeNull()
    expect(finDeRepresentation('pas une date', 90)).toBeNull()
  })

  it('ne conclut pas sur une durée qui n’est pas un nombre fini', () => {
    expect(finDeRepresentation('2026-08-12T20:00:00.000Z', Number.NaN)).toBeNull()
    expect(finDeRepresentation('2026-08-12T20:00:00.000Z', Number.POSITIVE_INFINITY)).toBeNull()
  })
})
