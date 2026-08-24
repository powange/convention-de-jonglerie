import { describe, expect, it } from 'vitest'

import { buildProfilePatch } from '../../../../server/utils/user-merge'

/**
 * Fusion de comptes : régime, allergies et contact d'urgence comblent les vides.
 *
 * Ces cinq informations ne sont pas arbitrables dans le modal de fusion — l'administrateur n'a
 * pas de bouton pour choisir entre les deux comptes. Sans règle, le compte conservé l'emportait
 * donc en silence, et une allergie connue seulement du compte absorbé disparaissait à la
 * fusion. Perdre une information médicale de cette façon serait bien pire qu'un choix par
 * défaut discutable.
 *
 * La règle : on reprend ce que le compte conservé ignore, on n'écrase jamais ce qu'il sait.
 */

const compte = (surcharges: Record<string, unknown> = {}) =>
  ({
    id: 1,
    email: 'a@example.com',
    emailHash: 'h',
    pseudo: 'a',
    nom: null,
    prenom: null,
    password: null,
    authProvider: 'email',
    phone: null,
    pronouns: null,
    preferredLanguage: 'fr',
    profilePicture: null,
    dietaryPreference: 'NONE',
    allergies: null,
    allergySeverity: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    isEmailVerified: true,
    isGlobalAdmin: false,
    isVolunteer: false,
    isArtist: false,
    isOrganizer: false,
    createdAt: new Date(),
    lastLoginAt: null,
    ...surcharges,
  }) as never

describe('buildProfilePatch — santé et contact d’urgence', () => {
  it('reprend ce que le compte conservé ignore', () => {
    const patch = buildProfilePatch(
      compte(),
      compte({
        id: 2,
        dietaryPreference: 'VEGAN',
        allergies: 'Arachides',
        allergySeverity: 'CRITICAL',
        emergencyContactName: 'Camille',
        emergencyContactPhone: '+33612345678',
      }),
      {}
    )

    expect(patch).toMatchObject({
      dietaryPreference: 'VEGAN',
      allergies: 'Arachides',
      allergySeverity: 'CRITICAL',
      emergencyContactName: 'Camille',
      emergencyContactPhone: '+33612345678',
    })
  })

  it("n'écrase jamais ce que le compte conservé sait déjà", () => {
    const patch = buildProfilePatch(
      compte({
        dietaryPreference: 'VEGETARIAN',
        allergies: 'Gluten',
        allergySeverity: 'LIGHT',
        emergencyContactName: 'Dominique',
        emergencyContactPhone: '+33611111111',
      }),
      compte({
        id: 2,
        dietaryPreference: 'VEGAN',
        allergies: 'Arachides',
        allergySeverity: 'CRITICAL',
        emergencyContactName: 'Camille',
        emergencyContactPhone: '+33622222222',
      }),
      {}
    )

    for (const champ of [
      'dietaryPreference',
      'allergies',
      'allergySeverity',
      'emergencyContactName',
      'emergencyContactPhone',
    ]) {
      expect(patch, `${champ} ne devrait pas être écrasé`).not.toHaveProperty(champ)
    }
  })

  it('laisse le régime tranquille quand les deux comptes n’en déclarent aucun', () => {
    // `NONE` est la valeur par défaut, pas une absence : elle ne doit pas déclencher d'écriture.
    const patch = buildProfilePatch(compte(), compte({ id: 2 }), {})
    expect(patch).not.toHaveProperty('dietaryPreference')
  })

  it('ne comble rien quand le compte absorbé ne sait rien non plus', () => {
    const patch = buildProfilePatch(compte({ allergies: 'Gluten' }), compte({ id: 2 }), {})
    expect(patch).not.toHaveProperty('allergies')
  })
})
