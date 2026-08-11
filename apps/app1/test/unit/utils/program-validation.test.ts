import { describe, expect, it } from 'vitest'

import { programItemSchema } from '../../../server/utils/program-validation'

const base = {
  title: 'Repas du soir',
  startDateTime: '2026-09-26T18:30:00.000Z',
  endDateTime: '2026-09-26T19:30:00.000Z',
}

describe('programItemSchema', () => {
  it('accepte un élément minimal', () => {
    const r = programItemSchema.safeParse(base)
    expect(r.success).toBe(true)
  })

  it('accepte un élément sans heure de fin', () => {
    expect(programItemSchema.safeParse({ ...base, endDateTime: undefined }).success).toBe(true)
    expect(programItemSchema.safeParse({ ...base, endDateTime: null }).success).toBe(true)
    const sansFin = { title: base.title, startDateTime: base.startDateTime }
    expect(programItemSchema.safeParse(sansFin).success).toBe(true)
  })

  it('exige un titre non vide', () => {
    expect(programItemSchema.safeParse({ ...base, title: '   ' }).success).toBe(false)
  })

  /**
   * Le cas qui compte : un créneau qui finit avant de commencer traverserait toute l'application
   * — frise, regroupement par jour, affichage — en produisant des durées négatives.
   */
  it('refuse une fin antérieure ou égale au début', () => {
    expect(
      programItemSchema.safeParse({ ...base, endDateTime: '2026-09-26T17:00:00.000Z' }).success
    ).toBe(false)
    expect(programItemSchema.safeParse({ ...base, endDateTime: base.startDateTime }).success).toBe(
      false
    )
  })

  /**
   * Zone et repère s'excluent : la carte ne saurait pas lequel montrer, et l'affichage devrait
   * trancher arbitrairement.
   */
  it('refuse une zone et un repère à la fois', () => {
    expect(programItemSchema.safeParse({ ...base, zoneId: 1, markerId: 2 }).success).toBe(false)
    expect(programItemSchema.safeParse({ ...base, zoneId: 1 }).success).toBe(true)
    expect(programItemSchema.safeParse({ ...base, markerId: 2 }).success).toBe(true)
  })

  it('accepte un lieu en texte libre à côté d’une zone', () => {
    const r = programItemSchema.safeParse({ ...base, zoneId: 1, locationName: 'côté buvette' })
    expect(r.success).toBe(true)
  })

  it('rejette un identifiant de lieu qui n’est pas un entier positif', () => {
    for (const zoneId of [0, -3, 1.5]) {
      expect(programItemSchema.safeParse({ ...base, zoneId }).success, `zoneId ${zoneId}`).toBe(
        false
      )
    }
  })

  it('borne le titre et la précision de lieu', () => {
    expect(programItemSchema.safeParse({ ...base, title: 'a'.repeat(201) }).success).toBe(false)
    expect(programItemSchema.safeParse({ ...base, locationName: 'a'.repeat(151) }).success).toBe(
      false
    )
  })

  it('accepte des dates déjà typées', () => {
    const r = programItemSchema.safeParse({
      ...base,
      startDateTime: new Date('2026-09-26T18:30:00.000Z'),
      endDateTime: new Date('2026-09-26T19:30:00.000Z'),
    })
    expect(r.success).toBe(true)
  })

  it('refuse une date illisible', () => {
    expect(programItemSchema.safeParse({ ...base, startDateTime: 'hier soir' }).success).toBe(false)
  })
})
