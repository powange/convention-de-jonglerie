<template>
  <div class="rounded-2xl bg-elevated p-6 sm:p-8">
    <USkeleton v-if="!profil" class="h-24 w-full" />
    <div v-else class="flex flex-row items-center gap-6">
      <!-- La photo vient de Google ou Facebook ; sans elle, UAvatar affiche les initiales. -->
      <UAvatar
        :src="profil.profilePicture ?? undefined"
        :alt="nomComplet"
        size="3xl"
        class="shadow-lg"
      />
      <div class="min-w-0 flex-1">
        <h1 class="mb-2 text-2xl font-bold sm:text-3xl">
          Bonjour {{ profil.prenom || profil.pseudo }} !
        </h1>
        <p class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-heroicons-calendar-days" class="size-4" />
          Membre depuis {{ membreDepuis }}
        </p>
        <p class="mt-1 flex items-center gap-2 truncate text-sm text-muted">
          <UIcon name="i-heroicons-envelope" class="size-4" />
          {{ profil.email }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: profil } = useProfil()

const nomComplet = computed(
  () => [profil.value?.prenom, profil.value?.nom].filter(Boolean).join(' ') || profil.value?.pseudo
)
const membreDepuis = computed(() =>
  profil.value
    ? new Date(profil.value.createdAt).toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      })
    : ''
)
</script>
