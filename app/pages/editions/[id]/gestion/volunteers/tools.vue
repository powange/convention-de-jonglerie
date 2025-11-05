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
          <UIcon name="i-heroicons-wrench-screwdriver" class="text-gray-600 dark:text-gray-400" />
          Outils de gestion
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Outils avancés pour la gestion des bénévoles
        </p>
      </div>

      <!-- Contenu des outils de gestion -->
      <div class="space-y-6">
        <!-- Outils disponibles si on peut gérer les bénévoles -->
        <div v-if="volunteersMode === 'INTERNAL'" class="space-y-6">
          <!-- Notifier les bénévoles de leurs créneaux -->
          <UCard>
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
                description="Envoyez une notification et un email à tous les bénévoles acceptés pour les informer que leurs créneaux sont disponibles."
              />

              <UButton
                color="primary"
                icon="i-heroicons-bell"
                :loading="sendingNotifications"
                @click="showNotifyModal = true"
              >
                Notifier tous les bénévoles acceptés
              </UButton>
            </div>
          </UCard>
        </div>

        <!-- Message si pas les permissions ou pas en mode interne -->
        <UCard v-else>
          <div class="text-center py-12">
            <UIcon
              name="i-heroicons-wrench-screwdriver"
              class="h-16 w-16 text-gray-400 mx-auto mb-4"
            />
            <h2 class="text-xl font-semibold mb-2">Outils de gestion</h2>
            <p class="text-gray-600 dark:text-gray-400 mb-2">
              <template v-if="!canManageVolunteers">
                Vous n'avez pas les permissions nécessaires pour accéder aux outils de gestion des
                bénévoles.
              </template>
              <template v-else-if="volunteersMode !== 'INTERNAL'">
                Les outils de gestion sont disponibles uniquement en mode interne.
              </template>
            </p>
            <p v-if="volunteersMode !== 'INTERNAL'" class="text-sm text-gray-500">
              Changez le mode de gestion dans la page de gestion principale.
            </p>
          </div>
        </UCard>
      </div>

      <!-- Modal de confirmation pour l'envoi des notifications -->
      <UModal v-model:open="showNotifyModal" title="Confirmer l'envoi des notifications">
        <template #body>
          <div class="space-y-4">
            <UAlert
              icon="i-heroicons-exclamation-triangle"
              color="warning"
              variant="soft"
              title="Attention"
              description="Vous allez envoyer une notification et un email à tous les bénévoles acceptés pour les informer que leurs créneaux sont disponibles."
            />
            <p class="text-gray-600 dark:text-gray-400">Cette action enverra :</p>
            <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
              <li>Une notification dans l'application</li>
              <li>Un email récapitulatif avec tous les créneaux assignés</li>
              <li>Un lien vers la page "Mes candidatures"</li>
            </ul>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Les bénévoles recevront uniquement les créneaux qui leur ont été assignés.
            </p>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton variant="outline" @click="showNotifyModal = false"> Annuler </UButton>
            <UButton
              color="primary"
              icon="i-heroicons-bell"
              :loading="sendingNotifications"
              @click="sendScheduleNotifications"
            >
              Confirmer l'envoi
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useVolunteerSettings } from '~/composables/useVolunteerSettings'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  layout: 'edition-dashboard',
})

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Utiliser le composable pour les paramètres des bénévoles
const {
  settings: volunteersInfo,
  error: volunteersInfoError,
  fetchSettings: fetchVolunteersInfo,
} = useVolunteerSettings(editionId)

// Mode des bénévoles
const volunteersMode = computed(() => volunteersInfo.value?.mode || 'INTERNAL')

// Variables pour l'envoi des notifications de créneaux
const showNotifyModal = ref(false)
const sendingNotifications = ref(false)

// Fonction pour envoyer les notifications de créneaux aux bénévoles acceptés
const sendScheduleNotifications = async () => {
  sendingNotifications.value = true
  try {
    const result = await $fetch(`/api/editions/${editionId}/volunteers/notify-schedules`, {
      method: 'POST',
    })

    toast.add({
      title: t('common.success'),
      description: result.message || 'Notifications envoyées avec succès',
      color: 'success',
    })

    showNotifyModal.value = false
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description:
        error?.data?.message || error?.message || "Erreur lors de l'envoi des notifications",
      color: 'error',
    })
  } finally {
    sendingNotifications.value = false
  }
}

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) {
    return true
  }

  // Utilisateurs avec des droits spécifiques
  if (canEdit.value || canManageVolunteers.value) {
    return true
  }

  // Tous les collaborateurs de la convention (même sans droits)
  return editionStore.isCollaborator(edition.value, authStore.user.id)
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

  // Afficher les erreurs de chargement si nécessaire
  if (volunteersInfoError.value) {
    toast.add({
      title: t('common.error'),
      description: volunteersInfoError.value,
      color: 'error',
    })
  }
})

// Métadonnées de la page
useSeoMeta({
  title: 'Outils de gestion - ' + (edition.value?.name || 'Édition'),
  description: 'Outils avancés pour la gestion des bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
