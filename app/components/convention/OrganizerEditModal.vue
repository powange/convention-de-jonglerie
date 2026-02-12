<template>
  <UDrawer
    v-model:open="isOpen"
    :title="$t('gestion.organizers.edit_organizer')"
    direction="bottom"
    :ui="{
      content: 'max-h-[90vh]',
      body: 'overflow-y-auto',
    }"
  >
    <template #header>
      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ $t('gestion.organizers.edit_organizer') }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('gestion.organizers.edit_organizer_description') }}
        </p>
      </div>
    </template>

    <template #body>
      <div v-if="organizer" class="space-y-6">
        <!-- Info organisateur - carte proéminente -->
        <div
          class="flex items-center gap-4 p-4 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border border-primary-200 dark:border-primary-700 rounded-xl"
        >
          <UiUserAvatar :user="organizer.user" size="lg" />
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-900 dark:text-white text-base">
              {{ organizer.user?.pseudo }}
            </div>
            <div
              v-if="organizer.user?.email"
              class="text-sm text-gray-600 dark:text-gray-400 truncate"
            >
              {{ organizer.user?.email }}
            </div>
            <div v-if="organizer.title" class="text-xs text-primary-600 dark:text-primary-400 mt-1">
              {{ organizer.title }}
            </div>
          </div>
        </div>

        <!-- Section droits d'accès -->
        <div class="space-y-3">
          <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <UIcon
              name="i-heroicons-shield-check"
              class="text-primary-500 dark:text-primary-400"
              size="20"
            />
            <h4 class="font-semibold text-gray-900 dark:text-white">
              {{ $t('gestion.organizers.access_rights') }}
            </h4>
          </div>

          <OrganizerRightsFields
            v-model="localRights"
            :editions="editions as any[]"
            :convention-name="convention?.name"
            size="sm"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between w-full gap-3">
        <!-- Bouton de suppression à gauche -->
        <UButton color="error" variant="soft" icon="i-heroicons-trash" @click="handleDelete">
          {{ $t('common.remove') }}
        </UButton>

        <!-- Actions principales à droite -->
        <div class="flex gap-3">
          <UButton variant="ghost" icon="i-heroicons-x-mark" @click="handleClose">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" icon="i-heroicons-check" :loading="loading" @click="handleSave">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UDrawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import type { Convention, Organizer, OrganizerRightsFormData, Edition } from '~/types'

interface Props {
  open: boolean
  organizer: Organizer | null
  convention: Convention | null
  editions?: Edition[]
  loading?: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'save', rights: OrganizerRightsFormData): void
  (e: 'delete'): void
}

const props = withDefaults(defineProps<Props>(), {
  editions: () => [],
  loading: false,
})

const emit = defineEmits<Emits>()

// État local
const isOpen = ref(props.open)
const localRights = ref<OrganizerRightsFormData>({
  rights: {},
  title: '',
  perEdition: [],
})

const { t } = useI18n()
const toast = useToast()

// Synchroniser l'état open avec le parent
watch(
  () => props.open,
  (newValue) => {
    isOpen.value = newValue
  }
)

watch(isOpen, (newValue) => {
  emit('update:open', newValue)
})

// Charger les droits de l'organisateur quand il change
watch(
  () => props.organizer,
  (newOrganizer) => {
    if (newOrganizer) {
      localRights.value = {
        rights: newOrganizer.rights ? { ...newOrganizer.rights } : {},
        title: newOrganizer.title || '',
        perEdition: [...(newOrganizer.perEditionRights || newOrganizer.perEdition || [])],
      }
    }
  },
  { immediate: true }
)

const handleClose = () => {
  isOpen.value = false
}

/**
 * Valide et sauvegarde les droits de l'organisateur
 * Vérifie que le titre est renseigné avant d'émettre l'événement save
 */
const handleSave = () => {
  // Validation du titre
  if (!localRights.value.title?.trim()) {
    toast.add({
      title: t('errors.validation_error'),
      description: t('gestion.organizers.title_required'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
    return
  }

  emit('save', localRights.value)
}

const handleDelete = () => {
  emit('delete')
}
</script>
