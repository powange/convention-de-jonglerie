import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import EntryModal from '../../../../../../layers/treasury/app/components/treasury/EntryModal.vue'

/**
 * « À régler à » : son texte d'aide se place SOUS le champ, pas à côté du libellé.
 *
 * Le champ portait `:hint`, qui rend l'aide dans la rangée du libellé. Ce texte fait 133
 * caractères — une phrase entière, qui explique au passage l'exclusion avec l'avance. Collée à
 * droite d'un libellé de trois mots, elle écrasait l'en-tête du champ. `:help`, lui, rend après
 * le contenu du `UFormField`.
 *
 * Trois autres champs du dépôt avaient le même écart (import d'édition, mise à jour par IA,
 * mot de passe d'application Infomaniak) ; ils sont corrigés du même geste. Un seul est éprouvé
 * ici : la prop est la même et le composant qui la rend est celui de Nuxt UI, donc couvrir les
 * quatre ne prouverait rien de plus que la bibliothèque.
 *
 * ⚠️ RIEN N'EST ASSERTÉ SUR LE TEXTE LUI-MÊME. L'environnement de test rend l'interface en
 * anglais, et une clé fraîchement synchronisée passe par `[TODO]` : une assertion sur le libellé
 * serait vraie aujourd'hui et fausse à la prochaine synchro.
 */
describe('EntryModal — l’aide du bénéficiaire se place sous le champ', () => {
  /*
   * `UModal` téléporte dans `document.body`, partagé entre les tests du fichier : un test qui
   * échoue n'atteint pas son `unmount()`, et le suivant lirait sa modale. Même raison que dans
   * `entry-modal-ligne-previsionnelle.test.ts`.
   */
  let composant: Awaited<ReturnType<typeof mountSuspended>> | null = null

  afterEach(() => {
    composant?.unmount()
    composant = null
  })

  /**
   * Monte la modale sur une dépense SANS avance : c'est la seule configuration où le champ
   * existe, les deux s'excluant à l'écran.
   */
  const ouvrir = async () => {
    composant = await mountSuspended(EntryModal, {
      props: {
        codes: [],
        currency: 'EUR',
        editionId: 21,
        open: true,
        entry: { entryId: 13, kind: 'EXPENSE', title: 'Cordes', settled: 12300, pending: 0 },
      },
    })
    await nextTick()
  }

  it('relie l’aide au champ par `aria-describedby`, et non le libellé', async () => {
    await ouvrir()

    /*
     * Visé par son attribut dédié, qui est son identité — et non par sa position parmi les
     * contrôles de la modale, qui changerait au premier champ ajouté.
     */
    const champ = document.body.querySelector('[data-entry-payee]')
    expect(
      champ,
      'le champ « À régler à » doit être rendu pour une dépense sans avance'
    ).not.toBeNull()

    /*
     * 📍 C'EST ICI QUE LE DÉFAUT SE LIT. Nuxt UI construit `aria-describedby` à partir des props
     * réellement passées : `…-hint` pour une indication accolée au libellé, `…-help` pour un
     * texte placé après le champ. L'attribut dit donc laquelle des deux est en service, sans
     * qu'on ait à inspecter une classe ni une géométrie — indisponible en environnement de test.
     */
    const decritPar = (champ!.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    const detail = `le champ est décrit par ${JSON.stringify(decritPar)}`

    expect(
      decritPar.filter((id) => id.endsWith('-help')),
      detail
    ).toHaveLength(1)
    expect(
      decritPar.filter((id) => id.endsWith('-hint')),
      detail
    ).toHaveLength(0)
  })

  it('rend l’aide APRÈS le champ dans le document', async () => {
    await ouvrir()

    const champ = document.body.querySelector('[data-entry-payee]')!
    const idAide = (champ.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .find((id) => id.endsWith('-help'))
    expect(idAide, 'aucune aide reliée au champ').toBeTruthy()

    const aide = document.getElementById(idAide!)
    expect(
      aide,
      'l’aide est annoncée par `aria-describedby` mais absente du document'
    ).not.toBeNull()
    expect(aide!.getAttribute('data-slot')).toBe('help')

    /*
     * « Sous le champ » se vérifie par l'ORDRE DU DOCUMENT, et non par des coordonnées : en
     * environnement de test, tout rectangle est à zéro et une comparaison de hauteurs passerait
     * quelle que soit la prop.
     */
    const suit = champ.compareDocumentPosition(aide!) & Node.DOCUMENT_POSITION_FOLLOWING
    expect(suit, 'l’aide précède le champ : elle est rendue dans la rangée du libellé').toBeTruthy()
  })
})
