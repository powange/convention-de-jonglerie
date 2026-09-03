<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('volunteers.swap_pending_title') }}</h1>
    </div>

    <UCard>
      <p v-if="demandes.length === 0" class="text-sm text-gray-500">
        {{ t('volunteers.swap_pending_none') }}
      </p>

      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
        <li
          v-for="demande in demandes"
          :key="demande.id"
          class="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="min-w-0 flex-1 space-y-3">
            <!-- Une personne, deux lignes : ce qu'elle cède et ce qu'elle reçoit. La version
                 précédente n'affichait que la destination — on ne savait pas d'où chacun
                 partait, et il fallait recouper les deux lignes pour le deviner. -->
            <VolunteersSwapMouvement
              :personne="demande.requester"
              :cede="demande.requesterAssignment.timeSlot"
              :recoit="demande.targetAssignment.timeSlot"
            />
            <VolunteersSwapMouvement
              :personne="demande.target"
              :cede="demande.targetAssignment.timeSlot"
              :recoit="demande.requesterAssignment.timeSlot"
            />

            <!-- Ce que l'échange produit sur le terrain. Deux noms et deux horaires ne suffisent
                 pas à décider : c'est l'effectif de chaque créneau qu'on valide. -->
            <p class="pt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              {{ t('volunteers.swap_effectif_titre') }}
            </p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <VolunteersSwapEffectif
                :titre="creneau(demande.requesterAssignment)"
                :membres="demande.effectifs?.offert ?? []"
              />
              <VolunteersSwapEffectif
                :titre="creneau(demande.targetAssignment)"
                :membres="demande.effectifs?.convoite ?? []"
              />
            </div>
          </div>

          <div class="flex shrink-0 gap-2">
            <UButton
              size="xs"
              color="success"
              :loading="enCours(demande.id)"
              :label="t('volunteers.swap_approve')"
              @click="validation.execute(demande.id)"
            />
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              :loading="enCours(demande.id)"
              :label="t('volunteers.swap_reject')"
              @click="rejet.execute(demande.id)"
            />
          </div>
        </li>
      </ul>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const { t } = useI18n()
const route = useRoute()
const editionId = computed(() => Number(route.params.id))

const { data, refresh } = await useFetch(
  () => `/api/editions/${editionId.value}/volunteers/swaps/pending`,
  { transform: (p: any) => p?.data ?? p }
)
const demandes = computed(() => data.value?.requests ?? [])

const creneau = (affectation: {
  timeSlot: { startDateTime: string; endDateTime: string; title?: string | null }
}) => {
  const c = affectation.timeSlot
  const d = new Date(c.startDateTime)
  const f = new Date(c.endDateTime)
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  const heure = (x: Date) => x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${jour} ${heure(d)}–${heure(f)}${c.title ? ` · ${c.title}` : ''}`
}

// Deux actions, comme côté bénévole : le corps est fixé à la construction du composable.
const options = (approve: boolean) => ({
  method: 'PATCH' as const,
  body: () => ({ approve }),
  successMessage: { title: t('volunteers.swap_decided') },
  errorMessages: { default: t('volunteers.swap_decide_error') },
  onSuccess: () => refresh(),
})

const validation = useApiActionById(
  (id) => `/api/editions/${editionId.value}/volunteers/swaps/${id}/decide`,
  options(true)
)
const rejet = useApiActionById(
  (id) => `/api/editions/${editionId.value}/volunteers/swaps/${id}/decide`,
  options(false)
)

const enCours = (id: string) => validation.isLoading(id) || rejet.isLoading(id)
</script>
