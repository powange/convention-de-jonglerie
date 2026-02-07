<template>
  <!-- Dropdown utilisateur ou boutons connexion -->
  <div :key="`auth-section-${authKey}`">
    <template v-if="authStore.isAuthenticated && authStore.user">
      <!-- Desktop : Dropdown menu -->
      <UDropdownMenu
        v-if="isDesktop"
        :items="userMenuItems"
        :content="{
          align: 'end',
          side: 'bottom',
          sideOffset: 8,
        }"
      >
        <UButton variant="ghost" color="neutral" class="rounded-full">
          <div class="flex items-center gap-2">
            <div class="relative shrink-0">
              <UiUserAvatar :user="authStore.user" size="md" border />
            </div>
            <div class="flex flex-col items-start">
              <span class="text-sm font-medium">{{ displayName }}</span>
              <UBadge
                v-if="authStore.isAdminModeActive"
                color="warning"
                variant="soft"
                size="xs"
                class="px-1"
              >
                Admin
              </UBadge>
            </div>
            <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 text-muted shrink-0" />
          </div>
        </UButton>
      </UDropdownMenu>

      <!-- Mobile : Drawer depuis le bas -->
      <UDrawer v-else v-model:open="drawerOpen">
        <UButton variant="ghost" color="neutral" class="rounded-full">
          <div class="relative shrink-0">
            <UiUserAvatar :user="authStore.user" size="md" border />
            <UBadge
              v-if="authStore.isAdminModeActive"
              color="warning"
              variant="soft"
              size="xs"
              class="absolute -top-1 -right-1 px-1"
            >
              A
            </UBadge>
          </div>
        </UButton>

        <template #header>
          <div class="flex items-center gap-3">
            <UiUserAvatar :user="authStore.user" size="lg" border />
            <div class="flex flex-col">
              <span class="text-base font-semibold">{{ displayName }}</span>
              <span class="text-sm text-muted">{{ authStore.user.email }}</span>
            </div>
            <UBadge
              v-if="authStore.isAdminModeActive"
              color="warning"
              variant="soft"
              size="sm"
              class="ml-auto"
            >
              Admin
            </UBadge>
          </div>
        </template>

        <template #body>
          <nav class="flex flex-col gap-1">
            <NuxtLink
              v-for="item in drawerMenuItems"
              :key="item.label"
              :to="item.to"
              class="flex items-center gap-3 px-3 py-3 rounded-lg text-highlighted hover:bg-elevated transition-colors"
              @click="drawerOpen = false"
            >
              <UIcon :name="item.icon" class="w-5 h-5 text-muted shrink-0" />
              <span class="text-sm font-medium">{{ item.label }}</span>
              <UBadge
                v-if="item.badge"
                color="error"
                variant="solid"
                size="xs"
                :label="String(item.badge)"
                class="ml-auto"
              />
            </NuxtLink>

            <!-- Section admin -->
            <template v-if="authStore.user?.isGlobalAdmin">
              <USeparator class="my-1" />
              <NuxtLink
                to="/admin"
                class="flex items-center gap-3 px-3 py-3 rounded-lg text-highlighted hover:bg-elevated transition-colors"
                @click="drawerOpen = false"
              >
                <UIcon name="i-heroicons-squares-2x2" class="w-5 h-5 text-muted shrink-0" />
                <span class="text-sm font-medium">{{ $t('navigation.admin') }}</span>
              </NuxtLink>
              <button
                class="flex items-center gap-3 px-3 py-3 rounded-lg text-highlighted hover:bg-elevated transition-colors w-full text-left"
                @click="onToggleAdminMode"
              >
                <UIcon
                  :name="
                    isAdminModeActive
                      ? 'i-heroicons-shield-exclamation'
                      : 'i-heroicons-shield-check'
                  "
                  class="w-5 h-5 text-muted shrink-0"
                />
                <span class="text-sm font-medium">
                  {{
                    isAdminModeActive
                      ? $t('navigation.disable_admin_mode')
                      : $t('navigation.enable_admin_mode')
                  }}
                </span>
                <UIcon
                  :name="isAdminModeActive ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
                  :class="['w-5 h-5 ml-auto', isAdminModeActive ? 'text-warning' : 'text-muted']"
                />
              </button>
            </template>

            <!-- Préférences (langue + mode sombre) -->
            <USeparator class="my-1" />
            <div class="flex items-center gap-3 px-3 py-3 rounded-lg text-highlighted">
              <UIcon name="i-heroicons-language" class="w-5 h-5 text-muted shrink-0" />
              <span class="text-sm font-medium">{{ $t('navigation.language') }}</span>
              <div class="ml-auto">
                <UiSelectLanguage show-label />
              </div>
            </div>
            <button
              class="flex items-center gap-3 px-3 py-3 rounded-lg text-highlighted hover:bg-elevated transition-colors w-full text-left"
              @click="toggleColorMode"
            >
              <UIcon
                :name="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'"
                class="w-5 h-5 text-muted shrink-0"
              />
              <span class="text-sm font-medium">
                {{ isDark ? $t('navigation.light_mode') : $t('navigation.dark_mode') }}
              </span>
              <UIcon
                :name="isDark ? 'i-heroicons-sun' : 'i-heroicons-moon'"
                class="w-5 h-5 ml-auto text-muted"
              />
            </button>

            <!-- Déconnexion -->
            <USeparator class="my-1" />
            <NuxtLink
              :to="`/logout?returnTo=${encodeURIComponent(useReturnTo().cleanReturnTo(route))}`"
              class="flex items-center gap-3 px-3 py-3 rounded-lg text-error hover:bg-elevated transition-colors"
              @click="drawerOpen = false"
            >
              <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-5 h-5 shrink-0" />
              <span class="text-sm font-medium">{{ $t('navigation.logout') }}</span>
            </NuxtLink>
          </nav>
        </template>
      </UDrawer>
    </template>

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
import { useMediaQuery } from '@vueuse/core'

