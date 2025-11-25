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
            <h3 class="font-semibold">{{ $t('messenger.conversations') }}</h3>
          </template>

          <div class="flex-1 overflow-y-auto">
            <div v-if="loading" class="text-center py-8">
              <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 mx-auto" />
              <p class="text-sm text-gray-500 mt-2">{{ $t('messenger.loading') }}</p>
            </div>

            <div v-else-if="!hasAnyConversation" class="text-center py-8">
              <UIcon name="i-heroicons-inbox" class="h-12 w-12 mx-auto text-gray-400" />
              <p class="text-sm text-gray-500 mt-2">{{ $t('messenger.no_conversations') }}</p>
            </div>

            <div v-else class="space-y-4">
              <!-- Section Conversations privées -->
              <UAccordion
                v-if="sortedPrivateConversations.length > 0"
                v-model="openPrivateAccordion"
                type="multiple"
                :items="privateAccordionItems"
                :unmount-on-hide="false"
              >
                <template #leading>
                  <UIcon
                    name="i-heroicons-chat-bubble-left-right"
                    class="w-10 h-10 text-gray-400"
                  />
                </template>

                <template #trailing="{ open }">
                  <div class="flex items-center gap-2">
                    <UBadge v-if="privateConversationsTotalUnread > 0" color="error" size="sm">
                      {{ privateConversationsTotalUnread }}
                    </UBadge>
                    <UIcon
                      name="i-heroicons-chevron-down"
                      class="transition-transform duration-200"
                      :class="[open ? 'rotate-180' : '']"
                    />
                  </div>
                </template>

                <template #body>
                  <div class="space-y-2 ml-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <button
                      v-for="conversation in sortedPrivateConversations"
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
                          <div class="flex items-center gap-3">
                            <!-- Avatar de l'autre participant pour les conversations privées -->
                            <UiUserAvatar
                              v-if="getOtherParticipant(conversation)"
                              :user="getOtherParticipant(conversation)!"
                              size="md"
                            />
                            <UIcon v-else :name="getConversationIcon(conversation)" />
                            <p class="font-medium truncate">
                              {{ getConversationDisplayName(conversation) }}
                            </p>
                          </div>
                          <!-- Dernier message -->
                          <p
                            v-if="conversation.messages[0]"
                            class="text-sm text-gray-600 dark:text-gray-400 truncate mt-1"
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

              <!-- Section Conversations par édition -->
              <UAccordion
                v-if="accordionItems.length > 0"
                v-model="openAccordionItems"
                type="multiple"
                :items="accordionItems"
                :unmount-on-hide="false"
              >
                <template #leading="{ item }">
                  <div v-if="item.edition?.imageUrl" class="w-10 h-10 flex-shrink-0">
                    <img
                      :src="
                        useImageUrl().getImageUrl(
                          item.edition.imageUrl ?? undefined,
                          'edition',
                          item.edition.id
                        )
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
                  <div class="space-y-2 ml-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
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
                              :name="getConversationIcon(conversation)"
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

                <!-- Avatar pour conversations privées avec pastille de présence, icône sinon -->
                <div v-if="getOtherParticipant(selectedConversation)" class="relative">
                  <UiUserAvatar :user="getOtherParticipant(selectedConversation)!" size="md" />
                  <!-- Pastille de présence -->
                  <div
                    v-if="presentUserIds.includes(getOtherParticipant(selectedConversation)!.id)"
                    class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"
                    :title="$t('messenger.online')"
                  />
                </div>
                <UIcon
                  v-else
                  :name="getConversationIcon(selectedConversation)"
                  :style="
                    selectedConversation.team ? { color: selectedConversation.team.color } : {}
                  "
                  class="h-6 w-6"
                />
                <div>
                  <h3 class="font-semibold">
                    {{ getConversationDisplayName(selectedConversation) }}
                  </h3>
                  <p v-if="selectedConversation.type !== 'PRIVATE'" class="text-xs text-gray-500">
                    {{ getConversationTypeLabel(selectedConversation) }}
                  </p>
                </div>
              </div>

              <!-- Bouton participants (masqué pour les conversations privées) -->
              <UButton
                v-if="selectedConversation.type !== 'PRIVATE'"
                color="neutral"
                variant="ghost"
                :label="`${selectedConversation.participants.length}`"
                icon="i-heroicons-users"
                @click="showParticipantsModal = true"
              />
            </div>
            <h3 v-else class="font-semibold">{{ $t('messenger.select_conversation') }}</h3>
          </template>

          <div v-if="!selectedConversationId" class="flex-1 flex items-center justify-center p-8">
            <div class="text-center">
              <UIcon
                name="i-heroicons-chat-bubble-left-right"
                class="h-16 w-16 mx-auto text-gray-400"
              />
              <p class="text-sm text-gray-500 mt-4">{{ $t('messenger.select_conversation') }}</p>
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
                <p class="text-xs text-gray-500 mt-1">
                  {{ $t('messenger.loading_previous_messages') }}
                </p>
              </div>

              <!-- Message quand il n'y a plus de messages -->
              <div
                v-else-if="!hasMoreMessages && messages.length > 0 && !loadingMessages"
                class="text-center py-3 text-xs text-gray-400"
              >
                {{ $t('messenger.beginning_of_conversation') }}
              </div>

              <div v-if="loadingMessages" class="text-center py-8">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 mx-auto" />
                <p class="text-sm text-gray-500 mt-2">{{ $t('messenger.loading_messages') }}</p>
              </div>

              <div v-else-if="formattedMessages.length === 0" class="text-center py-8">
                <UIcon
                  name="i-heroicons-chat-bubble-left"
                  class="h-12 w-12 mx-auto text-gray-400"
                />
                <p class="text-sm text-gray-500 mt-2">{{ $t('messenger.no_messages') }}</p>
                <p class="text-xs text-gray-400 mt-1">{{ $t('messenger.be_first_to_send') }}</p>
              </div>

              <UChatMessages v-else :should-scroll-to-bottom="false" :should-auto-scroll="false">
                <div
                  v-for="message in formattedMessages"
                  :id="`message-${message.id}`"
                  :key="message.id"
                >
                  <UChatMessage
                    v-bind="message"
                    :role="message.role"
                    :side="message.isCurrentUser ? 'right' : 'left'"
                    :avatar="{ src: message.avatarUrl.value }"
                    :actions="isMobile ? undefined : message.actions"
                  >
                    <template #content>
                      <MessengerMessageBubble
                        :message-id="message.id"
                        :can-delete="message.isCurrentUser"
                        :is-deleted="message.metadata?.isDeleted"
                        @reply="handleReplyToMessage(getOriginalMessage(message.id)!)"
                        @delete="handleDeleteMessage(message.id)"
                      >
                        <div>
                          <!-- Nom de l'auteur pour les messages des autres -->
                          <p
                            v-if="message.role === 'assistant'"
                            class="text-xs font-medium mb-1 opacity-70"
                          >
                            {{ message.metadata?.authorName }}
                          </p>

                          <!-- Citation du message auquel on répond -->
                          <div
                            v-if="message.metadata?.replyTo"
                            class="mb-2 p-2 rounded-md bg-gray-100 dark:bg-gray-800 border-l-4 border-primary cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            @click="scrollToMessage(message.metadata.replyTo.id)"
                          >
                            <p class="text-xs font-medium text-primary mb-1">
                              {{ message.metadata.replyTo.participant.user.pseudo }}
                            </p>
                            <p
                              class="text-xs opacity-70 truncate"
                              :class="{ italic: message.metadata.replyTo.deletedAt }"
                            >
                              {{ message.metadata.replyTo.content }}
                            </p>
                          </div>

                          <!-- Contenu du message -->
                          <p
                            class="text-sm break-words whitespace-pre-wrap"
                            :class="{ 'italic opacity-50': message.metadata?.isDeleted }"
                          >
                            {{ message.parts[0]?.text }}
                          </p>
                          <!-- Horodatage et statut d'édition -->
                          <p class="text-xs mt-1 opacity-70">
                            {{ formatMessageTime(message.metadata?.createdAt) }}
                            <span
                              v-if="message.metadata?.editedAt && !message.metadata?.isDeleted"
                              class="ml-1"
                              >({{ $t('messenger.edited') }})</span
                            >
                          </p>
                        </div>
                      </MessengerMessageBubble>
                    </template>
                  </UChatMessage>
                </div>
              </UChatMessages>
            </div>

            <!-- Indicateur de typing -->
            <MessengerTypingIndicator :users="typingUsersInCurrentConversation" />

            <!-- Formulaire d'envoi avec UChatPrompt -->
            <div class="border-t dark:border-gray-700 p-4 shrink-0">
              <!-- Preview de la réponse -->
              <div
                v-if="replyingToMessage"
                class="mb-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 border-l-4 border-primary"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <UIcon name="i-heroicons-arrow-uturn-left" class="h-4 w-4 text-primary" />
                      <p class="text-xs font-medium text-primary">
                        {{
                          $t('messenger.reply_to', {
                            pseudo: replyingToMessage.participant.user.pseudo,
                          })
                        }}
                      </p>
                    </div>
                    <p class="text-sm opacity-70 truncate">
                      {{ replyingToMessage.content }}
                    </p>
                  </div>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-heroicons-x-mark"
                    size="sm"
                    @click="cancelReply"
                  />
                </div>
              </div>

              <UChatPrompt
                ref="chatPromptRef"
                v-model="newMessage"
                :placeholder="$t('messenger.message_placeholder')"
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
    <UModal v-model:open="showParticipantsModal" :title="$t('messenger.participants')">
      <template #body>
        <div v-if="selectedConversation" class="space-y-3">
          <div
            v-for="participant in selectedConversation.participants"
            :key="participant.id"
            class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div class="relative">
              <UiUserAvatar :user="participant.user" size="md" />
              <!-- Pastille verte de présence -->
              <div
                v-if="presentUserIds.includes(participant.user.id)"
                class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"
                :title="$t('messenger.online')"
              />
            </div>
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
import { useAvatar } from '~/utils/avatar'

