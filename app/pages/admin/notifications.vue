<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" :aria-label="$t('navigation.breadcrumb')">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">{{
              $t('admin.notification_management')
            }}</span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-bell" class="text-yellow-600" />
        {{ $t('admin.notification_management') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        Envoyer et gérer les notifications système
      </p>
    </div>

    <!-- Actions rapides -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <!-- Envoyer des rappels -->
      <UCard>
        <div class="text-center p-6">
          <div
            class="mx-auto mb-4 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center"
          >
            <UIcon name="i-heroicons-clock" class="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 class="text-lg font-semibold mb-2">{{ $t('admin.event_reminders') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Envoyer des rappels pour les événements à venir
          </p>
          <UButton :loading="sendingReminders" @click="sendReminders">
            Envoyer les rappels
          </UButton>
        </div>
      </UCard>

      <!-- Créer une notification -->
      <UCard>
        <div class="text-center p-6">
          <div
            class="mx-auto mb-4 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
          >
            <UIcon
              name="i-heroicons-paper-airplane"
              class="h-6 w-6 text-green-600 dark:text-green-400"
            />
          </div>
          <h3 class="text-lg font-semibold mb-2">{{ $t('admin.new_notification') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Envoyer une notification personnalisée
          </p>
          <UButton variant="outline" @click="showCreateModal = true">
            Créer une notification
          </UButton>
        </div>
      </UCard>

      <!-- Tester le système -->
      <UCard>
        <div class="text-center p-6">
          <div
            class="mx-auto mb-4 w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center"
          >
            <UIcon name="i-heroicons-beaker" class="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 class="text-lg font-semibold mb-2">{{ $t('admin.test_debug') }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Tester les différents types de notifications
          </p>
          <UButton variant="outline" color="purple" @click="showTestModal = true">
            {{ $t('admin.test') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Statistiques -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.total_sent') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats?.totalSent || 0 }}
            </p>
          </div>
          <UIcon name="i-heroicons-paper-airplane" class="h-8 w-8 text-blue-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('notifications.unread') }}
            </p>
            <p class="text-2xl font-bold text-red-600">
              {{ stats?.totalUnread || 0 }}
            </p>
          </div>
          <UIcon name="i-heroicons-bell-alert" class="h-8 w-8 text-red-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.today') }}
            </p>
            <p class="text-2xl font-bold text-green-600">
              {{ stats?.sentToday || 0 }}
            </p>
          </div>
          <UIcon name="i-heroicons-calendar-days" class="h-8 w-8 text-green-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.active_types') }}
            </p>
            <p class="text-2xl font-bold text-purple-600">
              {{ stats?.activeTypes || 0 }}
            </p>
          </div>
          <UIcon name="i-heroicons-squares-2x2" class="h-8 w-8 text-purple-500" />
        </div>
      </UCard>
    </div>

    <!-- Notifications récentes -->
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold">{{ $t('admin.recent_notifications') }}</h3>
          <UButton
            icon="i-heroicons-arrow-path"
            variant="ghost"
            size="sm"
            :loading="loadingRecent"
            @click="loadRecentNotifications"
          >
            Actualiser
          </UButton>
        </div>
      </template>

      <div v-if="loadingRecent" class="py-8 text-center">
        <UIcon
          name="i-heroicons-arrow-path"
          class="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400"
        />
        <p class="text-sm text-gray-500">Chargement...</p>
      </div>

      <div v-else-if="recentNotifications.length === 0" class="py-8 text-center">
        <UIcon name="i-heroicons-bell-slash" class="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p class="text-sm text-gray-500">Aucune notification récente</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="notification in recentNotifications"
          :key="notification.id"
          class="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <UIcon
            :name="getNotificationIcon(notification.type)"
            :class="getNotificationIconColor(notification.type)"
            class="h-5 w-5 mt-0.5 flex-shrink-0"
          />

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ notification.title }}
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ notification.message }}
                </p>
                <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{{ formatDateTime(notification.createdAt) }}</span>
                  <span v-if="notification.user"> Pour: {{ notification.user.pseudo }} </span>
                  <UBadge
                    :color="
                      notification.type === 'ERROR'
                        ? 'red'
                        : notification.type === 'SUCCESS'
                          ? 'green'
                          : notification.type === 'WARNING'
                            ? 'yellow'
                            : 'blue'
                    "
                    variant="soft"
                    size="xs"
                  >
                    {{ notification.type }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Modal de création de notification -->
    <UModal v-model:open="showCreateModal" class="z-50">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">Créer une notification</h3>
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                @click="showCreateModal = false"
              />
            </div>
          </template>

          <UForm
            :schema="createNotificationSchema"
            :state="createForm"
            @submit="createNotification"
          >
            <div class="space-y-4">
              <UFormField
                label="Utilisateur cible"
                name="userId"
                description="Laisser vide pour envoyer à votre propre compte (test)"
              >
                <UInput
                  v-model="createForm.userId"
                  type="number"
                  placeholder="ID de l'utilisateur (optionnel)"
                />
              </UFormField>

              <UFormField label="Type" name="type" required>
                <USelectMenu
                  v-model="createForm.type"
                  :options="notificationTypes"
                  placeholder="Sélectionnez un type"
                />
              </UFormField>

              <UFormField label="Titre" name="title" required>
                <UInput v-model="createForm.title" placeholder="Titre de la notification" />
              </UFormField>

              <UFormField label="Message" name="message" required>
                <UTextarea
                  v-model="createForm.message"
                  placeholder="Contenu de la notification"
                  :rows="4"
                />
              </UFormField>

              <UFormField label="Catégorie" name="category">
                <USelectMenu
                  v-model="createForm.category"
                  :options="categoryOptions"
                  placeholder="Sélectionnez une catégorie"
                />
              </UFormField>

              <UFormField label="URL d'action" name="actionUrl">
                <UInput
                  v-model="createForm.actionUrl"
                  placeholder="URL de redirection (optionnel)"
                />
              </UFormField>

              <UFormField label="Texte du bouton" name="actionText">
                <UInput
                  v-model="createForm.actionText"
                  placeholder="Texte du bouton d'action (optionnel)"
                />
              </UFormField>
            </div>

            <template #footer>
              <div class="flex justify-end gap-3">
                <UButton variant="ghost" @click="showCreateModal = false"> Annuler </UButton>
                <UButton type="submit" :loading="creatingNotification"> Envoyer </UButton>
              </div>
            </template>
          </UForm>
        </UCard>
      </template>
    </UModal>

    <!-- Modal de test -->
    <UModal v-model:open="showTestModal" class="z-50">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">Tester les notifications</h3>
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                @click="showTestModal = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Choisissez un type de notification à tester :
            </p>

            <div class="grid grid-cols-2 gap-3">
              <UButton
                v-for="testType in testTypes"
                :key="testType.value"
                variant="outline"
                class="justify-start"
                :loading="testingType === testType.value"
                @click="testNotification(testType.value)"
              >
                <UIcon :name="testType.icon" class="mr-2" />
                {{ testType.label }}
              </UButton>
            </div>
          </div>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'

// Protection admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

useSeoMeta({
  title: 'Gestion des Notifications - Administration',
  description: 'Envoyer et gérer les notifications système',
})

const toast = useToast()

// État réactif
const sendingReminders = ref(false)
const showCreateModal = ref(false)
const showTestModal = ref(false)
const creatingNotification = ref(false)
const testingType = ref('')
const loadingRecent = ref(false)

const stats = ref(null)
const recentNotifications = ref([])

// Formulaire de création
const createNotificationSchema = z.object({
  userId: z.number().int().positive().optional(),
  type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  category: z.string().optional(),
  actionUrl: z.string().url().optional().or(z.literal('')),
  actionText: z.string().max(50).optional(),
})

const createForm = reactive({
  userId: null,
  type: '',
  title: '',
  message: '',
  category: '',
  actionUrl: '',
  actionText: '',
})

// Options
const notificationTypes = [
  { label: 'Information', value: 'INFO' },
  { label: 'Succès', value: 'SUCCESS' },
  { label: 'Avertissement', value: 'WARNING' },
  { label: 'Erreur', value: 'ERROR' },
]

const categoryOptions = [
  { label: 'Système', value: 'system' },
  { label: 'Édition', value: 'edition' },
  { label: 'Bénévolat', value: 'volunteer' },
  { label: 'Autre', value: 'other' },
]

const testTypes = [
  { label: 'Bienvenue', value: 'welcome', icon: 'i-heroicons-hand-raised' },
  { label: 'Bénévole accepté', value: 'volunteer-accepted', icon: 'i-heroicons-check-circle' },
  { label: 'Bénévole refusé', value: 'volunteer-rejected', icon: 'i-heroicons-x-circle' },
  { label: "Rappel d'événement", value: 'event-reminder', icon: 'i-heroicons-clock' },
  { label: 'Erreur système', value: 'system-error', icon: 'i-heroicons-exclamation-triangle' },
  { label: 'Personnalisée', value: 'custom', icon: 'i-heroicons-cog-6-tooth' },
]

// Méthodes utilitaires
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'SUCCESS':
      return 'i-heroicons-check-circle'
    case 'WARNING':
      return 'i-heroicons-exclamation-triangle'
    case 'ERROR':
      return 'i-heroicons-x-circle'
    default:
      return 'i-heroicons-information-circle'
  }
}

const getNotificationIconColor = (type: string) => {
  switch (type) {
    case 'SUCCESS':
      return 'text-green-500'
    case 'WARNING':
      return 'text-yellow-500'
    case 'ERROR':
      return 'text-red-500'
    default:
      return 'text-blue-500'
  }
}

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Actions
const sendReminders = async () => {
  sendingReminders.value = true
  try {
    const response = await $fetch('/api/admin/notifications/send-reminders', {
      method: 'POST',
    })

    toast.add({
      color: 'green',
      title: 'Rappels envoyés',
      description: response.message,
    })

    await loadStats()
    await loadRecentNotifications()
  } catch {
    toast.add({
      color: 'red',
      title: 'Erreur',
      description: "Impossible d'envoyer les rappels",
    })
  } finally {
    sendingReminders.value = false
  }
}

const createNotification = async () => {
  creatingNotification.value = true
  try {
    const response = await $fetch('/api/admin/notifications/create', {
      method: 'POST',
      body: {
        userId: createForm.userId || undefined,
        type: createForm.type,
        title: createForm.title,
        message: createForm.message,
        category: createForm.category || undefined,
        actionUrl: createForm.actionUrl || undefined,
        actionText: createForm.actionText || undefined,
      },
    })

    toast.add({
      color: 'green',
      title: 'Notification envoyée',
      description: response.message,
    })

    showCreateModal.value = false
    resetCreateForm()
    await loadStats()
    await loadRecentNotifications()
  } catch (error) {
    toast.add({
      color: 'red',
      title: 'Erreur',
      description: error.data?.message || "Impossible d'envoyer la notification",
    })
  } finally {
    creatingNotification.value = false
  }
}

const testNotification = async (type: string) => {
  testingType.value = type
  try {
    const response = await $fetch('/api/admin/notifications/test', {
      method: 'POST',
      body: { type },
    })

    toast.add({
      color: 'green',
      title: 'Test envoyé',
      description: response.message,
    })

    await loadStats()
    await loadRecentNotifications()
  } catch {
    toast.add({
      color: 'red',
      title: 'Erreur',
      description: "Impossible d'envoyer le test",
    })
  } finally {
    testingType.value = ''
  }
}

const resetCreateForm = () => {
  Object.assign(createForm, {
    userId: null,
    type: '',
    title: '',
    message: '',
    category: '',
    actionUrl: '',
    actionText: '',
  })
}

const loadStats = async () => {
  try {
    // Simuler des statistiques pour l'instant
    stats.value = {
      totalSent: 127,
      totalUnread: 23,
      sentToday: 8,
      activeTypes: 4,
    }
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error)
  }
}

const loadRecentNotifications = async () => {
  loadingRecent.value = true
  try {
    // Pour l'instant, simuler des notifications récentes
    // Plus tard, on pourra créer une API dédiée
    recentNotifications.value = []
  } catch (error) {
    console.error('Erreur lors du chargement des notifications récentes:', error)
  } finally {
    loadingRecent.value = false
  }
}

// Initialisation
onMounted(async () => {
  await Promise.all([loadStats(), loadRecentNotifications()])
})
</script>
