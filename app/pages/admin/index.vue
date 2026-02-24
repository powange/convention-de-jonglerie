<template>
  <div class="admin-dashboard">
    <!-- En-tête du dashboard -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-shield-check" class="text-blue-600" />
        {{ $t('admin.dashboard') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ $t('admin.dashboard_subtitle') }}
      </p>
    </div>

    <!-- Switch d'administration -->
    <div
      v-if="authStore.isGlobalAdmin"
      class="mb-6 p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg border border-orange-200 dark:border-orange-800"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 bg-orange-100 dark:bg-orange-800 rounded-lg flex items-center justify-center"
          >
            <UIcon
              name="i-heroicons-shield-exclamation"
              class="w-4 h-4 text-orange-600 dark:text-orange-400"
            />
          </div>
          <div>
            <h4 class="font-medium text-gray-900 dark:text-white">
              {{ $t('profile.admin_mode') }}
            </h4>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{
                authStore.isAdminModeActive
                  ? $t('profile.admin_access_all')
                  : $t('profile.activate_admin_privileges')
              }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <UBadge
            :color="authStore.isAdminModeActive ? 'warning' : 'neutral'"
            variant="soft"
            size="sm"
          >
            {{
              authStore.isAdminModeActive ? $t('profile.admin_active') : $t('profile.normal_active')
            }}
          </UBadge>
          <USwitch
            v-model="adminModeToggle"
            color="warning"
            size="lg"
            @update:model-value="toggleAdminMode"
          />
        </div>
      </div>
    </div>

    <!-- Statistiques rapides -->
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.total_users') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalUsers }}</p>
            <p class="text-xs text-green-600">
              {{ $t('admin.new_users_this_month', { count: stats.newUsersThisMonth }) }}
            </p>
          </div>
          <UIcon name="i-heroicons-users" class="h-8 w-8 text-blue-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.conventions') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats.totalConventions }}
            </p>
            <p class="text-xs text-green-600">
              {{ $t('admin.new_conventions_this_month', { count: stats.newConventionsThisMonth }) }}
            </p>
          </div>
          <UIcon name="i-heroicons-building-library" class="h-8 w-8 text-purple-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.editions') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats.totalEditions }}
            </p>
            <p class="text-xs text-green-600">
              {{ $t('admin.new_editions_this_month', { count: stats.newEditionsThisMonth }) }}
            </p>
          </div>
          <UIcon name="i-heroicons-calendar" class="h-8 w-8 text-green-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.super_admins') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalAdmins }}</p>
            <p class="text-xs text-gray-500">{{ $t('admin.active_administrators') }}</p>
          </div>
          <UIcon name="i-heroicons-shield-check" class="h-8 w-8 text-red-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.feedback.unresolved') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats.unresolvedFeedbacks }}
            </p>
            <p class="text-xs text-orange-600">
              {{ $t('admin.feedback.require_attention') }}
            </p>
          </div>
          <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="h-8 w-8 text-green-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.error_logs.unresolved') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats.unresolvedErrorLogs }}
            </p>
            <p class="text-xs text-red-600">
              {{ $t('admin.error_logs.need_investigation') }}
            </p>
          </div>
          <UIcon name="i-heroicons-exclamation-triangle" class="h-8 w-8 text-red-500" />
        </div>
      </UCard>
    </div>

    <!-- Navigation des outils d'administration -->
    <div class="mb-8">
      <h2 class="text-xl font-semibold mb-4">{{ $t('admin.administration_tools') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Gestion des utilisateurs -->
        <NuxtLink to="/admin/users" class="block">
          <UCard class="hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <UIcon
                      name="i-heroicons-users"
                      class="h-6 w-6 text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <h3 class="font-semibold text-lg">{{ $t('admin.user_management') }}</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {{ $t('admin.user_management_description') }}
                </p>
                <div class="flex items-center gap-4 text-sm text-gray-500">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-eye" class="h-4 w-4" />
                    {{ $t('admin.view_profiles') }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-funnel" class="h-4 w-4" />
                    {{ $t('admin.filter_sort') }}
                  </span>
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-gray-400" />
            </div>
          </UCard>
        </NuxtLink>

        <!-- Gestion des conventions -->
        <NuxtLink to="/admin/conventions" class="block">
          <UCard class="hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <UIcon
                      name="i-heroicons-building-library"
                      class="h-6 w-6 text-purple-600 dark:text-purple-400"
                    />
                  </div>
                  <h3 class="font-semibold text-lg">{{ $t('admin.conventions_management') }}</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {{ $t('admin.conventions_management_description') }}
                </p>
                <div class="flex items-center gap-4 text-sm text-gray-500">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-eye" class="h-4 w-4" />
                    {{ $t('admin.view_all_conventions') }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-calendar-days" class="h-4 w-4" />
                    {{ $t('admin.manage_editions') }}
                  </span>
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-gray-400" />
            </div>
          </UCard>
        </NuxtLink>

        <!-- Import d'éditions -->
        <NuxtLink to="/admin/import-edition" class="block">
          <UCard class="hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <UIcon
                      name="i-heroicons-arrow-down-tray"
                      class="h-6 w-6 text-green-600 dark:text-green-400"
                    />
                  </div>
                  <h3 class="font-semibold text-lg">{{ $t('admin.import.title') }}</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {{ $t('admin.import.description') }}
                </p>
                <div class="flex items-center gap-4 text-sm text-gray-500">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-document-text" class="h-4 w-4" />
                    {{ $t('admin.import.json_format') }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-shield-check" class="h-4 w-4" />
                    {{ $t('admin.import.orphan_conventions') }}
                  </span>
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-gray-400" />
            </div>
          </UCard>
        </NuxtLink>

        <!-- Configuration Système -->
        <NuxtLink to="/admin/system-config" class="block">
          <UCard class="hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <UIcon
                      name="i-heroicons-cog-6-tooth"
                      class="h-6 w-6 text-gray-600 dark:text-gray-400"
                    />
                  </div>
                  <h3 class="font-semibold text-lg">{{ $t('admin.config.title') }}</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {{ $t('admin.config.view_config') }}
                </p>
                <div class="flex items-center gap-4 text-sm text-gray-500">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-server" class="h-4 w-4" />
                    {{ $t('admin.config.server') }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-globe-alt" class="h-4 w-4" />
                    {{ $t('admin.config.public') }}
                  </span>
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-gray-400" />
            </div>
          </UCard>
        </NuxtLink>

        <!-- Gestion des notifications -->
        <NuxtLink to="/admin/notifications" class="block">
          <UCard class="hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <UIcon
                      name="i-heroicons-bell"
                      class="h-6 w-6 text-yellow-600 dark:text-yellow-400"
                    />
                  </div>
                  <h3 class="font-semibold text-lg">{{ $t('admin.notification_management') }}</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Envoyer et gérer les notifications système
                </p>
                <div class="flex items-center gap-4 text-sm text-gray-500">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-paper-airplane" class="h-4 w-4" />
                    Envoyer des notifications
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-clock" class="h-4 w-4" />
                    Rappels automatiques
                  </span>
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-gray-400" />
            </div>
          </UCard>
        </NuxtLink>

        <!-- Gestion des feedbacks -->
        <NuxtLink to="/admin/feedback" class="block">
          <UCard class="hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <UIcon
                      name="i-heroicons-chat-bubble-left-ellipsis"
                      class="h-6 w-6 text-green-600 dark:text-green-400"
                    />
                  </div>
                  <h3 class="font-semibold text-lg">{{ $t('admin.feedback.title') }}</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {{ $t('admin.feedback.description') }}
                </p>
                <div class="flex items-center gap-4 text-sm text-gray-500">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-eye" class="h-4 w-4" />
                    {{ $t('admin.feedback.view') }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-check-circle" class="h-4 w-4" />
                    {{ $t('admin.feedback.resolve') }}
                  </span>
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-gray-400" />
            </div>
          </UCard>
        </NuxtLink>

        <!-- Logs d'erreurs API -->
        <NuxtLink to="/admin/error-logs" class="block">
          <UCard class="hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <UIcon
                      name="i-heroicons-exclamation-triangle"
                      class="h-6 w-6 text-red-600 dark:text-red-400"
                    />
                  </div>
                  <h3 class="font-semibold text-lg">{{ $t('admin.api_error_logs') }}</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Surveiller et résoudre les erreurs de l'API
                </p>
                <div class="flex items-center gap-4 text-sm text-gray-500">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-eye" class="h-4 w-4" />
                    Consulter les logs
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-check-circle" class="h-4 w-4" />
                    Marquer comme résolu
                  </span>
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-gray-400" />
            </div>
          </UCard>
        </NuxtLink>

        <!-- Gestion des tâches automatisées -->
        <NuxtLink to="/admin/crons" class="block">
          <UCard class="hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <UIcon
                      name="i-heroicons-clock"
                      class="h-6 w-6 text-indigo-600 dark:text-indigo-400"
                    />
                  </div>
                  <h3 class="font-semibold text-lg">{{ $t('admin.cron_management') }}</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {{ $t('admin.cron_management_description') }}
                </p>
                <div class="flex items-center gap-4 text-sm text-gray-500">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-play" class="h-4 w-4" />
                    {{ $t('admin.execute_tasks') }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-eye" class="h-4 w-4" />
                    {{ $t('admin.monitor_tasks') }}
                  </span>
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-gray-400" />
            </div>
          </UCard>
        </NuxtLink>

        <!-- Gestion des sauvegardes -->
        <NuxtLink to="/admin/backup" class="block">
          <UCard class="hover:shadow-lg transition-shadow cursor-pointer">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <UIcon
                      name="i-heroicons-archive-box"
                      class="h-6 w-6 text-orange-600 dark:text-orange-400"
                    />
                  </div>
                  <h3 class="font-semibold text-lg">{{ $t('admin.backup_management') }}</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {{ $t('admin.backup_management_description') }}
                </p>
                <div class="flex items-center gap-4 text-sm text-gray-500">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4" />
                    {{ $t('admin.backup_create') }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-heroicons-arrow-up-tray" class="h-4 w-4" />
                    {{ $t('admin.backup_restore') }}
                  </span>
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-gray-400" />
            </div>
          </UCard>
        </NuxtLink>

        <!-- Anonymisation des données (DEV uniquement) -->
        <UCard
          v-if="!isRealProduction"
          class="hover:shadow-lg transition-shadow cursor-pointer border-2 border-red-300 dark:border-red-700"
          @click="showAnonymizeModal = true"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-3">
                <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <UIcon
                    name="i-heroicons-eye-slash"
                    class="h-6 w-6 text-red-600 dark:text-red-400"
                  />
                </div>
                <h3 class="font-semibold text-lg">{{ $t('admin.anonymize.title') }}</h3>
                <UBadge color="error" variant="soft" size="xs">DEV</UBadge>
              </div>
              <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {{ $t('admin.anonymize.description') }}
              </p>
              <div class="flex items-center gap-4 text-sm text-gray-500">
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-shield-check" class="h-4 w-4" />
                  {{ $t('admin.anonymize.preserves_admins') }}
                </span>
              </div>
            </div>
            <UIcon name="i-heroicons-arrow-right" class="h-5 w-5 text-gray-400" />
          </div>
        </UCard>
      </div>
    </div>

    <!-- Activité récente -->
    <div class="mb-8">
      <h2 class="text-xl font-semibold mb-4">{{ $t('admin.recent_activity') }}</h2>
      <UCard>
        <div v-if="loading" class="text-center py-6">
          <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin mx-auto mb-2" />
          <p class="text-gray-500">{{ $t('admin.loading_activity') }}</p>
        </div>

        <div v-else-if="recentActivity.length === 0" class="text-center py-6">
          <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p class="text-gray-500">{{ $t('admin.no_recent_activity') }}</p>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="activity in recentActivity"
            :key="activity.id"
            class="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
          >
            <div class="p-2 rounded-full" :class="getActivityIconClass(activity.type)">
              <UIcon :name="getActivityIcon(activity.type)" class="h-4 w-4" />
            </div>
            <div class="flex-1">
              <p class="font-medium">{{ activity.title }}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ activity.description }}</p>
            </div>
            <div class="text-sm text-gray-500">
              {{ formatRelativeTime(activity.createdAt) }}
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Modal de confirmation d'anonymisation -->
    <UModal v-model:open="showAnonymizeModal" :title="$t('admin.anonymize.confirm_title')">
      <template #body>
        <div class="space-y-4">
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('admin.anonymize.confirm_message') }}
          </p>
          <div
            class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p class="text-red-700 dark:text-red-400 text-sm font-medium">
              <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 inline mr-1" />
              {{ $t('admin.anonymize.warning') }}
            </p>
          </div>
          <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-5">
            <li>{{ $t('admin.anonymize.scope_users') }}</li>
            <li>{{ $t('admin.anonymize.scope_volunteers') }}</li>
            <li>{{ $t('admin.anonymize.scope_artists') }}</li>
            <li>{{ $t('admin.anonymize.scope_admins_safe') }}</li>
          </ul>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="outline" @click="showAnonymizeModal = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="anonymizing" @click="executeAnonymization">
            <UIcon name="i-heroicons-eye-slash" class="h-4 w-4" />
            {{ $t('admin.anonymize.confirm_button') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal de résultat d'anonymisation -->
    <UModal v-model:open="showAnonymizeResult" :title="$t('admin.anonymize.result_title')">
      <template #body>
        <div v-if="anonymizeResult" class="space-y-3">
          <div class="flex items-center gap-2 text-green-600">
            <UIcon name="i-heroicons-check-circle" class="h-5 w-5" />
            <span class="font-medium">{{ $t('admin.anonymize.result_success') }}</span>
          </div>
          <div class="grid grid-cols-1 gap-2 text-sm">
            <div class="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <span>{{ $t('admin.anonymize.users_count') }}</span>
              <span class="font-semibold">{{ anonymizeResult.usersAnonymized }}</span>
            </div>
            <div class="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <span>{{ $t('admin.anonymize.volunteer_apps_count') }}</span>
              <span class="font-semibold">{{
                anonymizeResult.volunteerApplicationsAnonymized
              }}</span>
            </div>
            <div class="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <span>{{ $t('admin.anonymize.show_apps_count') }}</span>
              <span class="font-semibold">{{ anonymizeResult.showApplicationsAnonymized }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <UButton @click="showAnonymizeResult = false">
            {{ $t('common.close') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// Middleware de protection pour super admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const authStore = useAuthStore()
const toast = useToast()
const isRealProduction = useState<boolean>('isRealProduction', () => true)

// Métadonnées de la page
const { t } = useI18n()
useSeoMeta({
  title: t('admin.dashboard') + ' - Administration',
  description: t('admin.dashboard_subtitle'),
})

// État réactif
const loading = ref(false)

// Anonymisation
interface AnonymizeResult {
  usersAnonymized: number
  volunteerApplicationsAnonymized: number
  showApplicationsAnonymized: number
}
const showAnonymizeModal = ref(false)
const showAnonymizeResult = ref(false)
const anonymizing = ref(false)
const anonymizeResult = ref<AnonymizeResult | null>(null)

const stats = ref({
  totalUsers: 0,
  newUsersThisMonth: 0,
  totalConventions: 0,
  newConventionsThisMonth: 0,
  totalEditions: 0,
  newEditionsThisMonth: 0,
  totalAdmins: 0,
  unresolvedFeedbacks: 0,
  unresolvedErrorLogs: 0,
})

interface Activity {
  id: string
  type: string
  title: string
  description: string
  createdAt: string
}

const recentActivity = ref<Activity[]>([])

// Gestion du mode administrateur
const adminModeToggle = ref(authStore.isAdminModeActive)

// Fonctions utilitaires
const { locale } = useI18n()

const formatRelativeTime = (date: string) => {
  const target = new Date(date)

  return useTimeAgoIntl(target, {
    locale: locale.value,
    relativeTimeFormatOptions: {
      numeric: 'auto',
      style: 'short',
    },
  }).value
}

const getActivityIcon = (type: string) => {
  const icons: Record<string, string> = {
    user_registered: 'i-heroicons-user-plus',
    convention_created: 'i-heroicons-building-library',
    edition_created: 'material-symbols:calendar-add-on',
    admin_promoted: 'i-heroicons-shield-check',
  }
  return icons[type] || 'i-heroicons-information-circle'
}

const getActivityIconClass = (type: string) => {
  const classes: Record<string, string> = {
    user_registered: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    convention_created: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    edition_created: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    admin_promoted: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  }
  return classes[type] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
}

// Anonymisation des données utilisateurs
const executeAnonymization = async () => {
  anonymizing.value = true
  try {
    const response = await $fetch('/api/admin/anonymize-users', { method: 'POST' })
    anonymizeResult.value = (response as any).data
    showAnonymizeModal.value = false
    showAnonymizeResult.value = true
    toast.add({
      color: 'success',
      title: t('admin.anonymize.success_title'),
      description: t('admin.anonymize.success_description'),
    })
    await refreshData()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: error?.data?.message || t('admin.anonymize.error'),
    })
  } finally {
    anonymizing.value = false
  }
}

// Fonction pour charger les statistiques
const loadStats = async () => {
  try {
    const data = await $fetch('/api/admin/stats')
    stats.value = data
  } catch (error) {
    console.error('Error loading statistics:', error)

    // Si erreur d'authentification, rediriger vers login
    if ((error as any)?.statusCode === 401 || (error as any)?.status === 401) {
      navigateTo('/login')
      return
    }

    // Valeurs par défaut en cas d'erreur
    stats.value = {
      totalUsers: 0,
      newUsersThisMonth: 0,
      totalConventions: 0,
      newConventionsThisMonth: 0,
      totalEditions: 0,
      newEditionsThisMonth: 0,
      totalAdmins: 0,
      unresolvedFeedbacks: 0,
      unresolvedErrorLogs: 0,
    }

    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('admin.cannot_load_stats'),
    })
  }
}

// Fonction pour charger l'activité récente
const loadRecentActivity = async () => {
  try {
    const data = await $fetch('/api/admin/activity', { query: { limit: 10 } })
    recentActivity.value = data
  } catch (error) {
    console.error('Error loading activity:', error)

    // Si erreur d'authentification, rediriger vers login
    if ((error as any)?.statusCode === 401 || (error as any)?.status === 401) {
      navigateTo('/login')
      return
    }

    // Laisser la liste vide en cas d'erreur
    recentActivity.value = []

    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('admin.cannot_load_activity'),
    })
  }
}

// Fonction pour actualiser toutes les données
const refreshData = async () => {
  loading.value = true
  await Promise.all([loadStats(), loadRecentActivity()])
  loading.value = false
}

// Fonction pour basculer le mode administrateur
const toggleAdminMode = (enabled: boolean) => {
  if (enabled) {
    authStore.enableAdminMode()
    toast.add({
      title: t('admin_mode.admin_mode_enabled'),
      description: t('admin_mode.admin_mode_enabled_desc'),
      icon: 'i-heroicons-shield-check',
      color: 'warning',
    })
  } else {
    authStore.disableAdminMode()
    toast.add({
      title: t('admin_mode.admin_mode_disabled'),
      description: t('admin_mode.admin_mode_disabled_desc'),
      icon: 'i-heroicons-shield-exclamation',
      color: 'neutral',
    })
  }
}

// Charger les données au montage
onMounted(() => {
  refreshData()
})
</script>