const { getUserAvatarWithCache } = useAvatar()

definePageMeta({
  middleware: 'auth-protected',
  layout: 'messenger',
})

// Charger les traductions messenger en lazy loading
await useLazyI18n('messenger')

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const {
  fetchEditions,
  fetchConversations,
  fetchPrivateConversations,
  fetchMessages,
  sendMessage: sendMessageApi,
  deleteMessage,
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
const privateConversations = ref<Conversation[]>([])
const messages = ref<ConversationMessage[]>([])

const selectedConversationId = ref<string | null>(null)
const newMessage = ref('')
const openAccordionItems = ref<string[]>([])
const openPrivateAccordion = ref<string[]>(['private']) // Ouvert par défaut
const chatPromptRef = ref()
const messagesContainerRef = ref<HTMLElement | null>(null)
const replyingToMessage = ref<ConversationMessage | null>(null)
const presentUserIds = ref<number[]>([])

// Pagination des messages
const hasMoreMessages = ref(true)
const loadingMoreMessages = ref(false)
const messagesLimit = 50

// Détection mobile pour afficher swipe/long press au lieu des boutons d'actions
const isMobile = ref(false)

// Computed
const selectedConversation = computed(() => {
  // Chercher d'abord dans les conversations privées
  const privateConv = privateConversations.value.find((c) => c.id === selectedConversationId.value)
  if (privateConv) return privateConv

  // Sinon chercher dans les conversations liées aux éditions
  for (const { conversations } of editionsWithConversations.value.values()) {
    const conversation = conversations.find((c) => c.id === selectedConversationId.value)
    if (conversation) return conversation
  }
  return undefined
})

// Trouver l'édition de la conversation sélectionnée (ou 'private' pour les conversations privées)
const selectedEditionId = computed(() => {
  if (!selectedConversationId.value) return null

  // Vérifier si c'est une conversation privée
  if (privateConversations.value.some((c) => c.id === selectedConversationId.value)) {
    return 'private'
  }

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
      label: edition.name ?? edition.convention.name,
      icon: 'i-heroicons-calendar',
      value: String(edition.id),
      conversations: sortedConversations,
      totalUnread,
      edition, // Passer l'édition complète pour accéder à imageUrl dans les slots
    }
  })
})

