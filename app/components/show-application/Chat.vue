<script setup lang="ts">
import { useMessenger } from '@@/app/composables/useMessenger'
import { useMessengerStream } from '@@/app/composables/useMessengerStream'

import type { ConversationMessage } from '@@/app/composables/useMessenger'

const props = defineProps<{
  applicationId: number
}>()

const { t, locale } = useI18n()
const { user } = useUserSession()
const messenger = useMessenger()

// État de la conversation
const conversationId = ref<string | null>(null)
const isLoading = ref(true)
const isLoadingMore = ref(false)
const isSending = ref(false)
const hasConversation = ref(false)
const messageInput = ref('')
const messagesContainerRef = ref<HTMLElement | null>(null)

// Messages
const messages = ref<ConversationMessage[]>([])
const pagination = ref<{ total: number; hasMore: boolean } | null>(null)

// Stream temps réel
const { realtimeMessages, isConnected, messageUpdates, clearMessages, clearMessageUpdates } =
  useMessengerStream(conversationId)

// Vérifier si une conversation existe (sans la créer)
const checkConversation = async () => {
  isLoading.value = true

  try {
    const response = await $fetch<{
      success: boolean
      data: { exists: boolean; conversationId: string | null }
    }>(`/api/show-applications/${props.applicationId}/conversation`, { method: 'GET' })

    if (response.data.exists && response.data.conversationId) {
      conversationId.value = response.data.conversationId
      hasConversation.value = true
      await loadMessages()
    } else {
      hasConversation.value = false
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de la conversation:', error)
  } finally {
    isLoading.value = false
  }
}

// Charger les messages
const loadMessages = async () => {
  if (!conversationId.value) return

  const result = await messenger.fetchMessages(conversationId.value, { limit: 50 })
  // Les messages sont retournés du plus récent au plus ancien, on les inverse
  messages.value = result.data.reverse()
  pagination.value = result.pagination

  // Marquer le dernier message comme lu (seulement si on est participant)
  if (messages.value.length > 0) {
    const lastMessage = messages.value[messages.value.length - 1]
    try {
      await messenger.markMessageAsRead(conversationId.value, lastMessage.id)
    } catch {
      // Ignorer l'erreur si l'utilisateur n'est pas participant (il peut quand même voir la conversation)
    }
  }

  // Scroll vers le bas après chargement
  await nextTick()
  scrollToBottom()
}

// Charger plus de messages
const loadMoreMessages = async () => {
  if (!conversationId.value || isLoadingMore.value || !pagination.value?.hasMore) return

  isLoadingMore.value = true
  const result = await messenger.fetchMessages(conversationId.value, {
    limit: 50,
    offset: messages.value.length,
  })

  // Ajouter les anciens messages au début
  messages.value = [...result.data.reverse(), ...messages.value]
  pagination.value = result.pagination
  isLoadingMore.value = false
}

// S'assurer que l'utilisateur est participant (et créer la conversation si nécessaire)
const ensureParticipant = async (): Promise<string | null> => {
  try {
    const response = await $fetch<{ success: boolean; data: { conversationId: string } }>(
      `/api/show-applications/${props.applicationId}/conversation`,
      { method: 'POST' }
    )

    if (response.data.conversationId) {
      conversationId.value = response.data.conversationId
      hasConversation.value = true
      return response.data.conversationId
    }
  } catch (error) {
    console.error('Erreur lors de la création/mise à jour de la conversation:', error)
  }
  return null
}

// Envoyer un message
const handleSendMessage = async () => {
  if (!messageInput.value.trim() || isSending.value) return

  const content = messageInput.value.trim()
  messageInput.value = ''
  isSending.value = true

  try {
    // S'assurer que l'utilisateur est participant (crée la conversation si besoin)
    const convId = await ensureParticipant()
    if (!convId) {
      // Remettre le message si erreur
      messageInput.value = content
      return
    }

    const newMessage = await messenger.sendMessage(convId, content)
    if (newMessage) {
      // Le message sera ajouté via le stream SSE
      await nextTick()
      scrollToBottom()
    }
  } finally {
    isSending.value = false
  }
}

// Scroll vers le bas du conteneur
const scrollToBottom = () => {
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
  }
}

// Vérifier si un message est de l'utilisateur courant
const isOwnMessage = (message: ConversationMessage) => {
  return message.participant.user.id === user.value?.id
}

// Formater la date d'un message
const formatMessageTime = (date: Date) => {
  const d = new Date(date)
  return d.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}

// Formater la date complète pour les séparateurs de jour
const formatMessageDate = (date: Date) => {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) {
    return t('components.artist_application.chat.today')
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return t('components.artist_application.chat.yesterday')
  }
  return d.toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
}

// Vérifier si on doit afficher un séparateur de date
const shouldShowDateSeparator = (index: number) => {
  if (index === 0) return true
  const current = new Date(allMessages.value[index].createdAt)
  const previous = new Date(allMessages.value[index - 1].createdAt)
  return current.toDateString() !== previous.toDateString()
}

// Combiner messages chargés et messages temps réel
const allMessages = computed(() => {
  const existingIds = new Set(messages.value.map((m) => m.id))
  const newMessages = realtimeMessages.value.filter((m) => !existingIds.has(m.id))
  return [...messages.value, ...newMessages]
})

