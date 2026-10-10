import type { DestinationDeConversation } from '~~/shared/utils/destination-conversation'

export interface MessengerEdition {
  id: number
  name: string | null
  startDate: Date
  endDate: Date
  imageUrl: string | null
  convention: {
    id: number
    name: string
  }
  _count: {
    conversations: number
  }
}

export interface ConversationParticipant {
  id: string
  userId: number
  lastReadAt: Date | null
  lastReadMessageId?: string | null // Dernier message lu par ce participant (indicateur « lu »)
  isLeader?: boolean // Présent uniquement pour les conversations d'équipe
  user: {
    id: number
    pseudo: string
    profilePicture: string | null
    emailHash: string
  }
}

export interface ConversationMessage {
  id: string
  content: string
  createdAt: Date
  editedAt: Date | null
  deletedAt: Date | null
  replyToId: string | null
  replyTo: {
    id: string
    content: string
    createdAt: Date
    deletedAt: Date | null
    participant: {
      user: {
        id: number
        pseudo: string
      }
    }
  } | null
  participant: {
    id: string
    user: {
      id: number
      pseudo: string
      profilePicture: string | null
      emailHash: string
    }
  }
}

export interface Conversation {
  id: string
  type:
    | 'TEAM_GROUP'
    | 'TEAM_LEADER_PRIVATE'
    | 'VOLUNTEER_TO_ORGANIZERS'
    | 'ORGANIZERS_GROUP'
    | 'PRIVATE'
    | 'ARTIST_APPLICATION'
    | 'SHOW_GROUP'
  createdAt: Date
  updatedAt: Date
  team: {
    id: string
    name: string
    color: string
  } | null
  show: {
    id: number
    title: string
  } | null
  showApplication: {
    id: number
    showTitle: string
    artistName: string
    user: {
      id: number
      pseudo: string
      profilePicture: string | null
      emailHash: string
    }
  } | null
  participants: ConversationParticipant[]
  /**
   * Où mène le bouton de l'en-tête, pour l'utilisateur courant : calculé par le serveur, qui
   * connaît ses droits. Absent pour une conversation privée.
   */
  destination?: DestinationDeConversation | null
  messages: Array<{
    id: string
    content: string
    createdAt: Date
    participant: {
      user: {
        id: number
      }
    }
  }>
  _count: {
    messages: number
  }
  unreadCount: number
}

/**
 * La pagination telle que `createPaginatedResponse` la rend, écrite ICI.
 *
 * ⚠️ ELLE ÉTAIT TYPÉE `any`, et c'est ce qui a laissé passer le défaut. Deux écrans lisaient
 * `pagination.hasMore` — un champ que cette réponse ne porte pas, et que `any` ne pouvait pas
 * contredire. Le drapeau valait donc `undefined`, et le chargement des pages suivantes restait
 * fermé sans la moindre erreur.
 *
 * `hasMore` existe ailleurs dans le dépôt — les groupes du journal d'erreurs le rendent vraiment —
 * d'où la confusion. Ce qui la rend coûteuse, c'est qu'un nom plausible et absent se lit comme
 * « il n'y a plus rien », jamais comme une faute.
 */
