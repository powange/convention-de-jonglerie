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
              $t('admin.user_management')
            }}</span>
          </div>
        </li>
      </ol>
    </nav>

    <div class="mb-6">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-users" class="text-blue-600" />
        {{ $t('admin.user_management') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ $t('admin.user_management_description') }}
      </p>
    </div>

    <!-- Filtres et recherche -->
    <div class="mb-6 space-y-4">
      <div class="flex flex-col sm:flex-row gap-4">
        <!-- Barre de recherche -->
        <div class="flex-1">
          <UInput
            v-model="searchQuery"
            :placeholder="t('admin.search_users_placeholder')"
            icon="i-heroicons-magnifying-glass"
            @input="debouncedSearch"
          />
        </div>

        <!-- Filtre par statut admin -->
        <USelect
          v-model="adminFilter"
          :items="adminFilterOptions"
          value-key="value"
          class="w-full sm:w-48"
          @change="fetchUsers"
        />

        <!-- Filtre par email vérifié -->
        <USelect
          v-model="emailFilter"
          :items="emailFilterOptions"
          value-key="value"
          class="w-full sm:w-48"
          @change="fetchUsers"
        />

        <!-- Tri -->
        <USelect
          v-model="sortOption"
          :items="sortOptions"
          value-key="value"
          class="w-full sm:w-48"
          @change="fetchUsers"
        />

        <!-- Bouton rafraîchir -->
        <UButton
          icon="i-heroicons-arrow-path"
          variant="outline"
          color="neutral"
          :loading="loading"
          :title="t('common.refresh')"
          @click="refreshData"
        />
      </div>

      <!-- Filtres supplémentaires -->
      <div class="flex flex-col sm:flex-row gap-4">
        <!-- Checkbox utilisateurs en ligne -->
        <UCheckbox
          v-model="onlineFilter"
          :label="t('admin.show_online_users_only')"
          class="flex items-center"
        />
      </div>

      <!-- Statistiques rapides -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-primary">{{ stats.total }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('admin.total_users') }}
            </div>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">{{ stats.verified }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('admin.email_verified') }}
            </div>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">{{ stats.admins }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('admin.super_admins') }}
            </div>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-500">{{ stats.online }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('admin.users_online') }}
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Tableau des utilisateurs -->
    <UCard>
      <UTable :data="users" :columns="columns" :loading="loading" class="w-full" />

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="flex justify-center mt-6">
        <UPagination
          :default-page="currentPage"
          :items-per-page="pagination.limit"
          :total="pagination.totalCount"
          @update:page="onPageChange"
        />
      </div>
    </UCard>

    <!-- Modal de suppression d'utilisateur -->
    <AdminUserDeletionModal
      v-model:open="showDeletionModal"
      :user="userToDelete"
      @deleted="onUserDeleted"
    />
  </div>
</template>

<script setup lang="ts">
// Middleware de protection pour super admin
// Import du store d'authentification
import { h, resolveComponent } from 'vue'

import type { AdminUser } from '~/composables/useUserDeletion'
import { useAuthStore } from '~/stores/auth'
import { useImpersonationStore } from '~/stores/impersonation'

definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()

// Types pour les utilisateurs (utilisé dans la page mais défini dans le composable)
interface AdminUserWithConnection extends AdminUser {
  isConnected: boolean
  authProvider?: string
  lastLoginAt?: string | null
}

