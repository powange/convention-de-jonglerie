import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import StockItemFilters from '../../../../../../layers/stock/app/components/stock/StockItemFilters.vue'

/**
 * Les filtres de la liste du matériel ne filtrent plus à chaque touche.
 *
 * ⚠️ CE QUI N'ALLAIT PAS, et pourquoi ça se voyait sans se comprendre. Chaque caractère tapé
 * reparcourait la liste entière ET faisait écrire l'adresse par la page (un `replace` par frappe). Sur un
 * matériel de plusieurs centaines d'objets, taper « rallonge » produisait huit filtrages et huit
 * écritures d'adresse — le champ semblait accrocher, sans que rien ne dise pourquoi.
 *
 * 🔬 CE QUE CES TESTS MESURENT, et c'est le cœur du lot : que les DEUX valeurs soient distinctes.
 * La saisie doit suivre la frappe au caractère — sans quoi les lettres traînent à l'écran, un
 * défaut pire que celui qu'on corrige parce qu'il est visible — tandis que le modèle, donc le
 * filtrage chez le parent, n'est mis à jour qu'une fois la frappe retombée.
 *
 * Un test qui n'observerait que le modèle final serait VERT même sans temporisation. C'est la
 * mesure du modèle À MI-COURSE — après la frappe, avant l'échéance — qui voit le défaut.
 *
 * ⚠️ MINUTEURS SIMULÉS. Attendre 250 ms pour de vrai rendrait le fichier lent et, surtout,
 * intermittent : la suite Nuxt tourne à côté du serveur de développement, et un test à seuil de
 * temps y a déjà dépassé 80 secondes sous charge.
 */

const proprietesDeBase = {
  tagItems: [],
  etatsItems: [],
  tags: [],
  etats: [],
}

