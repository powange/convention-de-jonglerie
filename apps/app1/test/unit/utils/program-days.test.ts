import { describe, expect, it } from 'vitest'

import { buildProgramDays, editionDayKeys } from '../../../shared/utils/program-days'

describe('editionDayKeys', () => {
  it('couvre les bornes, début et fin compris', () => {
    expect(editionDayKeys('2026-09-11T16:00:00.000Z', '2026-09-13T14:00:00.000Z')).toEqual([
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ])
  })

  it('rend un seul jour pour une édition d’une journée', () => {
    expect(editionDayKeys('2026-09-11T08:00:00.000Z', '2026-09-11T23:00:00.000Z')).toEqual([
      '2026-09-11',
    ])
  })

  it('franchit les mois et les années', () => {
    expect(editionDayKeys('2026-12-31T10:00:00.000Z', '2027-01-02T10:00:00.000Z')).toEqual([
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
  })

  // Des dates inversées viennent d'une saisie fautive : mieux vaut ne rien proposer que de
  // produire une liste absurde.
  it('rend une liste vide sur des dates incohérentes', () => {
    expect(editionDayKeys('2026-09-13', '2026-09-11')).toEqual([])
    expect(editionDayKeys('pas une date', '2026-09-11')).toEqual([])
  })

  // Une saisie fautive — année erronée, par exemple — ne doit pas engendrer des milliers de
  // champs de texte.
  it('borne les éditions déraisonnablement longues', () => {
    expect(editionDayKeys('2026-01-01', '2030-01-01').length).toBe(60)
  })
})

describe('buildProgramDays', () => {
  it('associe le contenu déjà écrit à son jour', () => {
    const jours = buildProgramDays('2026-09-11', '2026-09-12', [
      { date: '2026-09-12', content: 'Gala à 20h' },
    ])

    expect(jours.map((j) => [j.date, j.content])).toEqual([
      ['2026-09-11', ''],
      ['2026-09-12', 'Gala à 20h'],
    ])
  })

  it('propose chaque jour de l’édition, même vide', () => {
    const jours = buildProgramDays('2026-09-11', '2026-09-13', [])
    expect(jours).toHaveLength(3)
    expect(jours.every((j) => j.content === '')).toBe(true)
    expect(jours.every((j) => !j.outsideDates)).toBe(true)
  })

  /**
   * Les dates d'une convention bougent. Effacer le texte écrit pour un jour qui n'existe plus
   * ferait perdre du travail que personne n'a demandé à jeter.
   */
  it('conserve un jour sorti des dates, et le signale', () => {
    const jours = buildProgramDays('2026-09-12', '2026-09-13', [
      { date: '2026-09-11', content: 'Accueil des bénévoles' },
      { date: '2026-09-12', content: 'Ouverture' },
    ])

    expect(jours.map((j) => [j.date, j.outsideDates])).toEqual([
      ['2026-09-12', false],
      ['2026-09-13', false],
      ['2026-09-11', true],
    ])
    expect(jours.find((j) => j.outsideDates)!.content).toBe('Accueil des bénévoles')
  })

  // Un jour hors dates et vide n'a rien à signaler : l'afficher n'ajouterait qu'du bruit.
  it('ignore un jour hors dates resté vide', () => {
    const jours = buildProgramDays('2026-09-12', '2026-09-12', [
      { date: '2026-09-11', content: '   ' },
    ])
    expect(jours).toHaveLength(1)
    expect(jours[0]!.date).toBe('2026-09-12')
  })

  it('range les jours hors dates après ceux de l’édition, par ordre', () => {
    const jours = buildProgramDays('2026-09-12', '2026-09-12', [
      { date: '2026-09-20', content: 'b' },
      { date: '2026-09-01', content: 'a' },
    ])
    expect(jours.map((j) => j.date)).toEqual(['2026-09-12', '2026-09-01', '2026-09-20'])
  })
})
