import { describe, expect, it } from 'vitest'

import { destinationSurPlace, periodeEdition } from '../../../shared/utils/presence-edition'

const d = (iso: string) => new Date(iso)

const EDITION = {
  startDate: d('2026-07-10T08:00:00Z'),
  endDate: d('2026-07-13T18:00:00Z'),
  setupStartDate: d('2026-07-08T09:00:00Z'),
  teardownEndDate: d('2026-07-14T20:00:00Z'),
}

describe('periodeEdition', () => {
  it("reconnaît l'événement lui-même, bornes incluses", () => {
    expect(periodeEdition(d('2026-07-11T12:00:00Z'), EDITION)).toBe('evenement')
    expect(periodeEdition(EDITION.startDate, EDITION)).toBe('evenement')
    expect(periodeEdition(EDITION.endDate, EDITION)).toBe('evenement')
  })

  it('reconnaît le montage et le démontage', () => {
    expect(periodeEdition(d('2026-07-09T12:00:00Z'), EDITION)).toBe('montage')
    expect(periodeEdition(d('2026-07-14T10:00:00Z'), EDITION)).toBe('demontage')
  })

  it('rend null en dehors de toute période', () => {
    expect(periodeEdition(d('2026-07-01T12:00:00Z'), EDITION)).toBeNull()
    expect(periodeEdition(d('2026-07-20T12:00:00Z'), EDITION)).toBeNull()
  })

  it("sans bornes de montage, s'en tient aux dates publiques", () => {
    const sansMontage = { startDate: EDITION.startDate, endDate: EDITION.endDate }
    expect(periodeEdition(d('2026-07-09T12:00:00Z'), sansMontage)).toBeNull()
    expect(periodeEdition(d('2026-07-14T10:00:00Z'), sansMontage)).toBeNull()
    expect(periodeEdition(d('2026-07-11T12:00:00Z'), sansMontage)).toBe('evenement')
  })

  it('accepte des dates sérialisées, telles que les rend une API', () => {
    expect(
      periodeEdition(d('2026-07-09T12:00:00Z'), {
        startDate: '2026-07-10T08:00:00Z',
        endDate: '2026-07-13T18:00:00Z',
        setupStartDate: '2026-07-08T09:00:00Z',
      })
    ).toBe('montage')
  })

  it('ignore une date invalide plutôt que de conclure au hasard', () => {
    expect(
      periodeEdition(d('2026-07-11T12:00:00Z'), { startDate: 'n’importe quoi', endDate: '' })
    ).toBeNull()
  })
})

describe('destinationSurPlace', () => {
  const organisateur = { estOrganisateur: true, estBenevole: false }
  const benevole = { estOrganisateur: false, estBenevole: true }
  const visiteur = { estOrganisateur: false, estBenevole: false }

  it("envoie l'organisateur en gestion, quelle que soit la période", () => {
    for (const periode of ['montage', 'evenement', 'demontage'] as const) {
      expect(destinationSurPlace(7, periode, organisateur)).toBe('/editions/7/gestion')
    }
  })

  it('envoie le bénévole sur son planning, montage et démontage compris', () => {
    for (const periode of ['montage', 'evenement', 'demontage'] as const) {
      expect(destinationSurPlace(7, periode, benevole)).toBe('/editions/7/volunteers')
    }
  })

  it("fait primer l'organisateur sur le bénévole", () => {
    expect(destinationSurPlace(7, 'evenement', { estOrganisateur: true, estBenevole: true })).toBe(
      '/editions/7/gestion'
    )
  })

  it("n'emmène le public sur l'édition que pendant l'événement", () => {
    expect(destinationSurPlace(7, 'evenement', visiteur)).toBe('/editions/7')
    expect(destinationSurPlace(7, 'montage', visiteur)).toBeNull()
    expect(destinationSurPlace(7, 'demontage', visiteur)).toBeNull()
  })
})
