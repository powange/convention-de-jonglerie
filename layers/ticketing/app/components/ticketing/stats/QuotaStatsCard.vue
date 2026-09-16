<template>
  <!-- Pas de `!pending` ici : `refresh()` le repasse à vrai, et la carte se démontait donc à
       chaque événement temps réel — un clignotement au moment précis où l'on scanne à l'entrée.
       `useFetch` conserve `data` pendant un rafraîchissement : la seule condition d'affichage
       utile est donc d'avoir quelque chose à montrer, ce qui masque aussi le premier
       chargement. -->
  <UCard v-if="quotaStats.length > 0">
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-chart-bar-square" class="text-indigo-500" />
        <h2 class="text-lg font-semibold">{{ $t('ticketing.quotas.stats.title') }}</h2>
        <!-- Le rafraîchissement reste perceptible, mais ne coûte plus la carte. -->
        <UIcon
          v-if="pending"
          name="i-heroicons-arrow-path"
          class="h-4 w-4 text-gray-400 animate-spin"
        />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="quota in quotaStats"
          :key="quota.id"
          class="p-4 rounded-lg border-2"
          :class="
            quota.percentage >= 100
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : quota.percentage >= 80
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          "
        >
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold text-gray-900 dark:text-white text-sm">
                {{ quota.title }}
              </h3>
              <UBadge
                v-if="quota.currentCount > quota.quantity"
                color="error"
                variant="solid"
                size="xs"
              >
                {{ $t('ticketing.quotas.stats.exceeded') }}
              </UBadge>
            </div>

            <p v-if="quota.description" class="text-xs text-gray-600 dark:text-gray-400">
              {{ quota.description }}
            </p>

            <div class="space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">{{
                  $t('ticketing.quotas.stats.used')
                }}</span>
                <span class="font-medium text-gray-900 dark:text-white">
                  {{ quota.currentCount }} / {{ quota.quantity }}
                </span>
              </div>

              <!-- Barre de progression -->
              <!-- `:model-value` et non `v-model` : une barre de progression ne s'écrit pas, et
                   `quota` vient d'un `computed` sur les données de `useFetch` — la lier en
                   écriture ouvrait une voie de mutation vers ce qu'on vient de recevoir. -->
              <UProgress
                :model-value="quota.currentCount"
                :max="quota.quantity < quota.currentCount ? quota.currentCount : quota.quantity"
                :color="
                  quota.percentage >= 100 ? 'error' : quota.percentage >= 80 ? 'warning' : 'success'
                "
                size="sm"
              />

              <!-- Nombre de validés -->
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500 dark:text-gray-500">{{
                  $t('ticketing.quotas.stats.validated')
                }}</span>
                <span class="font-medium text-gray-700 dark:text-gray-300">
                  {{ quota.validatedCount }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{
  editionId: number
}>()

// SSE pour rafraîchissement automatique
const { lastUpdate } = useRealtimeStats(props.editionId)

const {
  data: quotaStatsData,
  pending,
  refresh,
} = await useFetch(`/api/editions/${props.editionId}/ticketing/quotas/stats`)
// Les statistiques sont désormais sous la clé `data` de l'enveloppe : l'endpoint passe par
// `createSuccessResponse`, comme tous les autres du module. Il faisait exception, et c'est
// l'exception qui aurait piégé le prochain appelant.
//
// (Le chemin pointé est écrit en toutes lettres à dessein : le détecteur i18n le prendrait pour
// une clé de traduction manquante.)
const quotaStats = computed(() => quotaStatsData.value?.data?.stats || [])

// Rafraîchir quand une mise à jour SSE arrive
watch(lastUpdate, () => {
  if (lastUpdate.value) {
    refresh()
  }
})
</script>
