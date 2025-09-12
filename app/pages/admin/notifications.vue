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
          <UButton variant="outline" color="primary" @click="showTestModal = true">
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
                        ? 'error'
                        : notification.type === 'SUCCESS'
                          ? 'success'
                          : notification.type === 'WARNING'
                            ? 'warning'
                            : 'primary'
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
    <UModal v-model:open="showCreateModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20"
                >
                  <UIcon name="i-heroicons-plus-circle" class="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    Nouvelle notification
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Créez et envoyez une notification personnalisée
                  </p>
                </div>
              </div>
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="showCreateModal = false"
              />
            </div>
          </template>

          <UForm
            :schema="createNotificationSchema"
            :state="createForm"
            class="space-y-5"
            @submit="createNotification"
          >
            <!-- Type et Catégorie -->
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Type de notification" name="type" required>
                <USelect
                  v-model="createForm.type"
                  :items="notificationTypes"
                  placeholder="Choisir le type..."
                  icon="i-heroicons-tag"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Catégorie" name="category">
                <USelect
                  v-model="createForm.category"
                  :items="categoryOptions"
                  placeholder="Choisir une catégorie..."
                  icon="i-heroicons-folder"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- Destinataire -->
            <UFormField
              label="ID Utilisateur (optionnel)"
              name="userId"
              description="Laissez vide pour vous l'envoyer (test)"
            >
              <UInput
                v-model="createForm.userId"
                type="number"
                placeholder="Ex: 123"
                icon="i-heroicons-user"
              />
            </UFormField>

            <UDivider />

            <!-- Contenu -->
            <UFormField label="Titre" name="title" required>
              <UInput
                v-model="createForm.title"
                placeholder="Ex: Nouvelle convention disponible"
                icon="i-heroicons-megaphone"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Message" name="message" required>
              <UTextarea
                v-model="createForm.message"
                placeholder="Décrivez le contenu de votre notification..."
                :rows="4"
                class="w-full"
              />
            </UFormField>

            <!-- Action optionnelle -->
            <div class="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p
                class="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1"
              >
                <UIcon name="i-heroicons-cursor-arrow-rays" class="h-3 w-3" />
                Action optionnelle
              </p>

              <div class="grid grid-cols-2 gap-3">
                <UFormField label="URL de redirection" name="actionUrl">
                  <UInput
                    v-model="createForm.actionUrl"
                    placeholder="https://..."
                    icon="i-heroicons-link"
                    size="sm"
                  />
                </UFormField>

                <UFormField label="Texte du bouton" name="actionText">
                  <UInput
                    v-model="createForm.actionText"
                    placeholder="Ex: Voir détails"
                    icon="i-heroicons-arrow-right"
                    size="sm"
                  />
                </UFormField>
              </div>
            </div>

            <!-- Preview de la notification -->
            <div
              v-if="createForm.title || createForm.message"
              class="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <p class="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">Aperçu :</p>
              <div class="space-y-1">
                <p
                  v-if="createForm.title"
                  class="font-medium text-sm text-gray-900 dark:text-white"
                >
                  {{ createForm.title }}
                </p>
                <p v-if="createForm.message" class="text-xs text-gray-600 dark:text-gray-400">
                  {{ createForm.message.substring(0, 100)
                  }}{{ createForm.message.length > 100 ? '...' : '' }}
                </p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <UButton
                variant="ghost"
                :disabled="creatingNotification"
                @click="showCreateModal = false"
              >
                Annuler
              </UButton>
              <UButton
                type="submit"
                :loading="creatingNotification"
                color="primary"
                :disabled="!createForm.type || !createForm.title || !createForm.message"
              >
                <UIcon name="i-heroicons-paper-airplane" class="mr-2" />
                {{ creatingNotification ? 'Envoi...' : 'Créer et envoyer' }}
              </UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>

    <!-- Modal de test -->
    <UModal v-model:open="showTestModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/20"
                >
                  <UIcon name="i-heroicons-bell" class="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    Test de notification
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Envoyez une notification de test personnalisée
                  </p>
                </div>
              </div>
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="showTestModal = false"
              />
            </div>
          </template>

          <UForm
            id="test-form"
            :schema="testNotificationSchema"
            :state="testForm"
            class="space-y-6"
            @submit="testNotificationAdvanced"
          >
            <!-- Email de l'utilisateur cible -->
            <UFormField
              label="Destinataire"
              name="targetUserEmail"
              description="Email de l'utilisateur qui recevra la notification"
              required
            >
              <UInput
                v-model="testForm.targetUserEmail"
                type="email"
                placeholder="exemple@email.com"
                class="w-full"
                icon="i-heroicons-envelope"
              />

              <!-- Suggestions rapides avec meilleure présentation -->
              <div class="mt-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Utilisateurs de test disponibles :
                </p>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="user in testUserEmails"
                    :key="user.value"
                    variant="soft"
                    size="xs"
                    :color="testForm.targetUserEmail === user.value ? 'primary' : 'neutral'"
                    class="transition-colors"
                    @click="testForm.targetUserEmail = user.value"
                  >
                    <UIcon name="i-heroicons-user" class="mr-1 h-3 w-3" />
                    {{ user.label.split(' ')[0] }}
                  </UButton>
                </div>
              </div>
            </UFormField>

            <!-- Type de notification -->
            <UFormField label="Type de notification" name="type" required>
              <USelect
                v-model="testForm.type"
                :items="testTypesWithLabels"
                placeholder="Sélectionnez le type de notification..."
                class="w-full"
                icon="i-heroicons-tag"
              />
            </UFormField>

            <!-- Message personnalisé (conditionnel) -->
            <UFormField
              v-if="testForm.type === 'custom'"
              label="Message personnalisé"
              name="message"
              description="Rédigez votre message de test personnalisé"
              class="w-full"
            >
              <UTextarea
                v-model="testForm.message"
                placeholder="Votre message de test personnalisé..."
                :rows="4"
                class="w-full"
              />
            </UFormField>

            <!-- Actions du formulaire -->
            <div class="flex justify-end gap-3 pt-4">
              <UButton variant="ghost" :disabled="testingAdvanced" @click="showTestModal = false">
                Annuler
              </UButton>
              <UButton
                type="submit"
                :loading="testingAdvanced"
                color="primary"
                form="test-form"
                :disabled="!testForm.targetUserEmail || !testForm.type"
              >
                <UIcon name="i-heroicons-paper-airplane" class="mr-2" />
                {{ testingAdvanced ? 'Envoi en cours...' : 'Envoyer le test' }}
              </UButton>
            </div>
          </UForm>
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
const testingAdvanced = ref(false)
const loadingRecent = ref(false)

