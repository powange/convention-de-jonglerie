/**
 * Configuration Firebase pour le client
 * Ces clés sont publiques et sûres à exposer côté client
 * La configuration varie selon l'environnement (dev, release, prod)
 *
 * IMPORTANT: Ce fichier doit retourner une fonction pour accéder au runtimeConfig
 * Les valeurs par défaut servent uniquement de fallback si les variables d'environnement ne sont pas définies
 */
export function getFirebaseConfig() {
  const config = useRuntimeConfig()

  return {
    apiKey: config.public.firebaseApiKey || 'AIzaSyAVDttdYlK-jAxvj06Nui-DRwf5Jj2GvHg',
    authDomain: config.public.firebaseAuthDomain || 'juggling-convention.firebaseapp.com',
    projectId: config.public.firebaseProjectId || 'juggling-convention',
    storageBucket: config.public.firebaseStorageBucket || 'juggling-convention.firebasestorage.app',
    messagingSenderId: config.public.firebaseMessagingSenderId || '136924576295',
    appId: config.public.firebaseAppId || '1:136924576295:web:b9d515a218409804c9ec02',
  }
}
