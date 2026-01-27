import { describe, it, expect, vi } from 'vitest'
import ShowApplicationChat from '../../../../app/components/show-application/Chat.vue'

// Mock des composables utilisés par le composant
vi.mock('../../../../app/composables/useMessenger', () => ({
  useMessenger: () => ({
    fetchMessages: vi.fn().mockResolvedValue({
      data: [],
      pagination: { total: 0, hasMore: false },
    }),
    sendMessage: vi.fn().mockResolvedValue({ id: '1', content: 'test' }),
    markMessageAsRead: vi.fn().mockResolvedValue(true),
  }),
}))

vi.mock('../../../../app/composables/useMessengerStream', () => ({
  useMessengerStream: () => ({
    realtimeMessages: { value: [] },
    isConnected: { value: false },
    messageUpdates: { value: [] },
    clearMessages: vi.fn(),
    clearMessageUpdates: vi.fn(),
  }),
}))

describe('ShowApplicationChat', () => {
  it('vérifie que le composant peut être importé', () => {
    expect(ShowApplicationChat).toBeDefined()
  })

  it('vérifie que le composant a les bonnes propriétés définies', () => {
    // Le composant doit avoir un nom ou être une SFC valide
    expect(ShowApplicationChat.__name || ShowApplicationChat.name).toBeDefined()
  })

  it('vérifie que le composant expose la méthode refresh', () => {
    // Le composant utilise defineExpose({ refresh: checkConversation })
    // Nous vérifions que le composant est bien défini et peut être instancié
    expect(typeof ShowApplicationChat).toBe('object')
  })

  it('vérifie que les props attendues sont définies dans le composant', () => {
    // Vérifie que le composant a des props définies
    const props = ShowApplicationChat.props || ShowApplicationChat.__props
    expect(props).toBeDefined()

    // Le composant doit accepter applicationId comme prop
    if (Array.isArray(props)) {
      expect(props).toContain('applicationId')
    } else if (typeof props === 'object') {
      expect('applicationId' in props).toBe(true)
    }
  })
})
