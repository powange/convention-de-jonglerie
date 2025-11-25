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

        <!-- Bouton messagerie (si connecté) -->
        <MessengerHeaderButton v-if="authStore.isAuthenticated" />

        <!-- Centre de notifications (si connecté) -->
        <NotificationsCenter v-if="authStore.isAuthenticated" />

        <!-- Dropdown utilisateur ou boutons connexion -->
        <UserAuthSection />
      </ClientOnly>
    </template>
  </UHeader>
</template>

<script lang="ts" setup>
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
</script>
