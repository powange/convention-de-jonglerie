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
  async function typeValue(props: Record<string, unknown>) {
    const component = await mountSuspended(UInputNumber, { props })
    const input = component.find('input')
    await input.setValue('6')
    await input.trigger('blur')
    return component.emitted('update:modelValue')?.at(-1)?.[0]
  }

  it('ramène la saisie au multiple du pas par défaut', async () => {
    expect(await typeValue({ modelValue: 6, min: 0, step: 5 })).toBe(5)
  })

  it('respecte la saisie exacte quand stepSnapping est désactivé', async () => {
    expect(await typeValue({ modelValue: 6, min: 0, step: 5, stepSnapping: false })).toBe(6)
  })
})
