import { describe, expect, it } from 'vitest'

import {
  complementsPourLeProfil,
  infosPersonnelles,
} from '../../../server/utils/infos-personnelles'

/**
 * Le profil fait foi, la candidature ne sert que de repli.
 *
 * L'enjeu n'est pas cosmétique : ces informations servent à préparer des repas et à joindre
 * quelqu'un en cas de pépin. Une allergie qui disparaît d'une liste parce qu'on a changé de
 * source de vérité, c'est une assiette servie à tort.
 */

const VIDE = {
  dietaryPreference: 'NONE' as const,
  allergies: null,
  allergySeverity: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
}

describe('infosPersonnelles', () => {
  it('prend le profil quand il est renseigné', () => {
    const vue = infosPersonnelles(
      { ...VIDE, dietaryPreference: 'VEGAN', allergies: 'Arachides' },
      { ...VIDE, dietaryPreference: 'VEGETARIAN', allergies: 'Gluten' }
    )
    expect(vue.dietaryPreference).toBe('VEGAN')
    expect(vue.allergies).toBe('Arachides')
  })

  it('se replie sur la candidature là où le profil ne dit rien', () => {
    const vue = infosPersonnelles(VIDE, {
      ...VIDE,
      dietaryPreference: 'VEGETARIAN',
      allergies: 'Gluten',
      allergySeverity: 'SEVERE',
      emergencyContactName: 'Camille',
      emergencyContactPhone: '+33612345678',
    })
    expect(vue).toMatchObject({
      dietaryPreference: 'VEGETARIAN',
      allergies: 'Gluten',
      allergySeverity: 'SEVERE',
      emergencyContactName: 'Camille',
      emergencyContactPhone: '+33612345678',
    })
  })

  it('ne remplace jamais un régime déclaré par « aucun régime »', () => {
    // Le cas qui compte : sans ce garde, quelqu'un de végétalien se verrait servir de la viande
    // le jour où la lecture bascule sur un profil encore vide.
    expect(infosPersonnelles(VIDE, { ...VIDE, dietaryPreference: 'VEGAN' }).dietaryPreference).toBe(
      'VEGAN'
    )
  })

  it('rend des valeurs neutres quand rien n’est connu nulle part', () => {
    expect(infosPersonnelles(null, null)).toEqual(VIDE)
    expect(infosPersonnelles(undefined)).toEqual(VIDE)
  })
})

describe('complementsPourLeProfil', () => {
  it('remonte au profil ce qu’il ignore', () => {
    expect(
      complementsPourLeProfil(VIDE, {
        ...VIDE,
        dietaryPreference: 'VEGAN',
        allergies: 'Arachides',
        emergencyContactName: 'Camille',
      })
    ).toEqual({
      dietaryPreference: 'VEGAN',
      allergies: 'Arachides',
      emergencyContactName: 'Camille',
    })
  })

  it('n’écrase jamais ce que la personne a mis dans son profil', () => {
    expect(
      complementsPourLeProfil(
        { ...VIDE, dietaryPreference: 'VEGETARIAN', allergies: 'Gluten' },
        { ...VIDE, dietaryPreference: 'VEGAN', allergies: 'Arachides' }
      )
    ).toEqual({})
  })

  it('ne propose aucune écriture quand il n’y a rien à compléter', () => {
    expect(complementsPourLeProfil(VIDE, VIDE)).toEqual({})
    expect(complementsPourLeProfil(VIDE, null)).toEqual({})
  })

  it('ne prend pas « aucun régime » pour une déclaration', () => {
    expect(complementsPourLeProfil(VIDE, { ...VIDE, dietaryPreference: 'NONE' })).toEqual({})
  })
})
