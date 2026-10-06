import { describe, expect, it } from 'vitest'

import { estIdentiqueALAcheteur } from '../../../../../layers/ticketing/app/utils/identite-du-titulaire'

/**
 * Abréger « identique à l'acheteur » sur la fiche d'un billet.
 *
 * ⚠️ POURQUOI CES TESTS. Cette fonction décide de MASQUER des valeurs. Trop permissive, elle cache
 * qu'un billet est au nom de quelqu'un d'autre — l'unique renseignement que l'opérateur vient
 * chercher. Et l'écran ne dira jamais qu'il a caché quelque chose.
 */

const acheteur = { firstName: 'Emma', lastName: 'Omer', email: 'ma.omer.mail@gmail.com' }

describe('le titulaire est l’acheteur', () => {
  it('nom ET adresse identiques', () => {
    expect(estIdentiqueALAcheteur({ ...acheteur }, acheteur)).toBe(true)
  })

  it('aux majuscules et aux espaces près', () => {
    // Les deux viennent de saisies différentes — un formulaire public, un import HelloAsso.
    expect(
      estIdentiqueALAcheteur(
        { firstName: ' EMMA', lastName: 'Omer ', email: 'MA.Omer.Mail@gmail.com' },
        acheteur
      )
    ).toBe(true)
  })
})

describe('le titulaire n’est PAS l’acheteur', () => {
  it('⚠️ nom différent, même adresse : un billet acheté pour quelqu’un d’autre', () => {
    /*
     * LE CAS QUI INTERDIT D'ABRÉGER. Un parent achète pour son enfant : son adresse, le nom de
     * l'enfant. Masquer la ligne ferait croire que le billet est au nom du parent, et c'est
     * exactement ce qu'on vient vérifier au guichet.
     */
    expect(estIdentiqueALAcheteur({ ...acheteur, firstName: 'Lucie' }, acheteur)).toBe(false)
  })

  it('⚠️ même nom, adresse différente', () => {
    // Deux comptes d'une même personne, ou une adresse de contact distincte : à montrer.
    expect(estIdentiqueALAcheteur({ ...acheteur, email: 'autre@example.com' }, acheteur)).toBe(
      false
    )
  })

  it('⚠️ deux champs VIDES ne se ressemblent pas, ils manquent', () => {
    /*
     * Le piège de l'égalité naïve : '' === '' est vrai. Écrire « identique à l'acheteur » sur une
     * ligne sans nom affirmerait une identité qu'on ignore, et masquerait qu'elle est incomplète.
     */
    expect(estIdentiqueALAcheteur({}, {})).toBe(false)
    expect(estIdentiqueALAcheteur({ ...acheteur, email: null }, { ...acheteur, email: null })).toBe(
      false
    )
    expect(
      estIdentiqueALAcheteur(
        { firstName: null, lastName: null, email: 'x@y.fr' },
        { firstName: null, lastName: null, email: 'x@y.fr' }
      )
    ).toBe(false)
  })

  it('⚠️ un ALIAS de boîte n’est pas la même adresse ici', () => {
    /*
     * `jean+asso@gmail.com` et `jean@gmail.com` arrivent dans la même boîte, et le rapprochement
     * des personnes les traite comme une seule adresse. Mais décider de CACHER une valeur est une
     * autre affaire : l'opérateur est venu la lire, et les deux chaînes diffèrent.
     */
    expect(
      estIdentiqueALAcheteur({ ...acheteur, email: 'ma.omer.mail+asso@gmail.com' }, acheteur)
    ).toBe(false)
  })

  it('sans acheteur, rien à comparer', () => {
    expect(estIdentiqueALAcheteur({ ...acheteur }, null)).toBe(false)
    expect(estIdentiqueALAcheteur({ ...acheteur })).toBe(false)
  })
})
