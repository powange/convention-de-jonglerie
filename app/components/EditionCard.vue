<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div v-if="edition.convention?.logo" class="flex-shrink-0">
            <img 
              :src="normalizeImageUrl(edition.convention.logo)" 
              :alt="edition.convention.name" 
              class="w-16 h-16 object-cover rounded-lg" 
            >
          </div>
          <div v-else class="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
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
      <p class="text-sm font-semibold">{{ formatDateTimeRange(edition.startDate, edition.endDate) }}</p>
      <p class="text-sm font-semibold flex items-center gap-1">
        <UIcon name="i-heroicons-map-pin" class="text-gray-400" size="16" />
        {{ edition.city }}, {{ edition.country }}
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
            <UButton icon="i-heroicons-eye" size="sm" color="info" variant="solid" :label="$t('common.view')" />
          </NuxtLink>
        </slot>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import type { Edition } from '~/types';
import { getEditionDisplayName } from '~/utils/editionName';
import { useTranslatedConventionServices } from '~/composables/useConventionServices';

interface Props {
  edition: Edition;
  showStatus?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showStatus: false
});

const { formatDateTimeRange } = useDateFormat();
const { getStatusColor, getStatusText } = useEditionStatus();
const { getTranslatedServices } = useTranslatedConventionServices();
const { normalizeImageUrl } = useImageUrl();

// Fonction pour obtenir les services actifs traduits
const getActiveServices = (edition: any) => {
  const services = getTranslatedServices();
  return services.filter(service => edition[service.key]);
};
</script>