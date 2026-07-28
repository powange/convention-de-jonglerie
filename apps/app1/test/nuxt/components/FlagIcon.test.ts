import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import FlagIcon from '../../../app/components/FlagIcon.vue'

/**
 * Les drapeaux viennent de la collection Iconify `flag` et non plus de la feuille globale
 * flag-icons : le composant rend donc une icône `i-flag:<pays>-4x3` au lieu des classes
 * `fi fi-<pays>`.
 */
describe('FlagIcon', () => {
  it('affiche le drapeau pour un code pays valide', async () => {
    const component = await mountSuspended(FlagIcon, { props: { code: 'FR' } })

    const flag = component.find('.flag-icon')
    expect(flag.exists()).toBe(true)
    expect(flag.classes()).toContain('i-flag:fr-4x3')
  })

  it('normalise le code pays en minuscules', async () => {
    const component = await mountSuspended(FlagIcon, { props: { code: 'GB' } })

    expect(component.find('.flag-icon').classes()).toContain('i-flag:gb-4x3')
  })

  it('gère les codes pays en minuscules', async () => {
    const component = await mountSuspended(FlagIcon, { props: { code: 'de' } })

    expect(component.find('.flag-icon').classes()).toContain('i-flag:de-4x3')
  })

  it('affiche un emplacement vide sans code, sans icône', async () => {
    const component = await mountSuspended(FlagIcon, { props: { code: '' } })

    const flag = component.find('.flag-icon')
    expect(flag.exists()).toBe(true)
    // Aucun drapeau à afficher : on ne doit demander aucune icône.
    expect(flag.classes().some((c) => c.startsWith('i-flag:'))).toBe(false)
  })

  it('affiche le code pays en attribut title', async () => {
    const component = await mountSuspended(FlagIcon, { props: { code: 'ES' } })

    expect(component.find('.flag-icon').attributes('title')).toBe('es')
  })

  it('gère les codes null ou undefined', async () => {
    const component = await mountSuspended(FlagIcon, { props: { code: null } })

    const flag = component.find('.flag-icon')
    expect(flag.exists()).toBe(true)
    expect(flag.classes().some((c) => c.startsWith('i-flag:'))).toBe(false)
  })

  it('tronque les codes pays à 2 caractères', async () => {
    const component = await mountSuspended(FlagIcon, { props: { code: 'FRA' } })

    expect(component.find('.flag-icon').classes()).toContain('i-flag:fr-4x3')
  })
})
