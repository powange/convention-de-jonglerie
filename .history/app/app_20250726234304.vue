<template>
  <UApp>
    <ClientOnly>
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <NuxtLink to="/" class="flex items-center">
              <img src="/logos/logo.svg" alt="Convention de Jonglerie" class="h-12 w-auto" />
            </NuxtLink>
            <div class="flex items-center gap-4">
              <!-- Navigation principale -->
              <div v-if="authStore.isAuthenticated" class="hidden md:flex items-center gap-2">
                <UButton 
                  icon="i-heroicons-star" 
                  size="sm" 
                  color="neutral" 
                  variant="ghost"
                  to="/favorites"
                >
                  Mes favoris
                </UButton>
              </div>

              <!-- Dropdown utilisateur ou boutons connexion -->
              <div v-if="authStore.isAuthenticated && authStore.user?.email" class="relative">
                <UButton 
                  variant="ghost" 
                  color="neutral" 
                  class="rounded-full hover:bg-gray-100 transition-colors"
                  @click="showUserMenu = !showUserMenu"
                >
                  <div class="flex items-center gap-2">
                    <img 
                      :src="getUserAvatar(authStore.user.email, 32)" 
                      :alt="`Avatar de ${displayName}`"
                      class="w-8 h-8 rounded-full border-2 border-gray-200"
                    />
                    <span class="hidden sm:block text-sm font-medium">{{ displayName }}</span>
                    <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 text-gray-400" />
                  </div>
                </UButton>
                
                <!-- Menu dropdown personnalisé -->
                <div v-if="showUserMenu" class="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                  <div class="py-1">
                    <!-- Profil -->
                    <NuxtLink to="/profile" @click="showUserMenu = false" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <UIcon name="i-heroicons-user" class="w-4 h-4" />
                      Mon profil
                    </NuxtLink>
                    
                    <!-- Mes conventions -->
                    <NuxtLink to="/my-conventions" @click="showUserMenu = false" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
                      Mes conventions
                    </NuxtLink>
                    
                    <!-- Séparateur -->
                    <hr class="border-gray-200 dark:border-gray-600 my-1">
                    
                    <!-- Navigation mobile -->
                    <div class="md:hidden">
                      <NuxtLink to="/conventions/add" @click="showUserMenu = false" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                        Ajouter une convention
                      </NuxtLink>
                      <NuxtLink to="/favorites" @click="showUserMenu = false" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <UIcon name="i-heroicons-star" class="w-4 h-4" />
                        Mes favoris
                      </NuxtLink>
                      <hr class="border-gray-200 dark:border-gray-600 my-1">
                    </div>
                    
                    <!-- Déconnexion -->
                    <button @click="handleLogout(); showUserMenu = false" class="flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left">
                      <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4" />
                      Déconnexion
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Boutons connexion/inscription pour utilisateurs non connectés -->
              <div v-else class="flex items-center gap-2">
                <UButton 
                  icon="i-heroicons-arrow-left-on-rectangle" 
                  size="sm" 
                  color="neutral" 
                  variant="ghost"
                  to="/login"
                >
                  Connexion
                </UButton>
                <UButton 
                  icon="i-heroicons-user-plus" 
                  size="sm" 
                  color="primary" 
                  variant="solid"
                  to="/register"
                >
                  Inscription
                </UButton>
              </div>
            </div>
          </div>
        </template>
        <NuxtPage />
      </UCard>
    </ClientOnly>
    <UToast />
  </UApp>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { useGravatar } from './utils/gravatar';

const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();
const { getUserAvatar } = useGravatar();

const showUserMenu = ref(false);

// Fermer le menu quand on clique ailleurs
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.relative')) {
    showUserMenu.value = false;
  }
};

onMounted(() => {
  // Ensure auth state is initialized on client-side after component mounts
  if (!authStore.isAuthenticated) {
    authStore.initializeAuth();
  }
  
  // Ajouter l'écouteur pour fermer le menu
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

const handleLogout = () => {
  authStore.logout();
  toast.add({ title: 'Déconnexion réussie !', icon: 'i-heroicons-check-circle', color: 'success' });
  router.push('/');
};

// Calculer le nom d'affichage
const displayName = computed(() => {
  return authStore.user?.pseudo || `${authStore.user?.prenom} ${authStore.user?.nom}`;
});

</script>