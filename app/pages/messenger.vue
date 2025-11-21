<template>
  <div class="h-[calc(100vh-100px)] flex flex-col p-4">
    <!-- Layout principal : 2 colonnes -->
    <div class="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
      <!-- Colonne 1 : Conversations groupées par édition -->
      <div
        class="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col overflow-hidden"
        :class="{ hidden: showConversationOnMobile, 'lg:flex': showConversationOnMobile }"
      >
        <UCard class="h-full flex flex-col overflow-hidden">
          <template #header>
            <h3 class="font-semibold">Conversations</h3>
          </template>

          <div class="flex-1 overflow-y-auto">
            <div v-if="loading" class="text-center py-8">
              <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 mx-auto" />
              <p class="text-sm text-gray-500 mt-2">Chargement...</p>
            </div>

            <div v-else-if="accordionItems.length === 0" class="text-center py-8">
              <UIcon name="i-heroicons-inbox" class="h-12 w-12 mx-auto text-gray-400" />
              <p class="text-sm text-gray-500 mt-2">Aucune conversation</p>
            </div>

            <UAccordion
              v-else
              v-model="openAccordionItems"
              type="multiple"
              :items="accordionItems"
              :unmount-on-hide="false"
            >
              <template #leading="{ item }">
                <div v-if="item.edition?.imageUrl" class="w-10 h-10 flex-shrink-0">
                  <img
                    :src="
                      useImageUrl().getImageUrl(item.edition.imageUrl, 'edition', item.edition.id)
                    "
                    :alt="item.label"
                    class="w-full h-full object-contain rounded"
                  />
                </div>
                <UIcon v-else name="i-heroicons-calendar" class="w-10 h-10 text-gray-400" />
              </template>

              <template #trailing="{ item, open }">
                <div class="flex items-center gap-2">
                  <UBadge v-if="item.totalUnread > 0" color="error" size="sm">
                    {{ item.totalUnread }}
                  </UBadge>
                  <UIcon
                    name="i-heroicons-chevron-down"
                    class="transition-transform duration-200"
                    :class="[open ? 'rotate-180' : '']"
                  />
                </div>
              </template>

              <template #body="{ item }">
                <div class="space-y-2">
                  <button
                    v-for="conversation in item.conversations"
                    :key="conversation.id"
                    :class="[
                      'w-full text-left p-3 rounded-lg transition-colors',
                      selectedConversationId === conversation.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-transparent',
                    ]"
                    @click="selectConversation(conversation.id)"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <UIcon
                            :name="
                              conversation.type === 'TEAM_GROUP'
                                ? 'i-heroicons-user-group'
                                : conversation.type === 'VOLUNTEER_TO_ORGANIZERS'
                                  ? 'i-heroicons-megaphone'
                                  : 'i-heroicons-user'
                            "
                            :style="conversation.team ? { color: conversation.team.color } : {}"
                          />
                          <p class="font-medium truncate">
                            {{ getConversationDisplayName(conversation) }}
                          </p>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">
                          {{ getConversationSubtitle(conversation) }}
                        </p>

                        <!-- Dernier message -->
                        <p
                          v-if="conversation.messages[0]"
                          class="text-sm text-gray-600 dark:text-gray-400 truncate mt-2"
                        >
                          {{ conversation.messages[0].content }}
                        </p>
                      </div>

                      <!-- Badge non lu -->
                      <UBadge v-if="conversation.unreadCount > 0" color="error" size="sm">
                        {{ conversation.unreadCount }}
                      </UBadge>
                    </div>
                  </button>
                </div>
              </template>
            </UAccordion>
          </div>
        </UCard>
      </div>

      <!-- Colonne 2 : Chat -->
      <div
        class="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col overflow-hidden"
        :class="{ hidden: !showConversationOnMobile, 'lg:flex': !showConversationOnMobile }"
      >
        <UCard
          variant="soft"
          class="h-full flex flex-col overflow-hidden"
          :ui="{ body: 'p-0 flex flex-col flex-1 overflow-hidden' }"
        >
          <template #header>
            <div v-if="selectedConversation" class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <!-- Bouton retour (mobile uniquement) -->
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-arrow-left"
                  class="lg:hidden"
                  @click="showConversationOnMobile = false"
                />

                <UIcon
                  :name="
                    selectedConversation.type === 'TEAM_GROUP'
                      ? 'i-heroicons-user-group'
                      : selectedConversation.type === 'VOLUNTEER_TO_ORGANIZERS'
                        ? 'i-heroicons-megaphone'
                        : 'i-heroicons-user'
                  "
                  :style="
                    selectedConversation.team ? { color: selectedConversation.team.color } : {}
                  "
                  class="h-6 w-6"
                />
                <div>
                  <h3 class="font-semibold">
                    {{ getConversationDisplayName(selectedConversation) }}
                  </h3>
                  <p class="text-xs text-gray-500">
                    {{
                      selectedConversation.type === 'TEAM_GROUP'
                        ? 'Discussion de groupe'
                        : selectedConversation.type === 'VOLUNTEER_TO_ORGANIZERS'
                          ? 'Conversation avec les organisateurs'
                          : 'Conversation privée'
                    }}
                  </p>
                </div>
              </div>

              <!-- Bouton participants -->
              <UButton
                color="neutral"
                variant="ghost"
                :label="`${selectedConversation.participants.length}`"
                icon="i-heroicons-users"
                @click="showParticipantsModal = true"
              />
            </div>
            <h3 v-else class="font-semibold">Sélectionnez une conversation</h3>
          </template>

          <div v-if="!selectedConversationId" class="flex-1 flex items-center justify-center p-8">
            <div class="text-center">
              <UIcon
                name="i-heroicons-chat-bubble-left-right"
                class="h-16 w-16 mx-auto text-gray-400"
              />
              <p class="text-sm text-gray-500 mt-4">Sélectionnez une conversation pour commencer</p>
            </div>
          </div>

          <div v-else class="flex-1 flex flex-col overflow-hidden">
            <!-- Zone de messages avec UChatMessages -->
            <div ref="messagesContainerRef" class="flex-1 overflow-y-auto" @scroll="handleScroll">
              <!-- Indicateur de chargement des messages précédents -->
              <div
                v-if="loadingMoreMessages && !loadingMessages"
                class="text-center py-4 sticky top-0 bg-white dark:bg-gray-900 z-10"
              >
                <UIcon name="i-heroicons-arrow-path" class="animate-spin h-5 w-5 mx-auto" />
                <p class="text-xs text-gray-500 mt-1">Chargement des messages précédents...</p>
              </div>

              <!-- Message quand il n'y a plus de messages -->
              <div
                v-else-if="!hasMoreMessages && messages.length > 0 && !loadingMessages"
                class="text-center py-3 text-xs text-gray-400"
              >
                Début de la conversation
              </div>

              <div v-if="loadingMessages" class="text-center py-8">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 mx-auto" />
                <p class="text-sm text-gray-500 mt-2">Chargement des messages...</p>
              </div>

              <div v-else-if="formattedMessages.length === 0" class="text-center py-8">
                <UIcon
                  name="i-heroicons-chat-bubble-left"
                  class="h-12 w-12 mx-auto text-gray-400"
                />
                <p class="text-sm text-gray-500 mt-2">Aucun message pour le moment</p>
                <p class="text-xs text-gray-400 mt-1">Soyez le premier à envoyer un message !</p>
              </div>

              <UChatMessages
                v-else
                :messages="formattedMessages"
                :user="{
                  variant: 'soft',
                  side: 'right',
                }"
                :assistant="{
                  variant: 'soft',
                  side: 'left',
                }"
                :should-scroll-to-bottom="true"
                :should-auto-scroll="true"
              >
                <template #leading="{ message }">
                  <UiUserAvatar
                    v-if="message.metadata?.user"
                    :user="message.metadata.user"
                    size="sm"
                  />
                </template>

                <template #content="{ message }">
                  <div>
                    <!-- Nom de l'auteur pour les messages des autres -->
                    <p
                      v-if="message.role === 'assistant'"
                      class="text-xs font-medium mb-1 opacity-70"
                    >
                      {{ message.metadata?.authorName }}
                    </p>
                    <!-- Contenu du message -->
                    <p class="text-sm break-words whitespace-pre-wrap">
                      {{ message.parts[0]?.text }}
                    </p>
                    <!-- Horodatage et statut d'édition -->
                    <p class="text-xs mt-1 opacity-70">
                      {{ formatMessageTime(message.metadata?.createdAt) }}
                      <span v-if="message.metadata?.editedAt" class="ml-1">(modifié)</span>
                    </p>
                  </div>
                </template>
              </UChatMessages>
            </div>

            <!-- Indicateur de typing -->
            <MessengerTypingIndicator :users="typingUsersInCurrentConversation" />

            <!-- Formulaire d'envoi avec UChatPrompt -->
            <div class="border-t dark:border-gray-700 p-4 shrink-0">
              <UChatPrompt
                ref="chatPromptRef"
                v-model="newMessage"
                placeholder="Écrivez votre message..."
                :disabled="sending"
                @submit="sendMessage"
                @input="handleTypingInput"
              >
                <UChatPromptSubmit :disabled="!newMessage.trim()" :loading="sending" />
              </UChatPrompt>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Modal des participants -->
    <UModal v-model:open="showParticipantsModal" title="Participants">
      <template #body>
        <div v-if="selectedConversation" class="space-y-3">
          <div
            v-for="participant in selectedConversation.participants"
            :key="participant.id"
            class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <UiUserAvatar :user="participant.user" size="md" />
            <div class="flex-1">
              <p class="font-medium">{{ participant.user.pseudo }}</p>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type {
  MessengerEdition,
  Conversation,
  ConversationMessage,
} from '~/composables/useMessenger'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  middleware: 'auth-protected',
  layout: 'messenger',
})

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const {
  fetchEditions,
  fetchConversations,
  fetchMessages,
  sendMessage: sendMessageApi,
  markMessageAsRead,
} = useMessenger()

