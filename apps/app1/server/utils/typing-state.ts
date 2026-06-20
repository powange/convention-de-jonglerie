/**
 * Système de gestion d'état de typing en mémoire
 * Permet de tracker quand les utilisateurs sont en train d'écrire dans une conversation
 */

interface TypingState {
  userId: number
  conversationId: string
  isTyping: boolean
  timestamp: Date
}

// Map pour stocker l'état de typing: conversationId -> Map(userId -> TypingState)
const typingStates = new Map<string, Map<number, TypingState>>()

// Durée après laquelle un état de typing est considéré comme périmé (3 secondes)
const TYPING_TIMEOUT = 3000

/**
 * Met à jour l'état de typing d'un utilisateur dans une conversation
 */
export function setTypingState(userId: number, conversationId: string, isTyping: boolean): void {
  if (!typingStates.has(conversationId)) {
    typingStates.set(conversationId, new Map())
  }

  const conversationTyping = typingStates.get(conversationId)!

  if (isTyping) {
    conversationTyping.set(userId, {
      userId,
      conversationId,
      isTyping: true,
      timestamp: new Date(),
    })
  } else {
    conversationTyping.delete(userId)
  }

  // Nettoyer si la Map est vide
  if (conversationTyping.size === 0) {
    typingStates.delete(conversationId)
  }
}

/**
 * Récupère tous les utilisateurs en train d'écrire dans une conversation
 * Exclut les états périmés (plus de 3 secondes)
 */
export function getTypingUsers(conversationId: string): number[] {
  const conversationTyping = typingStates.get(conversationId)
  if (!conversationTyping) return []

  const now = new Date()
  const activeTypers: number[] = []

  // Filtrer les états périmés et récupérer les userId actifs
  for (const [userId, state] of conversationTyping.entries()) {
    const timeSinceTyping = now.getTime() - state.timestamp.getTime()

    if (timeSinceTyping > TYPING_TIMEOUT) {
      // État périmé, le supprimer
      conversationTyping.delete(userId)
    } else if (state.isTyping) {
      activeTypers.push(userId)
    }
  }

  // Nettoyer si la Map est vide
  if (conversationTyping.size === 0) {
    typingStates.delete(conversationId)
  }

  return activeTypers
}

/**
 * Récupère tous les événements de typing récents pour un ensemble de conversations
 */
export function getTypingStatesForConversations(conversationIds: string[]): {
  conversationId: string
  userIds: number[]
}[] {
  const result: { conversationId: string; userIds: number[] }[] = []

  for (const conversationId of conversationIds) {
    const typingUserIds = getTypingUsers(conversationId)
    if (typingUserIds.length > 0) {
      result.push({
        conversationId,
        userIds: typingUserIds,
      })
    }
  }

  return result
}

/**
 * Nettoie tous les états de typing périmés (appelé périodiquement)
 */
export function cleanExpiredTypingStates(): void {
  const now = new Date()

  for (const [conversationId, conversationTyping] of typingStates.entries()) {
    for (const [userId, state] of conversationTyping.entries()) {
      const timeSinceTyping = now.getTime() - state.timestamp.getTime()

      if (timeSinceTyping > TYPING_TIMEOUT) {
        conversationTyping.delete(userId)
      }
    }

    // Nettoyer la conversation si vide
    if (conversationTyping.size === 0) {
      typingStates.delete(conversationId)
    }
  }
}
