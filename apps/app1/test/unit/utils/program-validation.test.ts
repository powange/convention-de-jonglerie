import { describe, expect, it } from 'vitest'

import {
  programItemLocationSchema,
  programItemSchema,
} from '../../../server/utils/program-validation'

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

/**
 * Le lieu seul, tel que l'envoie la frise quand on le change sur place. Les mêmes règles que le
 * formulaire complet doivent s'y appliquer : c'est tout l'intérêt de partager le schéma plutôt
 * que d'en tenir une copie dans le point d'API.
 */
describe('programItemLocationSchema', () => {
  const base = { locationName: null, zoneId: null, markerId: null }

  it('accepte une zone, un repère, ou aucun des deux', () => {
    expect(programItemLocationSchema.safeParse(base).success).toBe(true)
    expect(programItemLocationSchema.safeParse({ ...base, zoneId: 3 }).success).toBe(true)
    expect(programItemLocationSchema.safeParse({ ...base, markerId: 3 }).success).toBe(true)
  })

  // La carte ne saurait pas lequel des deux montrer.
  it('refuse une zone et un repère ensemble', () => {
    expect(programItemLocationSchema.safeParse({ ...base, zoneId: 3, markerId: 4 }).success).toBe(
      false
    )
  })

  /**
   * Les trois champs ensemble : un fragment laisserait cohabiter une zone fraîchement choisie et
   * un texte libre oublié.
   */
  it('exige les trois champs', () => {
    expect(programItemLocationSchema.safeParse({ zoneId: 3 }).success).toBe(false)
    expect(programItemLocationSchema.safeParse({ locationName: 'Chapiteau' }).success).toBe(false)
  })

  // Une chaîne vide n'est pas une précision : elle vaut « pas de texte ».
  it('ramène un texte vide ou blanc à l’absence de texte', () => {
    for (const locationName of ['', '   ']) {
      const r = programItemLocationSchema.safeParse({ ...base, locationName })
      expect(r.success, locationName).toBe(true)
      expect(r.success && r.data.locationName).toBeNull()
    }
  })

  it('borne la précision de lieu', () => {
    expect(
      programItemLocationSchema.safeParse({ ...base, locationName: 'a'.repeat(151) }).success
    ).toBe(false)
  })
})
