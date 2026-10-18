import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { USelectMenu } from '#components'

/**
 * Le nom du créneau qui rend le contenu du déclencheur d'un `USelectMenu`.
 *
 * Le dépôt employait `#label` à dix endroits, hérité d'une version antérieure de Nuxt UI. Ce
 * créneau n'existe plus : un gabarit posé sur un nom inconnu est ignoré EN SILENCE, ni erreur ni
 * avertissement — les dix textes de repli qu'il portait ne s'affichaient donc nulle part depuis
 * la montée de version.
 *
 * Ce test constate le nom juste en montant réellement le composant, plutôt qu'en s'en remettant à
 * la documentation. Il tient aussi lieu de garde pour la prochaine montée de version : si le nom
 * change encore, c'est ici qu'on l'apprendra, et non sur un écran muet.
 *
 * ⚠️ Le composant est IMPORTÉ, et non résolu par son nom : une première version s'appuyait sur
 * `resolveComponent`, qui échouait silencieusement dans cet environnement. Les deux cas rendaient
 * alors une chaîne vide, et le test « le créneau label est ignoré » passait pour la mauvaise
 * raison — il ne prouvait rien.
 */
const monter = (creneau: 'label' | 'default') =>
  mountSuspended(
    defineComponent({
      setup() {
        return () =>
          h(
            // Le composant est typé de façon générique sur ses `items` ; `h` n'y trouve pas de
            // surcharge applicable. Ce test ne porte pas sur son typage mais sur le nom d'un
            // créneau, d'où l'échappatoire — assumée et circonscrite à cet appel.
            USelectMenu as any,
            {
              modelValue: [],
              items: [{ label: 'Gala', value: 1 }],
              multiple: true,
              valueKey: 'value',
            },
            { [creneau]: () => h('span', 'aucun quota sélectionné') }
          )
      },
    })
  )

/**
 * Le créneau qui rend chaque ENTRÉE de la liste déroulante.
 *
 * Le dépôt employait `#option` à trois endroits, hérité de la même version antérieure. Effet
 * visible : les drapeaux du sélecteur de pays ne s'affichaient pas dans la liste.
 *
 * ⚠️ DEUX RÉGLAGES SANS LESQUELS CE TEST NE PROUVERAIT RIEN :
 *
 * - `defaultOpen` — les entrées ne sont rendues que menu ouvert. Fermé, les deux créneaux
 *   rendraient une chaîne vide et le cas « `option` est ignoré » passerait pour la mauvaise
 *   raison, comme cela s'est produit sur la première version du test du déclencheur.
 * - `portal: false` — par défaut le contenu est rendu dans un portail, donc HORS de l'arbre du
 *   composant monté : `composant.text()` ne le verrait pas.
 */
const monterSansSurcharge = () =>
  mountSuspended(
    defineComponent({
      setup() {
        return () =>
          h(USelectMenu as any, {
            modelValue: [],
            items: [{ label: 'Gala', value: 1 }],
            multiple: true,
            valueKey: 'value',
            defaultOpen: true,
            portal: false,
          })
      },
    })
  )

const monterUneEntree = (creneau: 'option' | 'item') =>
  mountSuspended(
    defineComponent({
      setup() {
        return () =>
          h(
            USelectMenu as any,
            {
              modelValue: [],
              items: [{ label: 'Gala', value: 1 }],
              multiple: true,
              valueKey: 'value',
              defaultOpen: true,
              portal: false,
            },
            { [creneau]: () => h('span', 'drapeau du pays') }
          )
      },
    })
  )

/**
 * Le placeholder du champ de recherche.
 *
 * `searchable` et `searchable-placeholder` sont deux props de Nuxt UI v2. Une prop non déclarée
 * est acceptée SANS un mot — comme un créneau inconnu —, et le texte traduit n'atteignait donc
 * jamais l'écran : le champ affichait le placeholder par défaut, dans les 13 langues.
 *
 * `searchable` lui-même était inerte mais sans conséquence visible, `searchInput` valant déjà
 * `true` ; c'est bien le placeholder, et lui seul, qui disparaissait.
 */
const monterAvecRecherche = (props: Record<string, unknown>) =>
  mountSuspended(
    defineComponent({
      setup() {
        return () =>
          h(USelectMenu as any, {
            modelValue: [],
            items: [{ label: 'Gala', value: 1 }],
            multiple: true,
            valueKey: 'value',
            defaultOpen: true,
            portal: false,
            ...props,
          })
      },
    })
  )

/**
 * ⚠️ `valueKey` N'EST PAS UN RENOMMAGE DE `value-attribute` : il change la FORME ÉMISE.
 *
 * `value-attribute` est un nom de Nuxt UI v2, donc inconnu, donc inerte : les composants qui le
 * portaient émettaient l'OBJET entier. Le « traduire » en `valueKey` fait émettre le champ — et
 * casse tout code bâti sur l'objet.
 *
 * C'est arrivé : trois `USelectMenu` ont reçu `value-key="value"` alors que leur `v-model` est un
 * `computed` dont le set lit `value?.value`. Celui-ci est devenu `undefined`, le pays restait
 * vide, la validation bloquait le stepper de création d'édition et le bouton de soumission
 * n'apparaissait jamais. Seul Playwright l'a vu ; aucun test unitaire ne couvrait la forme.
 *
 * 📍 `USelect` se comporte autrement : son `valueKey` vaut DÉJÀ `'value'` par défaut, là où celui
 * de `USelectMenu` vaut `undefined`. Poser `value-key="value"` sur un `USelect` est donc sans
 * effet, et sur un `USelectMenu` ça change le contrat. Le deuxième cas ci-dessous le fixe.
 */
