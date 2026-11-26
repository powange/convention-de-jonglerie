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

      <USeparator v-if="acces?.droits.voir" class="my-8" label="Fonctionnalités d'organisation" />

      <!-- La gestion s'ouvre à qui la voit ; archivé, ou propriétaire en surnombre d'événements,
           l'événement reste consultable en lecture seule (droits-evenement.ts). -->
      <div v-if="acces?.droits.voir" class="space-y-4">
        <UAlert
          v-if="acces.lectureSeule"
          color="warning"
          variant="subtle"
          icon="i-heroicons-lock-closed"
          :title="
            acces.lectureSeule === 'archive'
              ? 'Cet événement est archivé : sa gestion est en lecture seule'
              : 'Trop d’événements en cours pour la formule du propriétaire : la gestion est en lecture seule'
          "
          description="Rien n'est supprimé."
          :actions="
            acces.droits.estProprietaire && acces.lectureSeule === 'surnombre'
              ? [{ label: 'Voir les formules', to: '/pricing', color: 'warning', variant: 'solid' }]
              : []
          "
        />
        <div class="grid gap-4 sm:grid-cols-2">
          <UCard
            v-for="carte in cartes"
            :key="carte.to"
            class="cursor-pointer transition hover:ring-2 hover:ring-primary"
            @click="navigateTo(carte.to)"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex size-11 items-center justify-center rounded-lg"
                :class="carte.couleur"
              >
                <UIcon :name="carte.icone" class="text-2xl" />
              </div>
              <div>
                <p class="font-semibold">{{ carte.titre }}</p>
                <p class="text-sm text-muted">{{ carte.description }}</p>
              </div>
            </div>
          </UCard>
        </div>
      </div>
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
  lectureSeule: 'archive' | 'surnombre' | null
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
