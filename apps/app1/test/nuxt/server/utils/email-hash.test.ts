import md5 from 'md5'
import { describe, it, expect } from 'vitest'

import { getEmailHash } from '../../../../server/utils/email-hash'

/**
 * Le hachage d'une adresse pour Gravatar — constat A9.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * Une `Map` au niveau du module gardait chaque adresse rencontrée, **sans expiration ni plafond**.
 * Toute adresse jamais affichée — participants, bénévoles, listes d'administration, fusions de
 * comptes — y restait jusqu'au redémarrage : une fuite lente, et une **copie en clair de toutes les
 * adresses vues** dans le tas du processus.
 *
 * ⚠️ Et sa clé était l'adresse **brute**, alors que le hachage porte sur l'adresse normalisée :
 * « Foo@x.fr » et « foo@x.fr » occupaient deux entrées pour un seul et même MD5. Le cache
 * grandissait donc plus vite que le nombre d'adresses distinctes — tout cela pour économiser un MD5
 * sur une chaîne de trente caractères.
 *
 * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
 *
 * Le hachage attendu est **recalculé dans le test** à partir de l'adresse normalisée, et non recopié
 * en constante. Un hachage figé à la main serait vrai le jour où on l'écrit, et deviendrait une
 * affirmation sans preuve si la normalisation changeait — c'est ce que ces cas doivent attraper.
 *
 * Et aucun ne porte sur le cache lui-même : il n'y en a plus. Ce qu'on fige, c'est le **résultat**,
 * qui doit être exactement celui d'avant — un cache retiré ne doit rien changer à ce que Gravatar
 * reçoit, sans quoi tous les avatars du site changeraient d'un coup.
 */
describe('getEmailHash', () => {
  it('⚠️ REND LE MÊME HACHAGE QUELLE QUE SOIT LA CASSE', () => {
    /*
     * C'est ce que le cache ne savait pas voir : il indexait sur l'adresse brute, donc gardait deux
     * entrées. Le résultat, lui, était déjà correct — le hachage portait bien sur l'adresse
     * normalisée. Ce cas fige donc ce qui ne doit PAS changer.
     */
    const attendu = md5('alice@exemple.fr')

    expect(getEmailHash('alice@exemple.fr')).toBe(attendu)
    expect(getEmailHash('Alice@Exemple.FR')).toBe(attendu)
    expect(getEmailHash('ALICE@EXEMPLE.FR')).toBe(attendu)
  })

  it('ignore les espaces qui entourent l’adresse', () => {
    // Une adresse copiée-collée en porte souvent : sans `trim`, elle obtiendrait un autre avatar
    // que la même adresse saisie à la main.
    expect(getEmailHash('  alice@exemple.fr  ')).toBe(md5('alice@exemple.fr'))
  })

  it('rend une chaîne vide pour une adresse absente', () => {
    /*
     * Le cas que la suppression du cache aurait pu casser : le `if (!email) return ''` venait AVANT
     * la lecture du cache. Sans lui, `md5('')` rendrait un hachage valide — celui de la chaîne vide
     * — et l'écran afficherait l'avatar par défaut de Gravatar au lieu de ses initiales.
     */
    expect(getEmailHash('')).toBe('')
    expect(getEmailHash(undefined as unknown as string)).toBe('')
    expect(getEmailHash(null as unknown as string)).toBe('')
  })

  it('distingue deux adresses différentes', () => {
    /*
     * LE TÉMOIN. Sans lui, une fonction qui rendrait toujours la même chaîne — ou toujours vide —
     * satisferait les cas ci-dessus, et tout le monde porterait le même avatar.
     */
    expect(getEmailHash('alice@exemple.fr')).not.toBe(getEmailHash('bob@exemple.fr'))
  })

  it('rend le même résultat à deux appels successifs', () => {
    /*
     * SECOND TÉMOIN, et il remplace exactement ce que le cache garantissait par construction. Sans
     * lui, une fonction non déterministe — un sel aléatoire, par exemple — passerait tous les cas
     * ci-dessus tout en changeant l'avatar de chacun à chaque requête.
     */
    expect(getEmailHash('alice@exemple.fr')).toBe(getEmailHash('alice@exemple.fr'))
  })
})
