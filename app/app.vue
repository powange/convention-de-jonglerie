<template>
  <UApp>
    <!-- Loading Screen -->
    <div v-if="isLoading" class="loading-screen">
      <img src="/logos/logo-jc-anim-orbit.svg" :alt="$t('common.loading')" class="loading-logo" />
    </div>

    <ClientOnly>
      <!-- Bannière d'impersonation -->
      <UiImpersonationBanner />

      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <NuxtLink to="/" class="flex items-center">
              <UiLogoJc class="h-16 sm:h-30 w-auto text-black dark:text-white" />
              <span class="ml-2 text-sm sm:text-xl font-bold">{{ $t('app.title') }}</span>
            </NuxtLink>
            <div class="flex items-center gap-2 sm:gap-4">
              <!-- Groupe de boutons superposés sur mobile -->
              <div class="flex flex-col sm:flex-row gap-1 sm:gap-2">
                <!-- Bouton de bascule clair/sombre -->
                <ClientOnly>
                  <UColorModeSwitch size="sm" color="secondary" />
                  <template #fallback>
                    <div class="w-6 h-6 sm:w-8 sm:h-8" />
                  </template>
                </ClientOnly>

                <!-- Sélecteur de langue -->
                <UDropdownMenu :items="languageItems">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    class="sm:!size-sm"
                    :title="$t('footer.language_selector')"
                  >
                    <span
                      v-if="currentLanguage?.flag"
                      :class="currentLanguage.flag"
                      class="w-4 h-3"
                    />
                  </UButton>

                  <!-- Slots pour les drapeaux de chaque langue -->
                  <template v-for="lang in locales" :key="lang.code" #[`lang-${lang.code}-leading`]>
                    <span
                      :class="languageConfig[lang.code as keyof typeof languageConfig]?.flag"
                      class="w-4 h-3 shrink-0"
                    />
                  </template>
                </UDropdownMenu>
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
            </div>
          </div>

          <!-- Bannière d'installation PWA -->
          <PWAInstallBanner />

          <!-- Modale de promotion des notifications push -->
          <NotificationsPushPromoModal />
        </template>
        <NuxtPage />
      </UCard>
    </ClientOnly>
    <UiAppFooter />
    <UToast />
  </UApp>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { useAuthStore } from './stores/auth'

import type { DropdownMenuItem } from '@nuxt/ui'

const authStore = useAuthStore()
const { locale, locales, setLocale, t } = useI18n()
const toast = useToast()

// État de chargement
const isLoading = ref(true)

// État réactif pour la taille d'écran
const isMobile = ref(false)

// Configuration des langues avec leurs drapeaux
const languageConfig = {
  en: { name: 'English', flag: 'fi fi-gb' },
  da: { name: 'Dansk', flag: 'fi fi-dk' },
  de: { name: 'Deutsch', flag: 'fi fi-de' },
  es: { name: 'Español', flag: 'fi fi-es' },
  fr: { name: 'Français', flag: 'fi fi-fr' },
  it: { name: 'Italiano', flag: 'fi fi-it' },
  nl: { name: 'Nederlands', flag: 'fi fi-nl' },
  pl: { name: 'Polski', flag: 'fi fi-pl' },
  pt: { name: 'Português', flag: 'fi fi-pt' },
  ru: { name: 'Русский', flag: 'fi fi-ru' },
  uk: { name: 'Українська', flag: 'fi fi-ua' },
}

// Langue courante avec son drapeau
const currentLanguage = computed(() => {
  return languageConfig[locale.value as keyof typeof languageConfig]
})

// Configuration des items du dropdown de langues
const languageItems = computed(() => {
  return locales.value.map((lang) => ({
    label: languageConfig[lang.code as keyof typeof languageConfig]?.name,
    onSelect: () => changeLanguage(lang.code),
    class: locale.value === lang.code ? 'bg-gray-100 dark:bg-gray-700' : '',
    slot: `lang-${lang.code}`,
    flagClass: languageConfig[lang.code as keyof typeof languageConfig]?.flag,
  }))
})

const isAdminModeActive = ref(false)

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
      title: t('profile.admin_mode_enabled'),
      description: t('profile.admin_mode_enabled_desc'),
      icon: 'i-heroicons-shield-check',
      color: 'warning',
    })
  } else {
    authStore.disableAdminMode()
    toast.add({
      title: t('profile.admin_mode_disabled'),
      description: t('profile.admin_mode_disabled_desc'),
      icon: 'i-heroicons-shield-exclamation',
      color: 'neutral',
    })
  }
}

// Fonction pour changer de langue
const changeLanguage = async (newLocale: string) => {
  await setLocale(newLocale as any)
  // Forcer le rafraîchissement pour s'assurer que la langue est bien appliquée
  refreshNuxtData()
}

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

  // Attendre que tout soit chargé
  const hideLoading = () => {
    // Petit délai pour s'assurer que l'hydration est complète
    setTimeout(() => {
      isLoading.value = false
    }, 500)
  }

  // Utiliser useEventListener de VueUse pour gérer automatiquement le cleanup
  useEventListener(document, 'readystatechange', () => {
    if (document.readyState === 'complete') {
      hideLoading()
    }
  })

  // Si tout est déjà chargé
  if (document.readyState === 'complete') {
    hideLoading()
  } else {
    // Attendre que tout soit chargé (images, CSS, etc.)
    useEventListener(window, 'load', hideLoading)
  }
})

// Configuration SEO conditionnelle pour empêcher l'indexation en staging/release
const shouldDisallowIndexing = computed(() => {
  // Vérifier si nous sommes côté serveur
  if (import.meta.server) {
    return (
      process.env.NODE_ENV !== 'production' ||
      process.env.NUXT_ENV === 'staging' ||
      process.env.NUXT_ENV === 'release' ||
      !process.env.NUXT_PUBLIC_SITE_URL?.includes('juggling-convention.com')
    )
  }
  return false
})

// Ajouter meta robots si nécessaire
if (shouldDisallowIndexing.value) {
  useSeoMeta({
    robots: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  })
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

<style>
.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;

  /* Transition fluide à la sortie */
  transition: opacity 0.8s ease-out;
}

.loading-logo {
  width: 200px;
  height: 200px;
  max-width: 50vw;
  max-height: 50vh;
}

@keyframes fadeOut {
  to {
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
  }
}

/* Support du dark mode */
@media (prefers-color-scheme: dark) {
  .loading-screen {
    background: #0f172a; /* bg-slate-900 */
  }
}

/* Force le thème selon la classe dark sur html/body (priorité sur le thème système) */
.dark .loading-screen {
  background: #0f172a !important; /* bg-slate-900 en mode sombre */
}

.light .loading-screen {
  background: white !important; /* fond blanc en mode clair */
}
</style>