describe('USelectMenu — `valueKey` change la forme émise, il ne renomme rien', () => {
  const premiereEmission = async (props: Record<string, unknown>) => {
    const emissions: unknown[] = []
    const composant = await mountSuspended(
      defineComponent({
        setup() {
          return () =>
            h(USelectMenu as any, {
              modelValue: undefined,
              items: [{ label: 'Gala', value: 42 }],
              defaultOpen: true,
              portal: false,
              'onUpdate:modelValue': (v: unknown) => emissions.push(v),
              ...props,
            })
        },
      })
    )

    const entrees = composant.findAll('[role="option"]')
    expect(entrees.length, 'aucune entrée à cliquer : le menu n’est pas ouvert').toBeGreaterThan(0)
    await entrees[0]!.trigger('click')

    return emissions
  }

  it('SANS `valueKey`, le modèle reçoit l’OBJET entier', async () => {
    const emissions = await premiereEmission({})

    expect(emissions[0]).toEqual({ label: 'Gala', value: 42 })
  })

  it('AVEC `valueKey`, le modèle reçoit le CHAMP — ce n’est pas le même contrat', async () => {
    const emissions = await premiereEmission({ valueKey: 'value' })

    expect(emissions[0]).toBe(42)
  })
})

describe('USelectMenu — le placeholder du champ de recherche', () => {
  it('`search-input` porte bien le placeholder', async () => {
    const composant = await monterAvecRecherche({
      searchInput: { placeholder: 'Rechercher un pays' },
    })

    const champs = composant.findAll('input').map((i) => i.attributes('placeholder'))

    expect(champs, `aucun champ ne porte ce placeholder : ${JSON.stringify(champs)}`).toContain(
      'Rechercher un pays'
    )
  })

  it('⚠️ IGNORE EN SILENCE `searchable-placeholder`', async () => {
    const composant = await monterAvecRecherche({
      searchable: true,
      searchablePlaceholder: 'Rechercher un pays',
    })

    const champs = composant.findAll('input').map((i) => i.attributes('placeholder'))

    expect(champs).not.toContain('Rechercher un pays')
  })

  it('le témoin : le champ de recherche existe bien, menu ouvert', async () => {
    // Sans lui, le cas précédent serait satisfait par un menu qui ne rend aucun champ du tout.
    const composant = await monterAvecRecherche({})

    expect(
      composant.findAll('input').length,
      'le menu n’est pas ouvert, ou le champ de recherche est porté ailleurs'
    ).toBeGreaterThan(0)
  })
})

describe('USelectMenu — le créneau du déclencheur', () => {
  it('rend le contenu posé sur `default`', async () => {
    const composant = await monter('default')

    expect(composant.text()).toContain('aucun quota sélectionné')
  })

  it('ignore en silence le contenu posé sur `label`', async () => {
    // Le cœur du constat : aucune erreur n'est levée, le texte disparaît simplement.
    const composant = await monter('label')

    expect(composant.text()).not.toContain('aucun quota sélectionné')
  })
})

describe('USelectMenu — le créneau d’une entrée de la liste', () => {
  it('rend le contenu posé sur `item`', async () => {
    const composant = await monterUneEntree('item')

    expect(composant.text()).toContain('drapeau du pays')
  })

  it('⚠️ IGNORE EN SILENCE le contenu posé sur `option`', async () => {
    /*
     * Le constat qui a motivé la correction : le gabarit est simplement écarté, sans erreur ni
     * avertissement. Les drapeaux du sélecteur de pays n'étaient donc rendus nulle part depuis la
     * montée de version — et rien dans la console ne le signalait.
     */
    const composant = await monterUneEntree('option')

    expect(composant.text()).not.toContain('drapeau du pays')
  })

  it('le témoin : SANS surcharge, l’entrée et son libellé sont rendus', async () => {
    /*
     * Sans ce cas, les deux précédents seraient satisfaits par un menu fermé qui ne rend aucune
     * entrée du tout — et « `option` est ignoré » passerait pour la mauvaise raison.
     *
     * 📍 Il monte SANS surcharge, délibérément. Ma première version cherchait « Gala » tout en
     * surchargeant `#item` : elle échouait, parce que ce créneau remplace TOUT le rendu de
     * l'entrée, libellé compris. L'échec était juste, et c'est le témoin qui m'a appris la portée
     * réelle du créneau — il ne peut donc pas dépendre de celui dont il doit répondre.
     */
    const composant = await monterSansSurcharge()

    expect(
      composant.text(),
      'le menu n’est pas ouvert, ou son contenu est porté ailleurs'
    ).toContain('Gala')
  })
})
