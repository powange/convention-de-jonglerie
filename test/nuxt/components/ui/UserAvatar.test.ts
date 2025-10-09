import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UserAvatar from '../../../../app/components/ui/UserAvatar.vue'

describe('UserAvatar', () => {
  it("affiche le gravatar par défaut si pas d'image", async () => {
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
    expect(img.attributes('src')).toContain('gravatar.com')
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
    expect(img.attributes('src')).toBe('/uploads/profile.jpg')
  })

  it('applique la taille spécifiée', async () => {
    const component = await mountSuspended(UserAvatar, {
      props: {
        user: {
          email: 'test@example.com',
          profilePicture: null,
        },
        size: 'xl',
      },
    })

    const avatar = component.find('.avatar')
    expect(avatar.classes()).toContain('size-xl')
  })

  it("affiche les initiales si showInitials est true et pas d'image", async () => {
    const component = await mountSuspended(UserAvatar, {
      props: {
        user: {
          name: 'John Doe',
          email: 'test@example.com',
          profilePicture: null,
        },
        showInitials: true,
      },
    })

    expect(component.text()).toContain('JD')
  })
})
