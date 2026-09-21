<!--
  Le choix des colonnes affichées d'un tableau.

  Le motif existait en double — la liste des artistes et celle d'un groupe de stock l'avaient
  chacune recopié, à la virgule près, dans leur propre `template`. Une troisième copie était sur le
  point de partir pour les organisateurs. Deux copies d'un menu, c'est déjà deux endroits où
  corriger le jour où l'une des cases ne se décoche plus.

  Il se place à côté du bouton d'export, et les deux répondent à la même question : ce tableau
  montre plus — ou moins — que ce dont j'ai besoin. Choisir ses colonnes, puis les emporter.
-->
<template>
  <UDropdownMenu :items="colonnes" :disabled="colonnes.length === 0">
    <UButton
      icon="i-heroicons-view-columns"
      :color="color"
      :variant="variant"
      :size="size"
      :disabled="colonnes.length === 0"
    >
      <span class="hidden sm:inline">{{ label ?? t('common.columns') }}</span>
    </UButton>
  </UDropdownMenu>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /**
     * L'instance TanStack du tableau : `tableRef?.tableApi`.
     *
     * Absente avant le montage — d'où le menu désactivé plutôt qu'un bouton qui s'ouvrirait sur
     * le vide. Le passer en propriété la rend réactive : le menu se remplit dès que le tableau
     * existe, sans que l'appelant ait à s'en occuper.
     */
    tableApi?: unknown
    /**
     * Le nom lisible d'une colonne, d'après son identifiant.
     *
     * À défaut, l'identifiant lui-même : mieux vaut « dietaryPreference » qu'une ligne vide dans
     * la liste — on reconnaît au moins de quoi on parle.
     */
    libelle?: (id: string) => string
    label?: string
    color?: 'primary' | 'neutral' | 'success' | 'warning' | 'error'
    variant?: 'solid' | 'outline' | 'soft' | 'ghost' | 'subtle' | 'link'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { color: 'neutral', variant: 'outline', size: 'sm' }
)

const { t } = useI18n()

/** Ce qu'on lit de l'instance du tableau. Le reste de TanStack ne nous regarde pas. */
interface ColonneDuTableau {
  id: string
  getCanHide: () => boolean
  getIsVisible: () => boolean
  toggleVisibility: (visible: boolean) => void
}

interface ApiDeTableau {
  getAllColumns: () => ColonneDuTableau[]
}

/**
 * Une case par colonne masquable.
 *
 * `getCanHide()` respecte les colonnes qu'un écran a déclarées `enableHiding: false` — le nom d'un
 * objet, la case de sélection : masquer l'une rendrait le tableau illisible, et l'autre
 * inutilisable.
 *
 * `onSelect` empêche la fermeture du menu à chaque clic : on coche rarement une seule colonne, et
 * rouvrir le menu entre chaque case est le genre de détail qui fait renoncer à s'en servir.
 */
const colonnes = computed(() => {
  const api = props.tableApi as ApiDeTableau | undefined
  const toutes = api?.getAllColumns?.() ?? []

  return toutes
    .filter((colonne) => colonne.getCanHide())
    .map((colonne) => ({
      label: props.libelle?.(colonne.id) ?? colonne.id,
      type: 'checkbox' as const,
      checked: colonne.getIsVisible(),
      onUpdateChecked(coche: boolean) {
        colonne.toggleVisibility(!!coche)
      },
      onSelect(evenement?: Event) {
        evenement?.preventDefault()
      },
    }))
})
</script>
