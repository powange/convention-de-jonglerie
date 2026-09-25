import { describe, expect, it } from 'vitest'

import {
  COULEURS_DE_MODULE,
  FOND_DE_MODULE,
  ICONE_DE_MODULE,
} from '../../../app/utils/couleurs-de-module'
import { MODULES_DE_GESTION, moduleDeGestion } from '../../../app/utils/modules-de-gestion'

/**
 * Le registre est la seule source de l'icône et de la couleur d'un module.
 *
 * Il existe parce que la même information vivait à deux endroits — les cartes de l'accueil et le
 * titre de chaque page — et avait dérivé : treize pages sans icône, cinq avec la mauvaise, huit
 * avec la mauvaise couleur. Ces tests gardent les invariants qui rendent la dérive impossible.
 */
describe('le registre des modules', () => {
  it('ne déclare que des couleurs que les tables savent traduire', () => {
    /*
     * L'invariant qui manquait, et qui coûtait cher : cinq cartes annonçaient une couleur absente
     * de la table du composant. La recherche rendait `undefined`, la classe devenait
     * « rounded-lg undefined », et la carte s'affichait sans couleur — sans erreur ni avertissement.
     */
    const inconnues = Object.entries(MODULES_DE_GESTION)
      .filter(([, m]) => !COULEURS_DE_MODULE.includes(m.couleur))
      .map(([route, m]) => `${route} → ${m.couleur}`)

    expect(inconnues).toEqual([])
  })

  it('donne une classe de fond et d’icône à chaque couleur', () => {
    for (const couleur of COULEURS_DE_MODULE) {
      expect(FOND_DE_MODULE[couleur], `fond de ${couleur}`).toBeTruthy()
      expect(ICONE_DE_MODULE[couleur], `icône de ${couleur}`).toBeTruthy()
    }
  })

  it('n’écrit jamais une classe par interpolation', () => {
    // Tailwind lit les sources pour décider de ce qu'il génère : une classe composée à l'exécution
    // n'existerait pas dans la feuille de style, et l'on retomberait sur des cartes sans couleur.
    for (const classe of [...Object.values(FOND_DE_MODULE), ...Object.values(ICONE_DE_MODULE)]) {
      expect(classe).not.toContain('${')
    }
  })

  it('déclare une icône pour chaque module', () => {
    const sansIcone = Object.entries(MODULES_DE_GESTION)
      .filter(([, m]) => !m.icone)
      .map(([route]) => route)
    expect(sansIcone).toEqual([])
  })
})

describe('retrouver le module d’un chemin', () => {
  it('accepte le seul segment', () => {
    expect(moduleDeGestion('stock')?.icone).toBe('i-heroicons-archive-box')
  })

  it('accepte une URL complète', () => {
    expect(moduleDeGestion('/editions/22/gestion/stock')?.icone).toBe('i-heroicons-archive-box')
  })

  it('préfère le module le plus précis', () => {
    // `ticketing/tiers` a sa propre icône ; la retrouver ne doit pas retomber sur la billetterie.
    const tarifs = moduleDeGestion('/editions/22/gestion/ticketing/tiers')
    expect(tarifs?.icone).toBe('i-heroicons-currency-euro')
  })

  it('ramène une page de détail à son module parent', () => {
    // La fiche d'un objet de stock porte la couleur du stock : c'est le même module.
    expect(moduleDeGestion('/editions/22/gestion/stock/items/12')).toEqual(
      MODULES_DE_GESTION['stock']
    )
  })

  it('ignore les identifiants numériques', () => {
    expect(moduleDeGestion('/editions/22/gestion/tasks/7')).toEqual(MODULES_DE_GESTION['tasks'])
  })

  it('ignore la chaîne de requête', () => {
    expect(moduleDeGestion('/editions/22/gestion/stock?colonnes=tags')).toEqual(
      MODULES_DE_GESTION['stock']
    )
  })

  it('rend `undefined` pour un chemin inconnu', () => {
    // Une page sans entrée affiche son titre sans icône : l'oubli se voit, il ne casse rien.
    expect(moduleDeGestion('/editions/22/gestion/inexistant')).toBeUndefined()
    expect(moduleDeGestion('')).toBeUndefined()
  })
})
