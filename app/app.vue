<template>
  <UApp>
    <!-- Loading Screen -->
    <div v-if="isLoading" class="loading-screen">
      <img src="/logos/logo-jc-anim-orbit.svg" :alt="$t('common.loading')" class="loading-logo" />
    </div>

    <ClientOnly>
      <!-- Bannière d'impersonation -->
      <UiImpersonationBanner />

      <!-- Bannière d'installation PWA -->
      <PWAInstallBanner />

      <!-- Modale de promotion des notifications push -->
      <NotificationsPushPromoModal />
    </ClientOnly>

    <AppHeader />

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <AppFooter />
    <UToast />
  </UApp>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

// État de chargement
const isLoading = ref(true)

// Mettre à jour l'attribut lang du HTML selon la locale active
const { locale } = useI18n()
useHead(() => ({
  htmlAttrs: {
    lang: locale.value,
  },
}))

// Utiliser nextTick pour s'assurer que nous sommes côté client après hydration
onMounted(async () => {
  // Le plugin auth.client.ts s'occupe maintenant de l'initialisation de l'authentification

  await nextTick()

  // Attendre que tout soit chargé
  const hideLoading = () => {
    // Petit délai pour s'assurer que l'hydration est complète
    setTimeout(() => {
      isLoading.value = false
    }, 500)
  }

  // Utiliser useEventListener de VueUse pour gérer automatiquement le cleanup
  useEventListener(document, 'readystatechange', () => {
    if (document.readyState === 'complete') {
      hideLoading()
    }
  })

  // Si tout est déjà chargé
  if (document.readyState === 'complete') {
    hideLoading()
  } else {
    // Attendre que tout soit chargé (images, CSS, etc.)
    useEventListener(window, 'load', hideLoading)
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
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;

  /* Transition fluide à la sortie */
  transition: opacity 0.8s ease-out;
}

.loading-logo {
  width: 200px;
  height: 200px;
  max-width: 50vw;
  max-height: 50vh;
}

@keyframes fadeOut {
  to {
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
  }
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
