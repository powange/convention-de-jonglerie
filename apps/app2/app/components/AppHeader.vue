<template>
  <header class="sticky top-0 z-10 border-b border-default bg-default/75 backdrop-blur">
    <UContainer class="flex h-16 items-center justify-between gap-4">
      <!-- Le logo mène toujours à l'accueil, connecté ou non (le tableau de bord a son bouton). -->
      <NuxtLink to="/" class="flex items-center gap-2">
        <AppLogo class="h-8 w-auto text-highlighted" />
        <span class="flex flex-col leading-tight">
          <span class="text-lg font-semibold">Flow<span style="color: #ff6a00">vent</span></span>
          <span class="text-[11px] text-muted max-sm:hidden">Le flow de vos événements</span>
        </span>
      </NuxtLink>

      <nav class="flex items-center gap-2">
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
          <!-- Même place et même bouton que dans la barre de la gestion : juste avant le compte. -->
          <UColorModeButton />
          <AppUserMenu />
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
          <UColorModeButton />
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
const { loggedIn } = useUserSession()
</script>
