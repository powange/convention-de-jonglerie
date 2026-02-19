<script setup lang="ts">
import type { EditionMarker } from '~/composables/useEditionMarkers'

interface Props {
  marker?: EditionMarker | null
  open: boolean
  loading?: boolean
}

interface Emits {
  (e: 'close'): void
  (
    e: 'save',
    data: {
      name: string
      description: string | null
      markerTypes: string[]
      color: string
    }
  ): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const markerTypes = computed(() =>
  EDITION_ZONE_TYPES.map((type) => ({
    label: t(`gestion.map.types.${type.toLowerCase()}`),
    value: type,
    icon: getZoneTypeIcon(type),
  }))
)

const defaultColors = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
]

const form = reactive({
  name: '',
  description: '',
  markerTypes: ['OTHER'] as string[],
  color: defaultColors[0]!,
})

// Remplir le formulaire avec les données du marqueur si il existe
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (props.marker) {
        form.name = props.marker.name
        form.description = props.marker.description || ''
        form.markerTypes = [...props.marker.markerTypes]
        form.color = props.marker.color || defaultColors[0]!
      } else {
        // Reset pour un nouveau marqueur
        form.name = ''
        form.description = ''
        form.markerTypes = ['OTHER']
        form.color = defaultColors[0]!
      }
    }
  },
  { immediate: true }
)

const isValid = computed(() => form.name.trim().length > 0 && form.markerTypes.length > 0)

const handleSave = () => {
  if (!isValid.value) return

  emit('save', {
    name: form.name.trim(),
    description: form.description.trim() || null,
    markerTypes: form.markerTypes,
    color: form.color,
  })
}

const handleClose = () => {
  emit('close')
}

const modalTitle = computed(() =>
  props.marker ? t('gestion.map.edit_marker') : t('gestion.map.add_marker')
)
</script>

<template>
  <UModal
    :open="open"
    :title="modalTitle"
    @update:open="(value: boolean) => !value && handleClose()"
  >
    <template #default>
      <slot />
    </template>

    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('gestion.map.marker_name')" required>
          <UInput v-model="form.name" :placeholder="t('gestion.map.marker_name')" class="w-full" />
        </UFormField>

        <UFormField :label="t('gestion.map.marker_description')">
          <UTextarea
            v-model="form.description"
            :placeholder="t('gestion.map.marker_description')"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('gestion.map.marker_types')">
          <USelect
            v-model="form.markerTypes"
            multiple
            :items="markerTypes"
            :icon="form.markerTypes.length > 0 ? getZoneTypeIcon(form.markerTypes[0]) : undefined"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('gestion.map.marker_color')">
          <div class="flex items-center gap-3">
            <input
              v-model="form.color"
              type="color"
              class="h-10 w-14 cursor-pointer rounded border border-gray-300 dark:border-gray-700"
            />
            <div class="flex flex-wrap gap-1">
              <button
                v-for="color in defaultColors"
                :key="color"
                type="button"
                class="h-6 w-6 rounded border-2 transition-transform hover:scale-110"
                :class="
                  form.color === color ? 'border-gray-900 dark:border-white' : 'border-transparent'
                "
                :style="{ backgroundColor: color }"
                @click="form.color = color"
              />
            </div>
          </div>
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="ghost" :label="t('common.cancel')" @click="handleClose" />
        <UButton
          :label="t('common.save')"
          :loading="loading"
          :disabled="!isValid"
          @click="handleSave"
        />
      </div>
    </template>
  </UModal>
</template>