// Computed pour les conversations privées triées
const sortedPrivateConversations = computed(() => {
  return [...privateConversations.value].sort((a, b) => {
    const dateA = a.messages[0]?.createdAt ? new Date(a.messages[0].createdAt).getTime() : 0
    const dateB = b.messages[0]?.createdAt ? new Date(b.messages[0].createdAt).getTime() : 0
    return dateB - dateA // Ordre décroissant (plus récent en premier)
  })
})

// Item d'accordéon pour les conversations privées
const privateAccordionItems = computed(() => [
  {
    label: t('messenger.private_conversations'),
    value: 'private',
  },
])

// Total des messages non lus des conversations privées
const privateConversationsTotalUnread = computed(() => {
  return privateConversations.value.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0)
})

// Vérifier s'il y a des conversations (éditions ou privées)
const hasAnyConversation = computed(() => {
  return accordionItems.value.length > 0 || privateConversations.value.length > 0
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
    const isDeleted = !!message.deletedAt

    // Actions natives pour les messages non supprimés
    const actions = !isDeleted
      ? [
          {
            icon: 'i-heroicons-arrow-uturn-left',
            color: 'neutral' as const,
            label: t('messenger.reply'),
            trailing: true,
            onClick: () => handleReplyToMessage(message),
          },
          ...(isCurrentUser
            ? [
                {
                  icon: 'i-lucide-trash',
                  color: 'error' as const,
                  label: t('messenger.delete'),
                  trailing: true,
                  onClick: () => handleDeleteMessage(message.id),
                },
              ]
            : []),
        ]
      : undefined

    const { currentUrl: avatarUrl } = getUserAvatarWithCache(message.participant.user, 32)

    return {
      id: message.id,
      isCurrentUser: isCurrentUser,
      role: 'user',
      parts: [
        {
          type: 'text',
          text: message.content, // Le contenu est déjà "Message supprimé" si deletedAt existe (transformé côté serveur)
        },
      ],
      actions,
      avatarUrl,
      metadata: {
        authorName: message.participant.user.pseudo,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        deletedAt: message.deletedAt,
        replyTo: message.replyTo,
        user: message.participant.user, // Passer l'objet user complet pour UserAvatar
        isDeleted,
      },
    }
  })
})

