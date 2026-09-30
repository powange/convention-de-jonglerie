import { getFirebaseConfig } from '../config/firebase.config'

import type { FirebaseOptions } from 'firebase/app'
import type { MessagePayload, Messaging } from 'firebase/messaging'

/**
 * Chargement PARESSEUX de Firebase (app + messaging).
 *
 * Firebase (~150-200 Ko) n'est téléchargé et initialisé qu'au PREMIER usage réel
 * du push (ouverture des réglages de notifications, promo push…), et non plus au
 * boot de chaque page comme le faisait l'ancien plugin `firebase.client.ts`.
 * Le résultat est mémoïsé (singleton) pour ne charger/initialiser qu'une seule fois.
 */
let firebaseMessagingPromise: Promise<{
  messaging: Messaging
  getToken: typeof import('firebase/messaging').getToken
  onMessage: typeof import('firebase/messaging').onMessage
} | null> | null = null

async function loadFirebaseMessaging(firebaseConfig: FirebaseOptions) {
  if (firebaseMessagingPromise) return firebaseMessagingPromise

  firebaseMessagingPromise = (async () => {
    try {
      const [{ initializeApp, getApps }, { getMessaging, isSupported, getToken, onMessage }] =
        await Promise.all([import('firebase/app'), import('firebase/messaging')])

      if (!(await isSupported())) {
        // Condition permanente (navigateur non compatible) → on garde le null mémoïsé.
        console.warn('⚠️ Firebase Cloud Messaging non supporté dans ce navigateur')
        return null
      }

      const existingApps = getApps()
      const app = existingApps.length > 0 ? existingApps[0]! : initializeApp(firebaseConfig)
      return { messaging: getMessaging(app), getToken, onMessage }
    } catch (error) {
      // Échec potentiellement transitoire (chunk réseau, init) → on réinitialise le
      // singleton pour autoriser un nouvel essai au prochain appel, sans reload de page.
      console.error("❌ Erreur lors de l'initialisation de Firebase Messaging:", error)
      firebaseMessagingPromise = null
      return null
    }
  })()

  return firebaseMessagingPromise
}

/**
 * Composable pour gérer Firebase Cloud Messaging.
 * Firebase est chargé paresseusement (dynamic import) au premier usage.
 */
