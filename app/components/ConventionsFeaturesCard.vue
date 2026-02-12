<template>
  <UCard
    class="bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-primary-200 dark:border-primary-700"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 bg-primary-100 dark:bg-primary-900/50 rounded-lg flex items-center justify-center"
        >
          <UIcon
            name="i-heroicons-sparkles"
            class="text-primary-600 dark:text-primary-400"
            size="20"
          />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-primary-900 dark:text-primary-100">
            {{ $t('conventions.features_card_title') }}
          </h3>
          <p class="text-sm text-primary-700 dark:text-primary-300">
            {{ $t('conventions.features_card_subtitle') }}
          </p>
        </div>
      </div>
    </template>

    <ConventionsFeaturesContent variant="card" />

    <template v-if="showFooter" #footer>
      <div class="flex flex-col sm:flex-row gap-3">
        <UButton
          color="primary"
          size="sm"
          icon="i-heroicons-plus"
          :label="$t('conventions.create_first_convention')"
          to="/conventions/add"
          class="flex-1"
        />
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
interface Props {
  showFooter?: boolean
}

withDefaults(defineProps<Props>(), {
  showFooter: true,
})
</script>
