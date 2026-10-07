<template>
  <!--
    Un justificatif dans un TABLEAU : une icône, et rien quand il n'y a pas de fichier.

    ⚠️ CE N'EST PAS `ReceiptField`, et la différence est délibérée. Celui-là porte « Ajouter un
    justificatif » quand il est vide, et « Retirer » / « Remplacer » dans son aperçu. Dans une
    fiche, ces gestes sont attendus ; dans un tableau qu'on parcourt à la souris sur vingt lignes,
    ils sont trop engageants — et une invitation à déposer sur chaque ligne sans fichier
    encombrerait trois colonnes. Ici on RELIT, on ne modifie pas : le dépôt reste dans la fiche.

    📍 Rien du tout sans fichier, plutôt qu'une icône grisée : la colonne porte déjà le montant et
    son état, et un troisième signe muet se lirait comme une information.

    📍 UN PDF S'OUVRE DANS UN ONGLET, une image dans la modale de la page. C'est la décision prise
    pour la trésorerie puis pour l'espace artiste : la visionneuse du navigateur fait tout ce qu'une
    `iframe` ne faisait qu'imiter — zoom, pages, impression —, et beaucoup de navigateurs mobiles
    refusent purement d'incorporer un PDF. La règle qui les distingue est partagée, elle n'est pas
    réécrite ici.
  -->
  <UTooltip v-if="url" :text="estUnPdf ? $t('artists.receipt_open_new_tab') : libelle">
    <UButton
      :icon="estUnPdf ? 'i-heroicons-document-text' : 'i-heroicons-paper-clip'"
      color="neutral"
      variant="ghost"
      size="xs"
      :aria-label="libelle"
      :to="estUnPdf ? url : undefined"
      :target="estUnPdf ? '_blank' : undefined"
      :rel="estUnPdf ? 'noopener' : undefined"
      @click="!estUnPdf && emit('voir', url!)"
    />
  </UTooltip>
</template>

<script setup lang="ts">
import { estUnJustificatifPdf } from '~~/shared/utils/justificatif-pdf'

const props = defineProps<{
  /** L'URL du justificatif, ou `null` : l'icône n'apparaît pas sans fichier. */
  url?: string | null
  /** Ce dont il est le justificatif — « Justificatif du défraiement », « Facture de l'artiste ». */
  libelle: string
}>()

const emit = defineEmits<{
  /**
   * Une IMAGE à ouvrir en grand. Les PDF ne passent pas par là : `to` fait du bouton un lien, et
   * le navigateur s'en charge.
   *
   * 📍 C'est la PAGE qui porte la modale, pas ce composant : trois colonnes sur plusieurs dizaines
   * de lignes en poseraient autant d'exemplaires pour n'en ouvrir qu'un à la fois.
   */
  voir: [url: string]
}>()

const estUnPdf = computed(() => estUnJustificatifPdf(props.url))
</script>
