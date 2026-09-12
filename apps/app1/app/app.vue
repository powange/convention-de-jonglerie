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

      <!-- Signe de vie pendant une navigation : discret, en bas, hors du chemin de lecture. -->
      <UiRouteLoadingBar />

      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>

    <UToast />
  </UApp>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

// État de chargement
const isLoading = ref(true)
const siteLoaded = ref(false)

// Durée de l'animation settle (doit correspondre au CSS du composant LoadingLogo)
const SETTLE_DURATION = 1000

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

// Rien ici sur l'indexation, et c'est délibéré : @nuxtjs/seo s'en charge, à partir de
// `NUXT_SITE_ENV` lu à l'exécution — `staging` sur release, absent en production.
//
// Ce bloc posait une balise `robots: noindex` quand `NUXT_ENV` valait `staging`/`release`. Il
// fonctionnait, et c'était bien le problème : il était le SEUL des trois signaux à fonctionner.
// L'en-tête X-Robots-Tag annonçait `index, follow` — celui du module, qui écrasait celui du
// middleware `server/middleware/noindex.ts`, supprimé avec ce bloc. Une page qui dit `noindex`
// dans sa balise et `index` dans son en-tête n'est pas une protection, c'est une coïncidence
// favorable : la directive la plus restrictive l'emporte.
//
// Depuis #389, les signaux viennent d'une seule source et s'accordent. Vérifié sur les trois
// environnements : dev et release servent `noindex, nofollow`, la production `index, follow`.
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
