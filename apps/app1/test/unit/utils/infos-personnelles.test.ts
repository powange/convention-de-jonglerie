import { describe, expect, it } from 'vitest'

import {
  complementsPourLeProfil,
  infosPersonnelles,
  misesAJourDuProfil,
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

describe('misesAJourDuProfil', () => {
  /**
   * Le scénario qui a révélé le défaut : quelqu'un corrige son allergie depuis le formulaire,
   * le profil garde l'ancienne valeur, et comme il fait foi à la lecture, la correction
   * n'apparaît nulle part. Silencieusement annulée.
   */
  it('porte au profil la correction de l’intéressé', () => {
    const profil = { ...VIDE, allergies: 'Gluten' }
    const patch = misesAJourDuProfil(
      profil,
      { ...profil, allergies: 'Arachides' },
      {
        estLInteresse: true,
      }
    )
    expect(patch).toEqual({ allergies: 'Arachides' })

    // Et la correction doit être visible ensuite.
    expect(infosPersonnelles({ ...profil, ...patch }).allergies).toBe('Arachides')
  })

  it('accepte que l’intéressé efface une information', () => {
    expect(
      misesAJourDuProfil(
        { ...VIDE, allergies: 'Gluten' },
        { ...VIDE, allergies: '' },
        {
          estLInteresse: true,
        }
      )
    ).toEqual({ allergies: null })
  })

  it('ne touche pas aux champs absents de la saisie', () => {
    // Toutes les éditions ne demandent pas les mêmes informations : ce qui n'est pas demandé
    // n'est pas envoyé, et ne doit rien effacer.
    expect(
      misesAJourDuProfil({ ...VIDE, allergies: 'Gluten' }, {}, { estLInteresse: true })
    ).toEqual({})
  })

  it('n’écrit rien quand la saisie répète ce que le profil sait déjà', () => {
    const profil = { ...VIDE, allergies: 'Gluten', dietaryPreference: 'VEGAN' as const }
    expect(misesAJourDuProfil(profil, profil, { estLInteresse: true })).toEqual({})
  })

  it('se contente de combler les vides quand c’est quelqu’un d’autre qui remplit', () => {
    // Un organisateur qui corrige la candidature d'un bénévole ne réécrit pas son profil.
    const profil = { ...VIDE, allergies: 'Gluten' }
    expect(
      misesAJourDuProfil(
        profil,
        { ...VIDE, allergies: 'Arachides', emergencyContactName: 'Camille' },
        {
          estLInteresse: false,
        }
      )
    ).toEqual({ emergencyContactName: 'Camille' })
  })
})
