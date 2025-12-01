/**
 * Composable pour gérer un timer temps réel avec formatage de durée
 * Utilisé pour afficher le temps écoulé pendant une opération longue
 */

export interface SubStepEntry {
  url: string
  timestamp: Date
}

export interface StepHistoryEntry {
  step: string
  label: string
  timestamp: Date
  subSteps?: SubStepEntry[]
}

export const useElapsedTimer = () => {
  const startTime = ref<Date | null>(null)
  const currentElapsedTime = ref(0)
  let intervalId: ReturnType<typeof setInterval> | null = null

  /**
   * Formate une durée en millisecondes en format lisible
   * @param ms - Durée en millisecondes
   * @returns String formatée (ex: "1.5s", "2m 30s")
   */
  const formatMs = (ms: number): string => {
    const seconds = ms / 1000
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`
  }

  /**
   * Calcule la durée d'une étape
   * @param entry - Entrée de l'historique
   * @param idx - Index dans l'historique
   * @param history - Historique complet des étapes
   * @returns Durée formatée
   */
  const formatStepDuration = (
    entry: StepHistoryEntry,
    idx: number,
    history: StepHistoryEntry[]
  ): string => {
    if (!startTime.value) return ''

    // Trouver la fin de cette étape (début de la suivante ou maintenant)
    let endTime: number
    if (idx < history.length - 1) {
      const nextStep = history[idx + 1]
      endTime = nextStep ? nextStep.timestamp.getTime() : Date.now()
    } else {
      endTime = Date.now()
    }

    const ms = endTime - entry.timestamp.getTime()
    return formatMs(ms)
  }

  /**
   * Calcule la durée d'une sous-étape
   * @param parentEntry - Étape parente
   * @param subStep - Sous-étape
   * @param subIdx - Index de la sous-étape
   * @returns Durée formatée
   */
  const formatSubStepDuration = (
    parentEntry: StepHistoryEntry,
    subStep: SubStepEntry,
    subIdx: number
  ): string => {
    if (!startTime.value) return ''

    const startTimeMs =
      subIdx === 0
        ? parentEntry.timestamp.getTime()
        : (parentEntry.subSteps?.[subIdx - 1]?.timestamp.getTime() ??
          parentEntry.timestamp.getTime())

    const ms = subStep.timestamp.getTime() - startTimeMs
    return formatMs(ms)
  }

  /**
   * Démarre le timer
   */
  const start = () => {
    startTime.value = new Date()
    currentElapsedTime.value = 0

    if (intervalId) clearInterval(intervalId)
    intervalId = setInterval(() => {
      if (startTime.value) {
        currentElapsedTime.value = Date.now() - startTime.value.getTime()
      }
    }, 100)
  }

  /**
   * Arrête le timer
   */
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  /**
   * Réinitialise le timer
   */
  const reset = () => {
    stop()
    startTime.value = null
    currentElapsedTime.value = 0
  }

  // Nettoyage automatique lors de la destruction du composant
  onUnmounted(() => {
    stop()
  })

  return {
    startTime: readonly(startTime),
    currentElapsedTime: readonly(currentElapsedTime),
    formatMs,
    formatStepDuration,
    formatSubStepDuration,
    start,
    stop,
    reset,
  }
}
