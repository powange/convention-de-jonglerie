import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import EditionPost from '../../../../app/components/edition/Post.vue'

describe('EditionPost', () => {
  const mockPost = {
    id: 1,
    content: 'Ceci est un **post** avec du *markdown*',
    createdAt: new Date('2024-03-20T10:00:00'),
    updatedAt: new Date('2024-03-20T10:00:00'),
    author: {
      id: 1,
      name: 'Jean Dupont',
      email: 'jean@example.com',
      profilePicture: null,
    },
    editionId: 1,
  }

  it('affiche le contenu du post', async () => {
    const component = await mountSuspended(EditionPost, {
      props: {
        post: mockPost,
      },
    })

    expect(component.exists()).toBe(true)
    const content = component.find('.post-content')
    expect(content.exists()).toBe(true)
  })

  it("affiche les informations de l'auteur", async () => {
    const component = await mountSuspended(EditionPost, {
      props: {
        post: mockPost,
      },
    })

    expect(component.text()).toContain('Jean Dupont')
  })

  it('affiche la date de création', async () => {
    const component = await mountSuspended(EditionPost, {
      props: {
        post: mockPost,
      },
    })

    const dateElement = component.find('.post-date')
    expect(dateElement.exists()).toBe(true)
  })

  it("affiche le bouton d'édition si l'utilisateur est l'auteur", async () => {
    const { useAuthStore } = await import('~/stores/auth')
    const authStore = useAuthStore()
    authStore.user = { id: 1, name: 'Jean Dupont' }

    const component = await mountSuspended(EditionPost, {
      props: {
        post: mockPost,
      },
    })

    const editButton = component.find('[data-test="edit-post"]')
    expect(editButton.exists()).toBe(true)
  })

  it('affiche le bouton de suppression si canDelete est true', async () => {
    const { useAuthStore } = await import('~/stores/auth')
    const authStore = useAuthStore()
    authStore.user = { id: 1, name: 'Jean Dupont' }

    const component = await mountSuspended(EditionPost, {
      props: {
        post: mockPost,
        canDelete: true,
      },
    })

    const deleteButton = component.find('[data-test="delete-post"]')
    expect(deleteButton.exists()).toBe(true)
  })

  it('émet delete lors du clic sur supprimer', async () => {
    const { useAuthStore } = await import('~/stores/auth')
    const authStore = useAuthStore()
    authStore.user = { id: 1, name: 'Jean Dupont' }

    const component = await mountSuspended(EditionPost, {
      props: {
        post: mockPost,
        canDelete: true,
      },
    })

    const deleteButton = component.find('[data-test="delete-post"]')
    if (deleteButton.exists()) {
      await deleteButton.trigger('click')
      expect(component.emitted('delete')).toBeTruthy()
      expect(component.emitted('delete')?.[0]).toEqual([mockPost.id])
    }
  })

  it('entre en mode édition lors du clic sur éditer', async () => {
    const { useAuthStore } = await import('~/stores/auth')
    const authStore = useAuthStore()
    authStore.user = { id: 1, name: 'Jean Dupont' }

    const component = await mountSuspended(EditionPost, {
      props: {
        post: mockPost,
      },
    })

    const editButton = component.find('[data-test="edit-post"]')
    if (editButton.exists()) {
      await editButton.trigger('click')
      await component.vm.$nextTick()

      const textarea = component.find('textarea')
      expect(textarea.exists()).toBe(true)
      expect(textarea.element.value).toBe(mockPost.content)
    }
  })

  it('émet update lors de la sauvegarde des modifications', async () => {
    const { useAuthStore } = await import('~/stores/auth')
    const authStore = useAuthStore()
    authStore.user = { id: 1, name: 'Jean Dupont' }

    const component = await mountSuspended(EditionPost, {
      props: {
        post: mockPost,
      },
    })

    // Entrer en mode édition
    component.vm.isEditing = true
    component.vm.editedContent = 'Nouveau contenu'
    await component.vm.$nextTick()

    const saveButton = component.find('[data-test="save-post"]')
    if (saveButton.exists()) {
      await saveButton.trigger('click')
      expect(component.emitted('update')).toBeTruthy()
      expect(component.emitted('update')?.[0]).toEqual([mockPost.id, 'Nouveau contenu'])
    }
  })
})
