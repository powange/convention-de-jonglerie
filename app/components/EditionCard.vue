<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex items-start justify-between">
        <div class="flex items-start gap-3">
          <div v-if="displayImageUrl" class="flex-shrink-0">
            <img
              :src="displayImageUrl"
              :alt="displayImageAlt"
              class="w-16 h-auto object-contain rounded-lg"
            />
          </div>
          <div
            v-else
            class="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
          >
            <UIcon name="i-heroicons-building-library" class="text-gray-400" size="24" />
          </div>
          <div class="flex-1">
            <h2 class="text-xl font-semibold">{{ getEditionDisplayName(edition) }}</h2>
            <UBadge
              v-if="showStatus"
              :color="getStatusColor(edition)"
              variant="soft"
              size="lg"
              class="mt-2 px-3 py-1"
            >
              {{ getStatusText(edition) }}
            </UBadge>
          </div>
        </div>
        <!-- Slot pour boutons d'actions -->
        <div class="flex items-center gap-2">
          <slot name="actions" :edition="edition" />
        </div>
      </div>
    </template>

    <!-- Informations principales -->
    <div class="space-y-2">
      <p class="text-sm font-semibold">
        {{ formatDateTimeRange(edition.startDate, edition.endDate) }}
      </p>
      <p class="text-sm font-semibold flex items-center gap-1">
        <UIcon name="i-heroicons-map-pin" class="text-gray-400" size="16" />
        {{ edition.city }},
        <FlagIcon :code="getCountryCode(edition.country)" size="sm" class="mx-1" />
        {{ edition.country }}
      </p>
    </div>

    <!-- Services avec pictos -->
    <div class="flex flex-wrap gap-1 mt-4">
      <UIcon
        v-for="activeService in getActiveServices(edition)"
        :key="activeService.key"
        :name="activeService.icon"
        :class="activeService.color"
        size="20"
        :title="activeService.label"
      />
    </div>

    <template #footer>
      <div class="flex justify-end">
        <slot name="footer-actions" :edition="edition">
          <NuxtLink :to="`/editions/${edition.id}`">
            <UButton
              icon="i-heroicons-eye"
              size="sm"
              color="info"
              variant="solid"
              :label="t('common.view')"
            />
          </NuxtLink>
        </slot>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { useTranslatedConventionServices } from '~/composables/useConventionServices'
import type { Edition } from '~/types'
import { getCountryCode } from '~/utils/countries'
import { getEditionDisplayName } from '~/utils/editionName'

interface Props {
  edition: Edition
  showStatus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showStatus: false,
})

const { formatDateTimeRange } = useDateFormat()
const { getStatusColor, getStatusText } = useEditionStatus()
const { getTranslatedServices } = useTranslatedConventionServices()
const { getImageUrl } = useImageUrl()
const { t } = useI18n()
// const localePath = useLocalePath(); // Pas nécessaire avec strategy: 'no_prefix'

// Computed pour l'URL de l'image à afficher (édition en priorité, sinon convention)
const displayImageUrl = computed(() => {
  // Priorité 1: Image de l'édition
  if (props.edition.imageUrl) {
    return getImageUrl(props.edition.imageUrl, 'edition', props.edition.id)
  }

  // Priorité 2: Logo de la convention
  if (props.edition.convention?.logo) {
    return getImageUrl(props.edition.convention.logo, 'convention', props.edition.convention.id)
  }

  // Aucune image disponible
  return null
})

// Computed pour le texte alternatif de l'image
const displayImageAlt = computed(() => {
  if (props.edition.imageUrl) {
    return `Affiche de ${getEditionDisplayName(props.edition)}`
  }

  if (props.edition.convention?.logo) {
    return `Logo de ${props.edition.convention.name}`
  }

  return ''
})

// Fonction pour obtenir les services actifs traduits
const getActiveServices = (edition: Edition) => {
  const services = getTranslatedServices.value
  return services.filter((service) => (edition as any)[service.key])
}
</script>
