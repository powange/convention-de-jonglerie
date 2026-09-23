<template>
  <!-- Les colonnes AVANT l'export, comme partout : on choisit ce qu'on montre, puis on
       l'emporte. L'ordre inverse se lit comme deux boutons sans rapport. -->
  <div class="mb-4 flex flex-wrap justify-end gap-2">
    <UiColumnsMenu variant="soft" :table-api="tableRef?.tableApi" :libelle="libelleDeColonne" />

    <!-- Rien à produire sur un tableau vide : un fichier sans lignes se lit comme un export
         raté, et l'on cherche l'erreur là où il n'y en a pas. -->
    <UiExportMenu
      variant="outline"
      :disabled="sortedTiers.length === 0"
      :on-csv="exporterCsv"
      :on-pdf="exporterPdf"
    />

    <UButton icon="i-heroicons-plus" color="primary" @click="openTierModal()">
      Ajouter un tarif
    </UButton>
  </div>

  <!-- Liste des tarifs -->
  <div v-if="loading" class="text-center py-12">
    <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
    <p class="text-sm text-gray-500 mt-2">{{ $t('ticketing.tiers.list.loading') }}</p>
  </div>

  <div v-else-if="tiers.length === 0" class="text-center py-12">
    <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-300 mb-3 mx-auto" />
    <p class="text-sm text-gray-500">{{ $t('ticketing.tiers.list.none_found') }}</p>
    <p class="text-xs text-gray-400 mt-1">
      Ajoutez un tarif manuel ou synchronisez depuis votre billeterie externe
    </p>
  </div>

  <div v-else>
    <UTable
      ref="tableRef"
      v-model:column-visibility="colonnesVisibles"
      :data="sortedTiers"
      :columns="columns"
      :loading="loading"
      class="border border-accented"
    >
      <!-- Colonne Position avec drag handle -->
      <template #position-cell="{ row }">
        <div
          class="flex items-center gap-2 cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          draggable="true"
          :title="$t('ticketing.tiers.list.drag_to_reorder')"
          @dragstart="handleDragStart(row.original, $event)"
          @dragend="handleDragEnd"
          @dragover.prevent="handleDragOver(row.original, $event)"
          @drop="handleDrop(row.original, $event)"
        >
          <UIcon name="i-heroicons-bars-3" class="h-5 w-5" />
          <span class="text-sm font-medium text-gray-500 dark:text-gray-400">
            {{ row.index + 1 }}
          </span>
        </div>
      </template>

      <!-- Colonne Titre avec description en popover -->
      <template #title-cell="{ row }">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <!-- La provenance AVANT le nom : c'est elle qui situe le tarif, et la chercher après
                 un intitulé de longueur variable obligeait à balayer la ligne.

                 Par `provider` et non par `helloAssoTierId` : la colonne d'un seul fournisseur
                 laissait un tarif Infomaniak sans logo. Et il y en a toujours un — celui du site
                 quand le tarif a été saisi ici, sans quoi l'absence se lirait comme une origine
                 inconnue. -->
            <img
              :src="logoDuFournisseur(row.original.provider)"
              :alt="nomDuFournisseur(row.original.provider) ?? $t('gestion.ticketing.origin_site')"
              :title="
                nomDuFournisseur(row.original.provider) ?? $t('gestion.ticketing.origin_site')
              "
              class="h-5 w-5 object-contain flex-shrink-0"
            />
            <span class="font-semibold text-gray-900 dark:text-white">
              {{ row.original.name }}
            </span>
            <UBadge v-if="!row.original.isActive" color="neutral" variant="soft" size="xs">
              {{ $t('ticketing.tiers.list.inactive') }}
            </UBadge>
          </div>
          <div v-if="row.original.description">
            <UPopover>
              <div class="flex items-center gap-1 cursor-pointer">
                <span class="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 max-w-xs">
                  {{ row.original.description }}
                </span>
                <UIcon
                  name="i-heroicons-information-circle"
                  class="h-3.5 w-3.5 text-gray-400 flex-shrink-0"
                />
              </div>
              <template #content>
                <div class="p-3 max-w-md">
                  <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {{ row.original.description }}
                  </p>
                </div>
              </template>
            </UPopover>
          </div>
        </div>
      </template>

      <!-- Colonne Prix -->
      <template #price-cell="{ row }">
        <div class="flex flex-col items-start">
          <!-- Prix fixe -->
          <div v-if="isFixedPrice(row.original)" class="flex items-baseline gap-1">
            <span
              class="text-lg font-bold"
              :class="
                row.original.isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
              "
            >
              {{ (row.original.price / 100).toFixed(2) }}
            </span>
            <span class="text-xs text-gray-500">{{ symbol }}</span>
          </div>
          <!-- Prix libre -->
          <div v-else class="flex flex-col gap-1">
            <span
              class="text-sm font-semibold"
              :class="
                row.original.isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
              "
            >
              Prix libre
            </span>
            <div class="text-xs text-gray-500">
              <span v-if="row.original.minAmount != null"
                >Min: {{ money(row.original.minAmount) }}</span
              >
              <span v-if="row.original.minAmount != null && row.original.maxAmount != null">
                •
              </span>
              <span v-if="row.original.maxAmount != null"
                >Max: {{ money(row.original.maxAmount) }}</span
              >
            </div>
          </div>
        </div>
      </template>

      <!-- Colonne Date de début -->
      <template #validFrom-cell="{ row }">
        <span v-if="row.original.validFrom" class="text-sm text-gray-700 dark:text-gray-300">
          {{ formatDateTimeWithWeekday(row.original.validFrom) }}
        </span>
        <span v-else class="text-xs text-gray-400">-</span>
      </template>

      <!-- Colonne Date de fin -->
      <template #validUntil-cell="{ row }">
        <span v-if="row.original.validUntil" class="text-sm text-gray-700 dark:text-gray-300">
          {{ formatDateTimeWithWeekday(row.original.validUntil) }}
        </span>
        <span v-else class="text-xs text-gray-400">-</span>
      </template>

      <!-- Colonne Nombre de tickets -->
      <template #tickets-cell="{ row }">
        <div
          class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md"
          :class="
            row.original.soldCount && row.original.soldCount > 0
              ? 'bg-success-50 dark:bg-success-900/20'
              : 'bg-gray-50 dark:bg-gray-800'
          "
        >
          <UIcon
            name="i-heroicons-ticket"
            class="h-3.5 w-3.5"
            :class="
              row.original.soldCount && row.original.soldCount > 0
                ? 'text-success-600 dark:text-success-400'
                : 'text-gray-400'
            "
          />
          <span
            class="text-sm font-semibold"
            :class="
              row.original.soldCount && row.original.soldCount > 0
                ? 'text-success-700 dark:text-success-400'
                : 'text-gray-500'
            "
          >
            {{ row.original.soldCount || 0 }}
          </span>
        </div>
      </template>

      <!-- Colonne Description : du texte libre, coupé à l'affichage mais entier dans l'export. -->
      <template #description-cell="{ row }">
        <span
          v-if="row.original.description"
          class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2"
        >
          {{ row.original.description }}
        </span>
        <span v-else class="text-gray-400">-</span>
      </template>

      <!-- Colonne Actif -->
      <template #isActive-cell="{ row }">
        <UBadge :color="row.original.isActive ? 'success' : 'neutral'" variant="soft" size="xs">
          {{ row.original.isActive ? $t('common.yes') : $t('common.no') }}
        </UBadge>
      </template>

      <!-- Colonne Quotas -->
      <template #quotas-cell="{ row }">
        <div
          v-if="row.original.quotas && row.original.quotas.length > 0"
          class="flex flex-wrap gap-1"
        >
          <!-- Taille par défaut, pas `xs` : en très petit, un titre de quota ne se lisait plus
               — or c'est toute l'information de la colonne. -->
          <UBadge
            v-for="quotaRelation in row.original.quotas"
            :key="quotaRelation.quota.id"
            color="warning"
            variant="soft"
          >
            {{ quotaRelation.quota.title }}
          </UBadge>
        </div>
        <span v-else class="text-gray-400">-</span>
      </template>

      <!-- Colonne Articles à remettre -->
      <template #handoutItems-cell="{ row }">
        <div
          v-if="row.original.handoutItems && row.original.handoutItems.length > 0"
          class="flex flex-wrap gap-1"
        >
          <UBadge
            v-for="itemRelation in row.original.handoutItems"
            :key="itemRelation.handoutItem.id"
            color="info"
            variant="soft"
          >
            {{ itemRelation.handoutItem.name
            }}{{ itemRelation.quantity > 1 ? ` ×${itemRelation.quantity}` : '' }}
          </UBadge>
        </div>
        <span v-else class="text-gray-400">-</span>
      </template>

      <!-- Colonne Repas -->
      <template #meals-cell="{ row }">
        <div
          v-if="row.original.meals && row.original.meals.length > 0"
          class="flex flex-wrap gap-1"
        >
          <UBadge
            v-for="mealRelation in row.original.meals"
            :key="mealRelation.meal.id"
            color="success"
            variant="soft"
            size="xs"
          >
            {{ formatMealDisplay(mealRelation.meal) }}
          </UBadge>
        </div>
        <span v-else class="text-xs text-gray-400">-</span>
      </template>

      <!-- Colonne Actions -->
      <template #actions-cell="{ row }">
        <div class="flex gap-2">
          <UButton
            icon="i-heroicons-pencil"
            color="primary"
            variant="ghost"
            size="sm"
            @click="openTierModal(row.original)"
          />
          <UButton
            v-if="!row.original.helloAssoTierId"
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="sm"
            @click="confirmDeleteTier(row.original)"
          />
        </div>
      </template>
    </UTable>
  </div>

  <!-- Modal pour ajouter/modifier un tarif -->
  <TicketingTierModal
    v-model:open="tierModalOpen"
    :tier="selectedTier"
    :edition-id="editionId"
    @saved="handleTierSaved"
  />

  <!-- Modal de confirmation de suppression de tarif -->
  <UiConfirmModal
    v-model="deleteConfirmOpen"
    title="Supprimer le tarif"
    :description="`Êtes-vous sûr de vouloir supprimer le tarif '${tierToDelete?.name}' ?`"
    confirm-label="Supprimer"
    confirm-color="error"
    confirm-icon="i-heroicons-trash"
    icon-name="i-heroicons-exclamation-triangle"
    icon-color="text-red-500"
    :loading="deleting"
    @confirm="deleteTierAction"
    @cancel="deleteConfirmOpen = false"
  />
