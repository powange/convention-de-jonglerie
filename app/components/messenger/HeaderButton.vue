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
const { messengerUnreadCount, messengerConversationCount, fetchMessengerUnreadCount } =
  useNotificationStream()

// L'utilisateur a-t-il au moins une conversation ?
const hasConversations = computed(() => messengerConversationCount.value > 0)

// Raccourci pour le template
const unreadCount = messengerUnreadCount

// Charger le compteur initial au montage
onMounted(() => {
  fetchMessengerUnreadCount()
})
</script>
