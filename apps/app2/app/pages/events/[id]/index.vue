<template>
  <UContainer class="max-w-3xl py-10">
    <UButton
      to="/dashboard"
      variant="link"
      color="neutral"
      icon="i-heroicons-arrow-left"
      label="Retour"
      class="-ml-2 mb-4"
    />

    <div v-if="event">
      <h1 class="text-2xl font-bold">{{ event.name }}</h1>
      <div class="mt-2 flex flex-wrap gap-3 text-sm text-muted">
        <span v-if="event.location" class="flex items-center gap-1">
          <UIcon name="i-heroicons-map-pin" /> {{ event.location }}
        </span>
        <span v-if="event.startDate" class="flex items-center gap-1">
          <UIcon name="i-heroicons-calendar" /> {{ formatDate(event.startDate) }}
        </span>
      </div>

      <p v-if="event.description" class="mt-4 whitespace-pre-line text-muted">
        {{ event.description }}
      </p>

      <USeparator class="my-8" label="Fonctionnalités d'organisation" />

      <!-- Accès débloqué -->
      <div v-if="subActive" class="grid gap-4 sm:grid-cols-2">
        <UCard
          class="cursor-pointer transition hover:ring-2 hover:ring-primary"
          @click="navigateTo(`/events/${event.id}/volunteers`)"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <UIcon name="i-heroicons-user-group" class="text-2xl" />
            </div>
            <div>
              <p class="font-semibold">Gestion des bénévoles</p>
              <p class="text-sm text-muted">Équipes, créneaux, affectations.</p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Paywall -->
      <UCard v-else>
        <div class="flex flex-col items-center py-6 text-center">
          <div class="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UIcon name="i-heroicons-lock-closed" class="text-2xl" />
          </div>
          <p class="mt-3 font-semibold">Fonctionnalités réservées aux abonnés</p>
          <p class="mt-1 max-w-md text-sm text-muted">
            Abonnez-vous pour débloquer la gestion des bénévoles et les autres outils d'organisation
            de vos événements.
          </p>
          <UButton class="mt-4" to="/pricing" label="Voir les tarifs" icon="i-heroicons-credit-card" />
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()

const { data, error } = await useFetch(`/api/events/${route.params.id}`)
if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Événement introuvable', fatal: true })
}
const event = computed(() => data.value?.event)

const { data: subData } = await useFetch('/api/subscription/status')
const subActive = computed(() => !!subData.value?.active)

useSeoMeta({ title: () => (event.value ? `${event.value.name} — Flowvent` : 'Événement') })

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>
