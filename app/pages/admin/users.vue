<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" aria-label="Breadcrumb">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink to="/admin" class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white">
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">{{ $t('admin.user_management') }}</span>
          </div>
        </li>
      </ol>
    </nav>

    <div class="mb-6">
      <h1 class="text-3xl font-bold">{{ $t('admin.user_management') }}</h1>
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
            size="sm"
            @input="debouncedSearch"
          />
        </div>
        
        <!-- Filtre par statut admin -->
        <USelect
          v-model="adminFilter"
          :items="adminFilterOptions"
          value-key="value"
          size="sm"
          class="w-full sm:w-48"
          @change="fetchUsers"
        />
        
        <!-- Filtre par email vérifié -->
        <USelect
          v-model="emailFilter"
          :items="emailFilterOptions"
          value-key="value"
          size="sm"
          class="w-full sm:w-48"
          @change="fetchUsers"
        />
        
        <!-- Tri -->
        <USelect
          v-model="sortOption"
          :items="sortOptions"
          value-key="value"
          size="sm"
          class="w-full sm:w-48"
          @change="fetchUsers"
        />
      </div>
      
      <!-- Statistiques rapides -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-primary">{{ stats.total }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">{{ $t('admin.total_users') }}</div>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">{{ stats.verified }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">{{ $t('admin.email_verified') }}</div>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">{{ stats.admins }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">{{ $t('admin.super_admins') }}</div>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-purple-600">{{ stats.creators }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">{{ $t('admin.content_creators') }}</div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Tableau des utilisateurs -->
    <UCard>
      <UTable
        :data="users"
        :columns="columns"
        :loading="loading"
        class="w-full"
      />

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="flex justify-center mt-6">
        <UPagination
          v-model="currentPage"
          :total="pagination.totalCount"
          :page-count="pagination.limit"
          :max="5"
          @update:model-value="fetchUsers"
        />
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
// Middleware de protection pour super admin
// Import du store d'authentification
import { useAuthStore } from '~/stores/auth'
import { h, resolveComponent } from 'vue'

definePageMeta({
  middleware: ['auth-protected', 'super-admin']
})

const { t } = useI18n()


// Types pour les utilisateurs
interface UserCount {
  createdConventions: number
  createdEditions: number
  favoriteEditions: number
}

interface AdminUser {
  id: number
  email: string
  pseudo: string
  nom: string
  prenom: string
  profilePicture: string | null
  isEmailVerified: boolean
  isGlobalAdmin: boolean
  createdAt: string
  _count: UserCount
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
  users: AdminUser[]
  pagination: PaginationData
}

interface DropdownMenuItem {
  label: string
  icon: string
  color?: 'error' | 'warning' | 'success' | 'primary'
  onSelect: () => void
}

// Métadonnées de la page
useSeoMeta({
  title: t('admin.user_management') + ' - Admin',
  description: t('admin.user_management_description')
})

// État réactif
const loading = ref(false)
const users = ref<AdminUser[]>([])
const pagination = ref<PaginationData>({
  page: 1,
  limit: 20,
  totalCount: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false
})

const searchQuery = ref('')
const adminFilter = ref('all')
const emailFilter = ref('all')
const sortOption = ref('createdAt:desc')
const currentPage = ref(1)

