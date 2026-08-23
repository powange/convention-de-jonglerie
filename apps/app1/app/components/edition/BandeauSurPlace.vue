<template>
  <UAlert
    v-if="nomEdition"
    icon="i-heroicons-map-pin"
    color="info"
    variant="soft"
    class="mb-4"
    :title="$t('edition.sur_place.titre', { nom: nomEdition })"
    :description="$t('edition.sur_place.description')"
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

const retourAccueil = () => router.push('/')
</script>
