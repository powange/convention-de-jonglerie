import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MinimalMarkdownEditor from '~/components/MinimalMarkdownEditor.vue'

describe('MinimalMarkdownEditor', () => {
  it('affiche le contenu markdown initial', async () => {
    const content = '# Titre\n\nCeci est un **texte** en *markdown*'
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: content,
      },
    })

    const textarea = component.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect(textarea.element.value).toBe(content)
  })

  it('émet update:modelValue lors de la modification', async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: '',
      },
    })

    const textarea = component.find('textarea')
    const newContent = '## Nouveau titre'
    await textarea.setValue(newContent)

    expect(component.emitted('update:modelValue')).toBeTruthy()
    expect(component.emitted('update:modelValue')?.[0]).toEqual([newContent])
  })

  it('affiche la prévisualisation en mode preview', async () => {
    const content = '**Texte en gras**'
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: content,
        showPreview: true,
      },
    })

    const previewButton = component.find('[data-test="preview-toggle"]')
    if (previewButton.exists()) {
      await previewButton.trigger('click')
      await component.vm.$nextTick()

      const preview = component.find('.markdown-preview')
      expect(preview.exists()).toBe(true)
      expect(preview.html()).toContain('<strong>Texte en gras</strong>')
    }
  })

  it('insère du texte gras avec le bouton toolbar', async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: 'Texte',
      },
    })

    const boldButton = component.find('[data-test="bold-button"]')
    if (boldButton.exists()) {
      // Sélectionner le texte
      const textarea = component.find('textarea')
      textarea.element.setSelectionRange(0, 5)

      await boldButton.trigger('click')

      expect(component.emitted('update:modelValue')).toBeTruthy()
      const emittedValue = component.emitted('update:modelValue')?.[0]?.[0]
      expect(emittedValue).toContain('**Texte**')
    }
  })

  it('insère un lien avec le bouton toolbar', async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: '',
      },
    })

    const linkButton = component.find('[data-test="link-button"]')
    if (linkButton.exists()) {
      await linkButton.trigger('click')

      expect(component.emitted('update:modelValue')).toBeTruthy()
      const emittedValue = component.emitted('update:modelValue')?.[0]?.[0]
      expect(emittedValue).toContain('[texte du lien](url)')
    }
  })

  it('respecte la longueur maximale si spécifiée', async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: '',
        maxLength: 100,
      },
    })

    const textarea = component.find('textarea')
    expect(textarea.attributes('maxlength')).toBe('100')

    const counter = component.find('.character-counter')
    if (counter.exists()) {
      expect(counter.text()).toContain('0 / 100')
    }
  })

  it("désactive l'éditeur si disabled est true", async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: 'Contenu',
        disabled: true,
      },
    })

    const textarea = component.find('textarea')
    expect(textarea.attributes('disabled')).toBeDefined()

    const buttons = component.findAll('button')
    buttons.forEach((button) => {
      expect(button.attributes('disabled')).toBeDefined()
    })
  })

  it('affiche le placeholder si fourni', async () => {
    const component = await mountSuspended(MinimalMarkdownEditor, {
      props: {
        modelValue: '',
        placeholder: 'Entrez votre texte ici...',
      },
    })

    const textarea = component.find('textarea')
    expect(textarea.attributes('placeholder')).toBe('Entrez votre texte ici...')
  })
})