// Watcher pour les nouveaux messages temps réel
watch(
  realtimeMessages,
  async () => {
    await nextTick()
    scrollToBottom()

    // Marquer les nouveaux messages comme lus (seulement si on est participant)
    if (conversationId.value && realtimeMessages.value.length > 0) {
      const lastMessage = realtimeMessages.value[realtimeMessages.value.length - 1]
      try {
        await messenger.markMessageAsRead(conversationId.value, lastMessage.id)
      } catch {
        // Ignorer l'erreur si l'utilisateur n'est pas participant
      }
    }
  },
  { deep: true }
)

// Watcher pour les mises à jour de messages (suppression/modification)
watch(
  messageUpdates,
  (updates) => {
    updates.forEach((update) => {
      const index = messages.value.findIndex((m) => m.id === update.id)
      if (index !== -1) {
        messages.value[index] = update
      }
    })
    clearMessageUpdates()
  },
  { deep: true }
)

// Initialiser au montage
onMounted(() => {
  checkConversation()
})

// Nettoyer à la destruction
onUnmounted(() => {
  clearMessages()
})

// Exposer la méthode de refresh pour le parent
defineExpose({
  refresh: checkConversation,
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden rounded-lg border border-default">
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-default bg-elevated/50 px-4 py-3">
      <UIcon name="i-lucide-message-circle" class="h-5 w-5 text-primary" />
      <span class="font-medium">{{ t('components.artist_application.chat.title') }}</span>
      <UBadge v-if="isConnected" color="success" variant="soft" size="xs">
        {{ t('components.artist_application.chat.connected') }}
      </UBadge>
    </div>

    <!-- Contenu -->
    <div v-if="isLoading" class="flex flex-1 items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-muted" />
    </div>

    <template v-else>
      <!-- Zone des messages -->
      <div
        ref="messagesContainerRef"
        class="flex-1 space-y-4 overflow-y-auto p-4"
        @scroll="
          ($event.target as HTMLElement).scrollTop < 50 && pagination?.hasMore && loadMoreMessages()
        "
      >
        <!-- Loader pour les anciens messages -->
        <div v-if="isLoadingMore" class="flex justify-center py-2">
          <UIcon name="i-lucide-loader-2" class="h-5 w-5 animate-spin text-muted" />
        </div>

        <!-- Messages vides -->
        <div
          v-if="allMessages.length === 0"
          class="flex h-full flex-col items-center justify-center text-center text-muted"
        >
          <UIcon name="i-lucide-message-square" class="mb-2 h-12 w-12" />
          <p class="text-sm">{{ t('components.artist_application.chat.no_messages') }}</p>
          <p class="mt-1 text-xs">{{ t('components.artist_application.chat.be_first') }}</p>
        </div>

        <!-- Liste des messages -->
        <template v-for="(message, index) in allMessages" :key="message.id">
          <!-- Séparateur de date -->
          <div v-if="shouldShowDateSeparator(index)" class="flex items-center gap-4 py-2">
            <div class="h-px flex-1 bg-default" />
            <span class="text-xs text-muted">{{ formatMessageDate(message.createdAt) }}</span>
            <div class="h-px flex-1 bg-default" />
          </div>

          <!-- Message -->
          <div :class="['flex gap-3', isOwnMessage(message) ? 'justify-end' : 'justify-start']">
            <!-- Avatar (gauche) -->
            <UiUserAvatar
              v-if="!isOwnMessage(message)"
              :user="message.participant.user"
              size="sm"
              class="mt-1 shrink-0"
            />

            <!-- Bulle de message -->
            <div
              :class="[
                'max-w-[75%] rounded-2xl px-4 py-2',
                isOwnMessage(message)
                  ? 'bg-primary text-primary-contrast'
                  : 'bg-elevated text-default',
                message.deletedAt ? 'italic opacity-60' : '',
              ]"
            >
              <!-- Nom de l'expéditeur (pour les messages des autres) -->
              <p
                v-if="!isOwnMessage(message)"
                class="mb-1 text-xs font-medium"
                :class="isOwnMessage(message) ? 'text-primary-contrast/80' : 'text-primary'"
              >
                {{ message.participant.user.pseudo }}
              </p>

              <!-- Contenu -->
              <p v-if="message.deletedAt" class="text-sm">
                {{ t('components.artist_application.chat.message_deleted') }}
              </p>
              <p v-else class="whitespace-pre-wrap text-sm">{{ message.content }}</p>

              <!-- Heure et statut modifié -->
              <p
                :class="[
                  'mt-1 text-xs',
                  isOwnMessage(message) ? 'text-primary-contrast/70' : 'text-muted',
                ]"
              >
                {{ formatMessageTime(message.createdAt) }}
                <span v-if="message.editedAt">
                  · {{ t('components.artist_application.chat.edited') }}
                </span>
              </p>
            </div>

            <!-- Avatar (droite) -->
            <UiUserAvatar
              v-if="isOwnMessage(message)"
              :user="message.participant.user"
              size="sm"
              class="mt-1 shrink-0"
            />
          </div>
        </template>
      </div>

      <!-- Zone de saisie -->
      <div class="border-t border-default p-3">
        <UChatPrompt
          v-model="messageInput"
          :placeholder="t('components.artist_application.chat.placeholder')"
          :disabled="isSending"
          variant="subtle"
          class="w-full"
          @submit="handleSendMessage"
        >
          <UButton
            :icon="isSending ? 'i-lucide-loader-2' : 'i-lucide-send'"
            :loading="isSending"
            color="primary"
            variant="solid"
            size="sm"
            :disabled="!messageInput.trim() || isSending"
            @click="handleSendMessage"
          />
        </UChatPrompt>
      </div>
    </template>
  </div>
</template>
