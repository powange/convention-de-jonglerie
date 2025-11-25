<template>
  <!-- Afficher uniquement si l'utilisateur a au moins une conversation -->
  <NuxtLink v-if="hasConversations" to="/messenger">
    <UButton
      icon="i-heroicons-chat-bubble-left-right"
      variant="ghost"
      :color="unreadCount > 0 ? 'primary' : 'neutral'"
      :class="['relative', unreadCount > 0 ? 'animate-pulse' : '']"
      :title="$t('messenger.conversations')"
    >
      <!-- Badge de messages non lus -->
      <UBadge
        v-if="unreadCount > 0"
        color="error"
        variant="solid"
        :label="unreadCount > 99 ? '99+' : unreadCount.toString()"
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-xs"
      />
    </UButton>
  </NuxtLink>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()

const unreadCount = ref(0)
const conversationCount = ref(0)
let pollingInterval: ReturnType<typeof setInterval> | null = null

// L'utilisateur a-t-il au moins une conversation ?
const hasConversations = computed(() => conversationCount.value > 0)

// Fonction pour récupérer le nombre de messages non lus et de conversations
const fetchUnreadCount = async () => {
  if (!authStore.isAuthenticated) {
    unreadCount.value = 0
    conversationCount.value = 0
    return
  }

  try {
    const response = await $fetch<{
      success: boolean
      data: { unreadCount: number; conversationCount: number }
    }>('/api/messenger/unread-count')
    unreadCount.value = response.data.unreadCount
    conversationCount.value = response.data.conversationCount
  } catch (error) {
    console.error('Erreur lors de la récupération des messages non lus:', error)
  }
}

// Démarrer le polling
const startPolling = () => {
  if (pollingInterval) return

  // Polling toutes les 30 secondes
  pollingInterval = setInterval(() => {
    if (authStore.isAuthenticated && document.visibilityState === 'visible') {
      fetchUnreadCount()
    }
  }, 30000)
}

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

// Gérer la visibilité de la page
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && authStore.isAuthenticated) {
    fetchUnreadCount()
  }
}

onMounted(() => {
  fetchUnreadCount()
  startPolling()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

// Réagir aux changements d'authentification
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      fetchUnreadCount()
      startPolling()
    } else {
      unreadCount.value = 0
      conversationCount.value = 0
      stopPolling()
    }
  }
)
</script>
