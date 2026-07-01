<template>
  <UContainer class="py-10">
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Mes événements</h1>
        <p class="text-sm text-muted">Gérez vos événements et leurs bénévoles.</p>
      </div>
      <UButton to="/events/new" icon="i-heroicons-plus" label="Créer un événement" />
    </div>

    <!-- Bandeau abonnement -->
    <UCard v-if="!subActive" class="mb-6">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div class="flex items-start gap-3">
          <UIcon name="i-heroicons-sparkles" class="mt-0.5 text-2xl text-primary" />
          <div>
            <p class="font-semibold">Débloquez les fonctionnalités d'organisation</p>
            <p class="text-sm text-muted">
              Un abonnement actif donne accès à la gestion des bénévoles de vos événements.
            </p>
          </div>
        </div>
        <UButton to="/pricing" label="Voir les tarifs" icon="i-heroicons-credit-card" />
      </div>
    </UCard>
    <div v-else class="mb-6">
      <UBadge
        color="success"
        variant="subtle"
        icon="i-heroicons-check-badge"
        :label="`Abonnement ${planLabel} actif`"
      />
    </div>

    <!-- Liste des événements -->
    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <USkeleton v-for="i in 3" :key="i" class="h-28" />
    </div>
    <div v-else-if="events.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UCard
        v-for="ev in events"
        :key="ev.id"
        class="cursor-pointer transition hover:ring-2 hover:ring-primary"
        @click="navigateTo(`/events/${ev.id}`)"
      >
        <h3 class="truncate font-semibold">{{ ev.name }}</h3>
        <p v-if="ev.location" class="mt-2 flex items-center gap-1 text-sm text-muted">
          <UIcon name="i-heroicons-map-pin" /> {{ ev.location }}
        </p>
        <p v-if="ev.startDate" class="mt-1 flex items-center gap-1 text-sm text-muted">
          <UIcon name="i-heroicons-calendar" /> {{ formatDate(ev.startDate) }}
        </p>
      </UCard>
    </div>
    <UCard v-else class="py-12 text-center">
      <UIcon name="i-heroicons-calendar-days" class="mx-auto text-4xl text-muted" />
      <p class="mt-3 font-medium">Aucun événement pour le moment</p>
      <p class="text-sm text-muted">Créez votre premier événement pour démarrer.</p>
      <UButton class="mt-4" to="/events/new" icon="i-heroicons-plus" label="Créer un événement" />
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Tableau de bord — EventOrga' })

const { data: eventsData, pending } = await useFetch('/api/events')
const events = computed(() => eventsData.value?.events ?? [])

const { data: subData } = await useFetch('/api/subscription/status')
const subActive = computed(() => !!subData.value?.active)
const planLabel = computed(() =>
  subData.value?.subscription?.plan === 'annual' ? 'annuel' : 'mensuel'
)

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>
