<template>
  <UApp>
    <!-- Voile de chargement : un FONDU par-dessus le contenu, et non un rideau devant lui.
         Voir la note du script pour ce qui a changé et pourquoi. -->
    <div v-if="voileVisible" class="loading-screen" :class="{ 'loading-screen--sortie': sortie }">
      <LoadingLogo :loaded="sortie" />
    </div>

    <!-- Le contenu reste masqué jusqu'à l'HYDRATATION, et pas une milliseconde de plus.
         Voir la note du script : ce `v-show` fait plus qu'éviter un saut de mise en page. -->
    <div v-show="!voileVisible">
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

/*
 * Le voile de chargement, et ce qui a changé.
 *
 * ⚠️ IL RETARDAIT UNE PAGE DÉJÀ PRÊTE. Le contenu, rendu par le serveur, était masqué
 * (`v-show="!isLoading"`) jusqu'à `document.readyState === 'complete'` PUIS mille millisecondes
 * d'animation. Sur tout chargement complet, c'était au moins une seconde de plus devant une page
 * déjà écrite — et bien davantage quand les affiches d'éditions tardaient, puisque `load` les
 * attend.
 *
 * Mesuré avant correction, en profil mobile bridé (Slow 4G, processeur ÷4), médiane de trois
 * passes sur release : LCP de 13 344 ms sur l'accueil pour un `load` à 9 493 ms, et 14 716 ms sur
 * une fiche d'édition pour un `load` à 13 007 ms. L'écart, c'est ce voile.
 *
 * Ce qui le remplace : le voile sort dès que l'application est MONTÉE, avec un fondu de 300 ms. Il
 * ne guette plus `load` — donc plus les images — et ne compte plus de durée fixe.
 *
 * ⚠️ LE CONTENU RESTE MASQUÉ JUSQUE-LÀ, ET C'EST UN CHOIX RELU. Une première version le rendait
 * visible dès le rendu serveur, ce qui donne le meilleur LCP possible. Elle a fait tomber quatre
 * lots Playwright, et pour une raison qui n'est pas un artefact de test : les scénarios
 * remplissaient un champ de mot de passe aussitôt après `DOMContentLoaded`, et Vue le
 * RÉINITIALISAIT en s'hydratant. Ce que le `display: none` empêchait, ce n'était donc pas seulement
 * un saut de mise en page — c'était d'écrire dans un formulaire que personne n'écoute encore, et de
 * perdre sa saisie.
 *
 * On garde donc la barrière, en la ramenant de « `load` + une seconde » à « hydratation ». C'est la
 * seconde branche que l'énoncé laissait ouverte — « visible dès l'hydratation » — et elle retire
 * les deux attentes coûteuses sans rouvrir ce piège.
 *
 * Le plafond de sécurité reste, pour une seule raison : si le montage n'arrivait jamais — une
 * erreur d'hydratation, un script bloqué — le voile resterait indéfiniment devant la page. Il
 * garantit qu'il s'en va, quoi qu'il arrive.
 */
const DUREE_DU_FONDU = 300
const PLAFOND_AVANT_SORTIE = 2000

/** Le voile est-il encore dans le DOM ? */
const voileVisible = ref(true)
/** Le fondu est-il lancé ? Déclenche aussi l'animation de sortie du logo. */
const sortie = ref(false)

onMounted(async () => {
  await nextTick()

  const effacerLeVoile = () => {
    if (sortie.value) return
    sortie.value = true
    // Retiré du DOM à la fin du fondu : un `position: fixed` laissé en place, même transparent,
    // continuerait d'intercepter les clics.
    setTimeout(() => {
      voileVisible.value = false
    }, DUREE_DU_FONDU)
  }

  // L'application est montée : il n'y a plus rien à attendre.
  effacerLeVoile()

  // Filet de sécurité, au cas où la ligne ci-dessus n'aurait pas été atteinte.
  setTimeout(effacerLeVoile, PLAFOND_AVANT_SORTIE)
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

  /* Un fondu COURT : 800 ms de sortie s'ajoutaient à la seconde d'attente. */
  opacity: 1;
  transition: opacity 0.3s ease-out;
}

/* La sortie. Les clics passent au travers dès qu'elle commence : le contenu est déjà là, et
   attendre la fin du fondu pour le rendre cliquable rendrait la page inerte sans raison. */
.loading-screen--sortie {
  opacity: 0;
  pointer-events: none;
}

/* Un fondu est une animation : qui n'en veut pas voit le voile disparaître d'un coup. */
@media (prefers-reduced-motion: reduce) {
  .loading-screen {
    transition: none;
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