</template>

<script setup lang="ts">
import { useEditionStore } from '~/stores/editions'
import { formatMealDisplay } from '~/utils/meals'
import { telechargerFichier } from '~/utils/telechargement'

import {
  COLONNES_EXPORT_TARIFS,
  colonnesAExporter,
  lignesDExportDesTarifs,
  type FormateursDExport,
} from '../../utils/ticketing/export-tarifs'
import { logoDuFournisseur, nomDuFournisseur } from '../../utils/ticketing/fournisseur'
import { isFixedPrice, type TicketingTier } from '../../utils/ticketing/tiers'

import type { TableColumn } from '@nuxt/ui'

import { nomDeFichierCsv, versCsv } from '~~/shared/utils/csv'
import { texteImprimable } from '~~/shared/utils/texte-imprimable'

const { money, symbol } = useEditionCurrency()

const props = defineProps<{
  tiers: TicketingTier[]
  loading: boolean
  editionId: number
}>()

const editionStore = useEditionStore()
const edition = computed(() => editionStore.getEditionById(props.editionId))

const emit = defineEmits<{
  refresh: []
}>()

const tierModalOpen = ref(false)
const selectedTier = ref<TicketingTier | null>(null)
const deleteConfirmOpen = ref(false)
const tierToDelete = ref<TicketingTier | null>(null)

