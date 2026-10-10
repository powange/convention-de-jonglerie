<template>
  <!-- Afficher uniquement si l'utilisateur a au moins une conversation -->
  <NuxtLink v-if="hasConversations" to="/messenger">
    <!-- ⚠️ L'infobulle prend `navigation.messenger`, et non `messenger.conversations` : ce bouton
         est dans l'en-tête de TOUTES les pages, alors que le domaine `messenger` n'est chargé que
         sur `/messenger`. Elle affichait donc la chaîne « messenger.conversations » partout
         ailleurs, dans les treize langues — et réduit à son icône, c'était le seul texte qui
         nommait ce bouton. `navigation.messenger` vit dans `common.json`, toujours embarqué, et
         c'est déjà le nom que le menu donne à cette destination. -->
    <UButton
      icon="i-heroicons-chat-bubble-left-right"
      variant="ghost"
      :color="unreadCount > 0 ? 'primary' : 'neutral'"
      :class="['relative', unreadCount > 0 ? 'animate-pulse' : '']"
      :title="$t('navigation.messenger')"
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
