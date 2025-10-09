import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UserAvatar from '../../../../app/components/ui/UserAvatar.vue'

describe('UserAvatar', () => {
  it('monte le composant avec succès', async () => {
    const component = await mountSuspended(UserAvatar, {
      props: {
        user: {
          email: 'test@example.com',
          profilePicture: null,
        },
      },
    })

    expect(component.exists()).toBe(true)
  })

  it('affiche une image', async () => {
    const component = await mountSuspended(UserAvatar, {
      props: {
        user: {
          email: 'test@example.com',
          profilePicture: null,
        },
      },
    })

    const img = component.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBeDefined()
  })

  it("affiche l'image de profil si disponible", async () => {
    const component = await mountSuspended(UserAvatar, {
      props: {
        user: {
          email: 'test@example.com',
          profilePicture: '/uploads/profile.jpg',
        },
      },
    })

    const img = component.find('img')
    expect(img.attributes('src')).toContain('/uploads/profile.jpg')
  })

  it('applique les classes pour la taille', async () => {
    const component = await mountSuspended(UserAvatar, {
      props: {
        user: {
          email: 'test@example.com',
          profilePicture: null,
        },
        size: 'xl',
      },
    })

    const img = component.find('img')
    expect(img.classes()).toContain('w-32')
    expect(img.classes()).toContain('h-32')
  })
})