// États
const loading = ref(true)
const loadingMessages = ref(false)
const sending = ref(false)
const showParticipantsModal = ref(false)
const showConversationOnMobile = ref(false) // true = affiche la conversation, false = affiche la liste

const editionsWithConversations = ref<
  Map<number, { edition: MessengerEdition; conversations: Conversation[] }>
>(new Map())
const messages = ref<ConversationMessage[]>([])

const selectedConversationId = ref<string | null>(null)
const newMessage = ref('')
const openAccordionItems = ref<string[]>([])
const chatPromptRef = ref()
const messagesContainerRef = ref<HTMLElement | null>(null)

// Pagination des messages
const hasMoreMessages = ref(true)
const loadingMoreMessages = ref(false)
const messagesLimit = 50

// Computed
const selectedConversation = computed(() => {
  for (const { conversations } of editionsWithConversations.value.values()) {
    const conversation = conversations.find((c) => c.id === selectedConversationId.value)
    if (conversation) return conversation
  }
  return undefined
})

// Trouver l'édition de la conversation sélectionnée
const selectedEditionId = computed(() => {
  if (!selectedConversationId.value) return null

  for (const [editionId, { conversations }] of editionsWithConversations.value.entries()) {
    if (conversations.some((c) => c.id === selectedConversationId.value)) {
      return String(editionId)
    }
  }
  return null
})