export function useFirebaseMessaging() {
  const toast = useToast()
  const config = useRuntimeConfig()
  const { getDeviceId } = useDeviceId()
  const { t } = useI18n()
  // Résolu dans le contexte du composant (setup), puis passé au loader paresseux.
  const firebaseConfig = getFirebaseConfig()

  // Cache pour éviter les appels trop fréquents
  let lastTokenRequest = 0
  const TOKEN_REQUEST_COOLDOWN = 5000 // 5 secondes

  /**
   * Enregistrer le service worker Firebase
   */
  const registerServiceWorker = async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers non supportés')
      return false
    }

    try {
      // Le worker n'est plus désinscrit avant d'être réenregistré. Il porte désormais aussi le
      // cache hors ligne : le désinscrire laisserait la page sans contrôleur le temps du
      // remplacement, c'est-à-dire sans cache, et pour rien — `update()` ci-dessous suffit à
      // forcer la prise en compte d'une nouvelle version.

      // Enregistrer le Service Worker avec option de mise à jour forcée
      const registration = await navigator.serviceWorker.register(
        serviceWorkerUrl(useRuntimeConfig().app.buildId),
        { updateViaCache: 'none' } // Ne jamais utiliser le cache du navigateur
      )

      // Forcer la mise à jour immédiate
      await registration.update()

      // Si un nouveau SW est en attente, le forcer à s'activer
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      // Attendre que le SW soit prêt
      await navigator.serviceWorker.ready

      if (import.meta.dev) {
        console.log('✅ Service Worker Firebase enregistré:', registration.scope)
      }
      return true
    } catch (error) {
      console.error("❌ Erreur lors de l'enregistrement du Service Worker Firebase:", error)
      return false
    }
  }

  /**
   * Demander la permission pour les notifications et obtenir le token FCM
   */
  const requestPermissionAndGetToken = async (): Promise<string | null> => {
    const fb = await loadFirebaseMessaging(firebaseConfig)
    if (!fb) {
      console.warn('Firebase Messaging non disponible')
      return null
    }

    // Vérifier le cooldown pour éviter les appels trop fréquents
    const now = Date.now()
    if (now - lastTokenRequest < TOKEN_REQUEST_COOLDOWN) {
      console.warn(
        `⏱️ Attendez ${Math.ceil((TOKEN_REQUEST_COOLDOWN - (now - lastTokenRequest)) / 1000)}s avant de redemander le token`
      )
      return null
    }
    lastTokenRequest = now

    try {
      // 1. Enregistrer le Service Worker en premier
      if (import.meta.dev) {
        console.log('📝 Enregistrement du Service Worker Firebase...')
      }
      const swRegistered = await registerServiceWorker()
      if (!swRegistered) {
        console.error("❌ Impossible d'enregistrer le Service Worker")
        return null
      }

      // 2. Demander la permission
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        if (import.meta.dev) {
          console.log('Permission de notification refusée')
        }
        return null
      }

      // 3. Récupérer la clé VAPID depuis la configuration
      const vapidKey = config.public.firebaseVapidKey

      if (!vapidKey) {
        console.error('❌ VAPID key manquante. Configurez NUXT_PUBLIC_FIREBASE_VAPID_KEY dans .env')
        return null
      }

      if (import.meta.dev) {
        console.log('🔑 Utilisation de la clé VAPID:', vapidKey.substring(0, 20) + '...')
      }

      // 4. Obtenir le token FCM avec le Service Worker enregistré
      const registration = await navigator.serviceWorker.ready
      if (import.meta.dev) {
        console.log('✅ Service Worker prêt')
      }

      if (import.meta.dev) {
        console.log('⏳ Demande du token FCM...')
      }

      const token = await fb.getToken(fb.messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      })

      if (token) {
        if (import.meta.dev) {
          console.log('✅ Token FCM obtenu:', token.substring(0, 20) + '...')
        }

        // Enregistrer le token côté serveur avec le deviceId
        try {
          const deviceId = getDeviceId()
          await $fetch('/api/notifications/fcm/subscribe', {
            method: 'POST',
            body: { token, deviceId },
          })
          if (import.meta.dev) {
            console.log('✅ Token FCM enregistré côté serveur')
          }
        } catch (error) {
          console.error("❌ Erreur lors de l'enregistrement du token FCM:", error)
        }

        return token
      } else {
        if (import.meta.dev) {
          console.log("❌ Impossible d'obtenir le token FCM")
        }
        return null
      }
    } catch (error: any) {
      // Détecter si c'est Opera
      const isOpera =
        navigator.userAgent.indexOf('OPR') > -1 || navigator.userAgent.indexOf('Opera') > -1

      if (error.name === 'AbortError' && error.message.includes('push service error')) {
        if (isOpera) {
          console.warn('⚠️ Opera ne supporte pas correctement Firebase Cloud Messaging')
          console.warn('   Utilisez Chrome, Edge ou Firefox pour les notifications push')

          // Afficher un toast informatif
          /*
           * ⚠️ API DE NUXT UI v4. `timeout` n'existe plus (c'est `duration`) et les couleurs sont
           * SÉMANTIQUES : ni `amber`, ni `red`, ni `green`. Les valeurs de la v2 étaient ignorées
           * en silence — le toast s'affichait donc dans la couleur PRIMAIRE, c'est-à-dire la même
           * qu'un message de succès. Un avertissement et une erreur avaient exactement l'aspect
           * d'une bonne nouvelle.
           */
          toast.add({
            title: t('notifications.push.browser_unsupported_title'),
            description: t('notifications.push.browser_unsupported_opera'),
            color: 'warning',
            icon: 'i-heroicons-exclamation-triangle',
            duration: 8000,
          })
        } else {
          console.error('❌ Erreur de service push:', error)
          console.error('⚠️ Vérifiez que votre navigateur supporte les notifications push')

          toast.add({
            title: t('notifications.push.activation_error_title'),
            description: t('notifications.push.activation_error_browser'),
            color: 'error',
            icon: 'i-heroicons-x-circle',
            duration: 5000,
          })
        }
      } else {
        // Autre type d'erreur
        console.error('❌ Erreur lors de la demande de permission FCM:', error)

        toast.add({
          title: t('common.error'),
          description: t('notifications.push.activation_error_generic'),
          color: 'error',
          icon: 'i-heroicons-x-circle',
          duration: 5000,
        })
      }

      return null
    }
  }

  /**
   * Désactiver les notifications FCM sur CET appareil.
   *
   * ⚠️ L'appel partait sans corps, et le serveur lisait ce vide comme « tous les appareils ».
   * Couper les notifications sur son téléphone les coupait donc aussi sur son ordinateur, sans un
   * mot. On désigne maintenant l'appareil, et lui seul.
   */
  const unsubscribe = async (): Promise<boolean> => {
    const deviceId = getDeviceId()

    /*
     * Le token en plus du `deviceId`, quand on peut l'obtenir : Firebase fait tourner les tokens,
     * et les lignes créées avant la colonne `deviceId` n'en portent pas. Le token les retrouve.
     *
     * `getToken` ne redemande PAS la permission — elle est déjà accordée, sinon il n'y aurait rien
     * à désactiver — et son échec ne doit pas empêcher le désabonnement : d'où le `catch` qui rend
     * `null` et laisse le `deviceId` faire le travail seul.
     */
    let token: string | null = null
    try {
      const fb = await loadFirebaseMessaging(firebaseConfig)
      const vapidKey = config.public.firebaseVapidKey as string
      if (fb && vapidKey && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        token = await fb.getToken(fb.messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        })
      }
    } catch {
      // Sans token, le `deviceId` suffit dans le cas courant.
    }

    const corps = corpsDesabonnementAppareil(deviceId, token)
    if (!corps) {
      /*
       * Ni identifiant d'appareil ni token : on n'envoie RIEN plutôt qu'un corps vide, qui était
       * précisément la forme que le serveur lisait comme « coupe tout, partout ». Le cas demande
       * un `localStorage` inaccessible ET un token introuvable — rare, mais c'est exactement là
       * qu'un repli trop serviable ferait le plus de dégâts.
       */
      console.warn('⚠️ Aucun identifiant d’appareil : désabonnement non envoyé')
      return false
    }

    try {
      await $fetch('/api/notifications/fcm/unsubscribe', { method: 'POST', body: corps })
      if (import.meta.dev) {
        console.log('✅ Token FCM désactivé côté serveur')
      }
      return true
    } catch (error) {
      console.error('❌ Erreur lors de la désactivation du token FCM:', error)
      return false
    }
  }

  /**
   * Couper les notifications sur TOUS les appareils.
   *
   * Séparé de `unsubscribe`, et c'est le but du lot : « tout » doit se demander, jamais se déduire
   * d'un corps vide. Aucun écran ne l'appelle encore — la fonction existe pour que le geste soit
   * nommé le jour où on l'offrira, plutôt que retrouvé par accident.
   */
  const unsubscribeAllDevices = async (): Promise<boolean> => {
    try {
      await $fetch('/api/notifications/fcm/unsubscribe', {
        method: 'POST',
        body: corpsDesabonnementTousAppareils(),
      })
      return true
    } catch (error) {
      console.error('❌ Erreur lors de la désactivation de tous les tokens FCM:', error)
      return false
    }
  }

  /**
   * Écouter les messages en temps réel (foreground).
   * Charge Firebase paresseusement ; renvoie une fonction de nettoyage synchrone.
   */
  const listenToMessages = (
    callback: (payload: MessagePayload) => void = (payload) => {
      if (import.meta.dev) {
        console.log('Message reçu en foreground:', payload)
      }

      // Afficher un toast par défaut
      if (payload.notification) {
        toast.add({
          // Le titre vient de la charge FCM, traduite côté serveur. Le repli, lui, était en dur.
          title: payload.notification.title || t('notifications.push.title'),
          description: payload.notification.body || '',
          color: 'primary',
          icon: 'i-heroicons-bell',
        })
      }
    }
  ) => {
    let unsub: (() => void) | null = null
    let cancelled = false

    loadFirebaseMessaging(firebaseConfig).then((fb) => {
      if (!fb || cancelled) {
        if (!fb) console.warn('Firebase Messaging non disponible')
        return
      }
      // Écouter les messages quand l'app est au premier plan
      unsub = fb.onMessage(fb.messaging, callback)
    })

    return () => {
      cancelled = true
      unsub?.()
    }
  }

  // Disponibilité du push évaluée via les capacités du navigateur, SANS charger
  // Firebase (approxime `isSupported()` de firebase/messaging). Le contrôle réel
  // est refait par `loadFirebaseMessaging` au moment de l'activation.
  const isAvailable = computed(
    () =>
      import.meta.client &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof window !== 'undefined' &&
      'PushManager' in window &&
      'Notification' in window
  )

  return {
    requestPermissionAndGetToken,
    unsubscribe,
    unsubscribeAllDevices,
    listenToMessages,
    registerServiceWorker,
    isAvailable,
  }
}
