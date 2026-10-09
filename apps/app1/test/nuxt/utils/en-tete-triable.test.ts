import { describe, it, expect, vi } from 'vitest'

/*
 * ⚠️ CE FICHIER VIT DANS `test/nuxt/` ET NON DANS `test/unit/`, et ce n'est pas un rangement :
 * l'util importe `UButton` depuis `#components`, un alias que seul l'environnement Nuxt résout.
 * Dans le projet `unit`, qui tourne SANS Nuxt, l'import échoue au chargement — « Tests: no tests »,
 * et aucune assertion ne s'exécute.
 */
import { enTeteTriable } from '../../../app/utils/en-tete-triable'

/**
 * L'en-tête triable, partagé — et les trois états qu'il doit distinguer.
 *
 * Cette fonction existait en CINQ copies identiques. Ce test fixe ce qu'elles faisaient toutes,
 * pour que la fusion ne change rien : trois icônes pour trois états, et un clic qui demande
 * l'ordre inverse de celui en cours.
 */
const colonneFactice = (sens: false | 'asc' | 'desc') => ({
  getIsSorted: () => sens,
  toggleSorting: vi.fn(),
})

describe('enTeteTriable', () => {
  it('annonce qu’une colonne est triable AVANT qu’elle le soit', () => {
    /*
     * La flèche double est ce qui invite à cliquer. Sans elle, rien ne distingue une colonne
     * triable d'une colonne ordinaire — et personne n'essaie.
     */
    const rendu = enTeteTriable(colonneFactice(false) as never, 'Nom')

    expect(rendu.props?.icon).toBe('i-lucide-arrow-up-down')
    expect(rendu.props?.label).toBe('Nom')
  })

  it('montre le sens courant du tri', () => {
    expect(enTeteTriable(colonneFactice('asc') as never, 'Nom').props?.icon).toBe(
      'i-lucide-arrow-up-narrow-wide'
    )
    expect(enTeteTriable(colonneFactice('desc') as never, 'Nom').props?.icon).toBe(
      'i-lucide-arrow-down-wide-narrow'
    )
  })

  it('demande l’ordre INVERSE de celui en cours', () => {
    /*
     * `toggleSorting(true)` demande le décroissant. Depuis le croissant, le clic doit donc passer
     * `true` ; depuis tout autre état, `false`. Inverser cet argument rendrait le tri incapable
     * de repasser en croissant — un défaut qu'on ne voit qu'au deuxième clic.
     */
    const croissant = colonneFactice('asc')
    enTeteTriable(croissant as never, 'Nom').props?.onClick()
    expect(croissant.toggleSorting).toHaveBeenCalledWith(true)

    const decroissant = colonneFactice('desc')
    enTeteTriable(decroissant as never, 'Nom').props?.onClick()
    expect(decroissant.toggleSorting).toHaveBeenCalledWith(false)

    const nonTrie = colonneFactice(false)
    enTeteTriable(nonTrie as never, 'Nom').props?.onClick()
    expect(nonTrie.toggleSorting).toHaveBeenCalledWith(false)
  })

  it('garde le décalage qui aligne le libellé sur les colonnes non triables', () => {
    // Sans `-mx-2.5`, le rembourrage du bouton décale visiblement la colonne triable.
    expect(enTeteTriable(colonneFactice(false) as never, 'Nom').props?.class).toBe('-mx-2.5')
  })
})

/**
 * ⚠️ LE TEST QUI MANQUAIT, et qui a coûté une CI rouge.
 *
 * Les tests ci-dessus vérifient les PROPS rendues — icône, libellé, clic. Ils passaient au vert
 * alors que les en-têtes s'affichaient VIDES en production, parce qu'ils ne regardaient pas le
 * premier argument de `h()` : le composant.
 *
 * La cause : les cinq copies d'origine employaient `resolveComponent('UButton')`, et cela marchait
 * — parce qu'elles vivaient dans des `.vue`, où le module `components` de Nuxt réécrit cet appel
 * en import statique à la compilation. Dans un `.ts`, la réécriture n'a pas lieu :
 * `resolveComponent` s'exécute hors contexte de rendu et rend la CHAÎNE « UButton », qui se rend
 * comme une balise inconnue — donc rien.
 *
 * Aucune erreur, aucune page blanche : seulement des colonnes sans titre. L'instantané Playwright
 * l'a dit d'un coup d'œil, là où lint, typecheck et 4036 tests unitaires n'avaient rien vu.
 */
describe('le composant rendu, et non seulement ses props', () => {
  it('rend un COMPOSANT et non une chaîne', () => {
    const rendu = enTeteTriable(colonneFactice(false) as never, 'Nom')

    expect(
      typeof rendu.type,
      'une chaîne ici signifie un composant non résolu : l’en-tête se rendra vide'
    ).not.toBe('string')
  })

  it('ne rend pas la balise littérale « UButton »', () => {
    // La forme exacte du défaut : `h('UButton', …)` au lieu de `h(UButton, …)`.
    expect(enTeteTriable(colonneFactice(false) as never, 'Nom').type).not.toBe('UButton')
  })
})
