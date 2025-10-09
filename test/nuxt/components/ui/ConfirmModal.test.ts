import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ConfirmModal from '../../../../app/components/ui/ConfirmModal.vue'

describe('ConfirmModal', () => {
  it('affiche le modal quand isOpen est true', async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: true,
        title: 'Confirmer la suppression',
        message: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
      },
    })

    expect(component.text()).toContain('Confirmer la suppression')
    expect(component.text()).toContain('Êtes-vous sûr de vouloir supprimer cet élément ?')
  })

  it("n'affiche pas le modal quand isOpen est false", async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: false,
        title: 'Confirmer',
        message: 'Message',
      },
    })

    const modal = component.find('[role="dialog"]')
    expect(modal.exists()).toBe(false)
  })

  it('émet confirm lors du clic sur le bouton de confirmation', async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: true,
        title: 'Confirmer',
        message: 'Message',
        confirmText: 'Supprimer',
      },
    })

    const confirmButton = component.find('button:contains("Supprimer")')
    await confirmButton.trigger('click')

    expect(component.emitted('confirm')).toBeTruthy()
    expect(component.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it("émet cancel lors du clic sur le bouton d'annulation", async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: true,
        title: 'Confirmer',
        message: 'Message',
        cancelText: 'Annuler',
      },
    })

    const cancelButton = component.find('button:contains("Annuler")')
    await cancelButton.trigger('click')

    expect(component.emitted('cancel')).toBeTruthy()
    expect(component.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('applique le type de danger si isDanger est true', async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: true,
        title: 'Supprimer',
        message: 'Cette action est irréversible',
        isDanger: true,
      },
    })

    const confirmButton = component.find('.btn-danger')
    expect(confirmButton.exists()).toBe(true)
  })

  it('désactive les boutons pendant le traitement', async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: true,
        title: 'Confirmer',
        message: 'Message',
        isProcessing: true,
      },
    })

    const buttons = component.findAll('button')
    buttons.forEach((button) => {
      expect(button.attributes('disabled')).toBeDefined()
    })
  })
})
