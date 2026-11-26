<template>
  <header class="sticky top-0 z-10 border-b border-default bg-default/75 backdrop-blur">
    <UContainer class="flex h-16 items-center justify-between gap-4">
      <!-- Connecté, l'accueil renvoie de toute façon au tableau de bord : on y va directement. -->
      <NuxtLink :to="loggedIn ? '/dashboard' : '/'" class="flex items-center gap-2">
        <AppLogo class="h-8 w-auto text-highlighted" />
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
            <!-- Sur téléphone, l'avatar seul : un pseudo long poussait la barre hors de l'écran. -->
            <UButton
              :label="user?.pseudo || user?.email"
              :avatar="avatar"
              trailing-icon="i-heroicons-chevron-down"
              color="neutral"
              variant="soft"
              :aria-label="user?.pseudo || user?.email"
              :ui="{ label: 'max-sm:hidden', trailingIcon: 'max-sm:hidden' }"
            />
          </UDropdownMenu>
        </template>
        <template v-else>
          <!-- Un seul bouton pour entrer : « Connexion » et « Créer un compte » menaient à la même
               page (`/login` demande l'adresse, puis connecte ou crée le compte), et les deux ensemble
               débordaient de l'écran d'un téléphone. « Tarifs » y est caché : l'accueil y renvoie. -->
          <UButton
            to="/pricing"
            variant="ghost"
            color="neutral"
            label="Tarifs"
            class="max-sm:hidden"
          />
          <UButton
            to="/login"
            color="primary"
            icon="i-heroicons-arrow-right-end-on-rectangle"
            label="Connexion"
          />
        </template>
      </nav>
    </UContainer>
  </header>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { loggedIn, user, clear } = useUserSession()
const toast = useToast()

/*
 * L'avatar du menu : la photo de profil (déposée, ou reprise de Google / Facebook), sinon les
 * initiales du pseudo. La session ne porte pas la photo (cf. layers/auth/shared/utils/
 * utilisateur-de-session.ts) : on la lit dans le profil, partagé avec l'espace « Mon profil »
 * (même clé), si bien qu'une photo changée là-bas se voit ici sans rechargement.
 */
const { data: profil } = useProfil({ immediate: loggedIn.value, watch: [loggedIn] })
const { getUserAvatar } = useAvatar()
const avatar = computed(() => ({
  src: profil.value?.profilePicture
    ? getUserAvatar({ id: profil.value.id, profilePicture: profil.value.profilePicture }, 64)
    : undefined,
  alt: user.value?.pseudo || user.value?.email || '',
}))

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
    { label: 'Mon profil', icon: 'i-heroicons-user', to: '/profile' },
    { label: 'Tableau de bord', icon: 'i-heroicons-squares-2x2', to: '/dashboard' },
    { label: 'Tarifs', icon: 'i-heroicons-credit-card', to: '/pricing' },
    // Réservé aux administrateurs ; les pages et l'API le revérifient (server/utils/administration.ts).
    ...((user.value as { isGlobalAdmin?: boolean } | null)?.isGlobalAdmin
      ? [{ label: 'Administration', icon: 'i-heroicons-shield-check', to: '/admin' }]
      : []),
  ],
  [{ label: 'Se déconnecter', icon: 'i-heroicons-arrow-right-on-rectangle', onSelect: logout }],
])
</script>