// Préparer les items pour l'accordion
const accordionItems = computed(() => {
  return Array.from(editionsWithConversations.value.values()).map(({ edition, conversations }) => {
    const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0)

    // Trier les conversations par date du dernier message (plus récent en premier)
    const sortedConversations = [...conversations].sort((a, b) => {
      const dateA = a.messages[0]?.createdAt ? new Date(a.messages[0].createdAt).getTime() : 0
      const dateB = b.messages[0]?.createdAt ? new Date(b.messages[0].createdAt).getTime() : 0
      return dateB - dateA // Ordre décroissant (plus récent en premier)
    })

    return {
      label: edition.name || edition.convention.name,
      icon: 'i-heroicons-calendar',
      value: String(edition.id),
      conversations: sortedConversations,
      totalUnread,
      edition, // Passer l'édition complète pour accéder à imageUrl dans les slots
    }
  })
})

const allMessages = computed(() => {
  const baseMessages = [...messages.value]
  const realtimeMessages = streamRealtimeMessages.value as unknown as ConversationMessage[]

  // Combiner et dédupliquer par ID
  const allMessagesList = [...baseMessages, ...realtimeMessages]
  const uniqueMessages = Array.from(new Map(allMessagesList.map((msg) => [msg.id, msg])).values())

  return uniqueMessages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
})

