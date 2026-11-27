/**
 * L'événement dont l'application est OUVERTE dans cette fenêtre (installée sur le téléphone et
 * lancée depuis son icône), ou `null` dans Flowvent lui-même — navigateur ou application Flowvent.
 *
 * Dans l'application d'un événement, ce qui sortirait de l'événement (accueil, tableau de bord,
 * tarifs) disparaît ou ramène à son écran de démarrage.
 *
 * La marque est posée par l'écran de démarrage (`/events/<ref>/app`) lancé en mode application, et
 * gardée en `sessionStorage` : propre à la fenêtre, si bien que Flowvent installé à côté n'en hérite
 * pas (un `localStorage` serait partagé). Lue après le montage seulement : le rendu serveur n'en
 * sait rien, et une valeur lue pendant l'hydratation fausserait les liens.
 */
export function useApplicationEvenement() {
  const marque = useState<string | null>('application-evenement', () => null)
  if (import.meta.client) {
    onMounted(() => {
      try {
        marque.value = sessionStorage.getItem(CLE_APPLICATION_EVENEMENT)
      } catch {
        marque.value = null
      }
    })
  }
  return computed(() => marque.value)
}

/** Pose la marque : appelé par l'écran de démarrage, lancé en mode application. */
export function marquerApplicationEvenement(ref: string) {
  const marque = useState<string | null>('application-evenement', () => null)
  const autonome =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  if (!autonome) return
  try {
    sessionStorage.setItem(CLE_APPLICATION_EVENEMENT, ref)
  } catch {
    // Stockage refusé : l'application fonctionne, avec les liens de Flowvent.
  }
  marque.value = ref
}
