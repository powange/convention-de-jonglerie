import { describe, expect, it } from 'vitest'

import { buildProfilePatch } from '../../../../server/utils/user-merge'

/**
 * Fusion de comptes : les identifiants de fournisseur OAuth s'héritent.
 *
 * Les colonnes `googleId` / `facebookId` existent pour qu'un utilisateur qui change d'adresse
 * retrouve son compte au bouton Google ou Facebook, au lieu d'en recevoir un neuf — sans ses
 * billets, ses candidatures ni ses conventions.
 *
 * ⚠️ **Mais la fusion pouvait reprendre ce défaut par la porte de derrière.** Le compte absorbé
 * est SUPPRIMÉ, et avec lui son `googleId`. Sans règle d'héritage, l'utilisateur se connecterait
 * ensuite par ce bouton pour tomber… sur la création d'un compte neuf. Exactement ce que ces
 * colonnes ferment.
 *
 * La règle est celle du profil de santé juste à côté : **on reprend ce que le compte conservé
 * ignore, on n'écrase jamais ce qu'il sait.**
 *
 * 📍 Pourquoi c'est possible du tout : dans la transaction de fusion, la suppression du compte
 * source précède cette mise à jour. La contrainte d'unicité est donc déjà libérée quand la cible
 * reprend l'identifiant — même mécanisme que pour `email`.
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
    googleId: null,
    facebookId: null,
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
    ...surcharges,
  }) as never

/** L'arbitrage que l'administrateur rend dans le modal : ici, il garde tout de la cible. */
const garderLaCible = { credentials: 'target', pseudo: 'target' } as never

describe('fusion de comptes — identifiants de fournisseur', () => {
  it('⚠️ LA CIBLE REPREND LE LIEN QUE LE COMPTE ABSORBÉ EMPORTAIT', () => {
    /*
     * Le cas qui compte. Sans cette règle, le `googleId` disparaît avec le compte supprimé et
     * l'utilisateur retombe sur la création d'un compte neuf à sa prochaine connexion Google.
     */
    const patch = buildProfilePatch(
      compte({ id: 1, googleId: null }),
      compte({ id: 2, googleId: 'sub-google-123' }),
      garderLaCible
    )

    expect(patch.googleId, 'le lien Google est perdu à la fusion').toBe('sub-google-123')
  })

  it('hérite aussi de Facebook, et des deux à la fois', () => {
    const patch = buildProfilePatch(
      compte({ id: 1, googleId: null, facebookId: null }),
      compte({ id: 2, googleId: 'sub-g', facebookId: 'id-fb' }),
      garderLaCible
    )

    expect(patch.googleId).toBe('sub-g')
    expect(patch.facebookId).toBe('id-fb')
  })

  it('⚠️ N’ÉCRASE PAS un identifiant que la cible porte déjà', () => {
    /*
     * La colonne est unique : un seul des deux liens peut survivre. La cible garde le sien — le
     * lien du source est alors réellement perdu, et c'est une limite assumée de la fusion, pas
     * un oubli. L'écraser serait pire : on volerait au compte conservé l'accès qu'il utilisait.
     */
    const patch = buildProfilePatch(
      compte({ id: 1, googleId: 'sub-de-la-cible' }),
      compte({ id: 2, googleId: 'sub-du-source' }),
      garderLaCible
    )

    expect(patch.googleId, 'le lien de la cible a été écrasé').toBeUndefined()
  })

  it('ne fabrique rien quand le compte absorbé n’a aucun lien', () => {
    const patch = buildProfilePatch(
      compte({ id: 1, googleId: null, facebookId: null }),
      compte({ id: 2, googleId: null, facebookId: null }),
      garderLaCible
    )

    expect(patch.googleId).toBeUndefined()
    expect(patch.facebookId).toBeUndefined()
  })

  it('⚠️ HÉRITE INDÉPENDAMMENT DE L’ARBITRAGE `credentials`', () => {
    /*
     * Le témoin de la règle : l'administrateur choisit l'adresse et le mot de passe de l'un ou
     * de l'autre, mais les identifiants de fournisseur ne sont PAS dans ce choix — ils ne sont
     * pas arbitrables dans le modal. Si l'héritage avait été écrit dans le bloc `credentials`,
     * il ne se produirait que lorsque l'administrateur retient le compte absorbé, c'est-à-dire
     * presque jamais.
     */
    for (const credentials of ['target', 'source'] as const) {
      const patch = buildProfilePatch(
        compte({ id: 1, googleId: null }),
        compte({ id: 2, googleId: 'sub-google-123' }),
        { credentials, pseudo: 'target' } as never
      )

      expect(patch.googleId, `l’héritage dépend de credentials=${credentials}`).toBe(
        'sub-google-123'
      )
    }
  })
})
