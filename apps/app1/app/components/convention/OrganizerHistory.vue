<template>
  <div class="space-y-3">
    <div v-if="loading" class="text-center py-4">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto" size="24" />
    </div>

    <div
      v-else-if="history.length === 0"
      class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
    >
      <UIcon name="i-heroicons-clock" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
      <p class="text-sm text-gray-500">{{ $t('conventions.history.no_history') }}</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="entry in history"
        :key="entry.id"
        class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div class="flex items-start gap-3">
          <!-- Avatar de l'acteur -->
          <div class="flex-shrink-0">
            <UiUserAvatar v-if="entry.actor" :user="entry.actor" size="sm" />
          </div>

          <!-- Contenu -->
          <div class="flex-1 min-w-0">
            <!-- En-tête : Acteur + Action + Cible -->
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-sm">{{ entry.actor?.pseudo }}</span>
              <span class="text-xs text-gray-500">{{ getActionText(entry.changeType) }}</span>
              <template v-if="entry.targetUser">
                <UiUserAvatar :user="entry.targetUser" size="sm" />
                <span class="font-medium text-sm">{{ entry.targetUser.pseudo }}</span>
              </template>
            </div>

            <!-- Détails des changements -->
            <div
              v-if="
                entry.changeType === 'RIGHTS_UPDATED' || entry.changeType === 'PER_EDITIONS_UPDATED'
              "
              class="mt-1 text-xs text-gray-600 dark:text-gray-400"
            >
              <div v-if="entry.before || entry.after" class="space-y-1">
                <div
                  v-for="change in getPermissionChanges(entry.before, entry.after)"
                  :key="change.key"
                >
                  <span v-if="change.type === 'added'" class="text-green-600 dark:text-green-400">
                    ✓ {{ change.label }}
                  </span>
                  <span
                    v-else-if="change.type === 'removed'"
                    class="text-red-600 dark:text-red-400"
                  >
                    ✗ {{ change.label }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Date -->
            <div class="mt-1 text-xs text-gray-400">
              {{ formatDate(entry.createdAt) }}
            </div>
          </div>

          <!-- Icône de type d'action -->
          <div class="flex-shrink-0">
            <UIcon
              :name="getActionIcon(entry.changeType)"
              :class="getActionColor(entry.changeType)"
              size="16"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Props {
  conventionId: number
}

interface HistoryEntry {
  id: string
  changeType: string
  createdAt: string
  actorId: number
  targetUserId: number | null
  before: any
  after: any
  actor: {
    id: number
    pseudo: string
    email: string
    emailHash: string
    profilePicture: string | null
  } | null
  targetUser: {
    id: number
    pseudo: string
    email: string
    emailHash: string
    profilePicture: string | null
  } | null
}

const props = defineProps<Props>()
const { t } = useI18n()
const { formatDateTime } = useDateFormat()

const history = ref<HistoryEntry[]>([])
const loading = ref(false)

const loadHistory = async () => {
  loading.value = true
  try {
    const data = await $fetch<HistoryEntry[]>(
      `/api/conventions/${props.conventionId}/organizers/history`
    )
    history.value = data || []
  } catch (error) {
    console.error('Failed to load organizer history:', error)
    history.value = []
  } finally {
    loading.value = false
  }
}

const getActionText = (changeType: string) => {
  switch (changeType) {
    case 'CREATED':
      return t('conventions.history.created')
    case 'RIGHTS_UPDATED':
      return t('conventions.history.rights_updated')
    case 'PER_EDITIONS_UPDATED':
      return t('conventions.history.per_editions_updated')
    case 'ARCHIVED':
      return t('conventions.history.archived')
    case 'UNARCHIVED':
      return t('conventions.history.unarchived')
    case 'REMOVED':
      return t('conventions.history.removed')
    default:
      return changeType
  }
}

const getActionIcon = (changeType: string) => {
  switch (changeType) {
    case 'CREATED':
      return 'i-heroicons-plus-circle'
    case 'RIGHTS_UPDATED':
      return 'i-heroicons-pencil-square'
    case 'PER_EDITIONS_UPDATED':
      return 'i-heroicons-calendar-days'
    case 'ARCHIVED':
      return 'i-heroicons-archive-box'
    case 'UNARCHIVED':
      return 'i-heroicons-archive-box-arrow-down'
    case 'REMOVED':
      return 'i-heroicons-trash'
    default:
      return 'i-heroicons-information-circle'
  }
}

const getActionColor = (changeType: string) => {
  switch (changeType) {
    case 'CREATED':
      return 'text-green-500'
    case 'RIGHTS_UPDATED':
      return 'text-blue-500'
    case 'PER_EDITIONS_UPDATED':
      return 'text-indigo-500'
    case 'ARCHIVED':
      return 'text-orange-500'
    case 'UNARCHIVED':
      return 'text-green-500'
    case 'REMOVED':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
}

const getPermissionChanges = (before: any, after: any) => {
  const changes: Array<{ key: string; type: 'added' | 'removed'; label: string }> = []

  const beforeRights = before?.rights || {}
  const afterRights = after?.rights || {}

  // Comparer les droits globaux
  const allKeys = new Set([...Object.keys(beforeRights), ...Object.keys(afterRights)])

  allKeys.forEach((key) => {
    const wasBefore = beforeRights[key] === true
    const isAfter = afterRights[key] === true

    if (wasBefore && !isAfter) {
      // Droit retiré
      const translationKey = key.replace(/^can/, (match) => match.charAt(3).toLowerCase())
      changes.push({
        key,
        type: 'removed',
        label: t(`conventions.permissions.${translationKey}`, translationKey),
      })
    } else if (!wasBefore && isAfter) {
      // Droit ajouté
      const translationKey = key.replace(/^can/, (match) => match.charAt(3).toLowerCase())
      changes.push({
        key,
        type: 'added',
        label: t(`conventions.permissions.${translationKey}`, translationKey),
      })
    }
  })

  // Comparer les droits par édition
  const beforePerEdition = before?.perEdition || []
  const afterPerEdition = after?.perEdition || []

  // Créer des maps pour faciliter la comparaison
  const beforeMap = new Map(beforePerEdition.map((p: any) => [p.editionId, p]))
  const afterMap = new Map(afterPerEdition.map((p: any) => [p.editionId, p]))

  // Trouver toutes les éditions concernées
  const allEditionIds = new Set([...beforeMap.keys(), ...afterMap.keys()])

  allEditionIds.forEach((editionId) => {
    const beforePerms = beforeMap.get(editionId) as any
    const afterPerms = afterMap.get(editionId) as any

    // Si l'édition n'existait pas avant
    if (!beforePerms && afterPerms) {
      if (afterPerms.canEdit) {
        changes.push({
          key: `perEdition-${editionId}-canEdit`,
          type: 'added',
          label: `${t('gestion.organizers.per_edition_rights')} (Édition ${editionId}) - ${t('gestion.organizers.can_edit')}`,
        })
      }
      if (afterPerms.canDelete) {
        changes.push({
          key: `perEdition-${editionId}-canDelete`,
          type: 'added',
          label: `${t('gestion.organizers.per_edition_rights')} (Édition ${editionId}) - ${t('gestion.organizers.can_delete')}`,
        })
      }
      if (afterPerms.canManageVolunteers) {
        changes.push({
          key: `perEdition-${editionId}-canManageVolunteers`,
          type: 'added',
          label: `${t('gestion.organizers.per_edition_rights')} (Édition ${editionId}) - ${t('gestion.organizers.can_manage_volunteers')}`,
        })
      }
    }
    // Si l'édition n'existe plus après
    else if (beforePerms && !afterPerms) {
      if (beforePerms.canEdit) {
        changes.push({
          key: `perEdition-${editionId}-canEdit`,
          type: 'removed',
          label: `${t('gestion.organizers.per_edition_rights')} (Édition ${editionId}) - ${t('gestion.organizers.can_edit')}`,
        })
      }
      if (beforePerms.canDelete) {
        changes.push({
          key: `perEdition-${editionId}-canDelete`,
          type: 'removed',
          label: `${t('gestion.organizers.per_edition_rights')} (Édition ${editionId}) - ${t('gestion.organizers.can_delete')}`,
        })
      }
      if (beforePerms.canManageVolunteers) {
        changes.push({
          key: `perEdition-${editionId}-canManageVolunteers`,
          type: 'removed',
          label: `${t('gestion.organizers.per_edition_rights')} (Édition ${editionId}) - ${t('gestion.organizers.can_manage_volunteers')}`,
        })
      }
    }
    // Si l'édition existait avant et après, comparer les droits
    else if (beforePerms && afterPerms) {
      if (beforePerms.canEdit !== afterPerms.canEdit) {
        changes.push({
          key: `perEdition-${editionId}-canEdit`,
          type: afterPerms.canEdit ? 'added' : 'removed',
          label: `${t('gestion.organizers.per_edition_rights')} (Édition ${editionId}) - ${t('gestion.organizers.can_edit')}`,
        })
      }
      if (beforePerms.canDelete !== afterPerms.canDelete) {
        changes.push({
          key: `perEdition-${editionId}-canDelete`,
          type: afterPerms.canDelete ? 'added' : 'removed',
          label: `${t('gestion.organizers.per_edition_rights')} (Édition ${editionId}) - ${t('gestion.organizers.can_delete')}`,
        })
      }
      if (beforePerms.canManageVolunteers !== afterPerms.canManageVolunteers) {
        changes.push({
          key: `perEdition-${editionId}-canManageVolunteers`,
          type: afterPerms.canManageVolunteers ? 'added' : 'removed',
          label: `${t('gestion.organizers.per_edition_rights')} (Édition ${editionId}) - ${t('gestion.organizers.can_manage_volunteers')}`,
        })
      }
    }
  })

  return changes
}

const formatDate = (date: string) => {
  return formatDateTime(date)
}

onMounted(() => {
  loadHistory()
})

// Exposer la fonction pour recharger l'historique depuis le parent
defineExpose({
  loadHistory,
})
</script>
