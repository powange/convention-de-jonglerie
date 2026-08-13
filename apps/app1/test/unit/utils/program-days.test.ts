import { describe, expect, it } from 'vitest'

import { editionDayKeys } from '../../../shared/utils/program-days'

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