// Formater les messages au format AI SDK v5 pour UChatMessages
const formattedMessages = computed(() => {
  return allMessages.value.map((message) => {
    const isCurrentUser = message.participant.user.id === authStore.user?.id

    return {
      id: message.id,
      role: isCurrentUser ? 'user' : 'assistant',
      parts: [
        {
          type: 'text',
          text: message.content,
        },
      ],
      metadata: {
        authorName: message.participant.user.pseudo,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        user: message.participant.user, // Passer l'objet user complet pour UserAvatar
      },
    }
  })
})

// Stream SSE pour la conversation courante
const { realtimeMessages: streamRealtimeMessages } = useMessengerStream(selectedConversationId)

// Stream SSE global pour toutes les conversations
const {
  newMessageNotifications,
  typingEvents,
  connect: connectGlobalStream,
} = useGlobalMessengerStream()

// Gestion du typing indicator
const { handleInput: handleTypingInput } = useTypingIndicator(selectedConversationId)

// Computed pour récupérer les utilisateurs en train d'écrire dans la conversation courante
const typingUsersInCurrentConversation = computed(() => {
  if (!selectedConversationId.value) return []

  const userIds = typingEvents.value.get(selectedConversationId.value)
  if (!userIds || userIds.length === 0) return []

  // Récupérer les infos des utilisateurs depuis les participants de la conversation
  const conversation = selectedConversation.value
  if (!conversation) return []

  return conversation.participants.filter((p) => userIds.includes(p.user.id)).map((p) => p.user)
})

/**
 * Scrolle vers le bas de la zone de messages
 */
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
    }
  })
}

/**
 * Gère le scroll de la zone de messages pour charger plus de messages
 */
function handleScroll() {
  const container = messagesContainerRef.value
  if (!container) return

  // Si l'utilisateur est proche du haut (moins de 100px du début)
  if (container.scrollTop < 100) {
    loadMoreMessages()
  }
}

/**
 * Retourne le nom d'affichage d'une conversation
 */
function getConversationDisplayName(conversation: Conversation): string {
  if (conversation.type === 'VOLUNTEER_TO_ORGANIZERS') {
    return 'Responsables bénévoles'
  }

  if (conversation.type === 'TEAM_GROUP') {
    return conversation.team?.name || 'Conversation'
  }

  // Pour les conversations privées avec responsable(s) d'équipe (TEAM_LEADER_PRIVATE)
  if (conversation.type === 'TEAM_LEADER_PRIVATE' && conversation.team) {
    const currentUser = authStore.user
    if (!currentUser) return conversation.team.name

    // Trouver le participant actuel
    const currentParticipant = conversation.participants.find((p) => p.userId === currentUser.id)
    const isCurrentUserLeader = currentParticipant?.isLeader || false

    if (isCurrentUserLeader) {
      // Si je suis responsable : "[Nom de l'équipe] - [nom de la personne pas responsable]"
      const nonLeaderParticipant = conversation.participants.find(
        (p) => p.userId !== currentUser.id && !p.isLeader
      )

      if (nonLeaderParticipant) {
        return `${conversation.team.name} - ${nonLeaderParticipant.user.pseudo}`
      }
    }

    // Si je ne suis pas responsable : "[Nom de l'équipe]"
    return conversation.team.name
  }

  // Fallback pour les autres types de conversations
  return 'Conversation'
}

/**
 * Retourne le sous-titre d'une conversation
 */
function getConversationSubtitle(conversation: Conversation): string {
  if (conversation.type === 'TEAM_GROUP') {
    return 'Groupe'
  }

  if (conversation.type === 'VOLUNTEER_TO_ORGANIZERS') {
    return 'Organisateurs'
  }

  // Pour les conversations privées (TEAM_LEADER_PRIVATE)
  const otherParticipants = conversation.participants.filter((p) => p.userId !== authStore.user?.id)

  if (otherParticipants.length <= 1) {
    return 'Privé avec le responsable'
  }

  return 'Privé avec les responsables'
}

