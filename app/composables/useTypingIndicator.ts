/**
 * Composable pour gérer l'envoi des événements de typing
 */
export const useTypingIndicator = (conversationId: Ref<string | null>) => {
  let typingTimeout: NodeJS.Timeout | null = null
  let lastTypingEvent = 0
  const TYPING_THROTTLE = 500 // Envoyer au maximum un événement toutes les 500ms
  const TYPING_RESET_DELAY = 3000 // Considérer que l'utilisateur a arrêté d'écrire après 3s

  /**
   * Notifie le serveur que l'utilisateur est en train d'écrire
   */
  const notifyTyping = async () => {
    if (!conversationId.value) return

    const now = Date.now()
    const timeSinceLastEvent = now - lastTypingEvent

    // Throttle: ne pas envoyer trop souvent
    if (timeSinceLastEvent < TYPING_THROTTLE) {
      return
    }

    try {
      await $fetch(`/api/messenger/conversations/${conversationId.value}/typing`, {
        method: 'POST',
        body: { isTyping: true },
      })
      lastTypingEvent = now
    } catch (error) {
      console.error('[Typing] Erreur envoi événement typing:', error)
    }
  }

  /**
   * Notifie le serveur que l'utilisateur a arrêté d'écrire
   */
  const notifyStoppedTyping = async () => {
    if (!conversationId.value) return

    try {
      await $fetch(`/api/messenger/conversations/${conversationId.value}/typing`, {
        method: 'POST',
        body: { isTyping: false },
      })
    } catch (error) {
      console.error('[Typing] Erreur envoi événement stop typing:', error)
    }
  }

  /**
   * Gestionnaire d'événement input à attacher au champ de saisie
   */
  const handleInput = () => {
    // Notifier que l'utilisateur écrit
    notifyTyping()

    // Réinitialiser le timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }

    // Après 3 secondes sans saisie, considérer que l'utilisateur a arrêté
    typingTimeout = setTimeout(() => {
      notifyStoppedTyping()
    }, TYPING_RESET_DELAY)
  }

  /**
   * Nettoyer lors de la destruction du composant
   */
  const cleanup = () => {
    if (typingTimeout) {
      clearTimeout(typingTimeout)
      typingTimeout = null
    }
    // Notifier qu'on a arrêté d'écrire
    notifyStoppedTyping()
  }

  // Nettoyer lors du démontage
  onUnmounted(() => {
    cleanup()
  })

  // Nettoyer lors du changement de conversation
  watch(conversationId, (newId, oldId) => {
    if (oldId && oldId !== newId) {
      cleanup()
    }
  })

  return {
    handleInput,
    cleanup,
  }
}
