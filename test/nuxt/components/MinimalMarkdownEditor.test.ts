import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MinimalMarkdownEditor from '../../../app/components/MinimalMarkdownEditor.vue'

describe('MinimalMarkdownEditor', () => {
  it('monte le composant avec succès', async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: '',
      },
    })

    expect(component.exists()).toBe(true)
  })

  it('affiche un textarea pour l édition', async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: '',
      },
    })

    const textarea = component.find('textarea')
    expect(textarea.exists()).toBe(true)
  })

  it('affiche le contenu initial', async () => {
    const content = '# Titre\n\nCeci est un **texte** en *markdown*'
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: content,
      },
    })

    const textarea = component.find('textarea')
    expect(textarea.element.value).toBe(content)
  })

  it('affiche la barre d outils', async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: '',
      },
    })

    // Vérifier que les boutons de la toolbar sont présents
    const buttons = component.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('affiche le compteur de caractères', async () => {
    const content = 'Test'
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: content,
      },
    })

    expect(component.text()).toContain('4 caractères')
  })

  it('émet update:modelValue lors de la modification', async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: '',
      },
    })

    const textarea = component.find('textarea')
    await textarea.setValue('Nouveau contenu')

    expect(component.emitted('update:modelValue')).toBeTruthy()
  })

  it('désactive l édition si disabled est true', async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: 'Contenu',
        disabled: true,
      },
    })

    const textarea = component.find('textarea')
    expect(textarea.attributes('disabled')).toBeDefined()
  })
})
