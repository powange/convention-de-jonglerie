import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useModeClairTemporaire } from '../../../app/composables/useModeClairTemporaire'

/**
 * `useColorMode` réel manipule le DOM et n'a pas sa place ici : ce qu'on vérifie, c'est la
 * discipline du composable — ce qu'il pose, ce qu'il rend, et ce à quoi il ne touche pas.
 */
const mode = vi.hoisted(() => ({ preference: 'dark', value: 'dark' }))
mockNuxtImport('useColorMode', () => () => mode)

beforeEach(() => {
  mode.preference = 'dark'
})

describe('useModeClairTemporaire', () => {
  it('passe au clair à l’ouverture et rend le thème d’origine à la fermeture', async () => {
    const ouvert = ref(false)
    useModeClairTemporaire(ouvert)

    ouvert.value = true
    await nextTick()
    expect(mode.preference).toBe('light')

    ouvert.value = false
    await nextTick()
    expect(mode.preference).toBe('dark')
  })

  // Le mode « système » suit le thème de l'appareil : le rendre en « sombre » en dur figerait
  // un choix que l'utilisateur avait justement délégué.
  it('rend « système » tel quel, sans le traduire', async () => {
    mode.preference = 'system'
    const ouvert = ref(false)
    useModeClairTemporaire(ouvert)

    ouvert.value = true
    await nextTick()
    expect(mode.preference).toBe('light')

    ouvert.value = false
    await nextTick()
    expect(mode.preference).toBe('system')
  })

  // Basculer soi-même en sombre pendant que le QR est affiché, c'est un choix : la fermeture
  // ne doit pas le défaire.
  it('respecte un changement de thème fait pendant l’affichage', async () => {
    const ouvert = ref(false)
    useModeClairTemporaire(ouvert)

    ouvert.value = true
    await nextTick()
    mode.preference = 'dark'

    ouvert.value = false
    await nextTick()
    expect(mode.preference).toBe('dark')
  })

  it('ne change rien pour qui est déjà en clair', async () => {
    mode.preference = 'light'
    const ouvert = ref(false)
    useModeClairTemporaire(ouvert)

    ouvert.value = true
    await nextTick()
    ouvert.value = false
    await nextTick()

    expect(mode.preference).toBe('light')
  })

  // Fermer n'est pas toujours un clic : une navigation démonte le composant sans repasser
  // l'état à faux. Sans cette restauration, l'utilisateur resterait en clair sans comprendre.
  it('restaure le thème quand le composant disparaît sans se refermer', async () => {
    const ouvert = ref(true)
    const portee = effectScope()
    portee.run(() => useModeClairTemporaire(ouvert))
    await nextTick()
    expect(mode.preference).toBe('light')

    portee.stop()
    expect(mode.preference).toBe('dark')
  })
})
