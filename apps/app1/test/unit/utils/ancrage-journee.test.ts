import { describe, it, expect } from 'vitest'

import {
  ancrerCreneauSurJournee,
  estJourneeValide,
} from '../../../../../layers/workshops/server/utils/ancrage-journee'

describe('estJourneeValide', () => {
  it('accepte une journée réelle', () => {
    expect(estJourneeValide('2026-07-12')).toBe(true)
    expect(estJourneeValide('2024-02-29')).toBe(true)
  })

  it('refuse un format inattendu', () => {
    expect(estJourneeValide('12/07/2026')).toBe(false)
    expect(estJourneeValide('2026-7-2')).toBe(false)
    expect(estJourneeValide('2026-07-12T14:00')).toBe(false)
    expect(estJourneeValide('')).toBe(false)
    expect(estJourneeValide(null)).toBe(false)
    expect(estJourneeValide(42)).toBe(false)
  })

  it('refuse une date qui n’existe pas', () => {
    // Sans ce contrôle, Date reporterait le 31 février au 3 mars sans rien signaler.
    expect(estJourneeValide('2026-02-31')).toBe(false)
    expect(estJourneeValide('2025-02-29')).toBe(false)
    expect(estJourneeValide('2026-13-01')).toBe(false)
  })
})

describe('ancrerCreneauSurJournee', () => {
  it('replace le créneau sur la journée choisie en gardant les heures', () => {
    const resultat = ancrerCreneauSurJournee(
      { startDateTime: '2024-10-23T14:00:00', endDateTime: '2024-10-23T16:00:00' },
      '2026-07-12'
    )

    expect(resultat).toEqual({
      startDateTime: '2026-07-12T14:00:00',
      endDateTime: '2026-07-12T16:00:00',
    })
  })

  it('accepte une date-heure sans secondes', () => {
    const resultat = ancrerCreneauSurJournee(
      { startDateTime: '2024-10-23T09:30', endDateTime: '2024-10-23T11:00' },
      '2026-07-12'
    )

    expect(resultat).toEqual({
      startDateTime: '2026-07-12T09:30:00',
      endDateTime: '2026-07-12T11:00:00',
    })
  })

  it('conserve un atelier à cheval sur minuit', () => {
    // La durée est reportée, pas la date de fin : forcer les deux bornes sur la même journée
    // rendrait le créneau rétroactif, et il serait écarté par la validation qui suit.
    const resultat = ancrerCreneauSurJournee(
      { startDateTime: '2024-10-23T23:00:00', endDateTime: '2024-10-24T01:30:00' },
      '2026-07-12'
    )

    expect(resultat).toEqual({
      startDateTime: '2026-07-12T23:00:00',
      endDateTime: '2026-07-13T01:30:00',
    })
  })

  it('reporte une durée de plusieurs jours', () => {
    const resultat = ancrerCreneauSurJournee(
      { startDateTime: '2024-10-23T10:00:00', endDateTime: '2024-10-25T12:00:00' },
      '2026-07-12'
    )

    expect(resultat).toEqual({
      startDateTime: '2026-07-12T10:00:00',
      endDateTime: '2026-07-14T12:00:00',
    })
  })

  it('recale un atelier sans heure de fin sans en inventer une', () => {
    expect(ancrerCreneauSurJournee({ startDateTime: '2024-10-23T21:00:00' }, '2026-07-12')).toEqual(
      { startDateTime: '2026-07-12T21:00:00', endDateTime: null }
    )

    expect(
      ancrerCreneauSurJournee(
        { startDateTime: '2024-10-23T21:00:00', endDateTime: null },
        '2026-07-12'
      )
    ).toEqual({ startDateTime: '2026-07-12T21:00:00', endDateTime: null })
  })

  it('refuse une journée invalide', () => {
    expect(
      ancrerCreneauSurJournee(
        { startDateTime: '2024-10-23T14:00:00', endDateTime: '2024-10-23T16:00:00' },
        '2026-02-31'
      )
    ).toBeNull()
  })

  it('refuse un créneau illisible ou sans durée', () => {
    const creneauValide = { startDateTime: '2024-10-23T14:00:00', endDateTime: '2024-10-23T16:00' }
    expect(
      ancrerCreneauSurJournee({ ...creneauValide, startDateTime: '' }, '2026-07-12')
    ).toBeNull()
    expect(
      ancrerCreneauSurJournee({ ...creneauValide, endDateTime: 'demain' }, '2026-07-12')
    ).toBeNull()
    expect(
      ancrerCreneauSurJournee(
        { startDateTime: '2024-10-23T16:00:00', endDateTime: '2024-10-23T16:00:00' },
        '2026-07-12'
      )
    ).toBeNull()
    expect(
      ancrerCreneauSurJournee(
        { startDateTime: '2024-10-23T17:00:00', endDateTime: '2024-10-23T16:00:00' },
        '2026-07-12'
      )
    ).toBeNull()
  })

  it('ne tient aucun compte du fuseau de la machine', () => {
    // Les chaînes sont traitées telles quelles : c'est ce qui permet au jour choisi d'être
    // exactement celui qui ressort, où que tourne le serveur.
    const resultat = ancrerCreneauSurJournee(
      { startDateTime: '2024-10-23T00:30:00', endDateTime: '2024-10-23T02:00:00' },
      '2026-07-12'
    )

    expect(resultat?.startDateTime).toBe('2026-07-12T00:30:00')
  })
})
