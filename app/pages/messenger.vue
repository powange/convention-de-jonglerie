<template>
  <div class="min-h-screen">
    <!-- En-tête de page -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-chat-bubble-left-right" class="text-blue-600" />
        Messagerie
      </h1>
    </div>

    <!-- Layout principal : 2 colonnes -->
    <div class="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
      <!-- Colonne 1 : Conversations groupées par édition -->
      <div class="col-span-12 lg:col-span-5">
        <UCard class="h-full overflow-auto">
          <template #header>
            <h3 class="font-semibold">Conversations</h3>
          </template>

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
            <template #trailing="{ item }">
              <UBadge v-if="item.totalUnread > 0" color="red" size="xs">
                {{ item.totalUnread }}
              </UBadge>
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
                          {{
                            conversation.type === 'VOLUNTEER_TO_ORGANIZERS'
                              ? 'Responsables bénévoles'
                              : conversation.team?.name || 'Conversation'
                          }}
                        </p>
                      </div>
                      <p class="text-xs text-gray-500 mt-1">
                        {{
                          conversation.type === 'TEAM_GROUP'
                            ? 'Groupe'
                            : conversation.type === 'VOLUNTEER_TO_ORGANIZERS'
                              ? 'Organisateurs'
                              : 'Privé avec responsable'
                        }}
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
                    <UBadge v-if="conversation.unreadCount > 0" color="red" size="xs">
                      {{ conversation.unreadCount }}
                    </UBadge>
                  </div>
                </button>
              </div>
            </template>
          </UAccordion>
        </UCard>
      </div>

      <!-- Colonne 2 : Chat -->
      <div class="col-span-12 lg:col-span-7">
        <UCard class="h-full flex flex-col" :ui="{ body: { padding: '' } }">
          <template #header>
            <div v-if="selectedConversation" class="flex items-center gap-3">
              <UIcon
                :name="
                  selectedConversation.type === 'TEAM_GROUP'
                    ? 'i-heroicons-user-group'
                    : selectedConversation.type === 'VOLUNTEER_TO_ORGANIZERS'
                      ? 'i-heroicons-megaphone'
                      : 'i-heroicons-user'
                "
                :style="selectedConversation.team ? { color: selectedConversation.team.color } : {}"
                class="h-6 w-6"
              />
              <div>
                <h3 class="font-semibold">
                  {{
                    selectedConversation.type === 'VOLUNTEER_TO_ORGANIZERS'
                      ? 'Responsables bénévoles'
                      : selectedConversation.team?.name || 'Conversation'
                  }}
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

          <template v-else>
            <!-- Zone de messages avec UChatMessages -->
            <div class="flex-1 overflow-y-auto">
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
                  <UAvatar
                    :src="message.metadata?.avatarSrc"
                    :alt="message.metadata?.authorName"
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

            <!-- Formulaire d'envoi avec UChatPrompt -->
            <div class="border-t dark:border-gray-700 p-4">
              <UChatPrompt
                v-model="newMessage"
                placeholder="Écrivez votre message..."
                :disabled="sending"
                @submit="sendMessage"
              >
                <UChatPromptSubmit :disabled="!newMessage.trim()" :loading="sending" />
              </UChatPrompt>
            </div>
          </template>
        </UCard>
      </div>
    </div>
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
  layout: 'default',
})

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const {
  fetchEditions,
  fetchConversations,
  fetchMessages,
  sendMessage: sendMessageApi,
} = useMessenger()

// États
const loading = ref(true)
const loadingMessages = ref(false)
const sending = ref(false)

const editionsWithConversations = ref<
  Map<number, { edition: MessengerEdition; conversations: Conversation[] }>
>(new Map())
const messages = ref<ConversationMessage[]>([])

const selectedConversationId = ref<string | null>(null)
const newMessage = ref('')
const openAccordionItems = ref<string[]>([])

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
    const avatarSrc = message.participant.user.profilePicture
      ? message.participant.user.profilePicture
      : message.participant.user.emailHash
        ? `https://www.gravatar.com/avatar/${message.participant.user.emailHash}?d=mp`
        : undefined

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
        avatarSrc,
      },
    }
  })
})

// Stream SSE
const { realtimeMessages: streamRealtimeMessages } = useMessengerStream(selectedConversationId)

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

  loadingMessages.value = true
  const result = await fetchMessages(conversationId)
  messages.value = result.data
  loadingMessages.value = false

  // Mettre à jour l'URL
  router.push({ query: { conversationId } })
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
            userId: message.participant.userId,
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

    // Le message arrivera aussi via SSE mais sera dédupliqué par l'ID
    // UChatMessages gère automatiquement le scroll
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
</script>
