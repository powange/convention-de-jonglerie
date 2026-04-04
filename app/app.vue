<template>
  <UApp>
    <!-- Loading Screen -->
    <div v-if="isLoading" class="loading-screen">
      <LoadingLogo :loaded="siteLoaded" />
    </div>

    <!-- Contenu masqué pendant le chargement pour éviter les sauts de layout -->
    <div v-show="!isLoading">
      <ClientOnly>
        <!-- Bannière d'impersonation -->
        <UiImpersonationBanner />

        <!-- Bannière d'installation PWA -->
        <PWAInstallBanner />

        <!-- Modale de promotion des notifications push -->
        <NotificationsPushPromoModal />
      </ClientOnly>

      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>

    <UToast v-show="!isLoading" />
  </UApp>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

// État de chargement
const isLoading = ref(true)
const siteLoaded = ref(false)

// Durée de l'animation settle (doit correspondre au CSS du composant LoadingLogo)
const SETTLE_DURATION = 3000

onMounted(async () => {
  await nextTick()

  const triggerSettle = () => {
    // Le site est chargé : déclenche la transition du logo (phase 2+3)
    siteLoaded.value = true

    // Masque le loading screen après la fin de l'animation settle
    setTimeout(() => {
      isLoading.value = false
    }, SETTLE_DURATION)
  }

  // Utiliser useEventListener de VueUse pour gérer automatiquement le cleanup
  useEventListener(document, 'readystatechange', () => {
    if (document.readyState === 'complete') {
      triggerSettle()
    }
  })

  // Si tout est déjà chargé
  if (document.readyState === 'complete') {
    triggerSettle()
  } else {
    useEventListener(window, 'load', triggerSettle)
  }
})

// Configuration SEO conditionnelle pour empêcher l'indexation en staging/release
const shouldDisallowIndexing = computed(() => {
  // Vérifier si nous sommes côté serveur
  if (import.meta.server) {
    return (
      process.env.NODE_ENV !== 'production' ||
      process.env.NUXT_ENV === 'staging' ||
      process.env.NUXT_ENV === 'release' ||
      !process.env.NUXT_PUBLIC_SITE_URL?.includes('juggling-convention.com')
    )
  }
  return false
})

// Ajouter meta robots si nécessaire
if (shouldDisallowIndexing.value) {
  useSeoMeta({
    robots: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  })
}
</script>

<style>
.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh; /* viewport dynamique, evite le saut sur mobile */
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  overflow: hidden;

  /* Transition fluide à la sortie */
  transition: opacity 0.8s ease-out;
}

/* Support du dark mode */
@media (prefers-color-scheme: dark) {
  .loading-screen {
    background: #0f172a; /* bg-slate-900 */
  }
}

/* Force le thème selon la classe dark sur html/body (priorité sur le thème système) */
.dark .loading-screen {
  background: #0f172a !important; /* bg-slate-900 en mode sombre */
}

.light .loading-screen {
  background: white !important; /* fond blanc en mode clair */
}
</style>