// Charger toutes les éditions et conversations au montage
onMounted(async () => {
  try {
    loading.value = true

    // Récupérer toutes les éditions
    const allEditions = await fetchEditions()

    // Charger les conversations pour chaque édition
    const editionsData = new Map()
    for (const edition of allEditions) {
      const conversations = await fetchConversations(edition.id)

      // Trier les conversations par date du dernier message (plus récent en premier)
      // Ce tri ne se fait qu'au chargement initial
      const sortedConversations = [...conversations].sort((a, b) => {
        const dateA = a.messages[0]?.createdAt ? new Date(a.messages[0].createdAt).getTime() : 0
        const dateB = b.messages[0]?.createdAt ? new Date(b.messages[0].createdAt).getTime() : 0
        return dateB - dateA // Ordre décroissant (plus récent en premier)
      })

      editionsData.set(edition.id, { edition, conversations: sortedConversations })
    }

    editionsWithConversations.value = editionsData
    loading.value = false

    // Connecter le stream global pour recevoir les notifications de nouveaux messages
    connectGlobalStream()

    // Si conversationId dans query params, sélectionner la conversation
    const queryConversationId = route.query.conversationId
    if (queryConversationId && typeof queryConversationId === 'string') {
      await selectConversation(queryConversationId)
    }
  } catch (error) {
    console.error('Erreur lors du chargement des conversations:', error)
    loading.value = false
  }
})

// Sélectionner une conversation
async function selectConversation(conversationId: string) {
  selectedConversationId.value = conversationId

  // Réinitialiser la pagination
  hasMoreMessages.value = true

  loadingMessages.value = true
  const result = await fetchMessages(conversationId, { limit: messagesLimit, offset: 0 })
  messages.value = result.data
  hasMoreMessages.value = result.pagination?.hasNextPage ?? result.data.length >= messagesLimit
  loadingMessages.value = false

  // Scroller vers le bas après le chargement des messages
  scrollToBottom()

  // Réinitialiser le compteur de messages non lus pour cette conversation
  for (const [_editionId, data] of editionsWithConversations.value.entries()) {
    const conversation = data.conversations.find((c) => c.id === conversationId)
    if (conversation) {
      conversation.unreadCount = 0
      break
    }
  }

  // Sur mobile, afficher la conversation
  showConversationOnMobile.value = true

  // Mettre à jour l'URL
  router.push({ query: { conversationId } })
}

/**
 * Charge les messages plus anciens (pagination infinie)
 */
async function loadMoreMessages() {
  if (!selectedConversationId.value || loadingMoreMessages.value || !hasMoreMessages.value) {
    return
  }

  loadingMoreMessages.value = true

  // Sauvegarder la hauteur actuelle du scroll pour restaurer la position
  const container = messagesContainerRef.value
  const previousScrollHeight = container?.scrollHeight || 0

  try {
    const result = await fetchMessages(selectedConversationId.value, {
      limit: messagesLimit,
      offset: messages.value.length,
    })

    // Ajouter les nouveaux messages au début (car ce sont des messages plus anciens)
    messages.value = [...result.data, ...messages.value]

    // Mettre à jour hasMoreMessages
    hasMoreMessages.value = result.pagination?.hasNextPage ?? result.data.length >= messagesLimit

    // Restaurer la position de scroll après l'ajout des messages
    await nextTick()
    if (container) {
      const newScrollHeight = container.scrollHeight
      const scrollDiff = newScrollHeight - previousScrollHeight
      container.scrollTop = container.scrollTop + scrollDiff
    }
  } catch (error) {
    console.error('Erreur lors du chargement des messages précédents:', error)
  } finally {
    loadingMoreMessages.value = false
  }
}

// Mettre à jour le dernier message d'une conversation
function updateConversationLastMessage(conversationId: string, message: ConversationMessage) {
  for (const [_editionId, data] of editionsWithConversations.value.entries()) {
    const conversation = data.conversations.find((c) => c.id === conversationId)
    if (conversation) {
      // Mettre à jour le dernier message
      conversation.messages = [
        {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          participant: {
            user: {
              id: message.participant.user.id,
            },
          },
        },
      ]
      break
    }
  }
}

