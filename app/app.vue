<template>
  <UApp>
    <ClientOnly>
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <NuxtLink to="/" class="flex items-center">
              <img src="/logos/logo.svg" :alt="$t('app.title')" class="h-16 sm:h-30 w-auto">
              <span class="ml-2 text-sm sm:text-xl font-bold">{{ $t('app.title') }}</span>
            </NuxtLink>
            <div class="flex items-center gap-4">
              <!-- Sélecteur de langue -->
              <UDropdownMenu :items="languageItems">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :title="$t('footer.language_selector')"
                >
                  <span v-if="currentLanguage?.flag" :class="currentLanguage.flag" class="w-4 h-3" />
                </UButton>
                
                <!-- Slots pour les drapeaux de chaque langue -->
                <template 
                  v-for="lang in locales" 
                  :key="lang.code"
                  #[`lang-${lang.code}-leading`]
                >
                  <span 
                    :class="languageConfig[lang.code as keyof typeof languageConfig]?.flag" 
                    class="w-4 h-3 shrink-0"
                  />
                </template>
              </UDropdownMenu>

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
              <UDropdownMenu v-if="authStore.isAuthenticated && authStore.user?.email" :items="userMenuItems">
                <UButton 
                  variant="ghost" 
                  color="neutral" 
                  class="rounded-full"
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
                      class="w-4 h-4 text-gray-400"
                    />
                  </div>
                </UButton>
              </UDropdownMenu>
              
              <!-- Bouton connexion unique pour utilisateurs non connectés -->
              <div v-else class="flex items-center gap-2">
                <NuxtLink :to="{ path: '/login', query: { returnTo: $route.fullPath } }" class="w-full sm:w-auto">
                  <UButton 
                    icon="i-heroicons-key" 
                    size="sm" 
                    color="neutral" 
                    variant="ghost"
                  >
                    {{ $t('navigation.login') }}
                  </UButton>
                </NuxtLink>
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
const { locale, locales, setLocale, t } = useI18n();

// État réactif pour la taille d'écran
const isMobile = ref(false);

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
  uk: { name: 'Українська', flag: 'fi fi-ua' }
};

// Langue courante avec son drapeau
const currentLanguage = computed(() => {
  return languageConfig[locale.value as keyof typeof languageConfig];
});

// Configuration des items du dropdown de langues
const languageItems = computed(() => {
  return locales.value.map(lang => ({
    label: languageConfig[lang.code as keyof typeof languageConfig]?.name,
    onSelect: () => changeLanguage(lang.code),
    class: locale.value === lang.code ? 'bg-gray-100 dark:bg-gray-700' : '',
    slot: `lang-${lang.code}`,
    flagClass: languageConfig[lang.code as keyof typeof languageConfig]?.flag
  }));
});

// Configuration des items du dropdown utilisateur
const userMenuItems = computed(() => {
  const items = [
    {
      label: t('navigation.profile'),
      icon: 'i-heroicons-user',
      to: '/profile'
    },
    {
      label: t('navigation.my_conventions'),
      icon: 'i-heroicons-calendar-days',
      to: '/my-conventions'
    }
  ];

  // Ajouter le dashboard admin si super admin
  if (authStore.user?.isGlobalAdmin) {
    items.push({
      label: t('navigation.admin'),
      icon: 'i-heroicons-squares-2x2',
      to: '/admin'
    });
  }

  // Ajouter les favoris en mobile
  if (isMobile.value) {
    items.push({
      label: t('navigation.my_favorites'),
      icon: 'i-heroicons-star',
      to: '/favorites'
    });
  }

  // Ajouter le séparateur et la déconnexion
  items.push(
    { label: '─────────────────', icon: 'i-heroicons-minus', to: '#' },
    {
      label: t('navigation.logout'),
      icon: 'i-heroicons-arrow-right-on-rectangle',
      to: `/logout?returnTo=${encodeURIComponent(useRoute().fullPath)}`
    }
  );

  return items;
});

// Fonction pour changer de langue
const changeLanguage = async (newLocale: string) => {
  await setLocale(newLocale as any);
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

// Calculer le nom d'affichage
const displayName = computed(() => {
  return authStore.user?.pseudo || `${authStore.user?.prenom} ${authStore.user?.nom}`;
});

</script>