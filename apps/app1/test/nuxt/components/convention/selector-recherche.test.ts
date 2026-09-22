import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import { USelectMenu } from '#components'
import ConventionSelector from '../../../../app/components/convention/Selector.vue'

/**
 * Le sélecteur de conventions ne propose une recherche qu'au-delà de quatre entrées.
 *
 * En dessous, la liste se parcourt d'un coup d'œil, et le champ ouvrirait le clavier virtuel sur
 * téléphone pour quatre lignes déjà toutes visibles. `USelectMenu` affiche cette recherche par
 * DÉFAUT : sans valeur explicite, elle apparaîtrait dès deux conventions.
 *
 * Le test porte sur la propriété réellement transmise au composant, et non sur un calcul recopié :
 * c'est elle qui gouverne l'affichage, et son sens a été vérifié dans la documentation de Nuxt UI
 * (`searchInput: boolean | InputProps`, défaut `true`).
 */
const conventions = (combien: number) =>
  Array.from({ length: combien }, (_, i) => ({
    id: i + 1,
    name: `Convention ${i + 1}`,
    _count: { editions: 2 },
  }))

const monter = (combien: number) =>
  mountSuspended(ConventionSelector, {
    props: { conventions: conventions(combien), modelValue: 1 },
  })

const rechercheDe = async (combien: number) => {
  const vue = await monter(combien)
  // `USelectMenu` est typé de façon générique sur ses `items` ; `findComponent` n'y trouve pas de
  // surcharge applicable et retombe sur un `DOMWrapper`. L'échappatoire est assumée et circonscrite
  // à cette ligne — le même motif que `select-menu-creneau.test.ts`, pour la même raison.
  return (
    vue.findComponent(USelectMenu as never) as unknown as { props: (n: string) => unknown }
  ).props('searchInput')
}

describe('sélecteur de conventions : le champ de recherche', () => {
  it('masque la recherche jusqu’à quatre conventions', async () => {
    for (const combien of [2, 3, 4]) {
      expect(await rechercheDe(combien), `${combien} conventions`).toBe(false)
    }
  })

  it('propose la recherche à partir de cinq', async () => {
    for (const combien of [5, 12]) {
      expect(await rechercheDe(combien), `${combien} conventions`).toMatchObject({
        placeholder: expect.any(String),
      })
    }
  })

  it('ne s’affiche pas du tout avec une seule convention', async () => {
    // Le sélecteur entier disparaît : choisir entre une seule option n'est pas un choix.
    const vue = await monter(1)
    expect(vue.findComponent(USelectMenu as never).exists()).toBe(false)
  })

  it('porte un libellé traduit, et non une chaîne brute', async () => {
    // Une clé i18n absente s'affiche telle quelle, sans erreur : on vérifie qu'on ne montre pas
    // « common.search » à l'utilisateur.
    const recherche = (await rechercheDe(5)) as { placeholder: string }
    expect(recherche.placeholder).not.toContain('common.search')
    expect(recherche.placeholder.length).toBeGreaterThan(0)
  })
})