// Stream SSE pour la conversation courante
const { realtimeMessages: streamRealtimeMessages, messageUpdates } =
  useMessengerStream(selectedConversationId)

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
 * Scrolle vers un message spécifique et le met en évidence
 */
function scrollToMessage(messageId: string) {
  nextTick(() => {
    const messageElement = document.getElementById(`message-${messageId}`)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Ajouter une animation de highlight
      messageElement.classList.add('highlight-message')
      setTimeout(() => {
        messageElement.classList.remove('highlight-message')
      }, 2000)
    }
  })
}

/**
 * Récupère le message original à partir de son ID
 */
function getOriginalMessage(messageId: string): ConversationMessage | undefined {
  return allMessages.value.find((m) => m.id === messageId)
}

/**
 * Commence une réponse à un message
 */
function handleReplyToMessage(message: ConversationMessage | undefined) {
  if (!message) return
  replyingToMessage.value = message
  // Focus le champ de saisie
  nextTick(() => {
    if (chatPromptRef.value?.$el) {
      const textarea = chatPromptRef.value.$el.querySelector('textarea')
      if (textarea) {
        textarea.focus()
      }
    }
  })
}

/**
 * Annule la réponse en cours
 */
function cancelReply() {
  replyingToMessage.value = null
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
 * Retourne l'icône d'une conversation selon son type
 */
function getConversationIcon(conversation: Conversation): string {
  switch (conversation.type) {
    case 'TEAM_GROUP':
      return 'i-heroicons-user-group'
    case 'VOLUNTEER_TO_ORGANIZERS':
      return 'i-heroicons-megaphone'
    case 'ORGANIZERS_GROUP':
      return 'i-heroicons-building-office-2'
    case 'PRIVATE':
      return 'i-heroicons-chat-bubble-left-right'
    default:
      return 'i-heroicons-user'
  }
}

/**
 * Retourne le libellé du type de conversation
 */
function getConversationTypeLabel(conversation: Conversation): string {
  switch (conversation.type) {
    case 'TEAM_GROUP':
      return t('messenger.conversation_types.group')
    case 'VOLUNTEER_TO_ORGANIZERS':
      return t('messenger.conversation_types.organizers')
    case 'ORGANIZERS_GROUP':
      return t('messenger.conversation_types.organizers_group')
    default:
      return t('messenger.conversation_types.private')
  }
}

/**
 * Retourne le nom d'affichage d'une conversation
 */
function getConversationDisplayName(conversation: Conversation): string {
  if (conversation.type === 'VOLUNTEER_TO_ORGANIZERS') {
    return t('messenger.volunteer_managers')
  }

  if (conversation.type === 'ORGANIZERS_GROUP') {
    return t('messenger.organizers_group')
  }

  if (conversation.type === 'TEAM_GROUP') {
    return conversation.team?.name || 'Conversation'
  }

  // Pour les conversations privées 1-à-1 (PRIVATE)
  if (conversation.type === 'PRIVATE') {
    const currentUser = authStore.user
    if (!currentUser) return t('messenger.private_conversation')

    // Trouver l'autre participant
    const otherParticipant = conversation.participants.find((p) => p.userId !== currentUser.id)
    if (otherParticipant) {
      return otherParticipant.user.pseudo
    }
    return t('messenger.private_conversation')
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
 * Retourne l'autre participant d'une conversation privée 1-à-1
 */
function getOtherParticipant(conversation: Conversation) {
  if (conversation.type !== 'PRIVATE') return null
  const currentUser = authStore.user
  if (!currentUser) return null
  return conversation.participants.find((p) => p.userId !== currentUser.id)?.user || null
}

/**
 * Retourne le sous-titre d'une conversation
 */
function getConversationSubtitle(conversation: Conversation): string {
  if (conversation.type === 'TEAM_GROUP') {
    return t('messenger.subtitles.group')
  }

  if (conversation.type === 'VOLUNTEER_TO_ORGANIZERS') {
    return t('messenger.subtitles.organizers')
  }

  if (conversation.type === 'ORGANIZERS_GROUP') {
    return t('messenger.subtitles.organizers_group')
  }

  if (conversation.type === 'PRIVATE') {
    return t('messenger.subtitles.private')
  }

  // Pour les conversations privées (TEAM_LEADER_PRIVATE)
  const otherParticipants = conversation.participants.filter((p) => p.userId !== authStore.user?.id)

  if (otherParticipants.length <= 1) {
    return t('messenger.subtitles.private_leader')
  }

  return t('messenger.subtitles.private_leaders')
}

// Charger toutes les éditions et conversations au montage
onMounted(async () => {
  // Détecter si c'est un appareil tactile
  isMobile.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0

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

    // Charger les conversations privées 1-à-1
    privateConversations.value = await fetchPrivateConversations()

    loading.value = false

    // Connecter le stream global pour recevoir les notifications de nouveaux messages
    connectGlobalStream()

    // Si conversationId dans query params, sélectionner la conversation
    const queryConversationId = route.query.conversationId
    const queryEditionId = route.query.editionId

    if (queryConversationId && typeof queryConversationId === 'string') {
      // Si editionId est fourni, ouvrir l'accordéon de cette édition
      if (queryEditionId && typeof queryEditionId === 'string') {
        openAccordionItems.value = [queryEditionId]
      }

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
  // D'abord vérifier dans les conversations privées
  const privateConv = privateConversations.value.find((c) => c.id === conversationId)
  if (privateConv) {
    privateConv.unreadCount = 0
  } else {
    // Sinon chercher dans les éditions
    for (const [_editionId, data] of editionsWithConversations.value.entries()) {
      const conversation = data.conversations.find((c) => c.id === conversationId)
      if (conversation) {
        conversation.unreadCount = 0
        break
      }
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

  // Sauvegarder la position de scroll et la hauteur actuelle
  const container = messagesContainerRef.value
  if (!container) {
    loadingMoreMessages.value = false
    return
  }

  const previousScrollHeight = container.scrollHeight
  const previousScrollTop = container.scrollTop

  try {
    const result = await fetchMessages(selectedConversationId.value, {
      limit: messagesLimit,
      offset: messages.value.length,
    })

    // Ajouter les nouveaux messages au début (car ce sont des messages plus anciens)
    messages.value = [...result.data, ...messages.value]

    // Mettre à jour hasMoreMessages
    hasMoreMessages.value = result.pagination?.hasNextPage ?? result.data.length >= messagesLimit

    // Attendre que le DOM soit mis à jour
    await nextTick()

    // Attendre un court délai pour que le rendu soit complètement terminé
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Calculer la nouvelle hauteur du contenu
    const newScrollHeight = container.scrollHeight

    // Calculer la différence de hauteur (les nouveaux messages ajoutés)
    const heightDifference = newScrollHeight - previousScrollHeight

    // Restaurer la position de scroll en ajoutant la différence de hauteur
    // Cela maintient exactement la même position visuelle pour l'utilisateur
    container.scrollTop = previousScrollTop + heightDifference
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
  const message = await sendMessageApi(
    selectedConversationId.value,
    newMessage.value.trim(),
    replyingToMessage.value?.id
  )
  sending.value = false

  if (message) {
    // Ajouter le message immédiatement pour un retour visuel instantané
    messages.value.push(message)

    // Mettre à jour le dernier message de la conversation pour le tri
    updateConversationLastMessage(selectedConversationId.value, message)

    // Vider le champ de saisie et annuler la réponse
    newMessage.value = ''
    replyingToMessage.value = null

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

// Supprimer un message
async function handleDeleteMessage(messageId: string) {
  if (!selectedConversationId.value) return

  // Envoyer la requête de suppression
  // La mise à jour de l'UI se fera automatiquement via le SSE (événement message-updated)
  await deleteMessage(selectedConversationId.value, messageId)
}

// Récupérer la liste des utilisateurs présents sur la conversation
async function fetchPresence() {
  if (!selectedConversationId.value) {
    presentUserIds.value = []
    return
  }

  try {
    const response = await $fetch<{
      success: boolean
      data: { presentUserIds: number[] }
    }>(`/api/messenger/conversations/${selectedConversationId.value}/presence`)

    if (response.success) {
      presentUserIds.value = response.data.presentUserIds
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de la présence:', error)
  }
}

// Formater le temps du message
function formatMessageTime(date: Date) {
  const messageDate = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - messageDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return t('messenger.just_now')
  if (diffMins < 60) return t('messenger.minutes_ago', { count: diffMins })

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return t('messenger.hours_ago', { count: diffHours })

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

// Surveiller les changements de conversation sélectionnée pour ouvrir automatiquement l'accordéon correspondant
watch(selectedEditionId, (newEditionId) => {
  if (newEditionId === 'private') {
    // Ouvrir l'accordéon des conversations privées
    if (!openPrivateAccordion.value.includes('private')) {
      openPrivateAccordion.value.push('private')
    }
  } else if (newEditionId && !openAccordionItems.value.includes(newEditionId)) {
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

      // Scroller vers le bas UNIQUEMENT si le dernier message a changé
      // (ce qui indique un nouveau message à la fin, pas un chargement au début)
      if (oldMessages && oldMessages.length > 0 && newMessages.length > oldMessages.length) {
        const oldLastMessage = oldMessages[oldMessages.length - 1]
        const newLastMessage = newMessages[newMessages.length - 1]

        // Scroller seulement si le dernier message est différent
        if (oldLastMessage?.id !== newLastMessage?.id) {
          scrollToBottom()
        }
      }
    }
  },
  { deep: true }
)

// Surveiller les mises à jour de messages (suppressions/modifications) via SSE
watch(
  messageUpdates,
  (updates) => {
    if (updates.length === 0) return

    // Prendre la dernière mise à jour
    const update = updates[updates.length - 1] as unknown as ConversationMessage
    if (!update) return

    // Mettre à jour le message dans messages.value si présent
    const messageIndex = messages.value.findIndex((m) => m.id === update.id)
    if (messageIndex !== -1) {
      // Remplacer le message par la version mise à jour (approche immutable)
      messages.value = messages.value.map((m) => (m.id === update.id ? update : m))
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
    if (!notification) return

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

// Actualiser la présence quand la conversation change
watch(selectedConversationId, async (newId) => {
  if (newId) {
    await fetchPresence()
  } else {
    presentUserIds.value = []
  }
})

// Actualiser la présence toutes les 10 secondes
let presenceInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  presenceInterval = setInterval(() => {
    if (selectedConversationId.value) {
      fetchPresence()
    }
  }, 10000) // 10 secondes
})

onUnmounted(() => {
  if (presenceInterval) {
    clearInterval(presenceInterval)
  }
})
</script>

<style scoped>
@keyframes highlight-pulse {
  0% {
    background-color: transparent;
  }
  50% {
    background-color: rgb(59 130 246 / 0.2);
  }
  100% {
    background-color: transparent;
  }
}

.highlight-message {
  animation: highlight-pulse 2s ease-in-out;
}
</style>