interface NotificationStats {
  totalSent: number
  totalUnread: number
  sentToday: number
  activeTypes: number
}

interface RecentNotification {
  id: string
  type: string
  title: string
  message: string
  createdAt: string
  user?: {
    pseudo: string
  }
}

const stats = ref<NotificationStats | null>(null)
const recentNotifications = ref<RecentNotification[]>([])

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
  userId: undefined as number | undefined,
  type: 'INFO' as 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR',
  title: '',
  message: '',
  category: '',
  actionUrl: '',
  actionText: '',
})

// Formulaire de test avancé
const testNotificationSchema = z.object({
  targetUserEmail: z.string().email(),
  type: z.enum([
    'welcome',
    'volunteer-accepted',
    'volunteer-rejected',
    'event-reminder',
    'system-error',
    'custom',
  ]),
  message: z.string().optional(),
})

const testForm = reactive({
  targetUserEmail: 'alice.jongleuse@example.com',
  type: 'welcome' as
    | 'welcome'
    | 'volunteer-accepted'
    | 'volunteer-rejected'
    | 'event-reminder'
    | 'system-error'
    | 'custom',
  message: '',
})

// Options
const notificationTypes = [
  { label: 'Information', value: 'INFO' },
  { label: 'Succès', value: 'SUCCESS' },
  { label: 'Avertissement', value: 'WARNING' },
  { label: 'Erreur', value: 'ERROR' },
]

