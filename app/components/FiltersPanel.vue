<template>
  <div class="space-y-6">
    <!-- Bouton réinitialiser les filtres -->
    <UButton
      icon="i-heroicons-arrow-path"
      type="button"
      color="neutral"
      variant="ghost"
      block
      @click="emit('reset-filters')"
    >
      {{ $t('homepage.reset_filters') }}
    </UButton>

    <!-- Filtres de recherche -->
    <div class="space-y-4">
      <UFormField :label="$t('forms.labels.convention_name')" name="name">
        <UInput
          :model-value="filters.name"
          :placeholder="$t('forms.placeholders.search_by_name')"
          class="w-full"
          @update:model-value="updateFilter('name', $event)"
        />
      </UFormField>
      <UFormField :label="$t('common.country')" name="countries">
        <CountryMultiSelect
          :model-value="filters.countries"
          :placeholder="$t('forms.placeholders.select_countries')"
          @update:model-value="updateFilter('countries', $event)"
        />
      </UFormField>
    </div>

    <!-- Filtres de dates -->
    <div class="space-y-4">
      <h4 class="font-medium text-gray-700">{{ $t('common.dates') }} :</h4>
      <UFormField :label="$t('forms.labels.from_date')" name="startDate">
        <UPopover :popper="{ placement: 'bottom-start' }">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-heroicons-calendar-days"
            :label="
              filters.startDate
                ? formatDateForDisplay(filters.startDate)
                : $t('forms.labels.select_date')
            "
            block
          />
          <template #content>
            <UCalendar
              :model-value="calendarStartDate"
              class="p-2"
              @update:model-value="emit('update-start-date', $event)"
            />
          </template>
        </UPopover>
      </UFormField>
      <UFormField :label="$t('forms.labels.until_date')" name="endDate">
        <UPopover :popper="{ placement: 'bottom-start' }">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-heroicons-calendar-days"
            :label="
              filters.endDate
                ? formatDateForDisplay(filters.endDate)
                : $t('forms.labels.select_date')
            "
            block
          />
          <template #content>
            <UCalendar
              :model-value="calendarEndDate"
              class="p-2"
              :is-date-disabled="(date) => calendarStartDate && date < calendarStartDate"
              @update:model-value="emit('update-end-date', $event)"
            />
          </template>
        </UPopover>
      </UFormField>
    </div>

    <!-- Filtre temporel -->
    <div class="space-y-4">
      <h4 class="font-medium text-gray-700">{{ $t('homepage.period') }} :</h4>
      <div class="space-y-3">
        <UCheckbox
          :model-value="filters.showPast"
          name="showPast"
          @update:model-value="updateFilter('showPast', $event)"
        >
          <template #label>
            <div class="flex items-center gap-2">
              <span class="text-base">✅</span>
              <span>{{ $t('homepage.finished_editions') }}</span>
            </div>
          </template>
        </UCheckbox>
        <UCheckbox
          :model-value="filters.showCurrent"
          name="showCurrent"
          @update:model-value="updateFilter('showCurrent', $event)"
        >
          <template #label>
            <div class="flex items-center gap-2">
              <span class="text-base">🔥</span>
              <span>{{ $t('homepage.current_editions') }}</span>
            </div>
          </template>
        </UCheckbox>
        <UCheckbox
          :model-value="filters.showFuture"
          name="showFuture"
          @update:model-value="updateFilter('showFuture', $event)"
        >
          <template #label>
            <div class="flex items-center gap-2">
              <span class="text-base">🔄</span>
              <span>{{ $t('homepage.upcoming_editions') }}</span>
            </div>
          </template>
        </UCheckbox>
      </div>
    </div>

    <!-- Filtres services -->
    <div class="space-y-4">
      <h4 class="font-medium text-gray-700">{{ $t('homepage.searched_services') }} :</h4>
      <div :class="isMobile ? 'space-y-4' : 'space-y-6'">
        <div
          v-for="category in servicesByCategory"
          :key="category.category"
          :class="isMobile ? 'space-y-2' : 'space-y-3'"
        >
          <h5 class="text-sm font-medium text-gray-600">{{ category.label }}</h5>
          <div :class="isMobile ? 'grid grid-cols-2 gap-2' : 'space-y-2'">
            <UCheckbox
              v-for="service in category.services"
              :key="service.key"
              :model-value="filters[service.key]"
              :name="service.key"
              @update:model-value="updateFilter(service.key, $event)"
            >
              <template #label>
                <div class="flex items-center gap-2">
                  <UIcon :name="service.icon" :class="service.color" size="16" />
                  <span :class="isMobile ? 'text-sm' : ''">{{ service.label }}</span>
                </div>
              </template>
            </UCheckbox>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CountryMultiSelect from '~/components/CountryMultiSelect.vue'

import type { CalendarDate } from '@internationalized/date'

interface Props {
  filters: any
  servicesByCategory: any[]
  calendarStartDate: CalendarDate | null
  calendarEndDate: CalendarDate | null
  isMobile?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'reset-filters': []
  'update-start-date': [date: CalendarDate]
  'update-end-date': [date: CalendarDate]
  'update-filter': [{ key: string; value: any }]
}>()

const updateFilter = (key: string, value: any) => {
  // Emit un événement générique pour mettre à jour n'importe quel filtre
  emit('update-filter', { key, value })
}

const { formatDate: formatDateForDisplay } = useDateFormat()
</script>
