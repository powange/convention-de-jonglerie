<template>
  <UContainer class="py-16">
    <div class="mb-10 text-center">
      <h1 class="text-3xl font-bold">Tarifs</h1>
      <p class="mt-2 text-muted">
        Choisissez l'abonnement qui débloque les fonctionnalités d'organisation.
      </p>
      <UBadge
        class="mt-3"
        color="warning"
        variant="subtle"
        icon="i-heroicons-information-circle"
        label="Paiement simulé — aucune carte requise"
      />
    </div>

    <!-- Déjà abonné -->
    <div v-if="subActive" class="mb-8 flex justify-center">
      <UCard class="w-full max-w-md">
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-check-badge" class="text-2xl text-success" />
          <div>
            <p class="font-semibold">Vous êtes abonné ({{ planLabel }})</p>
            <p class="text-sm text-muted">
              Actif jusqu'au {{ formatDate(subData?.subscription?.currentPeriodEnd) }}
            </p>
          </div>
        </div>
        <UButton
          class="mt-4"
          to="/dashboard"
          block
          color="neutral"
          variant="subtle"
          label="Aller au tableau de bord"
        />
      </UCard>
    </div>

    <!-- Offres -->
    <div v-else class="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
      <UCard v-for="plan in plans" :key="plan.id" :class="plan.highlight ? 'ring-2 ring-primary' : ''">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ plan.name }}</h3>
          <UBadge v-if="plan.highlight" color="primary" variant="subtle" label="Le plus avantageux" />
        </div>
        <p class="mt-4">
          <span class="text-3xl font-bold">{{ plan.price }}</span>
          <span class="text-muted"> / {{ plan.period }}</span>
        </p>
        <ul class="mt-4 space-y-2 text-sm">
          <li v-for="f in plan.features" :key="f" class="flex items-center gap-2">
            <UIcon name="i-heroicons-check" class="text-success" /> {{ f }}
          </li>
        </ul>
        <UButton
          class="mt-6"
          block
          size="lg"
          :loading="loadingPlan === plan.id"
          :label="`S'abonner (${plan.name})`"
          @click="subscribe(plan.id)"
        />
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
useSeoMeta({ title: 'Tarifs — Flowvent' })

const toast = useToast()
const { loggedIn } = useUserSession()

// On n'interroge l'API (protégée) que si l'utilisateur est connecté.
const { data: subData, refresh } = await useFetch('/api/subscription/status', {
  immediate: loggedIn.value,
  default: () => ({ active: false, subscription: null }),
})

const subActive = computed(() => !!subData.value?.active)
const planLabel = computed(() =>
  subData.value?.subscription?.plan === 'annual' ? 'annuel' : 'mensuel'
)

const plans = [
  {
    id: 'monthly' as const,
    name: 'Mensuel',
    price: '19 €',
    period: 'mois',
    highlight: false,
    features: ['Événements illimités', 'Gestion des bénévoles', 'Sans engagement'],
  },
  {
    id: 'annual' as const,
    name: 'Annuel',
    price: '190 €',
    period: 'an',
    highlight: true,
    features: ['Tout le plan mensuel', '2 mois offerts', 'Support prioritaire'],
  },
]

const loadingPlan = ref<string | null>(null)

async function subscribe(plan: 'monthly' | 'annual') {
  if (!loggedIn.value) {
    await navigateTo('/register')
    return
  }
  loadingPlan.value = plan
  try {
    await $fetch('/api/subscription/checkout', { method: 'POST', body: { plan } })
    await refresh()
    toast.add({
      title: 'Abonnement activé',
      description: 'Paiement simulé avec succès.',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    await navigateTo('/dashboard')
  } catch (err: any) {
    toast.add({
      title: err?.data?.statusMessage || "Échec de l'abonnement",
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loadingPlan.value = null
  }
}

function formatDate(d?: string | Date | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>
