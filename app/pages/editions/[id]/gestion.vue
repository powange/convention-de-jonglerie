<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->
      <EditionHeader
        :edition="edition"
        current-page="gestion"
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />

      <!-- Contenu de gestion -->
      <div class="space-y-6">
        <!-- Actions de gestion -->
        <UCard>
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">{{ $t('pages.management.actions') }}</h3>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="canEdit"
                icon="i-heroicons-pencil"
                color="warning"
                :to="`/editions/${edition.id}/edit`"
              >
                {{ $t('pages.management.edit_edition') }}
              </UButton>
              <UButton
                v-if="edition.isOnline"
                :icon="'i-heroicons-eye-slash'"
                color="gray"
                variant="soft"
                @click="toggleOnlineStatus(false)"
              >
                {{ $t('editions.set_offline') }}
              </UButton>
              <UButton
                v-else
                :icon="'i-heroicons-globe-alt'"
                color="primary"
                @click="toggleOnlineStatus(true)"
              >
                {{ $t('editions.set_online') }}
              </UButton>
              <UButton
                v-if="canDelete"
                icon="i-heroicons-trash"
                color="error"
                variant="soft"
                @click="deleteEdition(edition.id)"
              >
                {{ $t('pages.management.delete_edition') }}
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Gestion des bénévoles -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-users" class="text-primary-500" />
              <h3 class="text-lg font-semibold">
                {{ $t('pages.management.volunteer_management') }}
              </h3>
            </div>

            <div
              class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <div class="flex items-start gap-3">
                <UIcon
                  name="i-heroicons-information-circle"
                  class="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                  size="20"
                />
                <div class="space-y-2">
                  <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {{ $t('pages.management.upcoming_feature') }}
                  </h4>
                  <p class="text-sm text-blue-800 dark:text-blue-200">
                    {{ $t('pages.management.volunteer_description') }}
                  </p>
                  <div class="mt-3">
                    <UBadge color="info" variant="soft">{{
                      $t('pages.management.in_development')
                    }}</UBadge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Objets trouvés -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-magnifying-glass" class="text-amber-500" />
                <h3 class="text-lg font-semibold">{{ $t('editions.lost_found') }}</h3>
              </div>
              <UButton
                v-if="isEditionFinished"
                size="sm"
                color="amber"
                variant="soft"
                icon="i-heroicons-arrow-right"
                :to="`/editions/${edition.id}/objets-trouves`"
              >
                {{ $t('pages.management.manage') }}
              </UButton>
            </div>

            <div
              v-if="!isEditionFinished"
              class="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg border border-gray-200 dark:border-gray-800"
            >
              <div class="flex items-start gap-3">
                <UIcon
                  name="i-heroicons-clock"
                  class="text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5"
                  size="20"
                />
                <div class="space-y-2">
                  <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ $t('pages.management.available_after_event') }}
                  </h4>
                  <p class="text-sm text-gray-700 dark:text-gray-300">
                    {{ $t('pages.management.lost_found_after_description') }}
                  </p>
                </div>
              </div>
            </div>

            <div
              v-else
              class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800"
            >
              <div class="flex items-start gap-3">
                <UIcon
                  name="i-heroicons-magnifying-glass"
                  class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                  size="20"
                />
                <div class="space-y-2">
                  <h4 class="text-sm font-medium text-amber-900 dark:text-amber-100">
                    {{ $t('pages.management.manage_lost_found') }}
                  </h4>
                  <p class="text-sm text-amber-800 dark:text-amber-200">
                    {{ $t('pages.management.lost_found_active_description') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'

import EditionHeader from '~/components/edition/EditionHeader.vue'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

// TODO: Ajouter le middleware d'authentification plus tard
// definePageMeta({
//   middleware: 'auth-protected'
// });

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId)
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
})

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return canEdit.value || authStore.user?.id === edition.value?.creatorId
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canDelete = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canDeleteEdition(edition.value, authStore.user.id)
})

// Vérifier si l'édition est terminée
const isEditionFinished = computed(() => {
  if (!edition.value) return false
  return new Date() > new Date(edition.value.endDate)
})

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy.some((u) => u.id === authStore.user?.id)
})

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
    toast.add({
      title: t('messages.favorite_status_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: unknown) {
    toast.add({
      title: e.statusMessage || t('errors.favorite_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

const deleteEdition = async (id: number) => {
  if (confirm(t('pages.access_denied.confirm_delete_edition'))) {
    try {
      await editionStore.deleteEdition(id)
      toast.add({
        title: t('messages.edition_deleted'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      router.push('/')
    } catch (e: unknown) {
      toast.add({
        title: e.statusMessage || t('errors.edition_deletion_failed'),
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  }
}

const toggleOnlineStatus = async (isOnline: boolean) => {
  if (!edition.value) return

  try {
    await $fetch(`/api/editions/${edition.value.id}/status`, {
      method: 'PATCH',
      body: { isOnline },
    })

    // Update local state
    await editionStore.fetchEditionById(editionId)

    const message = isOnline ? t('editions.edition_published') : t('editions.edition_set_offline')
    toast.add({
      title: message,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error) {
    console.error('Failed to toggle edition status:', error)
    toast.add({
      title: t('errors.status_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}
</script>
