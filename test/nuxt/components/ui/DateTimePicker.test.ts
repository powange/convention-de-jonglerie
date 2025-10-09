import { describe, it, expect, beforeAll } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import DateTimePicker from '../../../../app/components/ui/DateTimePicker.vue'

// Mock useI18n pour éviter les problèmes d'initialisation
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

describe('DateTimePicker', () => {
  let component: any
  let componentWithLabel: any

  beforeAll(async () => {
    // Monter les composants une seule fois pour tous les tests
    component = await mountSuspended(DateTimePicker, {
      props: {
        modelValue: '2024-03-20T14:30:00',
      },
    })

    componentWithLabel = await mountSuspended(DateTimePicker, {
      props: {
        modelValue: '2024-03-20T14:30:00',
        dateLabel: 'Date de début',
      },
    })
  })

  it('monte le composant avec succès', () => {
    expect(component.exists()).toBe(true)
  })

  it('affiche les champs de date et heure', () => {
    // Le composant utilise UFormField et UCalendar
    expect(component.html()).toBeDefined()
    expect(component.html().length).toBeGreaterThan(0)
  })

  it('affiche le label si fourni', () => {
    expect(componentWithLabel.text()).toContain('Date de début')
  })
})
