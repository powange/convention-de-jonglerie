/**
 * Mock Firebase App pour les tests
 */
export const initializeApp = () => ({
  name: '[DEFAULT]',
  options: {},
  automaticDataCollectionEnabled: false,
})

export const getApps = () => []

export const getApp = () => ({
  name: '[DEFAULT]',
  options: {},
  automaticDataCollectionEnabled: false,
})

export type FirebaseApp = ReturnType<typeof initializeApp>
