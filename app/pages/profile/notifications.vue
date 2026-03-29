<template>
  <div class="space-y-8">
    <!-- Toggle Push Notifications -->
    <UCard class="shadow-lg border-0">
      <template #header>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"
          >
            <UIcon name="i-heroicons-bell" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ $t('navigation.notifications') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('profile.notifications.manage_preferences') }}
            </p>
          </div>
        </div>
      </template>

      <NotificationsPushNotificationToggle />
    </UCard>

    <!-- Préférences de notifications (inline) -->
    <UCard class="shadow-lg border-0">
      <template #header>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"
          >
            <UIcon
              name="i-heroicons-cog-6-tooth"
              class="w-5 h-5 text-blue-600 dark:text-blue-400"
            />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ $t('profile.notifications.preferences_title') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('profile.notifications.preferences_description') }}
            </p>
          </div>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Rappels de créneaux bénévoles -->
        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center"
              >
                <UIcon
                  name="i-heroicons-clock"
                  class="w-4 h-4 text-orange-600 dark:text-orange-400"
                />
              </div>
              <div>
                <h4 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('profile.notifications.volunteer_reminders') }}
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('profile.notifications.volunteer_reminders_desc') }}
                </p>
              </div>
            </div>
            <USwitch
              v-model="notificationPreferences.volunteerReminders"
              color="primary"
              size="lg"
            />
          </div>
          <div class="flex items-center justify-between pl-11">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('profile.notifications.receive_by_email')
              }}</span>
            </div>
            <USwitch
              v-model="notificationPreferences.emailVolunteerReminders"
              :disabled="!notificationPreferences.volunteerReminders"
              color="primary"
              size="md"
            />
          </div>
        </div>

        <!-- Mises à jour de candidatures -->
        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center"
              >
                <UIcon
                  name="i-heroicons-hand-raised"
                  class="w-4 h-4 text-green-600 dark:text-green-400"
                />
              </div>
              <div>
                <h4 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('profile.notifications.application_updates') }}
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('profile.notifications.application_updates_desc') }}
                </p>
              </div>
            </div>
            <USwitch
              v-model="notificationPreferences.applicationUpdates"
              color="primary"
              size="lg"
            />
          </div>
          <div class="flex items-center justify-between pl-11">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('profile.notifications.receive_by_email')
              }}</span>
            </div>
            <USwitch
              v-model="notificationPreferences.emailApplicationUpdates"
              :disabled="!notificationPreferences.applicationUpdates"
              color="primary"
              size="md"
            />
          </div>
        </div>

        <!-- Nouvelles conventions -->
        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"
              >
                <UIcon
                  name="i-heroicons-calendar-days"
                  class="w-4 h-4 text-blue-600 dark:text-blue-400"
                />
              </div>
              <div>
                <h4 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('profile.notifications.convention_news') }}
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('profile.notifications.convention_news_desc') }}
                </p>
              </div>
            </div>
            <USwitch v-model="notificationPreferences.conventionNews" color="primary" size="lg" />
          </div>
          <div class="flex items-center justify-between pl-11">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('profile.notifications.receive_by_email')
              }}</span>
            </div>
            <USwitch
              v-model="notificationPreferences.emailConventionNews"
              :disabled="!notificationPreferences.conventionNews"
              color="primary"
              size="md"
            />
          </div>
        </div>

        <!-- Covoiturage -->
        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center"
              >
                <UIcon
                  name="i-heroicons-truck"
                  class="w-4 h-4 text-purple-600 dark:text-purple-400"
                />
              </div>
              <div>
                <h4 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('profile.notifications.carpool_updates') }}
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('profile.notifications.carpool_updates_desc') }}
                </p>
              </div>
            </div>
            <USwitch v-model="notificationPreferences.carpoolUpdates" color="primary" size="lg" />
          </div>
          <div class="flex items-center justify-between pl-11">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('profile.notifications.receive_by_email')
              }}</span>
            </div>
            <USwitch
              v-model="notificationPreferences.emailCarpoolUpdates"
              :disabled="!notificationPreferences.carpoolUpdates"
              color="primary"
              size="md"
            />
          </div>
        </div>

        <!-- Notifications système -->
        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 bg-gray-100 dark:bg-gray-900/30 rounded-lg flex items-center justify-center"
              >
                <UIcon
                  name="i-heroicons-cog-6-tooth"
                  class="w-4 h-4 text-gray-600 dark:text-gray-400"
                />
              </div>
              <div>
                <h4 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('profile.notifications.system_notifications') }}
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('profile.notifications.system_notifications_desc') }}
                </p>
              </div>
            </div>
            <USwitch
              v-model="notificationPreferences.systemNotifications"
              color="primary"
              size="lg"
            />
          </div>
          <div class="flex items-center justify-between pl-11">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{
                $t('profile.notifications.receive_by_email')
              }}</span>
            </div>
            <USwitch
              v-model="notificationPreferences.emailSystemNotifications"
              :disabled="!notificationPreferences.systemNotifications"
              color="primary"
              size="md"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            :loading="notificationPreferencesLoading"
            icon="i-heroicons-check"
            color="primary"
            size="lg"
            @click="saveNotificationPreferences"
          >
            {{
              notificationPreferencesLoading
                ? $t('profile.notifications.saving_preferences')
                : $t('profile.notifications.save_preferences')
            }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'

definePageMeta({
  layout: 'profile',
  middleware: 'auth-protected',
})

const { t } = useI18n()

const notificationPreferences = reactive({
  volunteerReminders: true,
  applicationUpdates: true,
  conventionNews: true,
  systemNotifications: true,
  carpoolUpdates: true,
  emailVolunteerReminders: true,
  emailApplicationUpdates: true,
  emailConventionNews: true,
  emailSystemNotifications: true,
  emailCarpoolUpdates: true,
})

const loadNotificationPreferences = async () => {
  try {
    const response = await $fetch<{
      success: boolean
      data: { preferences: typeof notificationPreferences }
    }>('/api/profile/notification-preferences')
    Object.assign(notificationPreferences, response.data.preferences)
  } catch (error) {
    console.error('Erreur lors du chargement des préférences:', error)
  }
}

const { execute: executeSaveNotificationPreferences, loading: notificationPreferencesLoading } =
  useApiAction('/api/profile/notification-preferences', {
    method: 'PUT',
    body: () => ({ ...notificationPreferences }),
    successMessage: {
      title: t('profile.preferences_saved'),
      description: t('profile.notification_preferences_updated'),
    },
    errorMessages: { default: t('profile.cannot_save_preferences') },
  })

const saveNotificationPreferences = () => {
  executeSaveNotificationPreferences()
}

onMounted(async () => {
  await loadNotificationPreferences()
})
</script>
