<template>
  <UAlert
    icon="i-heroicons-check-circle"
    color="success"
    variant="soft"
    :title="$t('admin.import.agent_success')"
  >
    <template #description>
      <p>
        {{
          $t('admin.import.agent_result', {
            pages: result.urlsProcessed?.length || 0,
            iterations: result.iterations || 0,
          })
        }}
      </p>
      <ul v-if="result.urlsProcessed?.length" class="mt-2 text-xs space-y-1">
        <li v-for="url in result.urlsProcessed" :key="url" class="truncate">• {{ url }}</li>
      </ul>
    </template>
  </UAlert>
</template>

<script setup lang="ts">
interface AgentResult {
  urlsProcessed?: string[]
  iterations?: number
}

defineProps<{
  /** Résultat de l'agent */
  result: AgentResult
}>()
</script>
