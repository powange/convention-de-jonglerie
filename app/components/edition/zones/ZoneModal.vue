<script setup lang="ts">
import type { EditionZone } from '~/composables/useEditionZones'
import { DEFAULT_HEX_PALETTE } from '~/utils/default-palette'

import { EDITION_ZONE_TYPES, getZoneTypeIcon } from '~~/shared/utils/zone-types'

interface Props {
  zone?: EditionZone | null
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
      color: string
      zoneTypes: string[]
    }
  ): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const zoneTypes = computed(() =>
  EDITION_ZONE_TYPES.map((type) => ({
    label: t(`gestion.map.types.${type.toLowerCase()}`),
    value: type,
    icon: getZoneTypeIcon(type),
  }))
)

const defaultColors = DEFAULT_HEX_PALETTE

const form = reactive({
  name: '',
  description: '',
  color: defaultColors[0]!,
  zoneTypes: ['OTHER'] as string[],
})

// Remplir le formulaire avec les données de la zone si elle existe
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (props.zone) {
        form.name = props.zone.name
        form.description = props.zone.description || ''
        form.color = props.zone.color
        form.zoneTypes = [...props.zone.zoneTypes]
      } else {
        // Reset pour une nouvelle zone
        form.name = ''
        form.description = ''
        form.color = defaultColors[Math.floor(Math.random() * defaultColors.length)]!
        form.zoneTypes = ['OTHER']
      }
    }
  },
  { immediate: true }
)

const isValid = computed(() => form.name.trim().length > 0 && form.zoneTypes.length > 0)

const handleSave = () => {
  if (!isValid.value) return

  emit('save', {
    name: form.name.trim(),
    description: form.description.trim() || null,
    color: form.color,
    zoneTypes: form.zoneTypes,
  })
}

const handleClose = () => {
  emit('close')
}

const modalTitle = computed(() =>
  props.zone ? t('gestion.map.edit_zone') : t('gestion.map.add_zone')
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
        <UFormField :label="t('gestion.map.zone_name')" required>
          <UInput v-model="form.name" :placeholder="t('gestion.map.zone_name')" class="w-full" />
        </UFormField>

        <UFormField :label="t('gestion.map.zone_description')">
          <UTextarea
            v-model="form.description"
            :placeholder="t('gestion.map.zone_description')"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('gestion.map.zone_types')">
          <USelect
            v-model="form.zoneTypes"
            multiple
            :items="zoneTypes"
            :icon="form.zoneTypes.length > 0 ? getZoneTypeIcon(form.zoneTypes[0]) : undefined"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('gestion.map.zone_color')">
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