interface PaginationData {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface UsersApiResponse {
  data: AdminUserWithConnection[]
  pagination: PaginationData
  connectionStats?: {
    totalActiveConnections: number
    totalActiveUsers: number
  }
}

// Métadonnées de la page
useSeoMeta({
  title: t('admin.user_management') + ' - Admin',
  description: t('admin.user_management_description'),
})

// Composables
// const router = useRouter() // Supprimé car non utilisé

// État réactif
const loading = ref(false)
const users = ref<AdminUserWithConnection[]>([])
const pagination = ref<PaginationData>({
  page: 1,
  limit: 20,
  totalCount: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
})

const searchQuery = ref('')
const adminFilter = ref('all')
const emailFilter = ref('all')
const sortOption = ref('createdAt:desc')
const currentPage = ref(1)
const onlineFilter = ref(false)

// État pour le modal de suppression
const userToDelete = ref<AdminUserWithConnection | null>(null)
const showDeletionModal = ref(false)

// État pour les stats de connexion
const connectionStats = ref<{ totalActiveConnections: number; totalActiveUsers: number } | null>(
  null
)

// Plus besoin de filtrage côté client, tout est géré côté serveur
// Les utilisateurs sont déjà filtrés selon le paramètre onlineOnly envoyé à l'API

// Statistiques rapides
const stats = computed(() => {
  const total = pagination.value.totalCount
  const verified = users.value.filter((u: AdminUserWithConnection) => u.isEmailVerified).length
  const admins = users.value.filter((u: AdminUserWithConnection) => u.isGlobalAdmin).length
  const creators = users.value.filter(
    (u: AdminUserWithConnection) => u._count.createdConventions > 0 || u._count.createdEditions > 0
  ).length
  // Utiliser les stats serveur si disponibles, sinon calculer côté client
  const online =
    connectionStats.value?.totalActiveUsers ??
    users.value.filter((u: AdminUserWithConnection) => u.isConnected).length

  return { total, verified, admins, creators, online }
})

// Configuration du tableau avec la nouvelle syntaxe
const columns = [
  {
    accessorKey: 'connectionStatus',
    header: '', // Pas de header pour les indicateurs
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUserWithConnection
      const isConnected = user.isConnected
      const hasPushEnabled = user._count.fcmTokens > 0

      return h(
        'div',
        {
          class: 'flex justify-center items-center gap-1',
        },
        [
          // Pastille de connexion SSE
          h('div', {
            class: [
              'w-3 h-3 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
            ],
            title: isConnected ? t('admin.user_connected') : t('admin.user_offline'),
          }),
          // Icône notifications push
          h(resolveComponent('UIcon'), {
            name: hasPushEnabled ? 'i-heroicons-bell-solid' : 'i-heroicons-bell-slash',
            class: [
              'w-4 h-4',
              hasPushEnabled ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600',
            ],
            title: hasPushEnabled
              ? t('admin.push_notifications_enabled', { count: user._count.fcmTokens })
              : t('admin.push_notifications_disabled'),
          }),
        ]
      )
    },
  },
  {
    accessorKey: 'identity',
    header: t('admin.user_column'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUserWithConnection
      return h(resolveComponent('UiUserDisplayForAdmin'), {
        key: `user-display-${user.id}`,
        user: user,
        size: 'md',
        showEmail: false,
      })
    },
  },
  {
    accessorKey: 'email',
    header: t('common.email'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUserWithConnection
      return h('div', { class: 'flex items-center gap-2' }, [
        h('span', user.email),
        user.isEmailVerified
          ? h(resolveComponent('UBadge'), { color: 'success', variant: 'soft', size: 'xs' }, () =>
              t('admin.verified')
            )
          : h(resolveComponent('UBadge'), { color: 'warning', variant: 'soft', size: 'xs' }, () =>
              t('admin.not_verified')
            ),
      ])
    },
  },
  {
    accessorKey: 'role',
    header: t('admin.role'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUserWithConnection
      return h(
        resolveComponent('UBadge'),
        {
          color: user.isGlobalAdmin ? 'error' : 'neutral',
          variant: user.isGlobalAdmin ? 'solid' : 'soft',
        },
        () => (user.isGlobalAdmin ? t('admin.super_admin') : t('admin.user'))
      )
    },
  },
  {
    accessorKey: 'activity',
    header: t('admin.activity'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUserWithConnection
      const activities = []

      if (user._count.createdConventions > 0) {
        activities.push(
          h('div', { class: 'flex items-center gap-1' }, [
            h(resolveComponent('UIcon'), {
              name: 'i-heroicons-building-library',
              class: 'w-4 h-4 text-blue-500',
            }),
            h('span', `${user._count.createdConventions} ${t('admin.conventions_count')}`),
          ])
        )
      }

      if (user._count.createdEditions > 0) {
        activities.push(
          h('div', { class: 'flex items-center gap-1' }, [
            h(resolveComponent('UIcon'), {
              name: 'i-heroicons-calendar',
              class: 'w-4 h-4 text-green-500',
            }),
            h('span', `${user._count.createdEditions} ${t('admin.editions_count')}`),
          ])
        )
      }

      if (user._count.favoriteEditions > 0) {
        activities.push(
          h('div', { class: 'flex items-center gap-1' }, [
            h(resolveComponent('UIcon'), {
              name: 'i-heroicons-heart',
              class: 'w-4 h-4 text-red-500',
            }),
            h('span', `${user._count.favoriteEditions} ${t('admin.favorites_count')}`),
          ])
        )
      }

      if (activities.length === 0) {
        activities.push(h('div', { class: 'text-gray-400' }, t('admin.no_activity')))
      }

      return h('div', { class: 'text-sm space-y-1' }, activities)
    },
  },
  {
    accessorKey: 'createdAt',
    header: t('admin.registration'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUserWithConnection

      function getAuthProviderLabel(provider: string): string {
        switch (provider) {
          case 'email':
            return t('admin.auth_provider_email')
          case 'google':
            return t('admin.auth_provider_google')
          case 'facebook':
            return t('admin.auth_provider_facebook')
          default:
            return t('admin.auth_provider_unknown')
        }
      }

      function getAuthProviderIcon(provider: string): string {
        switch (provider) {
          case 'email':
            return 'i-mdi-mail-ru'
          case 'google':
            return 'i-mdi-google'
          case 'facebook':
            return 'i-mdi-facebook'
          default:
            return 'i-heroicons-question-mark-circle'
        }
      }

      function getAuthProviderColor(provider: string): string {
        switch (provider) {
          case 'email':
            return 'neutral'
          case 'google':
            return 'error'
          case 'facebook':
            return 'info'
          default:
            return 'warning'
        }
      }

      const provider = user.authProvider || 'unknown'

      return h(
        resolveComponent('UTooltip'),
        { text: formatDateTime(user.createdAt) },
        {
          default: () =>
            h('div', { class: 'text-sm cursor-help' }, [
              h('div', formatDate(user.createdAt)),
              h('div', { class: 'text-gray-500' }, formatRelativeTime(user.createdAt)),
              h(resolveComponent('UIcon'), {
                name: getAuthProviderIcon(provider),
                class: 'w-4 h-4',
              }),
              h(
                resolveComponent('UBadge'),
                {
                  color: getAuthProviderColor(provider),
                  variant: 'soft',
                },
                () => getAuthProviderLabel(provider)
              ),
            ]),
        }
      )
    },
  },
  {
    accessorKey: 'lastLoginAt',
    header: t('admin.last_login'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUserWithConnection

      if (!user.lastLoginAt) {
        return h('div', { class: 'text-sm text-gray-400' }, t('admin.never_connected'))
      }

      return h(
        resolveComponent('UTooltip'),
        { text: formatDateTime(user.lastLoginAt) },
        {
          default: () =>
            h('div', { class: 'text-sm cursor-help' }, [
              h('div', formatDate(user.lastLoginAt)),
              h('div', { class: 'text-gray-500' }, formatRelativeTime(user.lastLoginAt)),
            ]),
        }
      )
    },
  },
  {
    accessorKey: 'actions',
    header: t('common.actions'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUserWithConnection
      return h(
        resolveComponent('UDropdownMenu'),
        {
          items: getUserActions(user),
        },
        {
          default: () =>
            h(resolveComponent('UButton'), {
              color: 'neutral',
              variant: 'ghost',
              icon: 'i-heroicons-ellipsis-horizontal',
              size: 'sm',
            }),
        }
      )
    },
  },
]

