<template>
  <div>
    <p>{{ $t('auth.logging_out') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()
const { t } = useI18n()

onMounted(async () => {
  // Récupérer la route actuelle avant la déconnexion
  const currentRoute = useRoute()
  const returnTo = currentRoute.query.returnTo as string

  // Liste des pages qui nécessitent une authentification
  const protectedRoutes = [
    '/profile',
    '/favorites',
    '/my-conventions',
    '/conventions/add',
    '/editions/add',
  ]

  // Patterns de routes protégées (pour les routes dynamiques)
  const protectedPatterns = [
    '/edit', // /conventions/[id]/edit, /editions/[id]/edit
    '/gestion', // /editions/[id]/gestion
    '/carpool', // /editions/[id]/carpool
    '/editions/add', // /conventions/[id]/editions/add
  ]

  // Vérifier si la route de retour est protégée
  const isProtectedRoute =
    returnTo &&
    (protectedRoutes.some((route) => returnTo.startsWith(route)) ||
      protectedPatterns.some((pattern) => returnTo.includes(pattern)))

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
