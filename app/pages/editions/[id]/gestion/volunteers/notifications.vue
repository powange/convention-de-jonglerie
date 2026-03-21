<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
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

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-bell" class="text-yellow-600 dark:text-yellow-400" />
          {{ t('edition.volunteers.notifications') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ t('edition.volunteers.notifications_description') }}
        </p>
      </div>

      <!-- Contenu des notifications bénévoles -->
      <div class="space-y-6">
        <!-- Message si aucun bénévole accepté -->
        <UCard v-if="acceptedCount === 0 && (canManageVolunteers || isTeamLeaderValue)">
          <div class="text-center py-12">
            <UIcon name="i-heroicons-user-group" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 class="text-xl font-semibold mb-2">
              {{ $t('edition.volunteers.no_accepted_volunteers_title') }}
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              {{ $t('edition.volunteers.no_accepted_volunteers_description') }}
            </p>
          </div>
        </UCard>

        <template v-else-if="canManageVolunteers || isTeamLeaderValue">
          <!-- Notifier les bénévoles de leurs créneaux -->
          <UCard v-if="canManageVolunteers && volunteersMode === 'INTERNAL'">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-bell" class="text-orange-500" />
                <h2 class="text-lg font-semibold">
                  {{ $t('edition.volunteers.notify_volunteers_slots') }}
                </h2>
              </div>
            </template>

            <div class="space-y-4">
              <UAlert
                icon="i-heroicons-information-circle"
                color="info"
                variant="soft"
                :description="t('edition.volunteers.notify_slots_description')"
              />

              <UButton
                color="primary"
                icon="i-heroicons-bell"
                :loading="sendingNotifications"
                @click="showNotifyModal = true"
              >
                {{ t('edition.volunteers.notify_all_accepted') }}
              </UButton>
            </div>
          </UCard>

          <!-- Section notification des bénévoles -->
          <UCard>
            <div class="space-y-4">
              <UAlert
                v-if="canManageVolunteers"
                icon="i-heroicons-information-circle"
                color="info"
                variant="soft"
                :description="t('edition.volunteers.notifications_info_admin')"
              />
              <UAlert
                v-else-if="isTeamLeaderValue"
                icon="i-heroicons-information-circle"
                color="info"
                variant="soft"
                :description="t('edition.volunteers.notifications_info_leader')"
              />

              <EditionVolunteerNotifications
                ref="notificationsListRef"
                :edition-id="editionId"
                :edition="edition"
                :volunteers-info="volunteersInfo"
                :can-manage-volunteers="canManageVolunteers"
                :is-team-leader="isTeamLeaderValue"
                :accepted-volunteers-count="acceptedCount"
              />
            </div>
          </UCard>
        </template>

        <!-- Message si pas les permissions -->
        <UCard v-else>
          <div class="text-center py-12">
            <UIcon name="i-heroicons-lock-closed" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 class="text-xl font-semibold mb-2">
              {{ $t('edition.volunteers.restricted_access') }}
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              {{ $t('edition.volunteers.restricted_access_description') }}
            </p>
          </div>
        </UCard>
      </div>

      <!-- Modal de confirmation pour l'envoi des notifications -->
      <UModal v-model:open="showNotifyModal" :title="t('edition.volunteers.notify_confirm_title')">
        <template #body>
          <div class="space-y-4">
            <UAlert
              icon="i-heroicons-exclamation-triangle"
              color="warning"
              variant="soft"
              :title="t('common.warning')"
              :description="t('edition.volunteers.notify_confirm_warning')"
            />
            <p class="text-gray-600 dark:text-gray-400">
              {{ t('edition.volunteers.notify_confirm_action') }}
            </p>
            <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
              <li>{{ t('edition.volunteers.notify_confirm_item_notification') }}</li>
              <li>{{ t('edition.volunteers.notify_confirm_item_email') }}</li>
              <li>{{ t('edition.volunteers.notify_confirm_item_link') }}</li>
            </ul>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('edition.volunteers.notify_confirm_note') }}
            </p>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton variant="outline" @click="showNotifyModal = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              icon="i-heroicons-bell"
              :loading="sendingNotifications"
              @click="sendScheduleNotifications"
            >
              {{ t('edition.volunteers.notify_confirm_send') }}
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVolunteerSettings } from '~/composables/useVolunteerSettings'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Utiliser le composable pour les paramètres des bénévoles
const { settings: volunteersInfo, fetchSettings: fetchVolunteersInfo } =
  useVolunteerSettings(editionId)

// Référence au composant de notifications
const notificationsListRef = ref()

// État pour vérifier si l'utilisateur est team leader
const isTeamLeaderValue = ref(false)

// Mode des bénévoles
const volunteersMode = computed(() => volunteersInfo.value?.mode || 'INTERNAL')

// Nombre de bénévoles acceptés
const acceptedCount = computed(() => volunteersInfo.value?.counts?.ACCEPTED ?? 0)

// Variables pour l'envoi des notifications de créneaux
const showNotifyModal = ref(false)

const { execute: sendScheduleNotifications, loading: sendingNotifications } = useApiAction(
  () => `/api/editions/${editionId}/volunteers/notify-schedules`,
  {
    method: 'POST',
    successMessage: {
      title: t('common.success'),
      description: t('edition.volunteers.notifications_sent_success'),
    },
    errorMessages: { default: t('edition.volunteers.notifications_sent_error') },
    onSuccess: () => {
      showNotifyModal.value = false
    },
  }
)

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return (
    canEdit.value ||
    canManageVolunteers.value ||
    isTeamLeaderValue.value ||
    authStore.user?.id === edition.value?.creatorId
  )
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  // Charger les informations des bénévoles
  await fetchVolunteersInfo()

  // Vérifier si l'utilisateur est team leader
  if (authStore.user?.id) {
    isTeamLeaderValue.value = await editionStore.isTeamLeader(editionId)
  }
})

// Métadonnées de la page
useSeoMeta({
  title: 'Notifications bénévoles - ' + (edition.value?.name || 'Édition'),
  description: 'Envoi et gestion des notifications aux bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