// Options de filtrage
const adminFilterOptions = [
  { label: t('admin.all_users'), value: 'all' },
  { label: t('admin.normal_users'), value: 'users' },
  { label: t('admin.super_administrators'), value: 'admins' },
]

const emailFilterOptions = [
  { label: t('admin.all_emails'), value: 'all' },
  { label: t('admin.verified_emails'), value: 'verified' },
  { label: t('admin.unverified_emails'), value: 'unverified' },
]

const sortOptions = [
  { label: t('admin.newest_first'), value: 'createdAt:desc' },
  { label: t('admin.oldest_first'), value: 'createdAt:asc' },
  { label: t('admin.last_login_recent'), value: 'lastLoginAt:desc' },
  { label: t('admin.last_login_oldest'), value: 'lastLoginAt:asc' },
  { label: t('admin.name_a_z'), value: 'nom:asc' },
  { label: t('admin.name_z_a'), value: 'nom:desc' },
  { label: t('admin.email_a_z'), value: 'email:asc' },
  { label: t('admin.email_z_a'), value: 'email:desc' },
]

// Fonctions utilitaires
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

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

const getUserActions = (user: AdminUserWithConnection) => {
  const actions: any[] = [
    // Action pour voir le profil
    {
      label: t('admin.view_profile'),
      icon: 'i-heroicons-user',
      to: `/admin/users/${user.id}`,
    },
  ]

  // Action d'impersonation (seulement pour les utilisateurs non-admin)
  if (!user.isGlobalAdmin) {
    actions.push({
      label: t('admin.impersonate_user'),
      icon: 'i-heroicons-arrow-right-circle',
      onSelect: () => {
        impersonateUser(user)
      },
    })
  }

  // Actions d'administration
  if (!user.isGlobalAdmin) {
    actions.push({
      label: t('admin.promote_to_admin'),
      icon: 'i-heroicons-shield-check',
      onSelect: () => {
        console.log('Promote clicked for:', user.pseudo)
        promoteToAdmin(user)
      },
    })
  } else {
    actions.push({
      label: t('admin.demote'),
      icon: 'i-heroicons-shield-exclamation',
      onSelect: () => {
        console.log('Demote clicked for:', user.pseudo)
        demoteFromAdmin(user)
      },
    })
  }

  // Action de suppression (seulement pour les utilisateurs normaux)
  if (!user.isGlobalAdmin) {
    actions.push({
      label: t('admin.delete_account'),
      icon: 'i-heroicons-trash',
      onSelect: () => {
        console.log('Delete clicked for:', user.pseudo)
        openDeletionModal(user)
      },
    })
  }

  return [actions]
}

