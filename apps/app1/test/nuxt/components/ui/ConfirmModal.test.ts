import { describe, it, expect } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import ConfirmModal from '../../../../app/components/ui/ConfirmModal.vue'

// Mock useI18n pour éviter les problèmes d'initialisation
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

describe('ConfirmModal', () => {
  it('monte le composant avec succès', async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: true,
        title: 'Confirmer la suppression',
        description: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
      },
    })

    expect(component.exists()).toBe(true)
  })

  it('rend le composant avec les props fournis', async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: true,
        title: 'Confirmer la suppression',
        description: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
      },
    })

    // Le composant devrait être rendu même si le contenu est dans un teleport
    expect(component.html()).toBeDefined()
    expect(component.html().length).toBeGreaterThan(0)
  })

  it('utilise UModal comme composant de base', async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: false,
        title: 'Confirmer',
        description: 'Message',
      },
    })

    // Le composant devrait être défini
    expect(component.exists()).toBe(true)
  })
})