describe('StockItemFilters — la recherche est temporisée', () => {
  let composant: Awaited<ReturnType<typeof mountSuspended>> | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    /*
     * Démontage AVANT de rendre les vrais minuteurs : le composable vide sa file à la destruction
     * de la portée, et l'ordre inverse laisserait un `setTimeout` en suspens. Un minuteur qui se
     * déclenche après le démontage produit un rejet non géré qui fait rougir la CI sans nommer
     * aucun test — c'est arrivé dans ce dépôt (#618), sur un test de saisie temporisée justement.
     */
    composant?.unmount()
    composant = null
    vi.useRealTimers()
  })

  /** Monte le composant et rend de quoi lire et écrire le champ du nom. */
  async function monter(nom = '', lieu = '') {
    composant = await mountSuspended(StockItemFilters, {
      props: { ...proprietesDeBase, nom, lieu },
    })
    return composant
  }

  /** Le champ du nom : le premier `input` de type texte du composant. */
  function champDuNom(c: any) {
    return c.findAll('input')[0]
  }

  function champDuLieu(c: any) {
    const champs = c.findAll('input')
    return champs[champs.length - 1]
  }

  it('affiche la frappe TOUT DE SUITE', async () => {
    /*
     * La moitié qu'on oublie. Reposer le champ sur la valeur temporisée marcherait pour le
     * filtrage et donnerait un champ qui traîne : on tape « rallonge » et on voit « rall ». Ce
     * test interdit cette solution-là.
     */
    const c = await monter()

    await champDuNom(c).setValue('rallonge')

    expect(champDuNom(c).element.value).toBe('rallonge')
  })

  it('ne remonte RIEN au parent avant l’échéance', async () => {
    /*
     * 🔬 L'ASSERTION QUI VOIT LE DÉFAUT. Sans temporisation, le modèle vaudrait déjà « rallonge »
     * ici, et c'est le seul moment où la différence se mesure : après l'échéance, les deux
     * solutions donnent le même résultat.
     */
    const c = await monter()

    await champDuNom(c).setValue('rallonge')
    vi.advanceTimersByTime(200)
    await nextTick()

    expect(c.emitted('update:nom')).toBeUndefined()
  })

  it('remonte la valeur une fois la frappe retombée', async () => {
    const c = await monter()

    await champDuNom(c).setValue('rallonge')
    vi.advanceTimersByTime(250)
    await nextTick()

    expect(c.emitted('update:nom')).toEqual([['rallonge']])
  })

  it('ne remonte qu’UNE seule valeur pour un mot entier', async () => {
    /*
     * Le gain du lot, chiffré. Huit caractères ne doivent produire qu'une écriture : c'est ce qui
     * fait tomber les huit filtrages et les huit écritures d'adresse de la page.
     *
     * Chaque frappe doit ANNULER la précédente, et non empiler huit minuteurs qui partiraient les
     * uns après les autres — ce que produirait un `setTimeout` sans `clearTimeout`, et qui
     * passerait le test précédent sans rien corriger.
     */
    const c = await monter()

    for (const valeur of ['r', 'ra', 'ral', 'rall', 'rallo', 'rallon', 'rallong', 'rallonge']) {
      await champDuNom(c).setValue(valeur)
      vi.advanceTimersByTime(40)
    }
    vi.advanceTimersByTime(250)
    await nextTick()

    expect(c.emitted('update:nom')).toEqual([['rallonge']])
  })

  it('la touche Entrée écrit SANS attendre', async () => {
    // Entrée veut dire « maintenant ». C'est ce que `refDebounced` de VueUse ne sait pas faire, et
    // la raison pour laquelle le composable est écrit à la main.
    const c = await monter()

    await champDuNom(c).setValue('marmite')
    await champDuNom(c).trigger('keydown.enter')

    expect(c.emitted('update:nom')).toEqual([['marmite']])
  })

  it('la croix vide le champ ET remonte le vide immédiatement', async () => {
    /*
     * Attendre un quart de seconde après un clic sur une croix donne l'impression que le clic n'a
     * pas été pris — et on reclique.
     */
    const c = await monter('marmite')

    await champDuNom(c).setValue('marmites')
    const croix = c.findAll('button')
    await croix[0].trigger('click')

    expect(champDuNom(c).element.value).toBe('')
    expect(c.emitted('update:nom')?.at(-1)).toEqual([''])
  })

  it('le NOM et le LIEU ont chacun leur échéance', async () => {
    /*
     * ⚠️ LE PIÈGE QU'UNE SEULE TEMPORISATION PARTAGÉE AURAIT CRÉÉ. Les deux filtres se composent
     * en ET : on cherche « marmite » puis on précise « cuisine ». Avec un minuteur commun, taper
     * dans le second repousserait l'écriture du premier — la liste ne bougerait pas, et c'est le
     * nom saisi trente secondes plus tôt qu'on croirait fautif.
     */
    const c = await monter()

    await champDuNom(c).setValue('marmite')
    vi.advanceTimersByTime(150)
    await champDuLieu(c).setValue('cuisine')
    vi.advanceTimersByTime(100)
    await nextTick()

    // Le nom a atteint son échéance (150 + 100 = 250) malgré la frappe dans l'autre champ.
    expect(c.emitted('update:nom')).toEqual([['marmite']])
    expect(c.emitted('update:lieu')).toBeUndefined()

    vi.advanceTimersByTime(150)
    await nextTick()
    expect(c.emitted('update:lieu')).toEqual([['cuisine']])
  })

  it('suit une remise à zéro venue du PARENT', async () => {
    /*
     * La page porte un bouton « effacer les filtres » qui écrit directement le modèle. Le champ
     * doit se vider — sinon il afficherait un filtre que la liste n'applique plus — et l'écriture
     * en attente doit être abandonnée, sans quoi elle réécrirait un quart de seconde plus tard le
     * texte qu'on vient d'effacer, et la remise à zéro paraîtrait ne pas avoir marché.
     */
    const c = await monter('marmite')

    await champDuNom(c).setValue('marmites')
    await c.setProps({ ...proprietesDeBase, nom: '', lieu: '' })
    await nextTick()

    expect(champDuNom(c).element.value).toBe('')

    vi.advanceTimersByTime(500)
    await nextTick()

    // Rien n'a été réécrit après coup : le parent reste maître de sa remise à zéro.
    expect(c.emitted('update:nom')?.some((appel: unknown[]) => appel[0] === 'marmites')).not.toBe(
      true
    )
  })
})
