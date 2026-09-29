<script setup lang="ts">
import { useMessenger } from '@@/app/composables/useMessenger'
import { useMessengerStream } from '@@/app/composables/useMessengerStream'

import {
  appliquerMisesAJour,
  fusionnerMessages,
  remplacerMessage,
} from '~/utils/messages-conversation'

import type { ConversationMessage } from '@@/app/composables/useMessenger'

/**
 * La discussion d'une candidature d'artiste, dans une carte : sur la fiche de la candidature en
 * gestion, et dans « Mes candidatures » côté artiste.
 *
 * C'est la même conversation que dans la messagerie, et elle s'y affiche de la même façon : même
 * fil (`MessengerMessageList`), même zone de saisie (`MessengerComposer`), mêmes actions. Ce qui
 * lui reste propre : la conversation n'est créée qu'au premier message, et un organisateur peut la
 * lire sans y être inscrit.
 */
const props = defineProps<{
  applicationId: number
}>()

const { t } = useI18n()
const messenger = useMessenger()

// État de la conversation
const conversationId = ref<string | null>(null)
const isLoadingMore = ref(false)
const isSending = ref(false)
const hasConversation = ref(false)
// Participant ou simple lecteur : un organisateur consulte la conversation sans y être
// inscrit, et n'a alors aucune position de lecture à enregistrer.
const isParticipant = ref(false)
const messageInput = ref('')
const messagesContainerRef = ref<HTMLElement | null>(null)
const composerRef = ref<{ focaliser: () => void } | null>(null)

// Messages
const messages = ref<ConversationMessage[]>([])
const pagination = ref<{ total: number; hasMore: boolean } | null>(null)

// Réponse ou modification en cours dans la zone de saisie : la même logique que la messagerie.
const {
  reponseA,
  enModification,
  repondreA,
  annulerReponse,
  modifier,
  annulerModification,
  enregistrerModification,
} = useSaisieMessage(messageInput)

// Stream temps réel
const { realtimeMessages, isConnected, messageUpdates, clearMessages, clearMessageUpdates } =
  useMessengerStream(conversationId)

// Vérifier si une conversation existe (sans la créer)
const { execute: checkConversation, loading: checkLoading } = useApiAction(
  () => `/api/show-applications/${props.applicationId}/conversation`,
  {
    method: 'GET',
    silent: true,
    onSuccess: async (response: any) => {
      if (response.exists && response.conversationId) {
        conversationId.value = response.conversationId
        hasConversation.value = true
        isParticipant.value = !!response.isParticipant
        await loadMessages()
      } else {
        hasConversation.value = false
      }
    },
  }
)

// Charger les messages
const loadMessages = async () => {
  if (!conversationId.value) return

  const result = await messenger.fetchMessages(conversationId.value, { limit: 50 })
  // Les messages sont retournés du plus récent au plus ancien, on les inverse
  messages.value = result.data.reverse()
  pagination.value = result.pagination

  // Marquer le dernier message comme lu, si l'on est participant : sans cela l'appel part
  // quand même et le serveur répond 403, ce qui remplit le journal d'erreurs de production.
  if (isParticipant.value && messages.value.length > 0) {
    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage) {
      await messenger.markMessageAsRead(conversationId.value, lastMessage.id)
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
      isParticipant.value = true
      return response.data.conversationId
    }
  } catch (error) {
    console.error('Erreur lors de la création/mise à jour de la conversation:', error)
  }
  return null
}

// Envoyer un message, ou enregistrer la modification en cours
const handleSendMessage = async () => {
  if (!messageInput.value.trim() || isSending.value) return

  // Modifier suppose un message déjà envoyé, donc une conversation dont on est participant.
  if (enModification.value && conversationId.value) {
    isSending.value = true
    const modifie = await enregistrerModification(conversationId.value)
    isSending.value = false
    if (modifie) {
      messages.value = remplacerMessage(messages.value, modifie)
      composerRef.value?.focaliser()
    }
    return
  }

  const content = messageInput.value.trim()
  const replyToId = reponseA.value?.id
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

    const newMessage = await messenger.sendMessage(convId, content, replyToId)
    if (newMessage) {
      messages.value = remplacerMessage(messages.value, newMessage)
      annulerReponse()
      await nextTick()
      scrollToBottom()
    } else {
      messageInput.value = content
    }
  } finally {
    isSending.value = false
  }
}

function handleReply(message: ConversationMessage) {
  repondreA(message)
  composerRef.value?.focaliser()
}

function handleEdit(message: ConversationMessage) {
  modifier(message)
  composerRef.value?.focaliser()
}

// Supprimer un message : la mise à jour arrive par le flux temps réel (message-updated).
async function handleDelete(messageId: string) {
  if (!conversationId.value) return
  await messenger.deleteMessage(conversationId.value, messageId)
}

// Scroll vers le bas du conteneur
const scrollToBottom = () => {
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
  }
}

// Messages chargés et messages du flux : la même fusion que la messagerie.
const allMessages = computed(() =>
  fusionnerMessages(messages.value, realtimeMessages.value as unknown as ConversationMessage[])
)

// Watcher pour les nouveaux messages temps réel
watch(
  realtimeMessages,
  async () => {
    await nextTick()
    scrollToBottom()

    // Même règle pour les messages reçus en direct.
    if (isParticipant.value && conversationId.value && realtimeMessages.value.length > 0) {
      const lastMessage = realtimeMessages.value[realtimeMessages.value.length - 1]
      if (lastMessage) {
        await messenger.markMessageAsRead(conversationId.value, lastMessage.id)
      }
    }
  },
  { deep: true }
)

// Watcher pour les mises à jour de messages (suppression/modification)
watch(
  messageUpdates,
  (updates) => {
    if (updates.length === 0) return
    messages.value = appliquerMisesAJour(
      messages.value,
      updates as unknown as ConversationMessage[]
    )
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
    <div v-if="checkLoading" class="flex flex-1 items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-muted" />
    </div>

    <template v-else>
      <!-- Zone des messages -->
      <div
        ref="messagesContainerRef"
        class="flex-1 overflow-y-auto py-2"
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
          class="flex h-full flex-col items-center justify-center p-4 text-center text-muted"
        >
          <UIcon name="i-lucide-message-square" class="mb-2 h-12 w-12" />
          <p class="text-sm">{{ t('components.artist_application.chat.no_messages') }}</p>
          <p class="mt-1 text-xs">{{ t('components.artist_application.chat.be_first') }}</p>
        </div>

        <MessengerMessageList
          v-else
          :messages="allMessages"
          @repondre="handleReply"
          @modifier="handleEdit"
          @supprimer="handleDelete"
        />
      </div>

      <!-- Zone de saisie -->
      <div class="border-t border-default p-3">
        <!--
          `autofocus` est coupé, et c'est le correctif d'un défaut signalé à l'usage : on arrivait
          sur la fiche d'une candidature tout en bas de la page, prêt à écrire un message.

          Sur la page de messagerie, focaliser le champ est juste — la page EST la conversation.
          Ici la discussion n'est qu'une carte au pied d'un long écran : le navigateur amenait le
          champ focalisé dans le champ de vision, et emportait la page avec lui. Le lecteur venait
          lire une candidature, pas y répondre.
        -->
        <MessengerComposer
          ref="composerRef"
          v-model="messageInput"
          :reponse-a="reponseA"
          :en-modification="enModification"
          :envoi="isSending"
          :autofocus="false"
          @envoyer="handleSendMessage"
          @annuler-reponse="annulerReponse"
          @annuler-modification="annulerModification"
        />
      </div>
    </template>
  </div>
</template>
