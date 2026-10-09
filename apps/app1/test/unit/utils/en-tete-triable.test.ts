import { describe, it, expect, vi } from 'vitest'

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
