import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getMessaging, type Messaging, isSupported } from 'firebase/messaging'

import { getFirebaseConfig } from '../config/firebase.config'

/**
 * Plugin Firebase pour Nuxt (client-side only)
 * Initialise Firebase et expose les services via provide
 */
export default defineNuxtPlugin(async () => {
  // Récupérer la configuration Firebase depuis le runtimeConfig
  const firebaseConfig = getFirebaseConfig()

  // Vérifier si Firebase n'est pas déjà initialisé
  let app: FirebaseApp
  const existingApps = getApps()

  if (existingApps.length === 0) {
    app = initializeApp(firebaseConfig)
    console.log('✅ Firebase initialisé')
  } else {
    app = existingApps[0]
    console.log('♻️ Firebase déjà initialisé')
  }

  // Initialiser Firebase Cloud Messaging si supporté
  let messaging: Messaging | null = null

  try {
    const messagingSupported = await isSupported()
    if (messagingSupported) {
      messaging = getMessaging(app)
      console.log('✅ Firebase Cloud Messaging initialisé')
    } else {
      console.warn('⚠️ Firebase Cloud Messaging non supporté dans ce navigateur')
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation de Firebase Messaging:", error)
  }

  // Exposer les services Firebase via provide
  return {
    provide: {
      firebase: {
        app,
        messaging,
      },
    },
  }
})