// Fonction d'impersonation
const impersonateUser = async (user: AdminUserWithConnection) => {
  try {
    const confirmMessage = t('admin.confirm_impersonate', {
      name: `${user.prenom} ${user.nom}`,
    })

    if (confirm(confirmMessage)) {
      const result = await $fetch(`/api/admin/users/${user.id}/impersonate`, {
        method: 'POST',
      })

      // Mettre à jour le store d'authentification avec le nouvel utilisateur
      const authStore = useAuthStore()
      if (result.user) {
        authStore.user = result.user
      }

      // Démarrer l'impersonation dans le store
      const impersonationStore = useImpersonationStore()
      if (result.impersonation?.originalUser) {
        impersonationStore.startImpersonation(result.impersonation.originalUser, result.user)
      }

      // Afficher le toast de succès
      useToast().add({
        title: t('common.success'),
        description: t('admin.impersonation_started', { pseudo: user.pseudo }),
        color: 'success',
      })

      // Rafraîchir les données de session
      await refreshNuxtData()

      // Naviguer vers la page d'accueil
      await navigateTo('/')
    }
  } catch (error: any) {
    console.error("Erreur lors de l'impersonation:", error)

    useToast().add({
      title: t('common.error'),
      description: error.data?.message || t('admin.impersonation_error'),
      color: 'error',
    })
  }
}

// Fonctions d'action
const promoteToAdmin = async (user: AdminUserWithConnection) => {
  try {
    const confirmMessage = t('admin.confirm_promote_to_admin', {
      name: `${user.prenom} ${user.nom}`,
    })

    if (confirm(confirmMessage)) {
      const updatedUser = await $fetch<AdminUserWithConnection>(
        `/api/admin/users/${user.id}/promote`,
        {
          method: 'PUT',
          body: { isGlobalAdmin: true },
        }
      )

      // Mettre à jour l'utilisateur dans la liste locale
      const userIndex = users.value.findIndex((u) => u.id === user.id)
      if (userIndex !== -1) {
        users.value[userIndex] = updatedUser
      }

      useToast().add({
        title: t('common.success'),
        description: t('admin.user_promoted_successfully'),
        color: 'success',
      })
    }
  } catch (error: any) {
    console.error('Erreur lors de la promotion:', error)

    useToast().add({
      title: t('common.error'),
      description: error.data?.message || t('admin.promotion_error'),
      color: 'error',
    })
  }
}

