<template>
  <div>
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

    <!-- Statistiques rapides -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                  <h3 class="font-semibold text-lg">Logs d'erreurs API</h3>
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
                  <h3 class="font-semibold text-lg">Gestion des notifications</h3>
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

        <!-- Placeholder pour futures fonctionnalités -->
        <UCard class="opacity-75 border-dashed border-2 border-gray-300 dark:border-gray-600">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-3">
                <div class="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <UIcon name="i-heroicons-cog-6-tooth" class="h-6 w-6 text-gray-400" />
                </div>
                <h3 class="font-semibold text-lg text-gray-500">
                  {{ $t('admin.system_settings') }}
                </h3>
              </div>
              <p class="text-gray-400 text-sm mb-4">
                {{ $t('admin.system_settings_description') }}
              </p>
              <UBadge color="neutral" variant="soft" size="xs">{{
                $t('admin.coming_soon')
              }}</UBadge>
            </div>
          </div>
        </UCard>

        <UCard class="opacity-75 border-dashed border-2 border-gray-300 dark:border-gray-600">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-3">
                <div class="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <UIcon name="i-heroicons-chart-bar" class="h-6 w-6 text-gray-400" />
                </div>
                <h3 class="font-semibold text-lg text-gray-500">
                  {{ $t('admin.advanced_statistics') }}
                </h3>
              </div>
              <p class="text-gray-400 text-sm mb-4">
                {{ $t('admin.advanced_statistics_description') }}
              </p>
              <UBadge color="neutral" variant="soft" size="xs">{{
                $t('admin.coming_soon')
              }}</UBadge>
            </div>
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
  </div>
</template>

<script setup lang="ts">
// Middleware de protection pour super admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

// const authStore = useAuthStore()
const toast = useToast()

// Métadonnées de la page
const { t } = useI18n()
useSeoMeta({
  title: t('admin.dashboard') + ' - Administration',
  description: t('admin.dashboard_subtitle'),
})

// État réactif
const loading = ref(false)
const stats = ref({
  totalUsers: 0,
  newUsersThisMonth: 0,
  totalConventions: 0,
  newConventionsThisMonth: 0,
  totalEditions: 0,
  newEditionsThisMonth: 0,
  totalAdmins: 0,
})

const recentActivity = ref([])

// Fonctions utilitaires
const formatRelativeTime = (date: string) => {
  const now = new Date()
  const target = new Date(date)
  const diffInMinutes = Math.floor((now.getTime() - target.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return t('common.time_just_now')
  if (diffInMinutes < 60) return t('common.time_minutes_ago', { count: diffInMinutes })

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return t('common.time_hours_ago', { count: diffInHours })

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return t('common.time_days_ago', { count: diffInDays })

  return target.toLocaleDateString()
}

const getActivityIcon = (type: string) => {
  const icons = {
    user_registered: 'i-heroicons-user-plus',
    convention_created: 'i-heroicons-building-library',
    edition_created: 'i-heroicons-calendar-plus',
    admin_promoted: 'i-heroicons-shield-check',
  }
  return icons[type] || 'i-heroicons-information-circle'
}

const getActivityIconClass = (type: string) => {
  const classes = {
    user_registered: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    convention_created: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    edition_created: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    admin_promoted: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  }
  return classes[type] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
}

// Fonction pour charger les statistiques
const loadStats = async () => {
  try {
    const data = await $fetch('/api/admin/stats')
    stats.value = data
  } catch (error) {
    console.error('Error loading statistics:', error)

    // Si erreur d'authentification, rediriger vers login
    if (error?.statusCode === 401 || error?.status === 401) {
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
    if (error?.statusCode === 401 || error?.status === 401) {
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

// Charger les données au montage
onMounted(() => {
  refreshData()
})
</script>
