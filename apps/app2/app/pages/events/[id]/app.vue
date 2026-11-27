<template>
  <UContainer
    class="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center"
  >
    <template v-if="introuvable">
      <UIcon name="i-heroicons-lock-closed" class="size-10 text-muted" />
      <p class="text-lg font-semibold">Vous n'avez pas accès à cet événement.</p>
      <p class="max-w-md text-sm text-muted">
        Il n'est pas public, et ce compte n'y est ni organisateur, ni bénévole, ni artiste.
      </p>
      <UButton
        label="Changer de compte"
        icon="i-heroicons-arrow-right-on-rectangle"
        @click="changerDeCompte"
      />
    </template>
    <template v-else>
      <UIcon name="i-heroicons-arrow-path" class="size-8 animate-spin text-primary" />
      <p class="text-sm text-muted">Ouverture de l'événement…</p>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
/**
 * L'écran de démarrage de l'application d'un événement (`start_url` de son manifeste) : il marque
 * la fenêtre comme application de l'événement, puis envoie chacun où il a à faire — gestion,
 * espace artiste, espace bénévole ou page publique (server/api/events/[id]/application/aiguillage).
 */
const route = useRoute()
const refEvenement = String(route.params.id)
const introuvable = ref(false)
const { clear } = useUserSession()

onMounted(async () => {
  marquerApplicationEvenement(refEvenement)
  try {
    const { destination } = await $fetch<{ destination: string }>(
      `/api/events/${refEvenement}/application/aiguillage`
    )
    await navigateTo(destination, { replace: true })
  } catch {
    introuvable.value = true
  }
})

async function changerDeCompte() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
  await clear()
  await navigateTo(`/login?returnTo=${encodeURIComponent(`/events/${refEvenement}/app`)}`)
}
</script>
