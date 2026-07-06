<template>
  <div class="min-h-screen flex flex-col bg-default">
    <header class="sticky top-0 z-10 border-b border-default bg-default/75 backdrop-blur">
      <UContainer class="flex h-16 items-center justify-between gap-4">
        <NuxtLink to="/" class="flex items-center gap-2">
          <img :src="logoUrl" alt="Flowvent" class="h-8 w-auto" />
          <span class="flex flex-col leading-tight">
            <span class="text-lg font-semibold">Flow<span style="color: #ff6a00">vent</span></span>
            <span class="text-[11px] text-muted max-sm:hidden">Le flow de vos événements</span>
          </span>
        </NuxtLink>

        <nav class="flex items-center gap-2">
          <UColorModeSwitch />
          <template v-if="loggedIn">
            <UButton
              to="/dashboard"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-squares-2x2"
              label="Tableau de bord"
              class="max-sm:hidden"
            />
            <UButton
              to="/pricing"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-credit-card"
              label="Tarifs"
              class="max-sm:hidden"
            />
            <UDropdownMenu :items="userMenuItems">
              <UButton
                :label="user?.name || user?.email"
                icon="i-heroicons-user-circle"
                trailing-icon="i-heroicons-chevron-down"
                color="neutral"
                variant="soft"
              />
            </UDropdownMenu>
          </template>
          <template v-else>
            <UButton to="/pricing" variant="ghost" color="neutral" label="Tarifs" />
            <UButton to="/login" variant="ghost" color="neutral" label="Connexion" />
            <UButton to="/register" color="primary" label="Créer un compte" />
          </template>
        </nav>
      </UContainer>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="mt-12 border-t border-default py-6">
      <UContainer
        class="flex flex-col items-center justify-between gap-1 text-sm text-muted sm:flex-row"
      >
        <span>© Flowvent — démonstration</span>
        <span class="flex items-center gap-1">
          <UIcon name="i-heroicons-information-circle" />
          Paiement simulé · aucune transaction réelle
        </span>
      </UContainer>
    </footer>
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import logoUrl from '~/assets/flowvent_v2_logo.svg?url'

const { loggedIn, user, clear } = useUserSession()
const toast = useToast()

async function logout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    await clear()
    toast.add({ title: 'Déconnexion réussie', icon: 'i-heroicons-check-circle', color: 'success' })
    await navigateTo('/login')
  }
}

const userMenuItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? '', type: 'label' }],
  [
    { label: 'Tableau de bord', icon: 'i-heroicons-squares-2x2', to: '/dashboard' },
    { label: 'Tarifs', icon: 'i-heroicons-credit-card', to: '/pricing' },
  ],
  [{ label: 'Se déconnecter', icon: 'i-heroicons-arrow-right-on-rectangle', onSelect: logout }],
])
</script>
