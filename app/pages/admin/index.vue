<template>
  <div>
    <!-- En-tête du dashboard -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-shield-check" class="text-blue-600" />
        Dashboard Administrateur
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        Tableau de bord et outils d'administration de la plateforme
      </p>
    </div>

    <!-- Statistiques rapides -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Utilisateurs</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalUsers }}</p>
            <p class="text-xs text-green-600">+{{ stats.newUsersThisMonth }} ce mois</p>
          </div>
          <UIcon name="i-heroicons-users" class="h-8 w-8 text-blue-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Conventions</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalConventions }}</p>
            <p class="text-xs text-green-600">+{{ stats.newConventionsThisMonth }} ce mois</p>
          </div>
          <UIcon name="i-heroicons-building-library" class="h-8 w-8 text-purple-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Éditions</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalEditions }}</p>
            <p class="text-xs text-green-600">+{{ stats.newEditionsThisMonth }} ce mois</p>
          </div>
          <UIcon name="i-heroicons-calendar" class="h-8 w-8 text-green-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Super Admins</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalAdmins }}</p>
            <p class="text-xs text-gray-500">Administrateurs actifs</p>
          </div>
          <UIcon name="i-heroicons-shield-check" class="h-8 w-8 text-red-500" />
        </div>
      </UCard>
    </div>

    <!-- Navigation des outils d'administration -->
    <div class="mb-8">
      <h2 class="text-xl font-semibold mb-4">Outils d'Administration</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <!-- Gestion des utilisateurs -->
        <NuxtLink to="/admin/users" class="block">
          <UCard class="hover:shadow-lg transition-shadow cursor-pointer">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-3">
                <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <UIcon name="i-heroicons-users" class="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 class="font-semibold text-lg">Gestion des Utilisateurs</h3>
              </div>
              <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Consulter, filtrer et gérer tous les utilisateurs de la plateforme
              </p>
              <div class="flex items-center gap-4 text-sm text-gray-500">
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-eye" class="h-4 w-4" />
                  Voir les profils
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-funnel" class="h-4 w-4" />
                  Filtrer & trier
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
                <h3 class="font-semibold text-lg text-gray-500">Paramètres Système</h3>
              </div>
              <p class="text-gray-400 text-sm mb-4">
                Configuration générale de la plateforme
              </p>
              <UBadge color="gray" variant="soft" size="xs">Bientôt disponible</UBadge>
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
                <h3 class="font-semibold text-lg text-gray-500">Statistiques Avancées</h3>
              </div>
              <p class="text-gray-400 text-sm mb-4">
                Rapports détaillés et analytiques
              </p>
              <UBadge color="gray" variant="soft" size="xs">Bientôt disponible</UBadge>
            </div>
          </div>
        </UCard>

      </div>
    </div>

    <!-- Activité récente -->
    <div class="mb-8">
      <h2 class="text-xl font-semibold mb-4">Activité Récente</h2>
      <UCard>
        <div v-if="loading" class="text-center py-6">
          <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin mx-auto mb-2" />
          <p class="text-gray-500">Chargement de l'activité récente...</p>
        </div>
        
        <div v-else-if="recentActivity.length === 0" class="text-center py-6">
          <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p class="text-gray-500">Aucune activité récente</p>
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

    <!-- Liens rapides -->
    <div>
      <h2 class="text-xl font-semibold mb-4">Liens Rapides</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <UButton
          to="/admin/users"
          color="blue"
          variant="outline"
          class="justify-center"
          icon="i-heroicons-users"
        >
          Tous les utilisateurs
        </UButton>
        
        <UButton
          to="/my-conventions"
          color="purple"
          variant="outline"
          class="justify-center"
          icon="i-heroicons-building-library"
        >
          Mes conventions
        </UButton>
        
        <UButton
          to="/"
          color="green"
          variant="outline"
          class="justify-center"
          icon="i-heroicons-home"
        >
          Retour accueil
        </UButton>
        
        <UButton
          color="gray"
          variant="outline"
          class="justify-center"
          icon="i-heroicons-arrow-path"
          @click="refreshData"
          :loading="loading"
        >
          Actualiser
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Middleware de protection pour super admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin']
})

const authStore = useAuthStore()

// Métadonnées de la page
useSeoMeta({
  title: 'Dashboard Admin - Administration',
  description: 'Tableau de bord administrateur pour la gestion de la plateforme'
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
  totalAdmins: 0
})

const recentActivity = ref([])

// Fonctions utilitaires
const formatRelativeTime = (date: string) => {
  const now = new Date()
  const target = new Date(date)
  const diffInMinutes = Math.floor((now.getTime() - target.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'À l\'instant'
  if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `Il y a ${diffInHours}h`
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `Il y a ${diffInDays} jours`
  
  return target.toLocaleDateString('fr-FR')
}

const getActivityIcon = (type: string) => {
  const icons = {
    user_registered: 'i-heroicons-user-plus',
    convention_created: 'i-heroicons-building-library',
    edition_created: 'i-heroicons-calendar-plus',
    admin_promoted: 'i-heroicons-shield-check'
  }
  return icons[type] || 'i-heroicons-information-circle'
}

const getActivityIconClass = (type: string) => {
  const classes = {
    user_registered: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    convention_created: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    edition_created: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    admin_promoted: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
  }
  return classes[type] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
}

// Fonction pour charger les statistiques
const loadStats = async () => {
  try {
    // Temporairement désactivé - API à créer plus tard
    // const data = await $fetch('/api/admin/stats')
    // stats.value = data
    
    // Valeurs par défaut pour le développement
    stats.value = {
      totalUsers: 156,
      newUsersThisMonth: 12,
      totalConventions: 45,
      newConventionsThisMonth: 3,
      totalEditions: 134,
      newEditionsThisMonth: 8,
      totalAdmins: 2
    }
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error)
    // Valeurs par défaut en cas d'erreur
    stats.value = {
      totalUsers: 156,
      newUsersThisMonth: 12,
      totalConventions: 45,
      newConventionsThisMonth: 3,
      totalEditions: 134,
      newEditionsThisMonth: 8,
      totalAdmins: 2
    }
  }
}

// Fonction pour charger l'activité récente
const loadRecentActivity = async () => {
  // Temporairement désactivé - API à créer plus tard
  // try {
  //   const data = await $fetch('/api/admin/activity')
  //   recentActivity.value = data
  // } catch (error) {
  //   console.error('Erreur lors du chargement de l\'activité:', error)
  // }
  
  // Données d'exemple pour le développement
  recentActivity.value = [
    {
      id: 1,
      type: 'user_registered',
      title: 'Nouvel utilisateur inscrit',
      description: 'Marie Dupont s\'est inscrite sur la plateforme',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    {
      id: 2,
      type: 'convention_created',
      title: 'Nouvelle convention créée',
      description: 'Convention de Printemps 2025 créée par Jean Martin',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    }
  ]
}

// Fonction pour actualiser toutes les données
const refreshData = async () => {
  loading.value = true
  await Promise.all([
    loadStats(),
    loadRecentActivity()
  ])
  loading.value = false
}

// Charger les données au montage
onMounted(() => {
  refreshData()
})
</script>