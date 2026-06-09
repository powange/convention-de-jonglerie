<script setup lang="ts">
import type { EditionMarker } from '~/composables/useEditionMarkers'
import { DEFAULT_HEX_PALETTE } from '~/utils/default-palette'

import { EDITION_ZONE_TYPES, getZoneTypeIcon } from '~~/shared/utils/zone-types'

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
    label: t(`map.types.${type.toLowerCase()}`),
    value: type,
    icon: getZoneTypeIcon(type),
  }))
)

const defaultColors = DEFAULT_HEX_PALETTE

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
  props.marker ? t('map.edit_marker') : t('gestion.map.add_marker')
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
          <UiColorPicker
            v-model="form.color"
            :palette="[...defaultColors]"
            format="hex"
            :columns="8"
            allow-custom
            :custom-label="t('gestion.map.custom_color')"
          />
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
