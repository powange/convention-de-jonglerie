import { describe, expect, it } from 'vitest'

import { genererCreneauxRecurrents } from '../../../shared/utils/creneaux-recurrents'

const PARIS = 'Europe/Paris'

// Édition du vendredi 2 au dimanche 4 octobre, montage dès le mercredi 30 septembre
const bornes = {
  debutEvenement: '2026-10-02T10:00:00.000Z',
  finEvenement: '2026-10-04T16:00:00.000Z',
  debutMontage: '2026-09-30T08:00:00.000Z',
  finDemontage: '2026-10-05T18:00:00.000Z',
}

/** Heure murale lisible, pour que les attentes se lisent comme le planning à l'écran. */
const local = (instant: string) =>
  new Date(instant).toLocaleString('fr-FR', {
    timeZone: PARIS,
    dateStyle: 'short',
    timeStyle: 'short',
  })

describe('genererCreneauxRecurrents', () => {
  const accueil = {
    startDateTime: '2026-10-02T07:00:00.000Z', // 9 h à Paris
    endDateTime: '2026-10-02T10:00:00.000Z', // 12 h
  }

  it("répète le créneau sur chaque journée de l'événement", () => {
    const creneaux = genererCreneauxRecurrents(accueil, 'EVENEMENT', bornes, PARIS)

    expect(creneaux).toHaveLength(3)
    expect(creneaux.map((c) => local(c.startDateTime))).toEqual([
      '02/10/2026 09:00',
      '03/10/2026 09:00',
      '04/10/2026 09:00',
    ])
    // L'heure de fin suit la même journée
    expect(local(creneaux[2]!.endDateTime)).toBe('04/10/2026 12:00')
  })

  it('couvre le montage et le démontage quand on les demande', () => {
    const creneaux = genererCreneauxRecurrents(accueil, 'AVEC_MONTAGE', bornes, PARIS)

    // du mercredi 30 septembre au lundi 5 octobre
    expect(creneaux).toHaveLength(6)
    expect(local(creneaux[0]!.startDateTime)).toBe('30/09/2026 09:00')
    expect(local(creneaux[5]!.startDateTime)).toBe('05/10/2026 09:00')
  })

  it("retombe sur les dates de l'événement quand montage et démontage manquent", () => {
    const creneaux = genererCreneauxRecurrents(
      accueil,
      'AVEC_MONTAGE',
      {
        debutEvenement: bornes.debutEvenement,
        finEvenement: bornes.finEvenement,
      },
      PARIS
    )

    expect(creneaux).toHaveLength(3)
  })

  it('garde le débordement après minuit sur chaque répétition, la dernière comprise', () => {
    // Bar de 22 h à 2 h : la fin appartient au lendemain
    const bar = {
      startDateTime: '2026-10-02T20:00:00.000Z', // 22 h à Paris
      endDateTime: '2026-10-03T00:00:00.000Z', // 2 h le lendemain
    }
    const creneaux = genererCreneauxRecurrents(bar, 'EVENEMENT', bornes, PARIS)

    expect(creneaux).toHaveLength(3)
    expect(local(creneaux[0]!.startDateTime)).toBe('02/10/2026 22:00')
    expect(local(creneaux[0]!.endDateTime)).toBe('03/10/2026 02:00')
    // Le dernier soir déborde au-delà de la fin de l'édition, comme les autres soirs
    expect(local(creneaux[2]!.startDateTime)).toBe('04/10/2026 22:00')
    expect(local(creneaux[2]!.endDateTime)).toBe('05/10/2026 02:00')
  })

  it('tient bon au changement d’heure', () => {
    // Le 25 octobre 2026, Paris repasse à l'heure d'hiver : une addition de 24 h décalerait
    // les créneaux suivants d'une heure.
    const creneaux = genererCreneauxRecurrents(
      { startDateTime: '2026-10-23T07:00:00.000Z', endDateTime: '2026-10-23T10:00:00.000Z' },
      'EVENEMENT',
      { debutEvenement: '2026-10-23T07:00:00.000Z', finEvenement: '2026-10-26T16:00:00.000Z' },
      PARIS
    )

    expect(creneaux.map((c) => local(c.startDateTime))).toEqual([
      '23/10/2026 09:00',
      '24/10/2026 09:00',
      '25/10/2026 09:00',
      '26/10/2026 09:00',
    ])
  })

  it('ne rend rien quand le fuseau est inconnu, plutôt qu’un horaire faux', () => {
    expect(genererCreneauxRecurrents(accueil, 'EVENEMENT', bornes, 'Mars/Olympus_Mons')).toEqual([])
  })
})
