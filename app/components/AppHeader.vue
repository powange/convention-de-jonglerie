<template>
  <UHeader :ui="{ title: '', toggle: 'hidden' }">
    <template #title>
      <div class="flex flex-col items-start sm:flex-row sm:items-center gap-1 sm:gap-2">
        <UiLogoJc class="h-16 w-auto text-black dark:text-white" />
        <span class="text-sm sm:text-xl font-bold">{{ $t('app.title') }}</span>
      </div>
    </template>

    <template #right>
      <ClientOnly>
        <!-- Groupe de boutons superposés sur mobile -->
        <div class="flex flex-row gap-2">
          <!-- Bouton de bascule clair/sombre -->
          <ClientOnly>
            <UColorModeSwitch size="sm" color="secondary" />
            <template #fallback>
              <div class="w-6 h-6 sm:w-8 sm:h-8" />
            </template>
          </ClientOnly>

          <!-- Sélecteur de langue -->
          <UiSelectLanguage />
        </div>

        <!-- Navigation principale -->
        <div v-if="authStore.isAuthenticated" class="hidden md:flex items-center gap-2">
          <UButton
            icon="i-heroicons-star"
            size="sm"
            color="neutral"
            variant="ghost"
            to="/favorites"
          >
            {{ $t('navigation.my_favorites') }}
          </UButton>
        </div>

        <!-- Centre de notifications (si connecté) -->
        <NotificationsCenter v-if="authStore.isAuthenticated" />

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
                <UiUserAvatar :user="authStore.user" size="md" border />
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
                <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 text-gray-400" />
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
      </ClientOnly>
    </template>
  </UHeader>
</template>

<script lang="ts" setup>
import { useAuthStore } from '~/stores/auth'

import type { DropdownMenuItem } from '@nuxt/ui'

const authStore = useAuthStore()

const { t } = useI18n()
const toast = useToast()

// État réactif pour la taille d'écran
const isMobile = ref(false)

const isAdminModeActive = ref(false)

// Utiliser nextTick pour s'assurer que nous sommes côté client après hydration
onMounted(async () => {
  // Le plugin auth.client.ts s'occupe maintenant de l'initialisation de l'authentification

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
    {
      label: t('navigation.my_volunteer_applications'),
      icon: 'i-heroicons-hand-raised',
      to: '/my-volunteer-applications',
    },
  ]

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
    to: `/logout?returnTo=${encodeURIComponent(useReturnTo().cleanReturnTo(useRoute()))}`,
  })

  return items
})

// Fonction pour basculer le mode admin
const toggleAdminMode = (checked: boolean) => {
  console.log('Toggling admin mode:', checked)
  isAdminModeActive.value = checked
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
const route = useRoute()
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
