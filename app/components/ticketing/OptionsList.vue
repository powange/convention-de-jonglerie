<template>
  <!-- Liste des options -->
  <div v-if="loading" class="text-center py-12">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
    <p class="text-sm text-gray-500 mt-2">Chargement...</p>
  </div>

  <div v-else-if="options.length === 0" class="text-center py-12">
    <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-300 mb-3 mx-auto" />
    <p class="text-sm text-gray-500">Aucune option trouvée</p>
    <p class="text-xs text-gray-400 mt-1">Synchronisez depuis votre billeterie externe</p>
  </div>

  <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <UCard v-for="option in options" :key="option.id">
      <template #header>
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 dark:text-white">
              {{ option.name }}
            </h3>
            <div class="flex items-center gap-2 mt-1">
              <UBadge color="primary" variant="soft" size="xs">
                {{ option.type }}
              </UBadge>
              <UBadge v-if="option.isRequired" color="warning" variant="soft" size="xs">
                Obligatoire
              </UBadge>
            </div>
          </div>
          <img
            v-if="option.helloAssoOptionId"
            src="~/assets/img/helloasso/logo.svg"
            alt="HelloAsso"
            class="h-5 w-auto"
            :title="`Synchronisé depuis HelloAsso (ID: ${option.helloAssoOptionId})`"
          />
        </div>
      </template>

      <div class="space-y-3">
        <p v-if="option.description" class="text-sm text-gray-600 dark:text-gray-400">
          {{ option.description }}
        </p>

        <!-- Choix disponibles -->
        <div v-if="option.choices && option.choices.length > 0">
          <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Choix :</p>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="(choice, idx) in option.choices"
              :key="idx"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ choice }}
            </UBadge>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
interface Option {
  id: number
  name: string
  description: string | null
  type: string
  isRequired: boolean
  choices: string[] | null
  helloAssoOptionId: number
}

defineProps<{
  options: Option[]
  loading: boolean
}>()
</script>
