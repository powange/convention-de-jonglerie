<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" aria-label="Breadcrumb">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink to="/admin" class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white">
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            Dashboard
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">Gestion des utilisateurs</span>
          </div>
        </li>
      </ol>
    </nav>

    <div class="mb-6">
      <h1 class="text-3xl font-bold">Gestion des Utilisateurs</h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        Liste complète des utilisateurs inscrits sur la plateforme
      </p>
    </div>

    <!-- Filtres et recherche -->
    <div class="mb-6 space-y-4">
      <div class="flex flex-col sm:flex-row gap-4">
        <!-- Barre de recherche -->
        <div class="flex-1">
          <UInput
            v-model="searchQuery"
            placeholder="Rechercher par email, pseudo, nom ou prénom..."
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
            <div class="text-sm text-gray-600 dark:text-gray-400">Total utilisateurs</div>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">{{ stats.verified }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">Email vérifié</div>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">{{ stats.admins }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">Super admins</div>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <div class="text-2xl font-bold text-purple-600">{{ stats.creators }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">Ont créé du contenu</div>
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
definePageMeta({
  middleware: ['auth-protected', 'super-admin']
})

// Import du store d'authentification
import { useAuthStore } from '~/stores/auth'
import { h, resolveComponent } from 'vue'

// Import des utilitaires avatar
const { getUserAvatar } = useAvatar()

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
  title: 'Gestion des Utilisateurs - Admin',
  description: 'Interface d\'administration pour gérer les utilisateurs'
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
    header: 'Utilisateur',
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
      return h('div', { class: 'flex items-center gap-3' }, [
        h('img', {
          src: getUserAvatar(user, 32),
          alt: `Avatar de ${user.prenom} ${user.nom}`,
          class: 'w-8 h-8 rounded-full border-2 border-gray-200'
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
    header: 'Email',
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
      return h('div', { class: 'flex items-center gap-2' }, [
        h('span', user.email),
        user.isEmailVerified 
          ? h(resolveComponent('UBadge'), { color: 'success', variant: 'soft', size: 'xs' }, () => 'Vérifié')
          : h(resolveComponent('UBadge'), { color: 'warning', variant: 'soft', size: 'xs' }, () => 'Non vérifié')
      ])
    }
  },
  {
    accessorKey: 'role', 
    header: 'Rôle',
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
      return h(resolveComponent('UBadge'), {
        color: user.isGlobalAdmin ? 'error' : 'neutral',
        variant: user.isGlobalAdmin ? 'solid' : 'soft'
      }, () => user.isGlobalAdmin ? 'Super Admin' : 'Utilisateur')
    }
  },
  {
    accessorKey: 'activity',
    header: 'Activité', 
    cell: ({ row }: { row: any }) => {
      const user = row.original as AdminUser
      const activities = []
      
      if (user._count.createdConventions > 0) {
        activities.push(h('div', { class: 'flex items-center gap-1' }, [
          h(resolveComponent('UIcon'), { name: 'i-heroicons-building-library', class: 'w-4 h-4 text-blue-500' }),
          h('span', `${user._count.createdConventions} convention(s)`)
        ]))
      }
      
      if (user._count.createdEditions > 0) {
        activities.push(h('div', { class: 'flex items-center gap-1' }, [
          h(resolveComponent('UIcon'), { name: 'i-heroicons-calendar', class: 'w-4 h-4 text-green-500' }),
          h('span', `${user._count.createdEditions} édition(s)`)
        ]))
      }
      
      if (user._count.favoriteEditions > 0) {
        activities.push(h('div', { class: 'flex items-center gap-1' }, [
          h(resolveComponent('UIcon'), { name: 'i-heroicons-heart', class: 'w-4 h-4 text-red-500' }),
          h('span', `${user._count.favoriteEditions} favori(s)`)
        ]))
      }
      
      if (activities.length === 0) {
        activities.push(h('div', { class: 'text-gray-400' }, 'Aucune activité'))
      }
      
      return h('div', { class: 'text-sm space-y-1' }, activities)
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'Inscription',
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
    header: 'Actions',
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
  { label: 'Tous les utilisateurs', value: 'all' },
  { label: 'Utilisateurs normaux', value: 'users' },
  { label: 'Super administrateurs', value: 'admins' }
]

const emailFilterOptions = [
  { label: 'Tous les emails', value: 'all' },
  { label: 'Emails vérifiés', value: 'verified' },
  { label: 'Emails non vérifiés', value: 'unverified' }
]

const sortOptions = [
  { label: 'Plus récents d\'abord', value: 'createdAt:desc' },
  { label: 'Plus anciens d\'abord', value: 'createdAt:asc' },
  { label: 'Par nom (A-Z)', value: 'nom:asc' },
  { label: 'Par nom (Z-A)', value: 'nom:desc' },
  { label: 'Par email (A-Z)', value: 'email:asc' },
  { label: 'Par email (Z-A)', value: 'email:desc' }
]

// Fonctions utilitaires
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const formatRelativeTime = (date: string) => {
  const now = new Date()
  const target = new Date(date)
  const diffInDays = Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffInDays === 0) return 'Aujourd\'hui'
  if (diffInDays === 1) return 'Hier'
  if (diffInDays < 7) return `Il y a ${diffInDays} jours`
  if (diffInDays < 30) return `Il y a ${Math.floor(diffInDays / 7)} semaines`
  if (diffInDays < 365) return `Il y a ${Math.floor(diffInDays / 30)} mois`
  return `Il y a ${Math.floor(diffInDays / 365)} ans`
}

const getUserActions = (user: AdminUser): DropdownMenuItem[] => {
  const actions: DropdownMenuItem[] = [
    // Action pour voir le profil
    {
      label: 'Voir le profil',
      icon: 'i-heroicons-user',
      onSelect: () => navigateTo(`/profile/${user.id}`)
    }
  ]
  
  // Actions d'administration
  if (!user.isGlobalAdmin) {
    actions.push({
      label: 'Promouvoir en super admin',
      icon: 'i-heroicons-shield-check',
      onSelect: () => promoteToAdmin(user)
    })
  } else {
    actions.push({
      label: 'Rétrograder',
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
  console.log('Promouvoir:', user)
}

const demoteFromAdmin = async (user: AdminUser) => {
  // TODO: Implémenter la rétrogradation
  console.log('Rétrograder:', user)
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
    console.error('Erreur lors du chargement des utilisateurs:', error)
    
    // Si erreur d'authentification, rediriger vers login
    if (error?.statusCode === 401 || error?.status === 401) {
      navigateTo('/login')
      return
    }
    
    useToast().add({
      color: 'red',
      title: 'Erreur',
      description: 'Impossible de charger les utilisateurs'
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