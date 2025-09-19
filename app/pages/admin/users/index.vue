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
      </div>

      <!-- Statistiques rapides -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
            <div class="text-2xl font-bold text-purple-600">{{ stats.creators }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('admin.content_creators') }}
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

definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()

// Types pour les utilisateurs (utilisé dans la page mais défini dans le composable)

interface PaginationData {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface UsersApiResponse {
  users: AdminUser[]
  pagination: PaginationData
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
const users = ref<AdminUser[]>([])
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

// État pour le modal de suppression
const userToDelete = ref<AdminUser | null>(null)
const showDeletionModal = ref(false)

// Statistiques rapides
const stats = computed(() => {
  const total = pagination.value.totalCount
  const verified = users.value.filter((u: AdminUser) => u.isEmailVerified).length
  const admins = users.value.filter((u: AdminUser) => u.isGlobalAdmin).length
  const creators = users.value.filter(
    (u: AdminUser) => u._count.createdConventions > 0 || u._count.createdEditions > 0
  ).length

  return { total, verified, admins, creators }
})

// Configuration du tableau avec la nouvelle syntaxe
const columns = [
  {
    accessorKey: 'identity',
    header: t('admin.user_column'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
      return h(resolveComponent('UiUserDisplayForAdmin'), {
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
      const user = row.original as AdminUser
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
      const user = row.original as AdminUser
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
      const user = row.original as AdminUser
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
      const user = row.original as AdminUser
      return h(
        resolveComponent('UTooltip'),
        { text: formatDateTime(user.createdAt) },
        {
          default: () =>
            h('div', { class: 'text-sm cursor-help' }, [
              h('div', formatDate(user.createdAt)),
              h('div', { class: 'text-gray-500' }, formatRelativeTime(user.createdAt)),
            ]),
        }
      )
    },
  },
  {
    accessorKey: 'actions',
    header: t('common.actions'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
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

const formatRelativeTime = (date: string) => {
  const now = new Date()
  const target = new Date(date)
  const diffInDays = Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))

  if (diffInDays === 0) return t('common.today')
  if (diffInDays === 1) return t('admin.yesterday')
  if (diffInDays < 7) return t('admin.days_ago', { count: diffInDays })
  if (diffInDays < 30) return t('admin.weeks_ago', { count: Math.floor(diffInDays / 7) })
  if (diffInDays < 365) return t('admin.months_ago', { count: Math.floor(diffInDays / 30) })
  return t('admin.years_ago', { count: Math.floor(diffInDays / 365) })
}

const getUserActions = (user: AdminUser) => {
  console.log('Creating actions for user:', user.pseudo)

  const actions: any[] = [
    // Action pour voir le profil
    {
      label: t('admin.view_profile'),
      icon: 'i-heroicons-user',
      to: `/admin/users/${user.id}`,
    },
  ]

  // Actions d'administration
  if (!user.isGlobalAdmin) {
    actions.push({
      label: t('admin.promote_to_admin'),
      icon: 'i-heroicons-shield-check',
      onClick: () => {
        console.log('Promote clicked for:', user.pseudo)
        promoteToAdmin(user)
      },
    })
  } else {
    actions.push({
      label: t('admin.demote'),
      icon: 'i-heroicons-shield-exclamation',
      onClick: () => {
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
      onClick: () => {
        console.log('Delete clicked for:', user.pseudo)
        openDeletionModal(user)
      },
    })
  }

  return [actions]
}

// Fonctions d'action
const promoteToAdmin = async (user: AdminUser) => {
  try {
    const confirmMessage = t('admin.confirm_promote_to_admin', {
      name: `${user.prenom} ${user.nom}`,
    })

    if (confirm(confirmMessage)) {
      const updatedUser = await $fetch<AdminUser>(`/api/admin/users/${user.id}/promote`, {
        method: 'PUT',
        body: { isGlobalAdmin: true },
      })

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

const demoteFromAdmin = async (user: AdminUser) => {
  try {
    const confirmMessage = t('admin.confirm_demote_from_admin', {
      name: `${user.prenom} ${user.nom}`,
    })

    if (confirm(confirmMessage)) {
      const updatedUser = await $fetch<AdminUser>(`/api/admin/users/${user.id}/promote`, {
        method: 'PUT',
        body: { isGlobalAdmin: false },
      })

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
const openDeletionModal = (user: AdminUser) => {
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
    }

    const data = await $fetch<UsersApiResponse>('/api/admin/users', {
      query: params,
    })

    users.value = data.users
    pagination.value = data.pagination
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

// Charger les données au montage
onMounted(() => {
  fetchUsers()
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
</script>
