<template>
  <div>
    <!-- Hero -->
    <UContainer class="py-20 text-center">
      <div class="mb-3 flex items-center justify-center gap-2">
        <UIcon name="i-heroicons-calendar-days" class="text-3xl text-primary" />
        <span class="text-2xl font-bold tracking-tight">Flowvent</span>
      </div>
      <p class="mb-6 text-base font-medium text-primary">Le flow de vos événements</p>
      <h1 class="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
        Organisez vos événements, gérez vos bénévoles, sans prise de tête.
      </h1>
      <p class="mx-auto mt-6 max-w-2xl text-lg text-muted">
        Créez un événement et débloquez les outils d'organisation grâce à un abonnement simple,
        mensuel ou annuel.
      </p>
      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <UButton
          :to="loggedIn ? '/dashboard' : '/register'"
          size="lg"
          :label="loggedIn ? 'Accéder à mon espace' : 'Commencer gratuitement'"
          icon="i-heroicons-rocket-launch"
        />
        <UButton to="/pricing" size="lg" color="neutral" variant="subtle" label="Voir les tarifs" />
      </div>
    </UContainer>

    <!-- Fonctionnalités -->
    <UContainer class="pb-20">
      <div class="grid gap-6 sm:grid-cols-3">
        <UCard v-for="feature in features" :key="feature.title">
          <div
            class="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <UIcon :name="feature.icon" class="text-2xl" />
          </div>
          <h3 class="font-semibold">{{ feature.title }}</h3>
          <p class="mt-1 text-sm text-muted">{{ feature.description }}</p>
        </UCard>
      </div>

      <UAlert
        class="mt-10"
        color="warning"
        variant="subtle"
        icon="i-heroicons-information-circle"
        title="Version de démonstration"
        description="Le paiement est simulé : aucun prestataire réel n'est appelé et aucune carte n'est demandée. L'abonnement s'active immédiatement."
      />
    </UContainer>
  </div>
</template>

<script setup lang="ts">
const { loggedIn } = useUserSession()

useSeoMeta({
  title: 'Flowvent — Organisation d\'événements',
  description: 'Créez vos événements et gérez vos bénévoles avec un abonnement simple.',
})

const features = [
  {
    icon: 'i-heroicons-calendar-days',
    title: 'Créez vos événements',
    description: 'Centralisez les informations clés de chaque événement en quelques clics.',
  },
  {
    icon: 'i-heroicons-user-group',
    title: 'Gérez vos bénévoles',
    description: 'Accédez aux outils d\'organisation des bénévoles une fois abonné.',
  },
  {
    icon: 'i-heroicons-credit-card',
    title: 'Abonnement simple',
    description: 'Mensuel ou annuel, sans engagement. Paiement simulé pour cette démo.',
  },
]
</script>