// Drag and drop
const draggedTierId = ref<number | null>(null)
const dragOverTierId = ref<number | null>(null)
const sortedTiers = ref<TicketingTier[]>([])

// Définition des colonnes
const columns = computed((): TableColumn<TicketingTier>[] => [
  {
    id: 'position',
    header: '#',
    size: 80,
  },
  {
    id: 'title',
    header: 'Titre',
    size: 250,
  },
  /*
   * Description et statut : masqués par défaut, proposés au menu des colonnes.
   *
   * Le tableau est déjà large, et ces deux-là n'aident pas à le parcourir — une description tient
   * sur plusieurs lignes, et un tarif inactif se reconnaît déjà à sa couleur. Mais ils comptent
   * dans un fichier qu'on relit à froid, et l'export ne prend que ce qui est visible : les cacher
   * pour de bon les aurait rendus inatteignables.
   */
  {
    id: 'description',
    header: 'Description',
    size: 300,
  },
  {
    id: 'isActive',
    header: 'Actif',
    size: 80,
  },
  {
    id: 'price',
    header: 'Tarif',
    size: 120,
  },
  {
    id: 'validFrom',
    header: 'Début de validité',
    size: 150,
  },
  {
    id: 'validUntil',
    header: 'Fin de validité',
    size: 150,
  },
  {
    id: 'tickets',
    header: 'Billets',
    size: 100,
  },
  {
    id: 'quotas',
    header: 'Quotas',
    size: 150,
  },
  {
    id: 'handoutItems',
    header: 'Articles à remettre',
    size: 150,
  },
  ...(edition.value?.mealsEnabled
    ? [
        {
          id: 'meals',
          header: 'Repas',
          size: 150,
        },
      ]
    : []),
  {
    id: 'actions',
    header: 'Actions',
    size: 120,
  },
])