const demoteFromAdmin = async (user: AdminUserWithConnection) => {
  try {
    const confirmMessage = t('admin.confirm_demote_from_admin', {
      name: `${user.prenom} ${user.nom}`,
    })

    if (confirm(confirmMessage)) {
      const updatedUser = await $fetch<AdminUserWithConnection>(
        `/api/admin/users/${user.id}/promote`,
        {
          method: 'PUT',
          body: { isGlobalAdmin: false },
        }
      )

      // Mettre à jour l'utilisateur dans la liste locale
      const userIndex = users.value.findIndex((u) => u.id === user.id)
      if (userIndex !== -1) {
        users.value[userIndex] = updatedUser
      }

      useToast().add({
        title: t('common.success'),
        description: t('admin.user_demoted_successfully'),
        color: 'success',
      })
    }
  } catch (error: any) {
    console.error('Erreur lors de la rétrogradation:', error)

    useToast().add({
      title: t('common.error'),
      description: error.data?.message || t('admin.demotion_error'),
      color: 'error',
    })
  }
}

// Fonction pour ouvrir le modal de suppression
const openDeletionModal = (user: AdminUserWithConnection) => {
  userToDelete.value = user
  showDeletionModal.value = true
}

// Fonction appelée après suppression réussie
const onUserDeleted = (deletedUser: any) => {
  // Retirer l'utilisateur de la liste
  users.value = users.value.filter((u) => u.id !== deletedUser.id)
  // Fermer le modal
  showDeletionModal.value = false
  userToDelete.value = null
  // Recharger les stats
  fetchUsers()
}

// Recherche avec debounce
// Fonction de debounce simple
let searchTimeout: NodeJS.Timeout | null = null
const debouncedSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchUsers()
  }, 300)
}

// Fonction pour gérer le changement de page
const onPageChange = (page: number) => {
  currentPage.value = page
  fetchUsers()
}

// Fonction pour récupérer les utilisateurs
const fetchUsers = async () => {
  loading.value = true

  try {
    const [sortBy, sortOrder] = sortOption.value.split(':')

    const params = {
      page: currentPage.value,
      limit: pagination.value.limit,
      search: searchQuery.value,
      sortBy,
      sortOrder,
      adminFilter: adminFilter.value,
      emailFilter: emailFilter.value,
      onlineOnly: onlineFilter.value.toString(),
    }

    const data = await $fetch<UsersApiResponse>('/api/admin/users', {
      query: params,
    })

    users.value = data.data
    pagination.value = data.pagination
    connectionStats.value = data.connectionStats || null
  } catch (error: any) {
    console.error('Error loading users:', error)

    // Si erreur d'authentification, rediriger vers login
    if (error?.statusCode === 401 || error?.status === 401) {
      navigateTo('/login')
      return
    }

    useToast().add({
      color: 'error' as const,
      title: t('common.error'),
      description: t('admin.cannot_load_users'),
    })
  } finally {
    loading.value = false
  }
}

// Fonction de rafraîchissement global
const refreshData = async () => {
  await fetchUsers()
}

// Charger les données au montage
onMounted(() => {
  fetchUsers()

  // Actualiser les données toutes les 30 secondes
  const connectionInterval = setInterval(() => {
    fetchUsers()
  }, 30000)

  // Nettoyer l'intervalle au démontage
  onUnmounted(() => {
    clearInterval(connectionInterval)
  })
})

// Watchers pour les changements de filtres
watch(adminFilter, () => {
  currentPage.value = 1
  fetchUsers()
})

watch(emailFilter, () => {
  currentPage.value = 1
  fetchUsers()
})

watch(sortOption, () => {
  currentPage.value = 1
  fetchUsers()
})

// Réinitialiser la page et refetch quand on change le filtre online
watch(onlineFilter, () => {
  currentPage.value = 1
  fetchUsers()
})
</script>
