import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import EntryModal from '../../../../app/components/treasury/EntryModal.vue'
import { parseMontantSaisi } from '../../../../shared/utils/money'

/**
 * Rouvrir une ligne PRÉVISIONNELLE pour la modifier.
 *
 * Le formulaire s'initialisait avec `entry.settled / 100`. Or `treasury-compute` place le montant
 * d'une ligne prévisionnelle dans `pending` et laisse `settled` à zéro : la modale s'ouvrait donc à
 * 0, et comme la validité exige un montant strictement positif, le bouton « Enregistrer » restait
 * désactivé. La ligne était impossible à modifier — même pour n'en changer que le titre.
 *
 * Les tests portent sur ce que le formulaire a CALCULÉ, en interrogeant le champ du montant, et non
 * sur un libellé : l'environnement de test rend l'interface en anglais.
 */
describe('EntryModal — une ligne prévisionnelle se rouvre avec son montant', () => {
  const base = {
    codes: [],
    currency: 'EUR',
    editionId: 21,
  }

  /*
   * Démontage en `afterEach`, et non à la fin de chaque test.
   *
   * `UModal` téléporte dans `document.body`, qui est PARTAGÉ entre les tests du fichier. Un test qui
   * échoue n'atteint pas son `unmount()` : sa modale reste alors dans le corps du document, et le
   * test suivant lit SON champ. Constaté en retirant le correctif — un seul test aurait dû tomber,
   * trois sont tombés, et les deux de trop lisaient le montant du premier.
   */
  let composant: Awaited<ReturnType<typeof mountSuspended>> | null = null

  afterEach(() => {
    composant?.unmount()
    composant = null
  })

  /**
   * Le champ du montant.
   *
   * Deux choses à savoir, l'une et l'autre découvertes en sondant le rendu réel :
   *
   * - `UModal` téléporte son contenu dans `document.body` ; interroger l'arbre du composant ne rend
   *   qu'un commentaire `<!--teleport-->` ;
   * - le champ est un `UiMoneyInput`, donc un `type="text"` portant `inputmode="decimal"`. Il
   *   remplace un `UInputNumber`, qui lisait « 12,50 » comme 1 250 faute de locale — et c'est
   *   `role="spinbutton"` que ce test visait alors.
   *
   * Visé par son `inputmode`, qui est son identité — c'est le seul montant de la modale — et non
   * par sa position parmi les `<input>`, qui changerait au premier champ ajouté.
   */
  const champMontant = (): HTMLInputElement => {
    const trouves = document.body.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')
    // Un seul, sans quoi on lirait la modale d'un autre test resté ouvert.
    expect(trouves).toHaveLength(1)
    return trouves[0]!
  }

  /**
   * Ce que le champ DÉSIGNE, et non le texte qu'il affiche.
   *
   * `UiMoneyInput` met le montant en forme selon la locale : « 12.5 » en anglais, « 12,5 » en
   * français. Un `Number()` sur cette chaîne rendrait `NaN` dès que l'environnement de test
   * basculerait de langue. On relit donc avec l'analyseur du champ lui-même.
   */
  const montantLu = () => parseMontantSaisi(champMontant().value)

  it('affiche le montant d’une ligne prévisionnelle, porté par `pending`', async () => {
    composant = await mountSuspended(EntryModal, {
      props: {
        ...base,
        open: true,
        entry: {
          entryId: 12,
          kind: 'EXPENSE',
          title: 'Location de la salle',
          // Le cas du constat : rien de réglé, 450 € engagés.
          settled: 0,
          pending: 45000,
          isForecast: true,
        },
      },
    })
    await nextTick()

    expect(montantLu()).toBe(450)
  })

  it('affiche le montant d’une ligne ordinaire, porté par `settled`', async () => {
    // La contrepartie : sans elle, initialiser le formulaire avec `pending` seul passerait le test
    // précédent en cassant le cas courant.
    composant = await mountSuspended(EntryModal, {
      props: {
        ...base,
        open: true,
        entry: {
          entryId: 13,
          kind: 'EXPENSE',
          title: 'Cordes',
          settled: 12300,
          pending: 0,
          isForecast: false,
        },
      },
    })
    await nextTick()

    expect(montantLu()).toBe(123)
  })

  it('ouvre une création à zéro', async () => {
    composant = await mountSuspended(EntryModal, {
      props: { ...base, open: true, entry: null },
    })
    await nextTick()

    expect(montantLu()).toBe(0)
  })

  /*
   * ⚠️ UN MONTANT À CENTIMES, qui est tout l'objet du changement de champ. 1 250 centimes doivent
   * se rouvrir en 12,50 — et non en 1 250, ce que l'ancien champ produisait en relisant sa propre
   * mise en forme.
   */
  it('rouvre un montant à centimes sans le centupler', async () => {
    composant = await mountSuspended(EntryModal, {
      props: {
        ...base,
        open: true,
        entry: { entryId: 15, kind: 'EXPENSE', title: 'Gaffer', settled: 1250, pending: 0 },
      },
    })
    await nextTick()

    expect(montantLu()).toBe(12.5)
  })

  it('tolère une ligne sans `pending` du tout', async () => {
    // `pending` est optionnel dans la propriété : une ligne construite sans lui ne doit pas rendre
    // `NaN`, ce qu'un `settled + entry.pending` sans repli produirait.
    composant = await mountSuspended(EntryModal, {
      props: {
        ...base,
        open: true,
        entry: { entryId: 14, kind: 'INCOME', title: 'Buvette', settled: 5000 },
      },
    })
    await nextTick()

    expect(montantLu()).toBe(50)
  })
})
