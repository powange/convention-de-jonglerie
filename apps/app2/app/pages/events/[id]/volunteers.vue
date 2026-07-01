<template>
  <UContainer class="max-w-4xl py-10">
    <UButton
      :to="`/events/${route.params.id}`"
      variant="link"
      color="neutral"
      icon="i-heroicons-arrow-left"
      label="Retour à l'événement"
      class="-ml-2 mb-4"
    />

    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold">
          <UIcon name="i-heroicons-user-group" class="text-primary" /> Gestion des bénévoles
        </h1>
        <p class="text-sm text-muted">Organisez les équipes et les créneaux de vos bénévoles.</p>
      </div>
      <UBadge color="success" variant="subtle" icon="i-heroicons-check-badge" label="Abonnement actif" />
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <UCard v-for="card in placeholderCards" :key="card.title">
        <div class="mb-2 flex items-center gap-3">
          <UIcon :name="card.icon" class="text-xl text-primary" />
          <p class="font-semibold">{{ card.title }}</p>
        </div>
        <p class="text-sm text-muted">{{ card.description }}</p>
        <UBadge class="mt-3" color="neutral" variant="subtle" label="Bientôt disponible" />
      </UCard>
    </div>

    <UCard class="mt-6 border-dashed py-12 text-center">
      <UIcon name="i-heroicons-wrench-screwdriver" class="mx-auto text-4xl text-muted" />
      <p class="mt-3 font-medium">Module en construction</p>
      <p class="mx-auto max-w-md text-sm text-muted">
        Cette page est un aperçu. Les outils complets de gestion des bénévoles arriveront dans une
        prochaine itération.
      </p>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'subscription'] })
useSeoMeta({ title: 'Bénévoles — EventOrga' })

const route = useRoute()

const placeholderCards = [
  { icon: 'i-heroicons-users', title: 'Équipes', description: 'Créez des équipes de bénévoles par pôle.' },
  { icon: 'i-heroicons-clock', title: 'Créneaux', description: 'Planifiez les créneaux et les besoins.' },
  {
    icon: 'i-heroicons-clipboard-document-check',
    title: 'Affectations',
    description: 'Affectez les bénévoles aux créneaux.',
  },
]
</script>
