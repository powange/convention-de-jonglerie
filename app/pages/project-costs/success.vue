<template>
  <div class="max-w-2xl mx-auto py-16 px-4 text-center">
    <div class="text-6xl mb-6">☕</div>
    <h1 class="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-4">
      {{ t('project_costs.coffee.success_title') }}
    </h1>
    <p class="text-gray-600 dark:text-gray-400 text-lg mb-8">
      {{ t('project_costs.coffee.success_message') }}
    </p>
    <UButton to="/project-costs" color="primary" size="lg" icon="i-heroicons-arrow-left">
      {{ t('project_costs.coffee.back_to_costs') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
</script>