// Initialiser sortedTiers avec les props.tiers
watch(
  () => props.tiers,
  (newTiers) => {
    sortedTiers.value = [...newTiers]
  },
  { immediate: true }
)

const handleDragStart = (tier: TicketingTier, event: DragEvent) => {
  draggedTierId.value = tier.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/html', '')
  }
}

const handleDragEnd = () => {
  draggedTierId.value = null
  dragOverTierId.value = null
}

const handleDragOver = (tier: TicketingTier, _event: DragEvent) => {
  dragOverTierId.value = tier.id
}

const handleDrop = async (targetTier: TicketingTier, event: DragEvent) => {
  event.preventDefault()

  if (!draggedTierId.value || draggedTierId.value === targetTier.id) {
    draggedTierId.value = null
    dragOverTierId.value = null
    return
  }

  const draggedIndex = sortedTiers.value.findIndex((t) => t.id === draggedTierId.value)
  const targetIndex = sortedTiers.value.findIndex((t) => t.id === targetTier.id)

  if (draggedIndex === -1 || targetIndex === -1) {
    draggedTierId.value = null
    dragOverTierId.value = null
    return
  }

  // Réorganiser localement
  const newTiers = [...sortedTiers.value]
  const [draggedTier] = newTiers.splice(draggedIndex, 1)
  // `splice` rend `T | undefined` : le compilateur ne peut pas savoir que l'élément
  // existe forcément. Le garde-fou est au-dessus — `draggedIndex` a déjà été refusé
  // s'il valait -1, donc le retrait porte toujours sur un élément réel.
  newTiers.splice(targetIndex, 0, draggedTier!)
  sortedTiers.value = newTiers

  // Mettre à jour les positions en base de données
  await updateTiersPositions(newTiers)

  draggedTierId.value = null
  dragOverTierId.value = null
}

const reorderPositions = ref<{ id: number; position: number }[]>([])