// Envoyer un message
async function sendMessage() {
  if (!newMessage.value.trim() || !selectedConversationId.value || sending.value) {
    return
  }

  sending.value = true
  const message = await sendMessageApi(selectedConversationId.value, newMessage.value.trim())
  sending.value = false

  if (message) {
    // Ajouter le message immédiatement pour un retour visuel instantané
    messages.value.push(message)

    // Mettre à jour le dernier message de la conversation pour le tri
    updateConversationLastMessage(selectedConversationId.value, message)

    // Vider le champ de saisie
    newMessage.value = ''

    // Scroller vers le bas pour voir le nouveau message
    scrollToBottom()

    // Refocus le champ de saisie pour permettre d'écrire immédiatement un nouveau message
    await nextTick()
    if (chatPromptRef.value?.$el) {
      const textarea = chatPromptRef.value.$el.querySelector('textarea')
      if (textarea) {
        textarea.focus()
      }
    }

    // Le message arrivera aussi via SSE mais sera dédupliqué par l'ID
  }
}

// Formater le temps du message
function formatMessageTime(date: Date) {
  const messageDate = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - messageDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins}min`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Il y a ${diffHours}h`

  return messageDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// UChatMessages gère automatiquement le scroll avec should-auto-scroll

// Surveiller les messages en temps réel pour mettre à jour le dernier message des conversations
watch(streamRealtimeMessages, (newMessages) => {
  if (newMessages.length > 0 && selectedConversationId.value) {
    const latestMessage = newMessages[newMessages.length - 1] as unknown as ConversationMessage
    updateConversationLastMessage(selectedConversationId.value, latestMessage)
  }
})

// Surveiller les changements de conversation sélectionnée pour ouvrir automatiquement l'édition correspondante
watch(selectedEditionId, (newEditionId) => {
  if (newEditionId && !openAccordionItems.value.includes(newEditionId)) {
    openAccordionItems.value.push(newEditionId)
  }
})

// Surveiller les messages pour marquer le dernier comme lu quand un nouveau arrive
watch(
  allMessages,
  async (newMessages, oldMessages) => {
    // Si on a des messages et qu'une conversation est sélectionnée
    if (newMessages.length > 0 && selectedConversationId.value && !loadingMessages.value) {
      // Récupérer le dernier message de la liste
      const lastMessage = newMessages[newMessages.length - 1]

      // Marquer ce message comme lu seulement s'il existe
      if (lastMessage && lastMessage.id) {
        await markMessageAsRead(selectedConversationId.value, lastMessage.id)
      }

      // Scroller vers le bas si un nouveau message est arrivé
      if (oldMessages && newMessages.length > oldMessages.length) {
        scrollToBottom()
      }
    }
  },
  { deep: true }
)

// Surveiller les notifications globales de nouveaux messages pour mettre à jour les compteurs
watch(
  newMessageNotifications,
  (notifications) => {
    if (notifications.length === 0) return

    // Prendre la dernière notification
    const notification = notifications[notifications.length - 1]

    // Ne rien faire si c'est la conversation courante (déjà gérée par le stream spécifique)
    if (notification.conversationId === selectedConversationId.value) {
      return
    }

    // Mettre à jour la conversation concernée
    for (const [_editionId, data] of editionsWithConversations.value.entries()) {
      const conversation = data.conversations.find((c) => c.id === notification.conversationId)
      if (conversation) {
        // Incrémenter le compteur de messages non lus
        conversation.unreadCount = (conversation.unreadCount || 0) + 1

        // Mettre à jour le dernier message affiché dans la liste
        conversation.messages = [
          {
            id: notification.messageId,
            content: notification.content,
            createdAt: notification.createdAt,
            participant: {
              user: {
                id: notification.participant.user.id,
              },
            },
          },
        ]

        // Mettre à jour updatedAt pour le tri
        conversation.updatedAt = notification.createdAt
        break
      }
    }
  },
  { deep: true }
)
</script>
