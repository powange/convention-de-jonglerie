<template>
  <UApp>
    <ClientOnly>
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <NuxtLink to="/" class="flex items-center">
              <img src="/logos/logo.svg" :alt="$t('app.title')" class="h-16 sm:h-30 w-auto" >
              <span class="ml-2 text-sm sm:text-xl font-bold">{{ $t('app.title') }}</span>
            </NuxtLink>
            <div class="flex items-center gap-4">
              <!-- Sélecteur de langue discret -->
              <div class="relative">
                <UButton
                  :icon="currentLanguage?.flag"
                  variant="ghost"
                  color="gray"
                  size="sm"
                  square
                  @click="toggleLanguageDropdown"
                  class="w-8 h-8"
                  :title="$t('footer.language_selector')"
                />
                
                <!-- Menu dropdown langues -->
                <div 
                  v-if="isLanguageDropdownOpen"
                  class="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                  @click.stop
                >
                  <div class="p-1">
                    <button 
                      v-for="lang in locales" 
                      :key="lang.code"
                      @click="changeLanguage(lang.code)"
                      class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      :class="{ 'bg-gray-100 dark:bg-gray-700': locale === lang.code }"
                    >
                      <span :class="languageConfig[lang.code as keyof typeof languageConfig]?.flag" class="w-4 h-3"></span>
                      {{ languageConfig[lang.code as keyof typeof languageConfig]?.name }}
                    </button>
                  </div>
                </div>
                
                <!-- Overlay pour fermer le dropdown en cliquant à l'extérieur -->
                <div 
                  v-if="isLanguageDropdownOpen"
                  class="fixed inset-0 z-40"
                  @click="closeLanguageDropdown"
                ></div>
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

              <!-- Dropdown utilisateur ou boutons connexion -->
              <div v-if="authStore.isAuthenticated && authStore.user?.email" class="relative">
                <UButton 
                  variant="ghost" 
                  color="neutral" 
                  class="rounded-full hover:bg-gray-100 transition-colors"
                  @click="toggleDropdown"
                >
                  <div class="flex items-center gap-2">
                    <UserAvatar 
                      :user="authStore.user" 
                      size="md" 
                      border
                    />
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
                    <UIcon 
                      name="i-heroicons-chevron-down" 
                      class="w-4 h-4 text-gray-400 transition-transform"
                      :class="{ 'rotate-180': isDropdownOpen }"
                    />
                  </div>
                </UButton>
                
                <!-- Menu dropdown -->
                <div 
                  v-if="isDropdownOpen"
                  class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                  @click.stop
                >
                  <div class="p-1">
                    <!-- Mon profil -->
                    <NuxtLink 
                      to="/profile" 
                      class="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      @click="closeDropdown"
                    >
                      <UIcon name="i-heroicons-user" class="w-4 h-4" />
                      {{ $t('navigation.profile') }}
                    </NuxtLink>
                    
                    <!-- Mes conventions -->
                    <NuxtLink 
                      to="/my-conventions" 
                      class="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      @click="closeDropdown"
                    >
                      <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
                      {{ $t('navigation.my_conventions') }}
                    </NuxtLink>
                    
                    <!-- Dashboard admin (si super admin) -->
                    <NuxtLink 
                      v-if="authStore.user?.isGlobalAdmin"
                      to="/admin" 
                      class="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      @click="closeDropdown"
                    >
                      <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4" />
                      {{ $t('navigation.admin') }}
                    </NuxtLink>
                    
                    <!-- Mes favoris (mobile uniquement) -->
                    <NuxtLink 
                      v-if="isMobile"
                      to="/favorites" 
                      class="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors md:hidden"
                      @click="closeDropdown"
                    >
                      <UIcon name="i-heroicons-star" class="w-4 h-4" />
                      {{ $t('navigation.my_favorites') }}
                    </NuxtLink>
                    
                    <!-- Séparateur -->
                    <hr class="my-1 border-gray-200 dark:border-gray-600" />
                    
                    <!-- Déconnexion -->
                    <button 
                      @click="handleLogout"
                      class="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    >
                      <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4" />
                      {{ $t('navigation.logout') }}
                    </button>
                  </div>
                </div>
                
                <!-- Overlay pour fermer le dropdown en cliquant à l'extérieur -->
                <div 
                  v-if="isDropdownOpen"
                  class="fixed inset-0 z-40"
                  @click="closeDropdown"
                ></div>
              </div>
              
              <!-- Boutons connexion/inscription pour utilisateurs non connectés -->
              <div v-else class="flex flex-col sm:flex-row items-center gap-2">
                <UButton 
                  icon="i-heroicons-key" 
                  size="sm" 
                  color="neutral" 
                  variant="ghost"
                  :to="`/login?returnTo=${encodeURIComponent($route.fullPath)}`"
                  class="w-full sm:w-auto"
                >
                  {{ $t('navigation.login') }}
                </UButton>
                <UButton 
                  icon="i-heroicons-user-plus" 
                  size="sm" 
                  color="primary" 
                  variant="solid"
                  to="/register"
                  class="w-full sm:w-auto"
                >
                  {{ $t('navigation.register') }}
                </UButton>
              </div>
            </div>
          </div>
        </template>
        <NuxtPage />
      </UCard>
    </ClientOnly>
    <AppFooter />
    <UToast />
  </UApp>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from './stores/auth';
