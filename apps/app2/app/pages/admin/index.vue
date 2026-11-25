<template>
  <UContainer class="py-10">
    <AdminNav />
    <USkeleton v-if="!stats" class="h-64 w-full" />
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard v-for="c in cartes" :key="c.libelle">
        <div class="flex items-start gap-3">
          <UIcon :name="c.icone" class="mt-1 size-6 text-primary" />
          <div>
            <p class="text-2xl font-bold">{{ c.valeur }}</p>
            <p class="text-sm text-muted">{{ c.libelle }}</p>
            <p v-if="c.detail" class="mt-1 text-xs text-muted">{{ c.detail }}</p>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })
useSeoMeta({ title: 'Administration — Flowvent' })

interface Stats {
  comptes: number
  verifies: number
  parFournisseur: Record<string, number>
  inscrits7j: number
  connectes7j: number
  abonnementsActifs: number
  evenements: number
  evenements7j: number
  candidatures: number
}
const { data: stats } = await useFetch<Stats>('/api/admin/stats')

const FOURNISSEURS: Record<string, string> = {
  email: 'e-mail',
  google: 'Google',
  facebook: 'Facebook',
  MANUAL: 'invités',
}
const cartes = computed(() => {
  const s = stats.value
  if (!s) return []
  const repartition = Object.entries(s.parFournisseur)
    .map(([f, n]) => `${n} ${FOURNISSEURS[f] ?? f}`)
    .join(' · ')
  return [
    {
      libelle: 'comptes',
      valeur: s.comptes,
      icone: 'i-heroicons-users',
      detail: `${s.verifies} vérifiés · ${repartition}`,
    },
    {
      libelle: 'inscriptions (7 jours)',
      valeur: s.inscrits7j,
      icone: 'i-heroicons-user-plus',
      detail: null,
    },
    {
      libelle: 'connectés (7 jours)',
      valeur: s.connectes7j,
      icone: 'i-heroicons-arrow-right-on-rectangle',
      detail: null,
    },
    {
      libelle: 'abonnements actifs',
      valeur: s.abonnementsActifs,
      icone: 'i-heroicons-credit-card',
      detail: null,
    },
    {
      libelle: 'événements',
      valeur: s.evenements,
      icone: 'i-heroicons-calendar-days',
      detail: `${s.evenements7j} créés ces 7 jours`,
    },
    {
      libelle: 'candidatures de bénévoles',
      valeur: s.candidatures,
      icone: 'i-heroicons-hand-raised',
      detail: null,
    },
  ]
})
</script>
