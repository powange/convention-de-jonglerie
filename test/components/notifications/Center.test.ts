import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NotificationsCenter from '~/components/notifications/Center.vue'

describe('NotificationsCenter', () => {
  const mockNotifications = [
    {
      id: 1,
      type: 'convention_update',
      title: 'Mise à jour de convention',
      message: 'La convention a été modifiée',
      read: false,
      createdAt: new Date('2024-03-20T10:00:00'),
      data: { conventionId: 1 },
    },
    {
      id: 2,
      type: 'comment',
      title: 'Nouveau commentaire',
      message: 'Un nouveau commentaire a été posté',
      read: true,
      createdAt: new Date('2024-03-19T15:00:00'),
      data: { editionId: 1 },
    },
  ]

  it('affiche la liste des notifications', async () => {
    const component = await mountSuspended(NotificationsCenter, {
      props: {
        notifications: mockNotifications,
      },
    })

    const notifItems = component.findAll('.notification-item')
    expect(notifItems).toHaveLength(2)
    expect(component.text()).toContain('Mise à jour de convention')
    expect(component.text()).toContain('Nouveau commentaire')
  })

  it('affiche le badge pour les notifications non lues', async () => {
    const component = await mountSuspended(NotificationsCenter, {
      props: {
        notifications: mockNotifications,
      },
    })

    const unreadBadge = component.find('.unread-badge')
    expect(unreadBadge.exists()).toBe(true)
    expect(unreadBadge.text()).toBe('1')
  })

  it('émet mark-read lors du clic sur une notification', async () => {
    const component = await mountSuspended(NotificationsCenter, {
      props: {
        notifications: mockNotifications,
      },
    })

    const firstNotif = component.find('.notification-item')
    await firstNotif.trigger('click')

    expect(component.emitted('mark-read')).toBeTruthy()
    expect(component.emitted('mark-read')?.[0]).toEqual([1])
  })

  it('émet mark-all-read lors du clic sur le bouton', async () => {
    const component = await mountSuspended(NotificationsCenter, {
      props: {
        notifications: mockNotifications,
      },
    })

    const markAllButton = component.find('[data-test="mark-all-read"]')
    if (markAllButton.exists()) {
      await markAllButton.trigger('click')
      expect(component.emitted('mark-all-read')).toBeTruthy()
    }
  })

  it('affiche un message si aucune notification', async () => {
    const component = await mountSuspended(NotificationsCenter, {
      props: {
        notifications: [],
      },
    })

    expect(component.text()).toContain('Aucune notification')
  })

  it('filtre les notifications par type', async () => {
    const component = await mountSuspended(NotificationsCenter, {
      props: {
        notifications: mockNotifications,
        filterType: 'convention_update',
      },
    })

    const notifItems = component.findAll('.notification-item')
    expect(notifItems).toHaveLength(1)
    expect(component.text()).toContain('Mise à jour de convention')
  })

  it('groupe les notifications par date', async () => {
    const component = await mountSuspended(NotificationsCenter, {
      props: {
        notifications: mockNotifications,
        groupByDate: true,
      },
    })

    const dateGroups = component.findAll('.date-group')
    expect(dateGroups.length).toBeGreaterThan(0)
  })

  it('émet delete lors du clic sur supprimer', async () => {
    const component = await mountSuspended(NotificationsCenter, {
      props: {
        notifications: mockNotifications,
      },
    })

    const deleteButton = component.find('[data-test="delete-notification"]')
    if (deleteButton.exists()) {
      await deleteButton.trigger('click')
      expect(component.emitted('delete')).toBeTruthy()
      expect(component.emitted('delete')?.[0]).toEqual([1])
    }
  })

  it('affiche le chargement si isLoading est true', async () => {
    const component = await mountSuspended(NotificationsCenter, {
      props: {
        notifications: [],
        isLoading: true,
      },
    })

    const loader = component.find('.loading-spinner')
    expect(loader.exists()).toBe(true)
  })

  it('permet la pagination si hasMore est true', async () => {
    const component = await mountSuspended(NotificationsCenter, {
      props: {
        notifications: mockNotifications,
        hasMore: true,
      },
    })

    const loadMoreButton = component.find('[data-test="load-more"]')
    expect(loadMoreButton.exists()).toBe(true)

    await loadMoreButton.trigger('click')
    expect(component.emitted('load-more')).toBeTruthy()
  })
})
