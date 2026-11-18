import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import { UInputNumber } from '#components'

/**
 * Les durées (spectacle, numéro, délai du modèle) utilisent un pas supérieur à 1 pour rendre les
 * boutons +/- utiles. Mais `stepSnapping` vaut `true` par défaut : sans le désactiver, toute
 * saisie est ramenée au multiple le plus proche, et une durée de 6 minutes devient impossible à
 * entrer alors que rien ne l'interdit.
 *
 * Ce test vise la bibliothèque plutôt que nos composants : c'est son comportement par défaut qui
 * nous a piégés, et une montée de version qui l'inverserait doit être visible.
 */
describe('UInputNumber : saisie hors multiple du pas', () => {
  /**
   * ⚠️ LA VALEUR DE DÉPART DOIT DIFFÉRER DE LA FRAPPE.
   *
   * Ce test partait de `modelValue: 6` pour saisir « 6 » — donc sans rien changer. Il ne passait
   * que parce que Nuxt UI 4.8.1 émettait un `update:modelValue` **redondant** sur une valeur
   * inchangée. 4.12.2 ne le fait plus, et le cas est tombé sur `expected undefined to be 6` : une
   * dérive d'instrumentation qui ressemble trait pour trait à une régression de la bibliothèque.
   *
   * Mesuré à la montée (18/11/2026), les quatre combinaisons :
   *
   * | départ | accrochage | émissions |
   * | --- | --- | --- |
   * | 6 | désactivé | `[]` — rien à émettre, la valeur ne bouge pas |
   * | 0 | désactivé | `[6]` — la saisie exacte est respectée |
   * | 0 | activé | `[5]` — ramenée au multiple |
   * | 6 | activé | `[5]` |
   *
   * Partir de 0 exerce donc un vrai changement dans les deux cas, et le test ne dépend plus de
   * ce que la bibliothèque émet « pour rien ».
   */
  async function typeValue(props: Record<string, unknown>) {
    const component = await mountSuspended(UInputNumber, { props })
    const input = component.find('input')
    await input.setValue('6')
    await input.trigger('blur')

    const emissions = component.emitted('update:modelValue') ?? []
    // Sans cette garde, un composant qui n'émettrait plus rien rendrait `undefined` et les deux
    // cas se liraient comme un désaccord de valeur — ce qui vient précisément d'arriver.
    expect(
      emissions.length,
      'aucun `update:modelValue` émis : la saisie n’a pas été prise'
    ).toBeGreaterThan(0)
    return emissions.at(-1)?.[0]
  }

  it('ramène la saisie au multiple du pas par défaut', async () => {
    expect(await typeValue({ modelValue: 0, min: 0, step: 5 })).toBe(5)
  })

  it('respecte la saisie exacte quand stepSnapping est désactivé', async () => {
    expect(await typeValue({ modelValue: 0, min: 0, step: 5, stepSnapping: false })).toBe(6)
  })
})
