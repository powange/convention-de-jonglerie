<template>
  <UModal v-model:open="open">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-exclamation-triangle" class="text-warning-500" size="24" />
        <span class="font-semibold">{{ $t('admin.import.duplicate_warning_title') }}</span>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <p class="text-gray-600 dark:text-gray-400">
          {{ $t('admin.import.duplicate_warning_description') }}
        </p>

        <UAlert
          icon="i-heroicons-information-circle"
          color="warning"
          variant="soft"
          :title="$t('admin.import.duplicate_editions_found', { count: duplicateEditions.length })"
        />

        <!-- Liste des éditions en doublon -->
        <div class="space-y-3 max-h-80 overflow-y-auto">
          <div
            v-for="edition in duplicateEditions"
            :key="edition.id"
            class="p-3 border rounded-lg dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <div class="flex items-start gap-3">
              <!-- Logo de la convention -->
              <div
                v-if="edition.convention?.logo"
                class="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700"
              >
                <img
                  :src="edition.convention.logo"
                  :alt="edition.convention.name"
                  class="w-full h-full object-cover"
                />
              </div>
              <div
                v-else
                class="w-12 h-12 flex-shrink-0 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
              >
                <UIcon name="i-heroicons-calendar" class="text-gray-400" size="20" />
              </div>

              <div class="flex-1 min-w-0">
                <h4 class="font-medium text-gray-900 dark:text-white truncate">
                  {{ edition.name || edition.convention?.name }}
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ edition.convention?.name }}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {{
                    $t('admin.import.duplicate_edition_dates', {
                      startDate: formatDate(edition.startDate),
                      endDate: formatDate(edition.endDate),
                    })
                  }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ edition.city }}, {{ edition.country }}
                </p>
              </div>

              <!-- Lien vers l'édition -->
              <NuxtLink
                :to="`/editions/${edition.id}`"
                target="_blank"
                class="flex-shrink-0 text-primary-500 hover:text-primary-600"
              >
                <UIcon name="i-heroicons-arrow-top-right-on-square" size="20" />
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton color="neutral" variant="outline" @click="open = false">
          {{ $t('admin.import.cancel_import') }}
        </UButton>
        <UButton color="warning" :loading="importing" @click="$emit('confirm')">
          {{ $t('admin.import.proceed_anyway') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface DuplicateEdition {
  id: string
  name?: string
  startDate: string | Date
  endDate: string | Date
  city: string
  country: string
  convention?: {
    name: string
    logo?: string
  }
}

defineProps<{
  /** Éditions en doublon */
  duplicateEditions: DuplicateEdition[]
  /** Indique si l'import est en cours */
  importing: boolean
}>()

const open = defineModel<boolean>('open', { required: true })

defineEmits<{
  /** Émis lorsque l'utilisateur confirme l'import malgré les doublons */
  confirm: []
}>()

/**
 * Formate une date pour l'affichage
 */
const formatDate = (date: string | Date): string => {
  const d = new Date(date)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>
