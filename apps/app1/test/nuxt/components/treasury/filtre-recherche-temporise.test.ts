import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import Filters from '../../../../app/components/treasury/Filters.vue'

/**
 * Le champ de recherche de la trésorerie ne filtre plus à chaque touche.
 *
 * ⚠️ POURQUOI UN SECOND ÉCRAN et pas seulement celui du stock. Les deux composants emploient le
 * même composable, mais ils ne le branchent pas pareil : le stock passe par un `defineModel` par
 * champ, la trésorerie mêle son champ de texte à trois autres filtres — codes, date de début, date
 * de fin — dans un même composant, et c'est le PARENT qui remet tout à zéro.
 *
 * ⚠️ CE QUE LA TEMPORISATION ÉVITE ICI, et ce n'est pas d'abord le filtrage. La page détient
 * toutes ses lignes et les reparcourt pour chaque caractère — mais elle écrit AUSSI l'adresse à
 * chaque changement de filtre. Une recherche de dix lettres produisait dix écritures d'adresse, sur
 * un écran où l'on tape volontiers un libellé entier.
 *
 * 🔬 L'assertion qui voit le défaut est celle du modèle À MI-COURSE : un test qui n'observerait
 * que la valeur finale serait vert sans aucune temporisation.
 */

const proprietesDeBase = {
  choixDeCode: [],
  texte: '',
  codes: [],
  du: '',
  au: '',
}

describe('TreasuryFilters — la recherche est temporisée', () => {
  let composant: Awaited<ReturnType<typeof mountSuspended>> | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    // Démontage AVANT de rendre les vrais minuteurs : le composable vide sa file à la destruction
    // de la portée, et l'ordre inverse laisserait un `setTimeout` en suspens — un rejet non géré
    // qui fait rougir la CI sans nommer aucun test (#618).
    composant?.unmount()
    composant = null
    vi.useRealTimers()
  })

  async function monter(texte = '') {
    composant = await mountSuspended(Filters, { props: { ...proprietesDeBase, texte } })
    return composant
  }

  /** Le champ de recherche : le premier `input` du composant, les autres étant dates et codes. */
  function champ(c: any) {
    return c.findAll('input')[0]
  }

  it('affiche la frappe TOUT DE SUITE', async () => {
    // Reposer le champ sur la valeur temporisée ferait traîner les lettres : on tape « location
    // salle » et on voit « location sa ». Ce test interdit cette solution.
    const c = await monter()

    await champ(c).setValue('location salle')

    expect(champ(c).element.value).toBe('location salle')
  })

  it('ne remonte RIEN au parent avant l’échéance', async () => {
    const c = await monter()

    await champ(c).setValue('location salle')
    vi.advanceTimersByTime(200)
    await nextTick()

    expect(c.emitted('update:texte')).toBeUndefined()
  })

  it('ne produit qu’UNE écriture pour un libellé entier', async () => {
    /*
     * Le gain mesuré : quatorze caractères, une seule écriture — donc une seule écriture d'adresse au
     * lieu de quatorze. Chaque frappe doit annuler la précédente, et non empiler quatorze
     * minuteurs.
     */
    const c = await monter()

    let valeur = ''
    for (const lettre of 'location salle') {
      valeur += lettre
      await champ(c).setValue(valeur)
      vi.advanceTimersByTime(30)
    }
    vi.advanceTimersByTime(250)
    await nextTick()

    expect(c.emitted('update:texte')).toEqual([['location salle']])
  })

  it('la touche Entrée écrit SANS attendre', async () => {
    const c = await monter()

    await champ(c).setValue('assurance')
    await champ(c).trigger('keydown.enter')

    expect(c.emitted('update:texte')).toEqual([['assurance']])
  })

  it('suit le « tout effacer » du parent, sans le défaire ensuite', async () => {
    /*
     * ⚠️ LE CAS PROPRE À CET ÉCRAN. `effacerLesFiltres`, dans la page, écrit les quatre modèles
     * d'un coup. Le champ doit se vider — sinon il afficherait un filtre que la liste n'applique
     * plus — ET l'écriture en attente doit être abandonnée, sans quoi elle réécrirait un quart de
     * seconde plus tard le texte qu'on vient d'effacer.
     */
    const c = await monter('assurance')

    await champ(c).setValue('assurances')
    await c.setProps({ ...proprietesDeBase, texte: '' })
    await nextTick()

    expect(champ(c).element.value).toBe('')

    vi.advanceTimersByTime(500)
    await nextTick()

    expect(
      c.emitted('update:texte')?.some((appel: unknown[]) => appel[0] === 'assurances')
    ).not.toBe(true)
  })

  it('les bornes de DATE restent immédiates', async () => {
    /*
     * ⚠️ CE QUI NE DOIT PAS AVOIR CHANGÉ. Temporiser un choix de date ou un sélecteur de codes
     * n'apporte rien — on ne « tape » pas dans un calendrier — et retarderait un clic, ce qui se
     * lit comme une panne. Seule la SAISIE LIBRE est temporisée.
     *
     * 📍 Les dates ne sont PAS des `input[type=date]` : elles passent par `UiDateField`, qui rend
     * un calendrier. On agit donc sur le composant lui-même, en lui faisant émettre ce qu'un clic
     * sur un jour émettrait — une première version de ce test cherchait un `input[type=date]` et
     * n'en trouvait aucun.
     */
    const c = await monter()
    const champsDeDate = c.findAllComponents({ name: 'UiDateField' })
    expect(champsDeDate.length).toBe(2)

    champsDeDate[0].vm.$emit('update:modelValue', '2026-01-15')
    await nextTick()

    // Aucun minuteur avancé : la valeur est déjà remontée.
    expect(c.emitted('update:du')).toEqual([['2026-01-15']])
  })
})
