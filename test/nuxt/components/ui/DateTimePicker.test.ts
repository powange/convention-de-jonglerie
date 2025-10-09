import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DateTimePicker from '../../../../app/components/ui/DateTimePicker.vue'

describe('DateTimePicker', () => {
  it("affiche la date et l'heure correctement", async () => {
    const date = new Date('2024-03-20T14:30:00')
    const component = await mountSuspended(DateTimePicker, {
      props: {
        modelValue: date,
      },
    })

    expect(component.exists()).toBe(true)
    const input = component.find('input[type="datetime-local"]')
    expect(input.exists()).toBe(true)
  })

  it('émet un événement update:modelValue lors du changement', async () => {
    const component = await mountSuspended(DateTimePicker, {
      props: {
        modelValue: new Date(),
      },
    })

    const input = component.find('input[type="datetime-local"]')
    const newDate = '2024-03-21T15:45'
    await input.setValue(newDate)

    expect(component.emitted('update:modelValue')).toBeTruthy()
    expect(component.emitted('update:modelValue')?.[0]).toBeDefined()
  })

  it('applique les contraintes min et max', async () => {
    const minDate = new Date('2024-01-01')
    const maxDate = new Date('2024-12-31')

    const component = await mountSuspended(DateTimePicker, {
      props: {
        modelValue: new Date('2024-06-15'),
        min: minDate,
        max: maxDate,
      },
    })

    const input = component.find('input[type="datetime-local"]')
    expect(input.attributes('min')).toBeDefined()
    expect(input.attributes('max')).toBeDefined()
  })

  it("désactive l'input si disabled est true", async () => {
    const component = await mountSuspended(DateTimePicker, {
      props: {
        modelValue: new Date(),
        disabled: true,
      },
    })

    const input = component.find('input[type="datetime-local"]')
    expect(input.attributes('disabled')).toBeDefined()
  })

  it('affiche le label si fourni', async () => {
    const component = await mountSuspended(DateTimePicker, {
      props: {
        modelValue: new Date(),
        label: 'Date de début',
      },
    })

    expect(component.text()).toContain('Date de début')
  })
})
