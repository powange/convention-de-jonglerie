import { describe, it, expect } from 'vitest'

import {
  conventionRightsSelect,
  conventionRightsZodShape,
  editionRightsSelect,
  editionRightsZodShape,
  hasAnyEditionRight,
  pickEditionRights,
  readEditionRights,
  toCanField,
} from '../../../server/utils/permissions/rights-shapes'
import { CONVENTION_RIGHTS, EDITION_RIGHTS } from '../../../shared/utils/organizer-rights'

describe('formes dérivées des droits', () => {
  // Le point de tout l'exercice : ajouter un droit à la source suffit, il apparaît partout.
  it('couvre exactement les droits d’édition', () => {
    expect(Object.keys(editionRightsZodShape()).sort()).toEqual([...EDITION_RIGHTS].sort())
    expect(Object.keys(editionRightsSelect).sort()).toEqual([...EDITION_RIGHTS].sort())
  })

  it('couvre exactement les droits de convention', () => {
    expect(Object.keys(conventionRightsZodShape()).sort()).toEqual([...CONVENTION_RIGHTS].sort())
    expect(Object.keys(conventionRightsSelect).sort()).toEqual(
      [...CONVENTION_RIGHTS].map(toCanField).sort()
    )
  })

  it('préfixe les clés courtes pour le schéma', () => {
    expect(toCanField('manageFAQ')).toBe('canManageFAQ')
    expect(toCanField('manageTreasury')).toBe('canManageTreasury')
  })

  it('sélectionne tout à `true`, comme Prisma l’attend', () => {
    expect(Object.values(editionRightsSelect).every((v) => v === true)).toBe(true)
  })
})

describe('pickEditionRights', () => {
  // `undefined` veut dire « non fourni » et doit le rester : le confondre avec `false` retirerait
  // un droit que personne n'a demandé à retirer.
  it('ne retient que les booléens réellement présents', () => {
    expect(
      pickEditionRights({ canEdit: true, canManageFAQ: false, canManageTasks: undefined })
    ).toEqual({ canEdit: true, canManageFAQ: false })
  })

  it('ignore les champs étrangers aux droits', () => {
    expect(pickEditionRights({ canEdit: true, editionId: 12, title: 'x' })).toEqual({
      canEdit: true,
    })
  })

  it('accepte l’absence de source', () => {
    expect(pickEditionRights(null)).toEqual({})
    expect(pickEditionRights(undefined)).toEqual({})
  })
})

describe('readEditionRights', () => {
  it('rend un booléen pour chaque droit, même absent', () => {
    const result = readEditionRights({ canManageFAQ: true })
    expect(Object.keys(result).sort()).toEqual([...EDITION_RIGHTS].sort())
    expect(result.canManageFAQ).toBe(true)
    expect(result.canManageTreasury).toBe(false)
  })
})

describe('hasAnyEditionRight', () => {
  it('repère un droit accordé, quel qu’il soit', () => {
    expect(hasAnyEditionRight({ canManageTreasury: true })).toBe(true)
    expect(hasAnyEditionRight({ canEdit: false })).toBe(false)
    expect(hasAnyEditionRight({})).toBe(false)
    expect(hasAnyEditionRight(null)).toBe(false)
  })
})