const categoryOptions = [
  { label: 'Aucune catégorie', value: '' },
  { label: 'Système', value: 'system' },
  { label: 'Édition', value: 'edition' },
  { label: 'Bénévolat', value: 'volunteer' },
  { label: 'Autre', value: 'other' },
]

const testUserEmails = [
  { label: 'Alice Jongleuse (utilisateur test)', value: 'alice.jongleuse@example.com' },
  { label: 'Bob Cirque (utilisateur test)', value: 'bob.cirque@example.com' },
  { label: 'Charlie Diabolo (utilisateur test)', value: 'charlie.diabolo@example.com' },
  { label: 'Diana Massues (utilisateur test)', value: 'diana.massues@example.com' },
  { label: 'Marie Bénévole (bénévole)', value: 'marie.benevole@example.com' },
  { label: 'Paul Aidant (bénévole)', value: 'paul.aidant@example.com' },
  { label: 'Powange User (utilisateur)', value: 'powange@hotmail.com' },
]

// Options avec labels pour USelect (format correct avec value)
const testTypesWithLabels = ref([
  {
    label: 'Bienvenue',
    value: 'welcome',
  },
  {
    label: 'Bénévole accepté',
    value: 'volunteer-accepted',
  },
  {
    label: 'Bénévole refusé',
    value: 'volunteer-rejected',
  },
  {
    label: "Rappel d'événement",
    value: 'event-reminder',
  },
  {
    label: 'Erreur système',
    value: 'system-error',
  },
  {
    label: 'Personnalisée',
    value: 'custom',
  },
])

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
      color: 'success',
      title: 'Rappels envoyés',
      description: response.message,
    })

    await loadStats()
    await loadRecentNotifications()
  } catch {
    toast.add({
      color: 'error',
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
        userId: createForm.userId,
        type: createForm.type,
        title: createForm.title,
        message: createForm.message,
        category: createForm.category || undefined,
        actionUrl: createForm.actionUrl || undefined,
        actionText: createForm.actionText || undefined,
      },
    })

    toast.add({
      color: 'success',
      title: 'Notification envoyée',
      description: response.message,
    })

    showCreateModal.value = false
    resetCreateForm()
    await loadStats()
    await loadRecentNotifications()
  } catch (error) {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: (error as any).data?.message || "Impossible d'envoyer la notification",
    })
  } finally {
    creatingNotification.value = false
  }
}

// Test avancé avec email et message personnalisé
const testNotificationAdvanced = async () => {
  testingAdvanced.value = true
  try {
    await $fetch('/api/admin/notifications/test', {
      method: 'POST',
      body: {
        type: testForm.type,
        targetUserEmail: testForm.targetUserEmail,
        message: testForm.message || undefined,
      },
    })

    toast.add({
      color: 'success',
      title: 'Test personnalisé envoyé',
      description: `Notification ${testForm.type} envoyée à ${testForm.targetUserEmail}`,
    })

    showTestModal.value = false
    resetTestForm()
    await loadStats()
    await loadRecentNotifications()
  } catch (error) {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: (error as any).data?.message || "Impossible d'envoyer le test",
    })
  } finally {
    testingAdvanced.value = false
  }
}

const resetCreateForm = () => {
  Object.assign(createForm, {
    userId: undefined,
    type: 'INFO' as const,
    title: '',
    message: '',
    category: '',
    actionUrl: '',
    actionText: '',
  })
}

const resetTestForm = () => {
  Object.assign(testForm, {
    targetUserEmail: 'alice.jongleuse@example.com',
    type: 'welcome' as const,
    message: '',
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
