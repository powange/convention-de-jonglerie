<!--
  Le bouton d'export d'un tableau : un seul bouton, deux formats.

  Il y avait jusqu'ici deux familles d'écrans — ceux qui exportaient en CSV, ceux qui exportaient
  en PDF — et rien à l'écran n'expliquait pourquoi l'un n'offrait pas ce que l'autre proposait.
  Le choix n'appartient pas à l'écran : il appartient à ce qu'on va faire du fichier. Le CSV pour
  retrier dans un tableur, le PDF pour emporter sur le terrain et cocher au crayon.

  Le composant ne sait rien des données : il reçoit deux fonctions et signale l'attente. La
  préparation reste dans l'écran, qui seul connaît ses colonnes et ses filtres.
-->
<template>
  <UDropdownMenu :items="choix" :disabled="disabled">
    <UButton
      icon="i-heroicons-arrow-down-tray"
      :color="color"
      :variant="variant"
      :size="size"
      :loading="enCours"
      :disabled="disabled"
      :label="label ?? t('common.export')"
      trailing-icon="i-heroicons-chevron-down"
    />
  </UDropdownMenu>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Écrit le fichier tableur. Peut être asynchrone. */
    onCsv: () => void | Promise<void>
    /** Compose la feuille imprimable. Peut être asynchrone — `jsPDF` se charge à la demande. */
    onPdf: () => void | Promise<void>
    disabled?: boolean
    /** Un intitulé plus précis que « Exporter » quand l'écran en porte plusieurs. */
    label?: string
    color?: 'primary' | 'neutral' | 'success' | 'warning' | 'error'
    variant?: 'solid' | 'outline' | 'soft' | 'ghost' | 'subtle' | 'link'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { color: 'neutral', variant: 'ghost', size: 'sm' }
)

const { t } = useI18n()
const toast = useToast()
const enCours = ref(false)

/**
 * Le PDF avant le CSV ? Non : le CSV d'abord.
 *
 * C'est le format le plus demandé sur ces écrans-ci — on exporte pour retravailler une liste —
 * et la première entrée d'un menu est celle qu'on choisit sans lire.
 */
const choix = computed(() => [
  [
    {
      label: t('common.export_csv'),
      icon: 'i-heroicons-table-cells',
      onSelect: () => lancer(props.onCsv),
    },
    {
      label: t('common.export_pdf'),
      icon: 'i-heroicons-document-arrow-down',
      onSelect: () => lancer(props.onPdf),
    },
  ],
])

/**
 * Exécute l'export en tenant l'indicateur d'attente et en rattrapant les échecs.
 *
 * Le rattrapage n'est pas une précaution de principe : `jsPDF` se charge à la demande, et un
 * réseau qui lâche entre le clic et le fichier laisserait sinon un bouton tournant pour toujours,
 * sans rien dire.
 */
async function lancer(action: () => void | Promise<void>) {
  if (enCours.value) return
  enCours.value = true
  try {
    await action()
  } catch (erreur: unknown) {
    toast.add({
      title: (erreur as { message?: string })?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    enCours.value = false
  }
}
</script>
