<template>
  <UAlert
    v-if="nomEdition"
    icon="i-heroicons-map-pin"
    color="info"
    variant="soft"
    class="mb-4"
    :title="$t('edition.sur_place.titre', { nom: nomEdition })"
    :description="$t(cleDescription)"
    :actions="[
      {
        label: $t('edition.sur_place.retour_accueil'),
        color: 'neutral',
        variant: 'outline',
        onClick: retourAccueil,
      },
    ]"
  />
</template>

<script setup lang="ts">
/**
 * Signale que l'on a été amené ici par la détection de position, et offre d'en repartir.
 *
 * Sans ce bandeau, la redirection serait une surprise sans explication ni recours : on ouvre
 * l'application, on se retrouve ailleurs que sur l'accueil, sans savoir pourquoi.
 */
const route = useRoute()
const router = useRouter()

const nomEdition = computed(() => {
  const valeur = route.query.surPlace
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null
})

/**
 * La formulation suit la période : « cette convention se déroule autour de vous » serait faux
 * pendant le montage, où elle n'a pas encore ouvert. Sans période transmise — un lien recopié,
 * une version antérieure — on retombe sur la phrase générale.
 */
const cleDescription = computed(() => {
  const periode = route.query.periode
  if (periode === 'montage') return 'edition.sur_place.description_montage'
  if (periode === 'demontage') return 'edition.sur_place.description_demontage'
  return 'edition.sur_place.description'
})

const retourAccueil = () => router.push('/')
</script>
