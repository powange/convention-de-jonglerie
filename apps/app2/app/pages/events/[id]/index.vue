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
          <UIcon name="i-heroicons-calendar" />
          {{ periodeEvenement({ ...event, timezone: event.timezone ?? undefined }) }}
        </span>
      </div>

      <p v-if="event.description" class="mt-4 whitespace-pre-line text-muted">
        {{ event.description }}
      </p>

      <USeparator class="my-8" label="Fonctionnalités d'organisation" />

      <!-- Accès débloqué : par l'abonnement du PROPRIÉTAIRE (un organisateur n'a pas besoin du
           sien), et chaque carte selon les droits de la personne. -->
      <div v-if="acces?.abonnementActif" class="grid gap-4 sm:grid-cols-2">
        <UCard
          v-for="carte in cartes"
          :key="carte.to"
          class="cursor-pointer transition hover:ring-2 hover:ring-primary"
          @click="navigateTo(carte.to)"
        >
          <div class="flex items-center gap-3">
            <div class="flex size-11 items-center justify-center rounded-lg" :class="carte.couleur">
              <UIcon :name="carte.icone" class="text-2xl" />
            </div>
            <div>
              <p class="font-semibold">{{ carte.titre }}</p>
              <p class="text-sm text-muted">{{ carte.description }}</p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Paywall -->
      <UCard v-else>
        <div class="flex flex-col items-center py-6 text-center">
          <div
            class="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <UIcon name="i-heroicons-lock-closed" class="text-2xl" />
          </div>
          <template v-if="acces?.droits.estProprietaire">
            <p class="mt-3 font-semibold">Fonctionnalités réservées aux abonnés</p>
            <p class="mt-1 max-w-md text-sm text-muted">
              Abonnez-vous pour débloquer la gestion des bénévoles et les autres outils
              d'organisation de vos événements — pour vous et vos co-organisateurs.
            </p>
            <UButton
              class="mt-4"
              to="/pricing"
              label="Voir les tarifs"
              icon="i-heroicons-credit-card"
            />
          </template>
          <template v-else>
            <p class="mt-3 font-semibold">Gestion momentanément indisponible</p>
            <p class="mt-1 max-w-md text-sm text-muted">
              L'abonnement du propriétaire de cet événement n'est plus actif : la gestion reprendra
              dès qu'il sera renouvelé.
            </p>
          </template>
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

// Droits de la personne, et l'abonnement du propriétaire qui ouvre (ou non) la gestion.
const { data: acces } = await useFetch<{
  droits: {
    voir: boolean
    modifier: boolean
    organisateurs: boolean
    benevoles: boolean
    estProprietaire: boolean
  }
  abonnementActif: boolean
  modules?: { benevoles: boolean }
}>(`/api/events/${route.params.id}/acces-gestion`)

// La gestion se résume ici à deux portes : son accueil (qui ouvre chaque module selon les droits),
// et la page que l'on partage aux bénévoles si leur module est actif.
const cartes = computed(() => {
  const e = event.value
  const a = acces.value
  if (!e || !a) return []
  const base = `/events/${e.publicId}`
  return [
    {
      titre: "Gestion de l'événement",
      description: 'Bénévoles, organisateurs, informations, modules.',
      icone: 'i-heroicons-squares-2x2',
      couleur: 'bg-primary/10 text-primary',
      to: `${base}/gestion`,
    },
    ...(a.modules?.benevoles !== false
      ? [
          {
            titre: 'Page des bénévoles',
            description: 'Ce que voient les candidats, et le lien à partager.',
            icone: 'i-heroicons-eye',
            couleur: 'bg-secondary/10 text-secondary',
            to: `${base}/volunteers`,
          },
        ]
      : []),
  ]
})

useSeoMeta({ title: () => (event.value ? `${event.value.name} — Flowvent` : 'Événement') })
</script>
