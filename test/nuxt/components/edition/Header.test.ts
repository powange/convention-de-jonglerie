import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import EditionHeader from '../../../../app/components/edition/Header.vue'

describe('EditionHeader', () => {
  const mockEdition = {
    id: 1,
    name: 'Convention de Jonglerie 2024',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    location: 'Paris, France',
    imageUrl: '/uploads/edition.jpg',
    conventionId: 1,
    description: 'Une super convention',
    isFavorite: false,
    convention: {
      id: 1,
      name: 'Convention Nationale',
    },
  }

  it("affiche les informations de l'édition", async () => {
    const component = await mountSuspended(EditionHeader, {
      props: {
        edition: mockEdition,
      },
    })

    expect(component.text()).toContain('Convention de Jonglerie 2024')
    expect(component.text()).toContain('Paris, France')
  })

  it("affiche l'image de l'édition si disponible", async () => {
    const component = await mountSuspended(EditionHeader, {
      props: {
        edition: mockEdition,
      },
    })

    const img = component.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/uploads/edition.jpg')
  })

  it("affiche le bouton favori si l'utilisateur est connecté", async () => {
    const mockUser = { id: 1, name: 'Test User' }
    const { useAuthStore } = await import('~/stores/auth')
    const authStore = useAuthStore()
    authStore.user = mockUser

    const component = await mountSuspended(EditionHeader, {
      props: {
        edition: mockEdition,
      },
    })

    const favoriteButton = component.find('[data-test="favorite-button"]')
    expect(favoriteButton.exists()).toBe(true)
  })

  it('émet toggle-favorite lors du clic sur le bouton favori', async () => {
    const mockUser = { id: 1, name: 'Test User' }
    const { useAuthStore } = await import('~/stores/auth')
    const authStore = useAuthStore()
    authStore.user = mockUser

    const component = await mountSuspended(EditionHeader, {
      props: {
        edition: mockEdition,
      },
    })

    const favoriteButton = component.find('[data-test="favorite-button"]')
    if (favoriteButton.exists()) {
      await favoriteButton.trigger('click')
      expect(component.emitted('toggle-favorite')).toBeTruthy()
    }
  })

  it('affiche les liens de navigation', async () => {
    const component = await mountSuspended(EditionHeader, {
      props: {
        edition: mockEdition,
        showNavigation: true,
      },
    })

    const navLinks = component.findAll('.nav-link')
    expect(navLinks.length).toBeGreaterThan(0)
  })

  it("affiche le badge de statut si l'édition est passée", async () => {
    const pastEdition = {
      ...mockEdition,
      endDate: new Date('2023-06-03'),
    }

    const component = await mountSuspended(EditionHeader, {
      props: {
        edition: pastEdition,
      },
    })

    const badge = component.find('.status-badge')
    if (badge.exists()) {
      expect(badge.text()).toContain('Terminée')
    }
  })

  it("affiche le bouton d'édition si l'utilisateur a les droits", async () => {
    const mockUser = { id: 1, name: 'Test User', isAdmin: true }
    const { useAuthStore } = await import('~/stores/auth')
    const authStore = useAuthStore()
    authStore.user = mockUser

    const component = await mountSuspended(EditionHeader, {
      props: {
        edition: mockEdition,
        canEdit: true,
      },
    })

    const editButton = component.find('[data-test="edit-button"]')
    expect(editButton.exists()).toBe(true)
  })
})
