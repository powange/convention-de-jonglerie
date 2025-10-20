/**
 * Composable pour détecter si l'application tourne en mode PWA (installée)
 */
export function usePWA() {
  const isPWA = ref(false)

  if (import.meta.client) {
    // Vérifier si l'app est en mode standalone (installée comme PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches

    // Vérifier si c'est une PWA iOS
    const isIOSPWA = (window.navigator as any).standalone === true

    // Vérifier via le manifest
    const isManifestPWA =
      document.referrer.includes('android-app://') || window.matchMedia('(display-mode: standalone)').matches

    isPWA.value = isStandalone || isIOSPWA || isManifestPWA
  }

  return {
    isPWA: readonly(isPWA),
  }
}
