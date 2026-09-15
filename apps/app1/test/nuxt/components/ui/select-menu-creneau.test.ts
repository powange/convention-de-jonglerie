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
