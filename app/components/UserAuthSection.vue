<template>
  <!-- Dropdown utilisateur ou boutons connexion -->
  <div :key="`auth-section-${authKey}`">
    <UDropdownMenu
      v-if="authStore.isAuthenticated && authStore.user"
      :items="userMenuItems"
      :content="{
        align: 'end',
        side: 'bottom',
        sideOffset: 8,
      }"
    >
      <UButton variant="ghost" color="neutral" class="rounded-full">
        <div class="flex items-center gap-2">
          <div class="relative flex-shrink-0">
            <UiUserAvatar :user="authStore.user" size="md" border />
            <!-- Badge Admin en mobile (sur l'avatar) -->
            <UBadge
              v-if="authStore.isAdminModeActive"
              color="warning"
              variant="soft"
              size="xs"
              class="absolute -top-1 -right-1 px-1 sm:hidden bg-opacity-100 backdrop-blur-sm"
            >
              👑
            </UBadge>
          </div>
          <div class="hidden sm:flex flex-col items-start">
            <span class="text-sm font-medium">{{ displayName }}</span>
            <UBadge
              v-if="authStore.isAdminModeActive"
              color="warning"
              variant="soft"
              size="xs"
              class="px-1"
            >
              👑 Admin
            </UBadge>
          </div>
          <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>
      </UButton>
    </UDropdownMenu>

    <!-- Bouton connexion unique pour utilisateurs non connectés -->
    <UButton
      v-else
      :label="$t('navigation.login')"
      icon="i-heroicons-key"
      size="sm"
      color="neutral"
      variant="ghost"
      :to="loginUrl"
    />
  </div>
</template>

<script lang="ts" setup>
import { useAuthStore } from '~/stores/auth'

import type { DropdownMenuItem } from '@nuxt/ui'

const authStore = useAuthStore()

const { t } = useI18n()
const toast = useToast()
const route = useRoute()

// État réactif pour la taille d'écran
const isMobile = ref(false)

// Synchroniser avec le store
const isAdminModeActive = computed(() => authStore.adminMode)

// Utiliser nextTick pour s'assurer que nous sommes côté client après hydration
onMounted(async () => {
  await nextTick()

  // Gérer le responsive avec les composables VueUse
  const { width } = useWindowSize()

  // Watcher réactif pour la taille d'écran
  watch(
    width,
    (newWidth) => {
      isMobile.value = newWidth < 768
    },
    { immediate: true }
  )
})

// Statut de messagerie de l'utilisateur
const messengerStatus = ref({
  hasConversations: false,
  unreadCount: 0,
  conversationsCount: 0,
})

// Charger le statut de messagerie
const loadMessengerStatus = async () => {
  if (!authStore.isAuthenticated) return

  try {
    const status = await $fetch('/api/messenger/status')
    messengerStatus.value = status
  } catch {
    messengerStatus.value = {
      hasConversations: false,
      unreadCount: 0,
      conversationsCount: 0,
    }
  }
}

// Charger au montage
onMounted(() => {
  loadMessengerStatus()
})

// Configuration des items du dropdown utilisateur
const userMenuItems = computed((): DropdownMenuItem[] => {
  const items: DropdownMenuItem[] = [
    {
      label: t('navigation.profile'),
      icon: 'i-heroicons-user',
      to: '/profile',
    },
    {
      label: t('navigation.my_conventions'),
      icon: 'i-heroicons-calendar-days',
      to: '/my-conventions',
    },
  ]

  // Ajouter les candidatures bénévoles seulement si l'utilisateur a la catégorie bénévole
  if (authStore.isVolunteer) {
    items.push({
      label: t('navigation.my_volunteer_applications'),
      icon: 'i-heroicons-hand-raised',
      to: '/my-volunteer-applications',
    })
  }

  // Ajouter les candidatures artiste seulement si l'utilisateur a la catégorie artiste
  if (authStore.isArtist) {
    items.push({
      label: t('navigation.my_artist_applications'),
      icon: 'i-heroicons-sparkles',
      to: '/my-artist-applications',
    })
  }

  // Ajouter la messagerie si l'utilisateur a des conversations
  if (messengerStatus.value.hasConversations) {
    items.push({
      label: t('navigation.messenger'),
      icon: 'i-heroicons-chat-bubble-left-right',
      to: '/messenger',
      badge: messengerStatus.value.unreadCount > 0 ? messengerStatus.value.unreadCount : undefined,
    })
  }

  // Ajouter les favoris en mobile
  if (isMobile.value) {
    items.push({
      label: t('navigation.my_favorites'),
      icon: 'i-heroicons-star',
      to: '/favorites',
    })
  }

  // Ajouter le dashboard admin si super admin
  if (authStore.user?.isGlobalAdmin) {
    items.push({ type: 'separator' as const })
    items.push({
      label: t('navigation.admin'),
      icon: 'i-heroicons-squares-2x2',
      to: '/admin',
    })

    items.push({
      label: isAdminModeActive.value
        ? t('navigation.disable_admin_mode')
        : t('navigation.enable_admin_mode'),
      icon: isAdminModeActive.value ? 'i-heroicons-shield-exclamation' : 'i-heroicons-shield-check',
      // Utiliser une checkbox pour le mode admin
      type: 'checkbox' as const,
      checked: isAdminModeActive.value,
      onUpdateChecked: (checked: boolean) => toggleAdminMode(checked),
    })
  }

  // Ajouter le séparateur et la déconnexion
  items.push({ type: 'separator' as const })
  items.push({
    label: t('navigation.logout'),
    icon: 'i-heroicons-arrow-right-on-rectangle',
    to: `/logout?returnTo=${encodeURIComponent(useReturnTo().cleanReturnTo(route))}`,
  })

  return items
})

// Fonction pour basculer le mode admin
const toggleAdminMode = (checked: boolean) => {
  if (checked) {
    authStore.enableAdminMode()
    toast.add({
      title: t('admin_mode.admin_mode_enabled'),
      description: t('admin_mode.admin_mode_enabled_desc'),
      icon: 'i-heroicons-shield-check',
      color: 'warning',
    })
  } else {
    authStore.disableAdminMode()
    toast.add({
      title: t('admin_mode.admin_mode_disabled'),
      description: t('admin_mode.admin_mode_disabled_desc'),
      icon: 'i-heroicons-shield-exclamation',
      color: 'neutral',
    })
  }
}

// Calculer le nom d'affichage
const displayName = computed(() => authStore.user?.pseudo || authStore.user?.prenom || '')

// Route actuelle pour la redirection après login
const loginUrl = computed(() => `/login?returnTo=${encodeURIComponent(route.fullPath)}`)

// Forcer un re-render complet après logout
const authKey = ref(0)
watch(
  () => authStore.isAuthenticated,
  () => {
    // Incrémenter la clé pour forcer Vue à recréer complètement la section
    authKey.value++
  }
)
</script>
