<template>
  <div class="mb-6">
    <!-- Titre et bouton ajouter -->
    <div class="flex items-center justify-between mb-4">
      <h4 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <UIcon name="i-heroicons-calendar-days" class="text-primary-500" size="20" />
        {{ $t('conventions.editions') }} ({{ editions.length }})
      </h4>
      <UButton
        v-if="canAddEdition"
        size="sm"
        variant="outline"
        icon="i-heroicons-plus"
        :to="`/conventions/${convention.id}/editions/add`"
      >
        {{ $t('conventions.add_edition') }}
      </UButton>
    </div>

    <!-- Grille d'éditions -->
    <div v-if="editions.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <EditionCard v-for="edition in editions" :key="edition.id" :edition="edition" show-status>
        <template #actions="{ edition: ed }">
          <UDropdownMenu :items="getEditionActions(ed)">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-ellipsis-horizontal"
              size="xs"
            />
          </UDropdownMenu>
        </template>

        <template #footer-actions="{ edition: ed }">
          <div class="flex items-center justify-between w-full">
            <!-- Compteurs -->
            <div class="flex items-center gap-3 text-sm text-gray-500">
              <span
                v-if="getVolunteersCount(ed) > 0"
                class="flex items-center gap-1"
                :title="t('edition.volunteers.title')"
              >
                <UIcon name="i-heroicons-hand-raised" class="text-primary-600" size="16" />
                {{ getVolunteersCount(ed) }}
              </span>
              <span
                v-if="getArtistsCount(ed) > 0"
                class="flex items-center gap-1"
                :title="t('edition.artists.title')"
              >
                <UIcon name="i-heroicons-star" class="text-amber-500" size="16" />
                {{ getArtistsCount(ed) }}
              </span>
              <span
                v-if="getOrganizersCount(ed) > 0"
                class="flex items-center gap-1"
                :title="t('conventions.organizers')"
              >
                <UIcon name="i-heroicons-shield-check" class="text-indigo-500" size="16" />
                {{ getOrganizersCount(ed) }}
              </span>
              <span
                v-if="getParticipantsCount(ed) > 0"
                class="flex items-center gap-1"
                :title="t('common.participants')"
              >
                <UIcon name="i-heroicons-ticket" class="text-success-600" size="16" />
                {{ getParticipantsCount(ed) }}
              </span>
            </div>
            <!-- Actions -->
            <div class="flex items-center gap-2">
              <USelect
                v-if="canEditEdition(ed.id)"
                :model-value="ed.status"
                :items="statusOptions"
                value-key="value"
                size="xs"
                :ui="{ content: 'min-w-fit' }"
                @update:model-value="
                  emit(
                    'statusChange',
                    ed.id,
                    $event as 'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'
                  )
                "
              />
              <NuxtLink :to="`/editions/${ed.id}`">
                <UButton
                  icon="i-heroicons-eye"
                  size="sm"
                  color="info"
                  variant="solid"
                  :label="t('common.view')"
                />
              </NuxtLink>
            </div>
          </div>
        </template>
      </EditionCard>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <UIcon name="i-heroicons-calendar-days" class="mx-auto h-10 w-10 text-gray-400 mb-3" />
      <p class="text-sm text-gray-500">{{ $t('conventions.no_editions') }}</p>
      <UButton
        v-if="canAddEdition"
        class="mt-3"
        size="sm"
        variant="soft"
        icon="i-heroicons-plus"
        :to="`/conventions/${convention.id}/editions/add`"
      >
        {{ $t('conventions.add_edition') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type {
  ConventionListItem,
  DashboardEdition,
  DashboardOrganizer,
  DashboardPerEditionPermission,
} from '~/types'

interface ConventionWithOrganizers extends ConventionListItem {
  organizers?: DashboardOrganizer[]
}

interface Props {
  editions: DashboardEdition[]
  convention: ConventionWithOrganizers
  canAddEdition: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (
    e: 'statusChange',
    editionId: number,
    status: 'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'
  ): void
  (e: 'delete' | 'duplicate', editionId: number): void
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const { statusOptions } = useEditionStatus()

// Helpers de droits
function findCurrentCollab(): DashboardOrganizer | undefined {
  const uid = authStore.user?.id
  if (!uid) return undefined
  return props.convention.organizers?.find((c) => c.user.id === uid)
}

const hasFullAccess = () =>
  !!(
    (authStore.user?.id &&
      props.convention.authorId &&
      props.convention.authorId === authStore.user.id) ||
    authStore.isAdminModeActive
  )

const canEditEdition = (editionId: number) => {
  if (hasFullAccess()) return true
  const collab = findCurrentCollab()
  if (!collab) return false
  if (collab.rights?.editAllEditions) return true
  return collab.perEdition?.some(
    (p: DashboardPerEditionPermission) => p.editionId === editionId && p.canEdit
  )
}

const canDeleteEdition = (editionId: number) => {
  if (hasFullAccess()) return true
  const collab = findCurrentCollab()
  if (!collab) return false
  if (collab.rights?.deleteAllEditions) return true
  return collab.perEdition?.some(
    (p: DashboardPerEditionPermission) => p.editionId === editionId && p.canDelete
  )
}

// Compteurs
const getVolunteersCount = (edition: DashboardEdition) => edition._count?.volunteerApplications ?? 0

const getArtistsCount = (edition: DashboardEdition) => edition._count?.artists ?? 0

const getOrganizersCount = (edition: DashboardEdition) => edition._count?.editionOrganizers ?? 0

const getParticipantsCount = (edition: DashboardEdition) =>
  edition._count?.ticketingParticipants ?? 0

// Actions pour chaque édition
const getEditionActions = (edition: DashboardEdition) => {
  const actions: {
    label: string
    icon: string
    to?: string
    color?: 'error'
    onSelect?: () => void
  }[] = [
    {
      label: t('common.view'),
      icon: 'i-heroicons-eye',
      to: `/editions/${edition.id}`,
    },
  ]

  if (canEditEdition(edition.id)) {
    actions.push({
      label: t('common.edit'),
      icon: 'i-heroicons-pencil',
      to: `/editions/${edition.id}/edit`,
    })
    actions.push({
      label: t('common.manage'),
      icon: 'i-heroicons-cog-6-tooth',
      to: `/editions/${edition.id}/gestion`,
    })
  }

  if (canEditEdition(edition.id) && props.canAddEdition) {
    actions.push({
      label: t('conventions.duplicate_edition'),
      icon: 'i-heroicons-document-duplicate',
      onSelect: () => emit('duplicate', edition.id),
    })
  }

  if (canDeleteEdition(edition.id)) {
    actions.push({
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => emit('delete', edition.id),
    })
  }

  return [actions]
}
</script>
