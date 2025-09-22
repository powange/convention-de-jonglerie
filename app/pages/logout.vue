<template>
  <div>
    <p>{{ $t('auth.logging_out') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

// URL canonique pour éviter le contenu dupliqué avec les paramètres
useSeoMeta({
  canonical: '/logout',
})

const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()
const { t } = useI18n()

onMounted(async () => {
  // Récupérer la route actuelle avant la déconnexion
  const currentRoute = useRoute()
  const { cleanReturnTo } = useReturnTo()

  // Nettoyer l'URL de destination (éviter les boucles returnTo)
  const returnTo = cleanReturnTo(currentRoute)

  // Liste des pages qui nécessitent une authentification
  const protectedRoutes = [
    '/profile',
    '/favorites',
    '/my-conventions',
    '/my-volunteer-applications',
    '/notifications',
    '/conventions/add',
    '/editions/add',
    '/admin',
  ]

  // Patterns de routes protégées (pour les routes dynamiques)
  const protectedPatterns = [
    '/edit$', // /conventions/[id]/edit, /editions/[id]/edit (fin de route)
    '/gestion', // /editions/[id]/gestion - page d'administration des bénévoles
    '/admin/', // /admin/*
    '/editions/add', // /conventions/[id]/editions/add
  ]

  // Debug: afficher les informations
  console.log('🔍 Debug logout - returnTo:', returnTo)
  console.log('🔍 Debug logout - protectedRoutes:', protectedRoutes)
  console.log('🔍 Debug logout - protectedPatterns:', protectedPatterns)

  // Vérifier si la route de retour est protégée
  const matchesStaticRoute = returnTo && protectedRoutes.some((route) => returnTo.startsWith(route))
  const matchesPattern =
    returnTo &&
    protectedPatterns.some((pattern) => {
      // Pour les patterns, on vérifie qu'ils correspondent exactement à la fin du chemin
      // ou qu'ils sont suivis d'un slash ou d'un query parameter
      const regex = new RegExp(`${pattern}(/|\\?|$)`)
      const matches = regex.test(returnTo)
      console.log(`🔍 Pattern "${pattern}" vs "${returnTo}": ${matches}`)
      return matches
    })

  const isProtectedRoute = matchesStaticRoute || matchesPattern

  console.log('🔍 Debug logout - matchesStaticRoute:', matchesStaticRoute)
  console.log('🔍 Debug logout - matchesPattern:', matchesPattern)
  console.log('🔍 Debug logout - isProtectedRoute:', isProtectedRoute)

  authStore.logout()
  toast.add({
    title: t('auth.logout_success_message'),
    icon: 'i-heroicons-check-circle',
    color: 'success',
  })

  // Si on vient d'une page protégée, rediriger vers login avec returnTo
  if (isProtectedRoute) {
    await router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`)
  } else {
    // Sinon, retourner à la page précédente ou à l'accueil
    await router.push(returnTo || '/')
  }
})
</script>