import UserAvatar from '~/components/ui/UserAvatar.vue';
import AppFooter from '~/components/ui/AppFooter.vue';

const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();
const { locale, locales, setLocale } = useI18n();

// État réactif pour la taille d'écran et dropdowns
const isMobile = ref(false);
const isDropdownOpen = ref(false);
const isLanguageDropdownOpen = ref(false);

// Configuration des langues avec leurs drapeaux
const languageConfig = {
  fr: { name: 'Français', flag: 'fi fi-fr' },
  en: { name: 'English', flag: 'fi fi-gb' },
  es: { name: 'Español', flag: 'fi fi-es' },
  de: { name: 'Deutsch', flag: 'fi fi-de' },
  it: { name: 'Italiano', flag: 'fi fi-it' },
  pt: { name: 'Português', flag: 'fi fi-pt' },
  da: { name: 'Dansk', flag: 'fi fi-dk' },
  pl: { name: 'Polski', flag: 'fi fi-pl' }
};

// Langue courante avec son drapeau
const currentLanguage = computed(() => {
  return languageConfig[locale.value as keyof typeof languageConfig];
});

// Fonctions pour gérer les dropdowns
const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value;
  // Fermer l'autre dropdown s'il est ouvert
  if (isDropdownOpen.value) {
    isLanguageDropdownOpen.value = false;
  }
};

const closeDropdown = () => {
  isDropdownOpen.value = false;
};

const toggleLanguageDropdown = () => {
  isLanguageDropdownOpen.value = !isLanguageDropdownOpen.value;
  // Fermer l'autre dropdown s'il est ouvert
  if (isLanguageDropdownOpen.value) {
    isDropdownOpen.value = false;
  }
};

const closeLanguageDropdown = () => {
  isLanguageDropdownOpen.value = false;
};

// Fonction pour changer de langue
const changeLanguage = async (newLocale: string) => {
  await setLocale(newLocale);
  isLanguageDropdownOpen.value = false;
  // Forcer le rafraîchissement pour s'assurer que la langue est bien appliquée
  refreshNuxtData();
};

onMounted(() => {
  // Le plugin auth.client.ts s'occupe maintenant de l'initialisation de l'authentification
  
  // Gérer le responsive
  const checkMobile = () => {
    isMobile.value = window.innerWidth < 768;
  };
  
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  // Cleanup
  onUnmounted(() => {
    window.removeEventListener('resize', checkMobile);
  });
});

const handleLogout = () => {
  // Rediriger vers la page de logout avec la route actuelle comme returnTo
  const currentPath = useRoute().fullPath;
  navigateTo(`/logout?returnTo=${encodeURIComponent(currentPath)}`);
};

// Calculer le nom d'affichage
const displayName = computed(() => {
  return authStore.user?.pseudo || `${authStore.user?.prenom} ${authStore.user?.nom}`;
});

</script>