// Statistiques rapides
const stats = computed(() => {
  const total = pagination.value.totalCount
  const verified = users.value.filter((u: AdminUser) => u.isEmailVerified).length
  const admins = users.value.filter((u: AdminUser) => u.isGlobalAdmin).length
  const creators = users.value.filter((u: AdminUser) => 
    u._count.createdConventions > 0 || u._count.createdEditions > 0
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
      return h('div', { class: 'flex items-center gap-3' }, [
        h(resolveComponent('UiUserAvatar'), {
          user: user,
          size: 'md',
          border: true
        }),
        h('div', [
          h('div', { class: 'font-medium' }, `${user.prenom} ${user.nom}`),
          h('div', { class: 'text-sm text-gray-500' }, `@${user.pseudo}`)
        ])
      ])
    }
  },
  {
    accessorKey: 'email',
    header: t('common.email'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
      return h('div', { class: 'flex items-center gap-2' }, [
        h('span', user.email),
        user.isEmailVerified 
          ? h(resolveComponent('UBadge'), { color: 'success', variant: 'soft', size: 'xs' }, () => t('admin.verified'))
          : h(resolveComponent('UBadge'), { color: 'warning', variant: 'soft', size: 'xs' }, () => t('admin.not_verified'))
      ])
    }
  },
  {
    accessorKey: 'role', 
    header: t('admin.role'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
      return h(resolveComponent('UBadge'), {
        color: user.isGlobalAdmin ? 'error' : 'neutral',
        variant: user.isGlobalAdmin ? 'solid' : 'soft'
      }, () => user.isGlobalAdmin ? t('admin.super_admin') : t('admin.user'))
    }
  },
  {
    accessorKey: 'activity',
    header: t('admin.activity'), 
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
      const activities = []
      
      if (user._count.createdConventions > 0) {
        activities.push(h('div', { class: 'flex items-center gap-1' }, [
          h(resolveComponent('UIcon'), { name: 'i-heroicons-building-library', class: 'w-4 h-4 text-blue-500' }),
          h('span', `${user._count.createdConventions} ${t('admin.conventions_count')}`)
        ]))
      }
      
      if (user._count.createdEditions > 0) {
        activities.push(h('div', { class: 'flex items-center gap-1' }, [
          h(resolveComponent('UIcon'), { name: 'i-heroicons-calendar', class: 'w-4 h-4 text-green-500' }),
          h('span', `${user._count.createdEditions} ${t('admin.editions_count')}`)
        ]))
      }
      
      if (user._count.favoriteEditions > 0) {
        activities.push(h('div', { class: 'flex items-center gap-1' }, [
          h(resolveComponent('UIcon'), { name: 'i-heroicons-heart', class: 'w-4 h-4 text-red-500' }),
          h('span', `${user._count.favoriteEditions} ${t('admin.favorites_count')}`)
        ]))
      }
      
      if (activities.length === 0) {
        activities.push(h('div', { class: 'text-gray-400' }, t('admin.no_activity')))
      }
      
      return h('div', { class: 'text-sm space-y-1' }, activities)
    }
  },
  {
    accessorKey: 'createdAt',
    header: t('admin.registration'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
      return h('div', { class: 'text-sm' }, [
        h('div', formatDate(user.createdAt)),
        h('div', { class: 'text-gray-500' }, formatRelativeTime(user.createdAt))
      ])
    }
  },
  {
    accessorKey: 'actions',
    header: t('admin.actions'),
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
      return h(resolveComponent('UDropdownMenu'), {
        items: getUserActions(user)
      }, {
        default: () => h(resolveComponent('UButton'), {
          color: 'neutral',
          variant: 'ghost', 
          icon: 'i-heroicons-ellipsis-horizontal',
          size: 'sm'
        })
      })
    }
  }
]

// Options de filtrage
const adminFilterOptions = [
  { label: t('admin.all_users'), value: 'all' },
  { label: t('admin.normal_users'), value: 'users' },
  { label: t('admin.super_administrators'), value: 'admins' }
]

const emailFilterOptions = [
  { label: t('admin.all_emails'), value: 'all' },
  { label: t('admin.verified_emails'), value: 'verified' },
  { label: t('admin.unverified_emails'), value: 'unverified' }
]

const sortOptions = [
  { label: t('admin.newest_first'), value: 'createdAt:desc' },
  { label: t('admin.oldest_first'), value: 'createdAt:asc' },
  { label: t('admin.name_a_z'), value: 'nom:asc' },
  { label: t('admin.name_z_a'), value: 'nom:desc' },
  { label: t('admin.email_a_z'), value: 'email:asc' },
  { label: t('admin.email_z_a'), value: 'email:desc' }
]

// Fonctions utilitaires
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const formatRelativeTime = (date: string) => {
  const now = new Date()
  const target = new Date(date)
  const diffInDays = Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffInDays === 0) return t('admin.today')
  if (diffInDays === 1) return t('admin.yesterday')
  if (diffInDays < 7) return t('admin.days_ago', { count: diffInDays })
  if (diffInDays < 30) return t('admin.weeks_ago', { count: Math.floor(diffInDays / 7) })
  if (diffInDays < 365) return t('admin.months_ago', { count: Math.floor(diffInDays / 30) })
  return t('admin.years_ago', { count: Math.floor(diffInDays / 365) })
}

const getUserActions = (user: AdminUser): DropdownMenuItem[] => {
  const actions: DropdownMenuItem[] = [
    // Action pour voir le profil
    {
      label: t('admin.view_profile'),
      icon: 'i-heroicons-user',
      onSelect: () => navigateTo(`/profile/${user.id}`)
    }
  ]
  
  // Actions d'administration
  if (!user.isGlobalAdmin) {
    actions.push({
      label: t('admin.promote_to_admin'),
      icon: 'i-heroicons-shield-check',
      onSelect: () => promoteToAdmin(user)
    })
  } else {
    actions.push({
      label: t('admin.demote'),
      icon: 'i-heroicons-shield-exclamation',
      color: 'error' as const,
      onSelect: () => demoteFromAdmin(user)
    })
  }
  
  return actions
}

// Fonctions d'action
const promoteToAdmin = async (user: AdminUser) => {
  // TODO: Implémenter la promotion
  console.log('Promote:', user)
}

const demoteFromAdmin = async (user: AdminUser) => {
  // TODO: Implémenter la rétrogradation
  console.log('Demote:', user)
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
      emailFilter: emailFilter.value
    }
    
    // Ajouter le token d'authentification depuis le store
    const authStore = useAuthStore()
    const headers: Record<string, string> = {}
    
    if (authStore.token) {
      headers.Authorization = `Bearer ${authStore.token}`
    }
    
    const data = await $fetch<UsersApiResponse>('/api/admin/users', {
      query: params,
      headers
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
      description: t('admin.cannot_load_users')
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