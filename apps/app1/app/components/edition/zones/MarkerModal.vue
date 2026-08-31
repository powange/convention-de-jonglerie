<script setup lang="ts">
import type { EditionMarker } from '~/composables/useEditionMarkers'
import type { EditionZone } from '~/composables/useEditionZones'
import { DEFAULT_HEX_PALETTE } from '~/utils/default-palette'
import { fromZoneSelection, NO_ZONE, toZoneSelection } from '~/utils/map-zone-attachment'

import { EDITION_ZONE_TYPES, getZoneTypeIcon } from '~~/shared/utils/zone-types'

interface Props {
  marker?: EditionMarker | null
  open: boolean
  loading?: boolean
  /** Zones de l'édition, proposées comme rattachement (une entrée appartient à une salle). */
  zones?: EditionZone[]
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
      zoneId: number | null
    }
  ): void
}

const props = withDefaults(defineProps<Props>(), { zones: () => [] })
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

// « Aucune zone » porte une valeur sentinelle et non `null`, que Nuxt UI lirait comme « rien de
// sélectionné » : le choix existait alors dans la liste sans pouvoir être retenu, et un
// rattachement une fois posé ne se retirait plus.
const zoneOptions = computed(() => [
  { label: t('gestion.map.marker_no_zone'), value: NO_ZONE },
  ...props.zones.map((zone) => ({ label: zone.name, value: zone.id })),
])

const form = reactive({
  name: '',
  description: '',
  markerTypes: ['OTHER'] as string[],
  color: defaultColors[0]!,
  zoneId: NO_ZONE,
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
        // Un rattachement vers une zone absente de la liste — supprimée entre-temps — serait
        // renvoyé tel quel au serveur, qui le rejetterait. Le simple fait de renommer l'entrée
        // échouerait alors sur une erreur incompréhensible depuis cette modale.
        const attachedZone = props.marker.zoneId
        form.zoneId = props.zones.some((zone) => zone.id === attachedZone)
          ? toZoneSelection(attachedZone)
          : NO_ZONE
      } else {
        // Reset pour un nouveau marqueur
        form.name = ''
        form.description = ''
        form.markerTypes = ['OTHER']
        form.color = defaultColors[0]!
        form.zoneId = NO_ZONE
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
    zoneId: fromZoneSelection(form.zoneId),
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
  <!-- Le panneau de la carte est une couche fixe non modale, laissée à `z-index: auto` : tout
       `z-index` positif la ferait passer devant le reste. Une boîte de dialogue doit donc
       s'élever pour la recouvrir, sans quoi c'est l'ordre du DOM qui tranche — et le panneau
       gagne dès qu'il se remonte, masquant les boutons d'action sur un écran court. 50 laisse
       les notifications, à 100, au-dessus de tout. -->
  <UModal
    :open="open"
    :ui="{ overlay: 'z-50', content: 'z-50' }"
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

        <UFormField
          v-if="zones.length > 0"
          :label="t('gestion.map.marker_zone')"
          :description="t('gestion.map.marker_zone_help')"
        >
          <!-- Même libellé en repli qu'en option : que le composant affiche l'entrée « Aucune
               zone » ou retombe sur son placeholder, l'absence de rattachement se lit pareil. -->
          <USelectMenu
            v-model="form.zoneId"
            :items="zoneOptions"
            value-key="value"
            :placeholder="t('gestion.map.marker_no_zone')"
            :search-input="{ placeholder: t('common.search') }"
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
