<template>
  <UCard v-if="!pending && quotaStats.length > 0">
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-chart-bar-square" class="text-indigo-500" />
        <h2 class="text-lg font-semibold">{{ $t('ticketing.quotas.stats.title') }}</h2>
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
                color="red"
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
              <UProgress
                v-model="quota.currentCount"
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

const { data: quotaStatsData, pending } = await useFetch(
  `/api/editions/${props.editionId}/ticketing/quotas/stats`
)
const quotaStats = computed(() => quotaStatsData.value?.stats || [])
</script>
