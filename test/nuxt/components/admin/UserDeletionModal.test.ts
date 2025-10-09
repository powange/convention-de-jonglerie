import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UserDeletionModal from '../../../../app/components/admin/UserDeletionModal.vue'

describe('UserDeletionModal', () => {
  const mockUser = {
    id: 1,
    name: 'Jean Dupont',
    email: 'jean@example.com',
    createdAt: new Date('2024-01-15'),
    role: 'user',
    isVerified: true,
  }

  it("affiche les informations de l'utilisateur à supprimer", async () => {
    const component = await mountSuspended(UserDeletionModal, {
      props: {
        modelValue: true,
        user: mockUser,
      },
    })

    expect(component.text()).toContain('Jean Dupont')
    expect(component.text()).toContain('jean@example.com')
  })

  it("affiche l'avertissement de suppression", async () => {
    const component = await mountSuspended(UserDeletionModal, {
      props: {
        modelValue: true,
        user: mockUser,
      },
    })

    expect(component.text()).toContain('supprimer')
    expect(component.text()).toContain('irréversible')
  })

  it('nécessite une confirmation par saisie du nom', async () => {
    const component = await mountSuspended(UserDeletionModal, {
      props: {
        modelValue: true,
        user: mockUser,
      },
    })

    const confirmInput = component.find('input[type="text"]')
    expect(confirmInput.exists()).toBe(true)

    const deleteButton = component.find('[data-test="confirm-delete"]')
    expect(deleteButton.attributes('disabled')).toBeDefined()

    await confirmInput.setValue('Jean Dupont')
    await component.vm.$nextTick()

    expect(deleteButton.attributes('disabled')).toBeUndefined()
  })

  it('émet delete-user lors de la confirmation', async () => {
    const component = await mountSuspended(UserDeletionModal, {
      props: {
        modelValue: true,
        user: mockUser,
      },
    })

    const confirmInput = component.find('input[type="text"]')
    await confirmInput.setValue('Jean Dupont')

    const deleteButton = component.find('[data-test="confirm-delete"]')
    await deleteButton.trigger('click')

    expect(component.emitted('delete-user')).toBeTruthy()
    expect(component.emitted('delete-user')?.[0]).toEqual([mockUser.id])
  })

  it("émet update:modelValue(false) lors de l'annulation", async () => {
    const component = await mountSuspended(UserDeletionModal, {
      props: {
        modelValue: true,
        user: mockUser,
      },
    })

    const cancelButton = component.find('[data-test="cancel-delete"]')
    await cancelButton.trigger('click')

    expect(component.emitted('update:modelValue')).toBeTruthy()
    expect(component.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it("affiche les statistiques de l'utilisateur si fournies", async () => {
    const userWithStats = {
      ...mockUser,
      stats: {
        conventions: 5,
        editions: 12,
        comments: 34,
      },
    }

    const component = await mountSuspended(UserDeletionModal, {
      props: {
        modelValue: true,
        user: userWithStats,
      },
    })

    expect(component.text()).toContain('5 conventions')
    expect(component.text()).toContain('12 éditions')
    expect(component.text()).toContain('34 commentaires')
  })

  it('désactive les boutons pendant le traitement', async () => {
    const component = await mountSuspended(UserDeletionModal, {
      props: {
        modelValue: true,
        user: mockUser,
        isDeleting: true,
      },
    })

    const buttons = component.findAll('button')
    buttons.forEach((button) => {
      expect(button.attributes('disabled')).toBeDefined()
    })
  })
})
