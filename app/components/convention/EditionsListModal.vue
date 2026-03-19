<template>
  <UModal v-model:open="open" :title="title" size="lg">
    <template #body>
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-gray-400" />
      </div>

      <div v-else-if="editions.length === 0" class="text-center py-8 text-gray-500">
        {{ $t('edition.no_editions') }}
      </div>

      <div v-else class="space-y-3">
        <NuxtLink
          v-for="edition in editions"
          :key="edition.id"
          :to="`/editions/${edition.id}`"
          class="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          @click="open = false"
        >
          <div v-if="editionImageUrl(edition)" class="flex-shrink-0">
            <img
              :src="editionImageUrl(edition)!"
              :alt="edition.name"
              loading="lazy"
              class="w-14 h-14 object-cover rounded-lg"
            />
          </div>
          <div
            v-else
            class="flex-shrink-0 w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
          >
            <UIcon name="i-heroicons-building-library" class="text-gray-400" size="20" />
          </div>

          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 dark:text-white truncate">
              {{ edition.name }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ formatDateRange(edition.startDate, edition.endDate) }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <UIcon name="i-heroicons-map-pin" size="14" />
              {{ edition.city }},
              <FlagIcon :code="getCountryCode(edition.country)" size="sm" />
              {{ translateCountryName(edition.country) }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { getCountryCode } from '~/utils/countries'

interface ConventionEdition {
  id: number
  name: string
  imageUrl: string | null
  startDate: string
  endDate: string
  city: string
  country: string
}

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  conventionId: number
  title: string
}>()

const { getImageUrl } = useImageUrl()
const { translateCountryName } = useCountryTranslation()
const { formatDateRange } = useDateFormat()

const editions = ref<ConventionEdition[]>([])
const loading = ref(false)
const loaded = ref(false)

const editionImageUrl = (edition: ConventionEdition) => {
  if (!edition.imageUrl) return null
  return getImageUrl(edition.imageUrl, 'edition', edition.id)
}

const fetchEditions = async () => {
  loading.value = true
  try {
    editions.value = await $fetch<ConventionEdition[]>(
      `/api/conventions/${props.conventionId}/public-editions`
    )
  } catch {
    editions.value = []
  } finally {
    loading.value = false
    loaded.value = true
  }
}

watch(open, (isOpen) => {
  if (isOpen && !loaded.value) {
    fetchEditions()
  }
})
</script>
