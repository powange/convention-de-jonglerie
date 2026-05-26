<script setup lang="ts">
import type { EditionZone } from '~/composables/useEditionZones'

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

const defaultColors = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#0ea5e9', // sky-500
  '#6366f1', // indigo-500
  '#a855f7', // purple-500
  '#f43f5e', // rose-500
  '#84cc16', // lime-500
  '#64748b', // slate-500
]

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
          <div class="space-y-3">
            <div class="grid grid-cols-8 gap-2 mb-3">
              <button
                v-for="color in defaultColors"
                :key="color"
                type="button"
                class="w-8 h-8 rounded-full border-2 shadow-sm hover:scale-110 transition-transform"
                :class="
                  form.color === color
                    ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-500'
                    : 'border-gray-300'
                "
                :style="{ backgroundColor: color }"
                @click="form.color = color"
              />
            </div>
            <div class="flex items-center gap-3">
              <label class="block">
                <span class="sr-only">{{ t('gestion.map.custom_color') }}</span>
                <input
                  v-model="form.color"
                  type="color"
                  class="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                />
              </label>
              <UInput
                v-model="form.color"
                placeholder="#3b82f6"
                class="flex-1"
                pattern="^#[0-9A-Fa-f]{6}$"
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
