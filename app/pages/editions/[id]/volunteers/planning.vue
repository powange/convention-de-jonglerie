<template>
  <div v-if="edition">
    <EditionHeader
      :edition="edition"
      current-page="volunteers"
      :is-favorited="isFavorited(edition.id)"
      @toggle-favorite="toggleFavorite(edition.id)"
    />

    <UCard variant="soft" class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-calendar-days" class="text-primary-500" />
            {{ t('editions.volunteers.schedule_management') }}
          </h3>
          <div v-if="canManageVolunteers" class="flex items-center gap-2">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-heroicons-arrow-left"
              :to="`/editions/${edition?.id}/volunteers`"
            >
              {{ t('common.back') || 'Retour' }}
            </UButton>
          </div>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Placeholder pour le futur contenu du planning -->
        <div class="text-center py-12">
          <UIcon name="i-heroicons-calendar-days" class="mx-auto text-gray-400 mb-4" size="48" />
          <h4 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {{ t('editions.volunteers.planning_coming_soon') || 'Planning des bénévoles' }}
          </h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {{
              t('editions.volunteers.planning_description') ||
              'Ici vous pourrez gérer et visualiser le planning des bénévoles pour cette édition.'
            }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
  <div v-else>
    <p>{{ t('editions.loading_details') }}</p>
  </div>
</template>

<script setup lang="ts">
// Vue & libs
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// App components & stores
import EditionHeader from '~/components/edition/EditionHeader.vue'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const { t } = useI18n()
const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const editionId = parseInt(route.params.id as string)

// Charger l'édition
await editionStore.fetchEditionById(editionId)
const edition = computed(() => editionStore.getEditionById(editionId))

// Gestion des favoris
const isFavorited = computed(() => (_id: number) => {
  return edition.value?.favoritedBy.some((u) => u.id === authStore.user?.id)
})

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
  } catch {
    /* silent */
  }
}

// Permissions pour gérer les bénévoles (repris de la page index)
const canManageVolunteers = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  // Créateur de l'édition
  if (edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId === authStore.user.id) return true
  // Collaborateur avec droit global de gérer les bénévoles
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  if (!collab) return false
  const rights = collab.rights || {}
  if (rights.manageVolunteers) return true
  // Collaborateur avec droit spécifique à cette édition
  const perEdition = (collab as any).perEdition || []
  const editionPerm = perEdition.find((p: any) => p.editionId === edition.value!.id)
  return editionPerm?.canManageVolunteers || false
})

// Metadata SEO
useHead({
  title: computed(() =>
    edition.value
      ? `Planning - ${edition.value.name || edition.value.convention?.name}`
      : 'Planning'
  ),
})
</script>
