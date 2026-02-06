<script setup lang="ts">
import type { EditionZone } from '~/composables/useEditionZones'

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
      zoneType: string
    }
  ): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const zoneTypes = computed(() => [
  { label: t('gestion.map.types.camping'), value: 'CAMPING' },
  { label: t('gestion.map.types.parking'), value: 'PARKING' },
  { label: t('gestion.map.types.shows'), value: 'SHOWS' },
  { label: t('gestion.map.types.workshops'), value: 'WORKSHOPS' },
  { label: t('gestion.map.types.food'), value: 'FOOD' },
  { label: t('gestion.map.types.market'), value: 'MARKET' },
  { label: t('gestion.map.types.entrance'), value: 'ENTRANCE' },
  { label: t('gestion.map.types.toilets'), value: 'TOILETS' },
  { label: t('gestion.map.types.info'), value: 'INFO' },
  { label: t('gestion.map.types.other'), value: 'OTHER' },
])

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
  color: defaultColors[0]!,
  zoneType: 'OTHER',
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
        form.zoneType = props.zone.zoneType
      } else {
        // Reset pour une nouvelle zone
        form.name = ''
        form.description = ''
        form.color = defaultColors[Math.floor(Math.random() * defaultColors.length)]!
        form.zoneType = 'OTHER'
      }
    }
  },
  { immediate: true }
)

const isValid = computed(() => form.name.trim().length > 0)

const handleSave = () => {
  if (!isValid.value) return

  emit('save', {
    name: form.name.trim(),
    description: form.description.trim() || null,
    color: form.color,
    zoneType: form.zoneType,
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

        <UFormField :label="t('gestion.map.zone_type')">
          <USelect v-model="form.zoneType" :items="zoneTypes" class="w-full" />
        </UFormField>

        <UFormField :label="t('gestion.map.zone_color')">
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
