<template>
  <div
    class="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
  >
    <UCard class="w-full max-w-md">
      <div class="text-center">
        <UIcon :name="icone" class="mx-auto mb-4 size-12" :class="classeIcone" />

        <h1 class="text-xl font-semibold">{{ titre }}</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ description }}</p>

        <!-- Le code n'apparaît que pour une VRAIE erreur : l'afficher sur une coupure de réseau
             fait croire à une panne du site, ce qui était précisément le défaut constaté. -->
        <p v-if="!connexionInterrompue && statut" class="mt-3 text-xs text-gray-400">
          {{ statut }}
        </p>

        <div class="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <UButton
            v-if="!pageIntrouvable"
            icon="i-heroicons-arrow-path"
            color="primary"
            :label="libelleReessayer"
            @click="reessayer"
          />
          <UButton
            icon="i-heroicons-home"
            color="neutral"
            variant="subtle"
            :label="libelleAccueil"
            @click="retourAccueil"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * La page d'erreur — et la dernière chose que voit quelqu'un dont la connexion a lâché.
 *
 * ⚠️ POURQUOI ELLE EXISTE. Il n'y en avait aucune : les visiteurs tombaient sur la page par défaut
 * de Nuxt, « 500 Internal Server Error » suivi de « Failed to fetch dynamically imported module ».
 * Signalé deux fois en production les 1er et 2 octobre 2026, la seconde avec la capture d'un
 * téléphone en 3G à 13 % de batterie. Mesuré les deux fois : la bribe existait, répondait 200, ses
 * octets étaient identiques au cache et à l'origine. **Rien n'était en panne côté serveur.**
 *
 * ⚠️ ET LA CAUSE N'EST PAS TOUJOURS LE RÉSEAU DU VISITEUR. Le 2 octobre, mesure faite, c'était un
 * fichier PÉRIMÉ dans le cache du CDN : deux builds avaient produit une bribe de même nom et de
 * contenu différent, et l'empreinte SRI du HTML rejetait celle du cache. D'où un libellé qui
 * décrit le FAIT — « le chargement a été interrompu » — et n'accuse ni la connexion du visiteur,
 * ni le serveur.
 *
 * 📍 CE QUE CETTE PAGE NE DOIT JAMAIS FAIRE : dépendre de quoi que ce soit qui se charge à la
 * demande. Elle est le dernier recours, et elle s'affiche précisément quand un chargement a
 * échoué. D'où les libellés de secours en dur sous l'i18n, et aucun composant différé ici.
 */
const props = defineProps<{ error: NuxtError }>()

/**
 * L'i18n, si elle répond.
 *
 * Les traductions sont chargées par domaine selon la route (`app/utils/translation-loaders.ts`) :
 * sur une page d'erreur, rien ne garantit que `common` soit chargé, et une clé non résolue
 * s'afficherait brute. `te()` tranche, et le secours en dur prend le relais.
 */
const i18n = (() => {
  try {
    return useI18n()
  } catch {
    return null
  }
})()

function libelle(cle: string, secoursFr: string, secoursEn: string): string {
  try {
    if (i18n?.te(cle)) return String(i18n.t(cle))
  } catch {
    /* une i18n indisponible ne doit pas emporter la page d'erreur elle-même */
  }
  return String(i18n?.locale?.value ?? 'fr').startsWith('fr') ? secoursFr : secoursEn
}

/**
 * Une coupure pendant le chargement, et non une panne.
 *
 * `echecDeBribe` reconnaît les trois formulations de Chrome, Firefox et Safari pour la même cause,
 * et lit le message d'une erreur SÉRIALISÉE — celle qui arrive ici n'est pas une instance d'`Error`
 * (`app/utils/composant-differe.ts`).
 */
const connexionInterrompue = computed(() => echecDeBribe(props.error))

/** Une adresse qui ne mène nulle part n'est pas une panne, et ne doit pas s'annoncer comme telle. */
const pageIntrouvable = computed(() => props.error?.statusCode === 404)

const icone = computed(() => {
  if (connexionInterrompue.value) return 'i-heroicons-signal-slash'
  if (pageIntrouvable.value) return 'i-heroicons-map'
  return 'i-heroicons-exclamation-triangle'
})
const classeIcone = computed(() => {
  if (connexionInterrompue.value) return 'text-amber-500'
  if (pageIntrouvable.value) return 'text-gray-400'
  return 'text-red-500'
})

const titre = computed(() => {
  if (connexionInterrompue.value)
    return libelle(
      'errors.page_load_failed_title',
      'La connexion a été interrompue',
      'Connection lost'
    )
  if (pageIntrouvable.value)
    return libelle('errors.page_not_found_title', 'Page introuvable', 'Page not found')
  return libelle('errors.error_occurred', 'Une erreur est survenue', 'Something went wrong')
})

const description = computed(() => {
  if (connexionInterrompue.value)
    return libelle(
      'errors.page_load_failed_description',
      "Cette page n'a pas pu finir de se charger. Réessayez dans un instant.",
      'This page could not finish loading. Please try again in a moment.'
    )
  if (pageIntrouvable.value)
    return libelle(
      'errors.page_not_found_description',
      'Cette adresse ne correspond à aucune page du site.',
      'This address does not match any page on the site.'
    )
  return libelle('errors.generic', 'Une erreur est survenue', 'Something went wrong')
})

const libelleReessayer = computed(() => libelle('common.retry', 'Réessayer', 'Try again'))
const libelleAccueil = computed(() =>
  libelle('errors.back_home', "Revenir à l'accueil", 'Back to home')
)

const statut = computed(() => {
  const code = props.error?.statusCode
  return code ? `${code}` : ''
})

useHead({ title: titre })

/**
 * ⚠️ UN RECHARGEMENT DUR, ET NON `reloadNuxtApp`.
 *
 * `reloadNuxtApp` porte une garde anti-boucle — un marqueur `nuxt:reload` en sessionStorage, dix
 * secondes par chemin — qui REFUSERAIT ce rechargement s'il suit de peu celui que
 * `emitRouteChunkError: 'automatic-immediate'` a déjà tenté. Or c'est exactement la situation :
 * on n'arrive sur cette page que lorsque ce rechargement automatique n'a pas suffi. Un clic de
 * l'utilisateur doit toujours agir.
 */
function reessayer() {
  window.location.reload()
}

function retourAccueil() {
  clearError({ redirect: '/' })
}

/**
 * Une seule reprise automatique, et seulement pour une coupure de réseau.
 *
 * Sur un réseau faible, une requête qui échoue réussit souvent à la suivante : le visiteur n'a
 * alors rien vu passer. Le marqueur de session plafonne la reprise à UNE par chemin — sans lui, un
 * déploiement réellement cassé ferait tourner le navigateur en boucle. Après cela, c'est le bouton
 * qui décide, et il décide toujours.
 */
onMounted(() => {
  if (!connexionInterrompue.value) return

  const cle = `bribe:reprise:${window.location.pathname}`
  try {
    if (sessionStorage.getItem(cle)) return
    sessionStorage.setItem(cle, '1')
  } catch {
    // Navigation privée, stockage refusé : pas de reprise automatique plutôt qu'une boucle.
    return
  }
  window.location.reload()
})
</script>
