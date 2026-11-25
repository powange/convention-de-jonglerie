import type { Ref } from 'vue'

/**
 * Force le mode clair tant qu'un affichage l'exige, puis rend à l'utilisateur le thème qu'il
 * avait choisi.
 *
 * Pensé pour les QR codes affichés en grand : en mode sombre, le contraste s'inverse et la
 * luminosité d'écran baisse, si bien qu'un scanner s'y reprend à plusieurs fois. À l'entrée
 * d'une convention, ça fait la différence entre un passage fluide et une file qui s'allonge.
 *
 * Trois précautions, qui sont tout l'intérêt d'avoir un seul endroit plutôt que quatre copies :
 *
 * - la restauration ne dépend pas de la façon de fermer — touche Échap, clic à côté, retour
 *   arrière ou démontage du composant conduisent au même endroit ;
 * - un choix fait pendant l'affichage est respecté : qui bascule en sombre le QR sous les yeux
 *   ne se verra pas ramené au clair à la fermeture ;
 * - le mode « système » est rendu tel quel, et non traduit en clair ou sombre en dur.
 */
export function useModeClairTemporaire(actif: Ref<boolean>) {
  const colorMode = useColorMode()

  /** Préférence d'avant la bascule, ou `null` quand on n'a rien forcé. */
  let preferenceInitiale: string | null = null

  const forcerLeClair = () => {
    if (preferenceInitiale !== null) return
    preferenceInitiale = colorMode.preference
    colorMode.preference = 'light'
  }

  const rendreLaMain = () => {
    if (preferenceInitiale === null) return
    // Toujours en clair : c'est bien nous qui l'avons posé, donc à nous de le défaire. Si la
    // valeur a changé entre-temps, elle vient de l'utilisateur et lui appartient.
    if (colorMode.preference === 'light') {
      colorMode.preference = preferenceInitiale
    }
    preferenceInitiale = null
  }

  watch(actif, (ouvert) => (ouvert ? forcerLeClair() : rendreLaMain()), { immediate: true })

  onScopeDispose(rendreLaMain)
}
