<template>
  <UCard variant="outline">
    <div v-if="!ready" class="flex items-center gap-2 text-sm text-gray-500 p-4">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
      <span>{{ t('common.loading') }}...</span>
    </div>
    <FullCalendar v-else ref="calendarRef" :options="calendarOptions" class="fc-theme-standard" />

    <!-- Modal d'aperçu d'édition -->
    <UModal v-model:open="modalOpen" size="lg">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-calendar" class="text-primary-500" />
          <h3 class="font-semibold text-lg truncate max-w-[28rem]">
            {{ selectedEdition ? getEditionDisplayName(selectedEdition) : '' }}
          </h3>
        </div>
      </template>
      <template #body>
        <div v-if="selectedEdition" class="space-y-4">
          <!-- Ligne date + ville -->
          <div class="flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <div class="flex items-center gap-1">
              <UIcon name="i-heroicons-calendar-days" class="text-primary-500" />
              <span>{{ formatEditionDates(selectedEdition) }}</span>
            </div>
            <div
              v-if="selectedEdition.city || selectedEdition.country"
              class="flex items-center gap-1 text-gray-600 dark:text-gray-400"
            >
              <UIcon name="i-heroicons-map-pin" />
              <span v-if="selectedEdition.city">{{ selectedEdition.city }}</span>
              <span v-if="selectedEdition.city && selectedEdition.country"> · </span>
              <FlagIcon
                v-if="selectedEdition.country"
                :code="selectedEdition.country"
                class="ml-0"
              />
              <span v-if="selectedEdition.country">{{ selectedEdition.country }}</span>
            </div>
          </div>

          <!-- Services actifs -->
          <div v-if="activeServices.length" class="flex flex-wrap gap-2 text-xs">
            <UBadge
              v-for="s in activeServices"
              :key="s.key"
              :color="'neutral'"
              variant="soft"
              class="inline-flex items-center gap-1"
            >
              <UIcon :name="s.icon" :class="s.color" />
              <span>{{ s.label }}</span>
            </UBadge>
          </div>
        </div>
        <div v-else class="text-sm text-gray-500">{{ t('common.error') || '—' }}</div>
      </template>
      <template #footer>
        <UButton
          :label="t('common.close')"
          color="neutral"
          variant="ghost"
          @click="modalOpen = false"
        />
        <UButton
          :label="t('common.view_details')"
          color="primary"
          :to="'/editions/' + selectedEdition.id"
          icon="i-heroicons-arrow-right"
          trailing
        />
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
// FullCalendar v6 (packages daygrid/list) n'expose pas de fichiers CSS séparés dans ce build ESM; styles de base intégrés.
import { DateTime } from 'luxon'

import { getActiveServices, type ConventionService } from '~/utils/convention-services'
import { getEditionDisplayName } from '~/utils/editionName'

interface EditionLike {
  id: number
  name?: string | null
  startDate: string
  endDate: string
  country?: string | null
  city?: string | null
  convention?: { name: string }
}

const props = defineProps<{ editions: EditionLike[] }>()
const { t, locale } = useI18n()

const editionsRef = toRef(props, 'editions')

const tooltipFormatter = (event: any) => {
  const lines: string[] = []
  if (event.city) lines.push(event.city)
  if (event.country) lines.push(event.country)
  return lines
}

// --- Modal état ---
const modalOpen = ref(false)
const selectedEditionId = ref<number | null>(null)

const selectedEdition = computed(
  () => props.editions.find((e) => e.id === selectedEditionId.value) || null
)

const activeServices = computed<ConventionService[]>(() => {
  if (!selectedEdition.value) return []
  // On filtre uniquement les clés présentes sur l'édition
  return getActiveServices(selectedEdition.value as any)
})

function openEdition(id: number) {
  selectedEditionId.value = id
  modalOpen.value = true
}

// Formatage des dates (locale courante)
function formatEditionDates(e: EditionLike) {
  const start = DateTime.fromISO(e.startDate)
  const end = DateTime.fromISO(e.endDate)
  const sameMonth = start.month === end.month && start.year === end.year
  const sameDay = start.hasSame(end, 'day')
  const fmt = (d: ReturnType<typeof DateTime.fromISO>, withYear = false) =>
    d.setLocale(locale.value).toFormat(withYear ? 'dd LLL yyyy' : 'dd LLL')
  if (sameDay) return fmt(start, true)
  if (sameMonth) return `${start.setLocale(locale.value).toFormat('dd')} – ${fmt(end, true)}`
  return `${fmt(start, true)} → ${fmt(end, true)}`
}

const { calendarRef, calendarOptions, ready } = useCalendar({
  events: editionsRef as any, // Type assertion temporaire pour éviter l'erreur
  eventTooltipFormatter: tooltipFormatter,
  onEventClick: openEdition,
})
</script>

<!-- Styles déplacés vers main.css pour éviter les problèmes de :deep() -->
