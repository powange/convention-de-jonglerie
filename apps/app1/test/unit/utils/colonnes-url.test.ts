import { describe, expect, it } from 'vitest'

import {
  AUCUNE_COLONNE_MASQUEE,
  colonnesMasqueesDepuisUrl,
  colonnesMasqueesVersUrl,
} from '../../../app/utils/colonnes-url'

const MASQUABLES = ['createdAt', 'user', 'referer', 'ip']

describe('colonnesMasqueesVersUrl', () => {
  /*
   * Les MASQUÉES, jamais les visibles : toutes le sont au départ, et énumérer les visibles
   * allongerait chaque URL sans rien dire de plus.
   */
  it('écrit les colonnes masquées, triées', () => {
    expect(colonnesMasqueesVersUrl({ referer: false, ip: true, user: false })).toBe('referer,user')
  })

  /* L'ordre fixe compte : deux personnes ayant fait le même choix doivent obtenir le même lien. */
  it('rend la même chaîne quel que soit l’ordre de saisie', () => {
    expect(colonnesMasqueesVersUrl({ user: false, referer: false })).toBe(
      colonnesMasqueesVersUrl({ referer: false, user: false })
    )
  })

  /* `null` et non chaîne vide : « colonnes= » se lirait comme un choix, et non comme son absence. */
  it('rend null quand rien n’est masqué', () => {
    expect(colonnesMasqueesVersUrl({})).toBeNull()
    expect(colonnesMasqueesVersUrl({ ip: true, user: true })).toBeNull()
  })
})

describe('colonnesMasqueesDepuisUrl', () => {
  it('relit les colonnes masquées', () => {
    expect(colonnesMasqueesDepuisUrl('referer,ip', MASQUABLES)).toEqual({
      referer: false,
      ip: false,
    })
  })

  /*
   * Sans cette borne, une adresse mal recopiée ferait disparaître la colonne d'actions ou celle du
   * statut — que l'écran ne propose justement pas de masquer.
   */
  it('ignore ce que l’écran ne propose pas de masquer', () => {
    expect(colonnesMasqueesDepuisUrl('ip,actions,inventee', MASQUABLES)).toEqual({ ip: false })
  })

  it('rend un objet vide sans paramètre : tout est visible', () => {
    expect(colonnesMasqueesDepuisUrl(undefined, MASQUABLES)).toEqual({})
    expect(colonnesMasqueesDepuisUrl('', MASQUABLES)).toEqual({})
    expect(colonnesMasqueesDepuisUrl(['ip'], MASQUABLES)).toEqual({})
  })

  /* Une liste de masquables vide n'autorise rien : c'est le cas avant que le tableau existe. */
  it('ne masque rien quand aucune colonne n’est déclarée masquable', () => {
    expect(colonnesMasqueesDepuisUrl('ip,user', [])).toEqual({})
  })
})

/** L'aller-retour est ce que le lecteur constate : il masque, recharge, et retrouve son tableau. */
describe('aller-retour', () => {
  it('restitue le même état après passage par l’URL', () => {
    const etat = { referer: false, ip: false }
    const relu = colonnesMasqueesDepuisUrl(colonnesMasqueesVersUrl(etat)!, MASQUABLES)
    expect(relu).toEqual(etat)
  })

  /* Les colonnes VISIBLES ne survivent pas au passage, et c'est voulu : l'absence vaut visible. */
  it('ne conserve que les masquées, les visibles étant l’état d’arrivée', () => {
    const relu = colonnesMasqueesDepuisUrl(
      colonnesMasqueesVersUrl({ ip: false, user: true })!,
      MASQUABLES
    )
    expect(relu).toEqual({ ip: false })
  })
})

/**
 * Les tableaux qui masquent des colonnes DÈS L'ARRIVÉE — la description d'un tarif, son statut.
 *
 * Sur ceux-là, « tout afficher » est un choix, et l'absence de paramètre signifie « je n'ai rien
 * réglé ». Sans traitement particulier, révéler une colonne cachée par défaut ne pourrait pas
 * s'écrire, et le réglage disparaîtrait au premier rechargement — précisément ce qu'on corrige.
 */
describe('tableaux avec des colonnes masquées par défaut', () => {
  const DEFAUTS = { description: false, isActive: false }
  const MASQUABLES_TARIFS = ['description', 'isActive', 'price', 'validFrom']

  it('n’écrit rien quand l’état est resté celui d’arrivée', () => {
    expect(colonnesMasqueesVersUrl({ description: false, isActive: false }, DEFAUTS)).toBeNull()
    // L'ordre de saisie ne compte pas : c'est le même état.
    expect(colonnesMasqueesVersUrl({ isActive: false, description: false }, DEFAUTS)).toBeNull()
  })

  it('écrit le mot réservé quand on a tout révélé', () => {
    expect(colonnesMasqueesVersUrl({ description: true, isActive: true }, DEFAUTS)).toBe(
      AUCUNE_COLONNE_MASQUEE
    )
  })

  it('relit les défauts en l’absence de paramètre, et non « tout visible »', () => {
    expect(colonnesMasqueesDepuisUrl(undefined, MASQUABLES_TARIFS, DEFAUTS)).toEqual(DEFAUTS)
  })

  it('relit « tout visible » sur le mot réservé', () => {
    expect(colonnesMasqueesDepuisUrl(AUCUNE_COLONNE_MASQUEE, MASQUABLES_TARIFS, DEFAUTS)).toEqual(
      {}
    )
  })

  /* Le cas qui motive tout ce mécanisme : révéler une colonne cachée d’origine doit survivre. */
  it('restitue un choix qui révèle une colonne masquée par défaut', () => {
    const choisi = { description: true, isActive: false }
    const ecrit = colonnesMasqueesVersUrl(choisi, DEFAUTS)
    expect(ecrit).toBe('isActive')
    expect(colonnesMasqueesDepuisUrl(ecrit, MASQUABLES_TARIFS, DEFAUTS)).toEqual({
      isActive: false,
    })
  })

  /* Les défauts rendus sont une COPIE : les modifier ne doit pas contaminer l’écran suivant. */
  it('ne rend jamais l’objet des défauts lui-même', () => {
    const relu = colonnesMasqueesDepuisUrl(undefined, MASQUABLES_TARIFS, DEFAUTS)
    relu.description = true
    expect(DEFAUTS.description).toBe(false)
  })
})