import { useAuthStore } from '~/stores/auth'

import type { DropdownMenuItem } from '@nuxt/ui'

const authStore = useAuthStore()

const { t } = useI18n()
const toast = useToast()
const route = useRoute()

// Responsive : desktop si >= 768px (md breakpoint Tailwind)
const isDesktop = useMediaQuery('(min-width: 768px)')

// Mode clair/sombre
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const toggleColorMode = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

// État du drawer mobile
const drawerOpen = ref(false)

// Synchroniser avec le store
const isAdminModeActive = computed(() => authStore.adminMode)

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

// Items de navigation partagés entre drawer mobile et dropdown desktop
const baseNavItems = computed(() => {
  const items: { label: string; icon: string; to: string; badge?: number }[] = [
    { label: t('navigation.profile'), icon: 'i-heroicons-user', to: '/profile' },
    {
      label: t('navigation.my_conventions'),
      icon: 'i-heroicons-calendar-days',
      to: '/my-conventions',
    },
  ]

  if (authStore.isVolunteer) {
    items.push({
      label: t('navigation.my_volunteer_applications'),
      icon: 'i-heroicons-hand-raised',
      to: '/my-volunteer-applications',
    })
  }

  if (authStore.isArtist) {
    items.push({
      label: t('navigation.my_artist_applications'),
      icon: 'i-heroicons-sparkles',
      to: '/my-artist-applications',
    })
  }

  if (messengerStatus.value.hasConversations) {
    items.push({
      label: t('navigation.messenger'),
      icon: 'i-heroicons-chat-bubble-left-right',
      to: '/messenger',
      badge: messengerStatus.value.unreadCount > 0 ? messengerStatus.value.unreadCount : undefined,
    })
  }

  items.push({ label: t('navigation.my_favorites'), icon: 'i-heroicons-star', to: '/favorites' })

  return items
})

// Items de navigation pour le drawer mobile
const drawerMenuItems = computed(() => baseNavItems.value)

// Configuration des items du dropdown utilisateur (desktop uniquement)
const userMenuItems = computed((): DropdownMenuItem[] => {
  const items: DropdownMenuItem[] = [...baseNavItems.value]

  if (authStore.user?.isGlobalAdmin) {
    items.push({ type: 'separator' as const })
    items.push({ label: t('navigation.admin'), icon: 'i-heroicons-squares-2x2', to: '/admin' })
    items.push({
      label: isAdminModeActive.value
        ? t('navigation.disable_admin_mode')
        : t('navigation.enable_admin_mode'),
      icon: isAdminModeActive.value ? 'i-heroicons-shield-exclamation' : 'i-heroicons-shield-check',
      type: 'checkbox' as const,
      checked: isAdminModeActive.value,
      onUpdateChecked: (checked: boolean) => toggleAdminMode(checked),
    })
  }

  items.push({ type: 'separator' as const })
  items.push({
    label: t('navigation.logout'),
    icon: 'i-heroicons-arrow-right-on-rectangle',
    to: `/logout?returnTo=${encodeURIComponent(useReturnTo().cleanReturnTo(route))}`,
  })

  return items
})

// Basculer le mode admin depuis le drawer mobile (ferme le drawer)
const onToggleAdminMode = () => {
  toggleAdminMode(!isAdminModeActive.value)
  drawerOpen.value = false
}

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
    authKey.value++
  }
)
</script>
