<template>
  <UiConfirmModal
    :model-value="confirmation.ouverte.value"
    :title="confirmation.demande.value?.titre"
    :description="confirmation.demande.value?.description ?? ''"
    :confirm-label="confirmation.demande.value?.libelleConfirmer"
    :confirm-color="confirmation.demande.value?.couleurConfirmer ?? 'error'"
    :loading="confirmation.enCours.value"
    @confirm="confirmation.confirmer"
    @cancel="confirmation.annuler"
    @update:model-value="(ouverte: boolean) => !ouverte && confirmation.annuler()"
  />
</template>

<script setup lang="ts">
import type { Confirmation } from '~/composables/useConfirmation'

/**
 * La modale que `useConfirmation` pilote — une ligne de gabarit par écran.
 *
 * Elle existe pour une raison précise : le câblage de `UiConfirmModal` sur l'état du composable
 * fait treize lignes, et neuf écrans de la gestion d'une édition en avaient besoin. Recopié, ce
 * bloc aurait divergé au premier écran qu'on aurait voulu traiter un peu différemment — et c'est
 * exactement ce que le remplacement de `confirm()` cherchait à corriger.
 *
 * L'objet du composable est reçu entier plutôt que champ par champ : passer six props revenait à
 * déplacer la recopie, pas à la supprimer.
 *
 * La fermeture passe par `annuler` plutôt que par un `v-model` sur la prop : écrire dans l'objet
 * reçu serait muter une prop, et `annuler` dit mieux ce qui se passe — refermer, c'est renoncer.
 * Elle refuse d'ailleurs de le faire tant que l'action est en cours.
 */
defineProps<{ confirmation: Confirmation }>()
</script>
