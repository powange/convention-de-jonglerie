/**
 * Mock Firebase Messaging pour les tests
 */
export const getMessaging = () => ({})

export const isSupported = async () => false

export const getToken = async () => 'mock-fcm-token'

export const onMessage = () => {
  // Retourne une fonction unsubscribe
  return () => {}
}

export type Messaging = ReturnType<typeof getMessaging>

export type MessagePayload = {
  notification?: {
    title?: string
    body?: string
    icon?: string
  }
  data?: Record<string, string>
}