const { execute: executeReorder } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/tiers/reorder`,
  {
    method: 'PUT',
    body: () => ({ positions: reorderPositions.value }),
    successMessage: {
      title: 'Ordre mis à jour',
      description: "L'ordre des tarifs a été enregistré",
    },
    errorMessages: { default: "Impossible de mettre à jour l'ordre des tarifs" },
    emitOnSuccess: () => emit('refresh'),
  }
)

const updateTiersPositions = (tiers: TicketingTier[]) => {
  reorderPositions.value = tiers.map((tier, index) => ({
    id: tier.id,
    position: index,
  }))
  executeReorder()
}

const openTierModal = (tier?: TicketingTier) => {
  selectedTier.value = tier || null
  tierModalOpen.value = true
}

const handleTierSaved = () => {
  emit('refresh')
}

const confirmDeleteTier = (tier: TicketingTier) => {
  tierToDelete.value = tier
  deleteConfirmOpen.value = true
}

const { execute: executeDeleteTier, loading: deleting } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/tiers/${tierToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: {
      title: 'Tarif supprimé',
      description: 'Le tarif a été supprimé avec succès',
    },
    errorMessages: { default: 'Impossible de supprimer le tarif' },
    onSuccess: () => {
      deleteConfirmOpen.value = false
      tierToDelete.value = null
      emit('refresh')
    },
  }
)

const deleteTierAction = () => {
  if (!tierToDelete.value) return
  executeDeleteTier()
}

const { formatDateTimeWithWeekday } = useDateFormat()

const { t } = useI18n()

const tableRef = useTemplateRef('tableRef')
/*
 * Le choix des colonnes survit au rechargement, et se partage par le lien.
 *
 * `description` et `isActive` sont masquées dès l'arrivée : elles sont déclarées en défauts, et
 * l'URL ne porte que l'ÉCART. Révéler la description s'écrit donc, là où une liste des seules
 * colonnes masquées l'aurait perdu à la première actualisation.
 */
/** Les colonnes que le lecteur a le droit de masquer — l'URL ne peut pas en cacher d'autres. */
const colonnesMasquables = computed(() =>
  columns.value.filter((c: any) => c.enableHiding !== false).map((c: any) => c.id as string)
)

const DEFAUTS_DE_COLONNES = { description: false, isActive: false }
const { visibilite: colonnesVisibles } = useColonnesDansUrl(colonnesMasquables, {
  defauts: DEFAUTS_DE_COLONNES,
})

/** Le nom lisible d'une colonne, pour le menu de visibilité comme pour les en-têtes d'export. */
const libelleDeColonne = (id: string) => t(`ticketing.tiers.export.${id}`, id)

/**
 * Les formateurs que l'export ne peut pas connaître : la devise et le fuseau viennent de
 * l'édition, le libellé d'un repas d'un utilitaire d'affichage.
 */
const formateursDExport = (): FormateursDExport => ({
  montant: (centimes: number) => money(centimes),
  date: (valeur: string | Date) => formatDateTimeWithWeekday(valeur as string),
  repas: (repas: unknown) => formatMealDisplay(repas as never),
  oui: t('common.yes'),
  non: t('common.no'),
})

/*
 * Les colonnes viennent du TABLEAU, pas d'une liste tenue à côté : décocher une colonne doit la
 * retirer des deux formats. Avant le montage, l'API n'existe pas — on retombe alors sur toutes
 * les colonnes exportables plutôt que sur un fichier vide.
 */
const colonnesRetenues = () => {
  const api = (tableRef.value as { tableApi?: { getVisibleLeafColumns?: () => { id: string }[] } })
    ?.tableApi
  const visibles = api?.getVisibleLeafColumns?.().map((colonne) => colonne.id)
  return colonnesAExporter(visibles ?? [...COLONNES_EXPORT_TARIFS])
}

/*
 * L'export porte sur « sortedTiers » et non sur la liste reçue en propriété : c'est l'ordre
 * affiché, celui que l'organisateur vient éventuellement de composer au glisser-déposer.
 * Exporter l'ordre d'origine rendrait un document qui ne ressemble pas à l'écran.
 */
const exporterCsv = () => {
  const colonnes = colonnesRetenues()
  if (sortedTiers.value.length === 0 || colonnes.length === 0) return

  telechargerFichier(
    nomDeFichierCsv(`tarifs-edition-${props.editionId}`),
    versCsv(
      colonnes.map(libelleDeColonne),
      // Sans `texteImprimable` : ses deux corrections ne servent qu'au PDF. Une cellule CSV entre
      // guillemets porte sans difficulté les retours à la ligne et l'espace insécable étroite.
      lignesDExportDesTarifs(sortedTiers.value, formateursDExport(), colonnes)
    ),
    'text/csv;charset=utf-8'
  )
}

async function exporterPdf() {
  const colonnes = colonnesRetenues()
  if (sortedTiers.value.length === 0 || colonnes.length === 0) return

  const { jsPDF } = await import('jspdf')
  const { applyPlugin } = await import('jspdf-autotable')
  applyPlugin(jsPDF)

  // Paysage : jusqu'à onze colonnes, dont trois listes (quotas, articles, repas).
  const doc = new jsPDF({ orientation: 'landscape' })
  const MARGE = 14

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(texteImprimable(t('ticketing.tiers.export.document_title')), MARGE, 16)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const sousTitre = texteImprimable(
    [edition.value?.convention?.name, edition.value?.name].filter(Boolean).join(' - ')
  )
  if (sousTitre) doc.text(sousTitre, MARGE, 22)

  // La date d'édition et le total : sans eux, on ne sait pas, trois semaines plus tard, si le
  // document qu'on a sous les yeux est encore à jour, ni s'il portait un filtre.
  doc.setFontSize(9)
  doc.text(
    texteImprimable(
      `${formatDateTimeWithWeekday(new Date().toISOString())} - ${t('common.total')}: ${sortedTiers.value.length}`
    ),
    MARGE,
    sousTitre ? 28 : 22
  )

  // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
  doc.autoTable({
    startY: sousTitre ? 33 : 27,
    margin: { left: MARGE, right: MARGE },
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [124, 58, 237] },
    head: [colonnes.map((colonne) => texteImprimable(libelleDeColonne(colonne)))],
    // La description garde ses retours à la ligne, le reste est aplati : c'est la seule colonne
    // qui porte du texte libre, et `overflow: linebreak` sait la rendre.
    body: lignesDExportDesTarifs(
      sortedTiers.value,
      formateursDExport(),
      colonnes,
      (valeur, colonne) => texteImprimable(valeur, { multiligne: colonne === 'description' })
    ),
  })

  doc.save(`tarifs-edition-${props.editionId}.pdf`)
}
</script>
