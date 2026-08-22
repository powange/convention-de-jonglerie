<template>
  <div class="flex flex-wrap gap-4">
    <div class="w-full md:flex-1 md:min-w-64">
      <UInput
        v-model="filters.search"
        icon="i-heroicons-magnifying-glass"
        :placeholder="$t('admin.search_error_messages')"
        class="w-full"
        @input="$emit('search')"
      />
    </div>

    <USelect
      v-model="filters.status"
      :items="statusOptions"
      class="w-full md:w-40"
      @change="$emit('apply')"
    />

    <USelect
      v-model="filters.timeRange"
      :items="timeRangeOptions"
      class="w-full md:w-48"
      @change="$emit('apply')"
    />

    <USelect
      v-model="filters.errorType"
      :items="errorTypeOptions"
      class="w-full md:w-48"
      @change="$emit('apply')"
    />

    <USelect
      v-model="filters.statusCode"
      :items="statusCodeOptions"
      class="w-full md:w-48"
      @change="$emit('apply')"
    />

    <UInput
      v-model="filters.path"
      icon="i-heroicons-link"
      :placeholder="$t('admin.api_path')"
      class="w-full md:w-48"
      @input="$emit('search')"
    />

    <UInput
      v-model="filters.ip"
      icon="i-heroicons-globe-alt"
      :placeholder="$t('admin.filter_by_ip')"
      class="w-full md:w-48"
      @input="$emit('search')"
    />

    <UInput
      v-model="filters.user"
      icon="i-heroicons-user"
      :placeholder="$t('admin.filter_by_user')"
      class="w-full md:w-56"
      @input="$emit('search')"
    />

    <UButton
      icon="i-heroicons-x-mark"
      variant="outline"
      color="neutral"
      class="w-full justify-center md:w-auto"
      @click="$emit('clear')"
    >
      {{ $t('admin.error_logs.clear_filters') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
/**
 * Les huit filtres de la page des logs d'erreurs.
 *
 * Extraits pour être rendus à deux endroits — en carte sur grand écran, dans une fenêtre sur
 * mobile — sans dupliquer leur description. L'objet `filters` est partagé par référence avec la
 * page : les deux rendus lisent et écrivent donc le même état, sans synchronisation à tenir.
 */
const filters = defineModel<Record<string, string>>('filters', { required: true })

defineProps<{
  statusOptions: unknown[]
  timeRangeOptions: unknown[]
  errorTypeOptions: unknown[]
  statusCodeOptions: unknown[]
}>()

defineEmits<{
  apply: []
  search: []
  clear: []
}>()
</script>
