import { describe, expect, it } from 'vitest'

import { CATEGORIES_DE_GESTION, categorieDeGestion } from '../../../app/utils/categories-de-gestion'

/**
 * Chaque catégorie porte sa couleur sous DEUX formes : une classe posée sur l'icône (l'accueil) et
 * une variante qui l'atteint depuis son lien (la barre latérale). Les réunir dans un même objet ne
 * suffit pas à les garder d'accord — c'est ce que ces tests font.
 */
describe('le registre des catégories', () => {
  /** La couleur nommée par une classe Tailwind, `text-amber-600` → `amber-600`. */
  const couleurNommee = (classe: string) => classe.match(/text-([a-z]+-\d+)/)?.[1]

  it('dit la même couleur dans ses deux formes', () => {
    const divergences = Object.entries(CATEGORIES_DE_GESTION)
      .map(([id, c]) => {
        const posee = couleurNommee(c.classeIcone)
        const dansUnLien = [...c.classeDansUnLien.matchAll(/text-([a-z]+-\d+)/g)].map((m) => m[1])
        const toutes = new Set([posee, ...dansUnLien])
        return toutes.size === 1 ? null : `${id} : ${[...toutes].join(' contre ')}`
      })
      .filter(Boolean)

    expect(divergences).toEqual([])
  })

  it('atteint les deux niveaux du menu', () => {
    // Une catégorie est une entrée parente, mais ses enfants portent `childLinkIcon` : oublier l'un
    // des deux sélecteurs laisserait la moitié des icônes en gris, sans rien casser par ailleurs.
    for (const [id, c] of Object.entries(CATEGORIES_DE_GESTION)) {
      expect(c.classeDansUnLien, `${id} : entrée parente`).toContain('data-slot=linkLeadingIcon')
      expect(c.classeDansUnLien, `${id} : sous-entrées`).toContain('data-slot=childLinkIcon')
    }
  })

  it('n’écrit jamais une classe par interpolation', () => {
    // Tailwind lit les sources pour décider de ce qu'il génère : une classe composée à l'exécution
    // n'existerait pas dans la feuille de style, et l'icône retomberait sur la couleur du thème.
    for (const c of Object.values(CATEGORIES_DE_GESTION)) {
      expect(c.classeIcone).not.toContain('${')
      expect(c.classeDansUnLien).not.toContain('${')
    }
  })

  it('déclare une icône pour chaque catégorie', () => {
    const sansIcone = Object.entries(CATEGORIES_DE_GESTION)
      .filter(([, c]) => !c.icone)
      .map(([id]) => id)
    expect(sansIcone).toEqual([])
  })

  it('ne porte aucune variante sombre', () => {
    // L'accueil n'en a pas. En ajouter une d'un seul côté ferait diverger les deux surfaces dans le
    // thème sombre exactement — c'est-à-dire là où personne ne penserait à regarder.
    for (const c of Object.values(CATEGORIES_DE_GESTION)) {
      expect(c.classeIcone).not.toContain('dark:')
      expect(c.classeDansUnLien).not.toContain('dark:')
    }
  })

  it('rend `undefined` pour un identifiant inconnu', () => {
    expect(categorieDeGestion('inexistante')).toBeUndefined()
    expect(categorieDeGestion(undefined)).toBeUndefined()
  })

  it('retrouve une catégorie par son identifiant', () => {
    expect(categorieDeGestion('repas')?.icone).toBe('cbi:mealie')
  })
})
