<template>
  <!-- Recherche en cours : une mesure de position demande une à deux secondes, pendant lesquelles
       l'utilisateur commence à lire l'accueil. L'annoncer évite que le changement de page ne
       paraisse surgir de nulle part. -->
  <UAlert
    v-if="detectionEnCours"
    icon="i-heroicons-map-pin"
    color="neutral"
    variant="soft"
    class="mb-4"
    :title="$t('edition.sur_place.recherche_en_cours')"
  />

  <!-- Affiché seulement quand une convention se déroule et que la détection automatique n'a rien
       donné : la plus grande partie de l'année, rien n'apparaît. -->
  <UAlert
    v-else-if="visible"
    icon="i-heroicons-map-pin"
    color="info"
    variant="soft"
    class="mb-4"
    :title="$t('edition.sur_place.proposition_titre')"
    :actions="[
      {
        label: $t('edition.sur_place.proposition_action'),
        color: 'info',
        variant: 'solid',
        loading: recherche,
        onClick: chercher,
      },
    ]"
  >
    <template #description>
      <p>{{ $t('edition.sur_place.proposition_description') }}</p>
      <!-- Raison d'un échec de localisation : refus, expiration, capacité interdite. Sans elle,
           un clic sans effet passe pour une panne de l'application. -->
      <p
        v-if="diagnostic"
        class="mt-2 font-mono text-xs break-all select-all text-gray-600 dark:text-gray-400"
      >
        {{ diagnostic }}
      </p>
    </template>
  </UAlert>
</template>

<script setup lang="ts">
/**
 * Propose de chercher l'édition où l'on se trouve, à la demande.
 *
 * La détection automatique exige de connaître l'état de l'autorisation de localisation sans la
 * demander — ce que tous les navigateurs ne permettent pas, Safari au premier chef. Sans ce
 * bouton, la fonctionnalité resterait lettre morte sur une bonne part des téléphones.
 *
 * Le geste de l'utilisateur vaut consentement : la demande du navigateur répond alors à un clic
 * plutôt que de surgir sans raison, ce qui la rend acceptable — et bien moins souvent refusée.
 */
const { demanderPosition, editionEnCoursExiste, detectionEnCours } = useEditionSurPlace()
const toast = useToast()
const { t } = useI18n()

const recherche = ref(false)
const epuise = ref(false)
/** Relevé temporaire affiché après un échec, pour comprendre ce qui a manqué. */
const diagnostic = ref<string | null>(null)

const visible = computed(() => editionEnCoursExiste.value && !epuise.value)

const chercher = async () => {
  recherche.value = true
  diagnostic.value = null
  try {
    if (import.meta.client && !navigator.geolocation) {
      diagnostic.value =
        'géolocalisation indisponible dans ce navigateur — souvent le signe d’une origine non sécurisée (HTTPS requis)'
      return
    }

    const { trouve, diagnostic: releve } = await demanderPosition()
    if (!trouve) {
      // Le dire : une recherche silencieuse qui n'aboutit pas laisse croire à une panne.
      toast.add({ title: t('edition.sur_place.aucune_trouvee'), color: 'warning' })
      // L'encart reste affiché tant qu'il porte un relevé : le masquer emporterait avec lui la
      // seule trace de ce qui s'est passé.
      diagnostic.value = releve ?? null
      if (!releve) epuise.value = true
    }
  } finally {
    recherche.value = false
  }
}
</script>
