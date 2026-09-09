<!--
  Les tags d'un objet, posés et retirés depuis la liste.

  Taguer est un geste de tri qu'on fait en balayant l'inventaire, pas en modifiant une fiche :
  passer par la modale d'édition obligeait à ouvrir, chercher le champ, enregistrer, fermer — pour
  cocher une case. Ici chaque bascule part aussitôt vers le serveur.
-->
<template>
  <!-- Le clic ne doit pas emmener sur la fiche : taguer et consulter sont deux gestes. -->
  <span @click.stop>
    <UPopover v-if="canManage" :content="{ align: 'start' }">
      <button
        type="button"
        class="group flex flex-wrap items-center gap-1 rounded px-1 -mx-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        :aria-label="$t('gestion.stock.tags.field_label')"
      >
        <StockTagBadge
          v-for="rattachement in item.tags || []"
          :key="rattachement.tag.id"
          :tag="rattachement.tag"
        />
        <span v-if="!item.tags?.length" class="text-gray-400">—</span>
        <!-- Le crayon ne paraît qu'au survol : affiché en permanence sur chaque ligne, il faisait
             un semis d'icônes qui tirait l'œil plus que les tags eux-mêmes. `pointer-coarse` le
             garde visible au doigt, où il n'y a pas de survol pour le révéler. -->
        <UIcon
          name="i-heroicons-pencil-square"
          class="size-3.5 text-gray-400 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100 transition-opacity"
        />
      </button>

      <template #content>
        <div class="p-2 min-w-52 max-h-72 overflow-y-auto space-y-1">
          <p v-if="!tags.length" class="text-sm text-gray-500 italic p-2">
            {{ $t('gestion.stock.tags.empty') }}
          </p>
          <label
            v-for="tag in tags"
            :key="tag.id"
            class="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <UCheckbox
              :model-value="porte(tag.id)"
              :disabled="enregistrement"
              @update:model-value="
                (coche: boolean | 'indeterminate') => basculer(tag.id, coche === true)
              "
            />
            <StockTagBadge :tag="tag" />
          </label>
        </div>
      </template>
    </UPopover>

    <!-- Sans droit de gestion, les pastilles restent lisibles mais ne s'ouvrent pas. -->
    <span v-else class="flex flex-wrap gap-1">
      <StockTagBadge
        v-for="rattachement in item.tags || []"
        :key="rattachement.tag.id"
        :tag="rattachement.tag"
      />
      <span v-if="!item.tags?.length" class="text-gray-400">—</span>
    </span>
  </span>
</template>

<script setup lang="ts">
interface TagLite {
  id: number
  name: string
  color: string
}

const props = defineProps<{
  editionId: number
  item: { id: number; tags?: Array<{ tag: TagLite }> }
  tags: TagLite[]
  canManage: boolean
}>()

const emit = defineEmits<{
  /** Les tags de l'objet après enregistrement, pour que l'appelant rafraîchisse cette seule ligne. */
  updated: [tags: Array<{ tag: TagLite }>]
}>()

const { t } = useI18n()
const toast = useToast()
const enregistrement = ref(false)

const porte = (tagId: number) => (props.item.tags || []).some((r) => r.tag.id === tagId)

/**
 * Envoie la liste complète des tags de l'objet, et non le seul changement : c'est ce que
 * l'endpoint attend, et raisonner en ajouts/retraits laisserait passer une suppression.
 */
async function basculer(tagId: number, coche: boolean) {
  const actuels = (props.item.tags || []).map((r) => r.tag.id)
  const voulus = coche ? [...actuels, tagId] : actuels.filter((id) => id !== tagId)

  enregistrement.value = true
  try {
    // La réponse porte les tags à jour : on s'en sert plutôt que de recharger la liste entière,
    // ce qui faisait clignoter tout le tableau pour une case cochée — et perdait au passage la
    // position de défilement.
    const reponse = await $fetch<{ data: { item: { tags: Array<{ tag: TagLite }> } } }>(
      `/api/editions/${props.editionId}/stock-items/${props.item.id}`,
      { method: 'PUT', body: { tagIds: voulus } }
    )
    emit('updated', reponse?.data?.item?.tags ?? [])
  } catch (e: any) {
    toast.add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    enregistrement.value = false
  }
}
</script>
