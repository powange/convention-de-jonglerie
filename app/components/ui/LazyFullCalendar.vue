<template>
  <div>
    <div v-if="loading" class="flex items-center gap-2 text-sm text-gray-500 p-4">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
      <span>{{ t('common.loading') }}...</span>
    </div>
    <component
      :is="FullCalendarComponent"
      v-else-if="FullCalendarComponent"
      ref="calendarRef"
      :options="options"
      :class="calendarClass"
    />
    <div v-else-if="error" class="p-4 text-red-500">
      <UIcon name="i-heroicons-exclamation-circle" />
      <span>{{ t('errors.error_occurred') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarOptions } from '@fullcalendar/core'

interface Props {
  options: CalendarOptions
  class?: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const FullCalendarComponent = shallowRef<any>(null)
const loading = ref(true)
const error = ref(false)
const calendarRef = ref<any>(null)

const calendarClass = computed(() => props.class || '')

onMounted(async () => {
  try {
    // Import dynamique du composant FullCalendar
    const module = await import('@fullcalendar/vue3')
    FullCalendarComponent.value = module.default
  } catch (err) {
    console.error('Error loading FullCalendar:', err)
    error.value = true
  } finally {
    loading.value = false
  }
})

// Exposer la référence et l'API pour permettre l'accès depuis le parent
defineExpose({
  calendarRef: computed(() => calendarRef.value),
  getApi: () => calendarRef.value?.getApi(),
})
</script>
