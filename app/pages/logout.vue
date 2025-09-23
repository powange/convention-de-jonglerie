<template>
  <div>
    <p>{{ $t('auth.logging_out') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

// Métadonnées SEO
useSeoMeta({
  title: 'Déconnexion',
})

const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()
const { t } = useI18n()

// Récupérer le returnTo depuis les paramètres de la route AVANT nextTick
const currentRoute = useRoute()
const { cleanReturnTo } = useReturnTo()

// Récupérer le returnTo depuis les query params ou utiliser la route comme fallback
const returnToParam = currentRoute.query.returnTo as string
const returnTo = returnToParam ? cleanReturnTo(returnToParam) : '/'

// Exécuter la déconnexion et redirection immédiatement via nextTick
nextTick(async () => {
  // Liste des pages qui nécessitent une authentification
  const protectedRoutes = [
    '/profile',
    '/favorites',
    '/my-conventions',
    '/my-volunteer-applications',
    '/notifications',
    '/admin',
  ]

  // Patterns de routes protégées (pour les routes dynamiques)
  const protectedPatterns = [
    '/edit$', // /conventions/[id]/edit, /editions/[id]/edit (fin de route)
    '/add$', // /conventions/[id]/add, /editions/[id]/add (fin de route)
    '/gestion', // /editions/[id]/gestion - page d'administration des bénévoles
    '/admin/', // /admin/*
  ]

  // Vérifier si la route de retour est protégée
  const matchesStaticRoute = returnTo && protectedRoutes.some((route) => returnTo.startsWith(route))
  const matchesPattern =
    returnTo &&
    protectedPatterns.some((pattern) => {
      const regex = new RegExp(`${pattern}(/|\\?|$)`)
      return regex.test(returnTo)
    })

  const isProtectedRoute = matchesStaticRoute || matchesPattern

  // Effectuer la déconnexion
  authStore.logout()
  toast.add({
    title: t('auth.logout_success_message'),
    icon: 'i-heroicons-check-circle',
    color: 'success',
  })

  // Rediriger immédiatement
  if (isProtectedRoute) {
    await router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`)
  } else {
    // Rediriger vers la page d'accueil par défaut pour éviter de rester bloqué
    await router.push(returnTo || '/')
  }
})
</script>
