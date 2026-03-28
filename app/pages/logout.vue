<template>
  <div />
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

// Métadonnées SEO
useSeoMeta({
  title: 'Déconnexion',
})

const authStore = useAuthStore()
const router = useRouter()

// Récupérer le returnTo depuis les paramètres de la route AVANT nextTick
const currentRoute = useRoute()
const { cleanReturnTo } = useReturnTo()

// Récupérer le returnTo depuis les query params ou utiliser la route comme fallback
const returnToParam = currentRoute.query.returnTo as string
const returnTo = returnToParam ? cleanReturnTo(returnToParam) : '/'

// Exécuter la déconnexion et redirection immédiatement via nextTick
nextTick(async () => {
  // Effectuer la déconnexion (attendre que la session soit supprimée)
  await authStore.logout()
  // Rediriger vers la page demandée (ou l'accueil par défaut).
  // Si la page est protégée, le middleware auth-protected se chargera
  // de rediriger vers /login?returnTo=... automatiquement.
  await router.push(returnTo || '/')
})
</script>