export interface PaginationDeMessages {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/**
 * Composable pour gérer la messagerie entre bénévoles
 */
export const useMessenger = () => {
  const toast = useToast()

  /**
   * Récupère les éditions avec conversations de l'utilisateur
   */
  const fetchEditions = async (): Promise<MessengerEdition[]> => {
    try {
      const response = await $fetch<{ success: boolean; data: MessengerEdition[] }>(
        '/api/messenger/editions'
      )
      return response.data
    } catch (error) {
      console.error('Erreur lors de la récupération des éditions:', error)
      toast.add({
        color: 'error',
        title: 'Erreur',
        description: 'Impossible de récupérer les éditions',
      })
      return []
    }
  }

  /**
   * Récupère les conversations d'une édition
   */
  const fetchConversations = async (editionId: number): Promise<Conversation[]> => {
    try {
      const response = await $fetch<{ success: boolean; data: Conversation[] }>(
        '/api/messenger/conversations',
        {
          query: { editionId },
        }
      )
      return response.data
    } catch (error) {
      console.error('Erreur lors de la récupération des conversations:', error)
      toast.add({
        color: 'error',
        title: 'Erreur',
        description: 'Impossible de récupérer les conversations',
      })
      return []
    }
  }

  /**
   * Récupère les messages d'une conversation
   */
  const fetchMessages = async (
    conversationId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ data: ConversationMessage[]; pagination: PaginationDeMessages | null }> => {
    try {
      const response = await $fetch<{
        success: boolean
        data: ConversationMessage[]
        pagination: PaginationDeMessages
      }>(`/api/messenger/conversations/${conversationId}/messages`, {
        query: {
          limit: options?.limit || 50,
          offset: options?.offset || 0,
        },
      })
      return {
        data: response.data,
        pagination: response.pagination,
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des messages:', error)
      toast.add({
        color: 'error',
        title: 'Erreur',
        description: 'Impossible de récupérer les messages',
      })
      return { data: [], pagination: null }
    }
  }

  /**
   * Envoie un message dans une conversation
   */
  const sendMessage = async (
    conversationId: string,
    content: string,
    replyToId?: string
  ): Promise<ConversationMessage | null> => {
    try {
      const response = await $fetch<{ success: boolean; data: ConversationMessage }>(
        `/api/messenger/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: { content, replyToId },
        }
      )
      return response.data
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error)
      toast.add({
        color: 'error',
        title: 'Erreur',
        description: "Impossible d'envoyer le message",
      })
      return null
    }
  }

  /**
   * Édite un message
   */
  const editMessage = async (
    conversationId: string,
    messageId: string,
    content: string
  ): Promise<ConversationMessage | null> => {
    try {
      const response = await $fetch<{ success: boolean; data: ConversationMessage }>(
        `/api/messenger/conversations/${conversationId}/messages/${messageId}`,
        {
          method: 'PATCH',
          body: { content },
        }
      )
      return response.data
    } catch (error) {
      console.error("Erreur lors de l'édition du message:", error)
      toast.add({
        color: 'error',
        title: 'Erreur',
        description: 'Impossible de modifier le message',
      })
      return null
    }
  }

  /**
   * Supprime un message
   */
  const deleteMessage = async (conversationId: string, messageId: string): Promise<boolean> => {
    try {
      await $fetch(`/api/messenger/conversations/${conversationId}/messages/${messageId}`, {
        method: 'PATCH',
        body: { deleted: true },
      })
      return true
    } catch (error) {
      console.error('Erreur lors de la suppression du message:', error)
      toast.add({
        color: 'error',
        title: 'Erreur',
        description: 'Impossible de supprimer le message',
      })
      return false
    }
  }

  /**
   * Marque un message comme lu dans une conversation
   * Met à jour le lastReadMessageId pour indiquer quel message a été lu en dernier
   */
  const markMessageAsRead = async (conversationId: string, messageId: string): Promise<boolean> => {
    try {
      await $fetch(`/api/messenger/conversations/${conversationId}/mark-read`, {
        method: 'PATCH',
        body: { messageId },
      })
      return true
    } catch (error) {
      console.error('Erreur lors du marquage du message comme lu:', error)
      // Ne pas afficher de toast pour cette erreur car c'est une action silencieuse
      return false
    }
  }

  /**
   * Récupère les conversations privées 1-à-1 de l'utilisateur (non liées à une édition)
   */
  const fetchPrivateConversations = async (): Promise<Conversation[]> => {
    try {
      const response = await $fetch<{ success: boolean; data: Conversation[] }>(
        '/api/messenger/private-conversations'
      )
      return response.data
    } catch (error) {
      console.error('Erreur lors de la récupération des conversations privées:', error)
      toast.add({
        color: 'error',
        title: 'Erreur',
        description: 'Impossible de récupérer les conversations privées',
      })
      return []
    }
  }

  return {
    fetchEditions,
    fetchConversations,
    fetchPrivateConversations,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    markMessageAsRead,
  }
}
