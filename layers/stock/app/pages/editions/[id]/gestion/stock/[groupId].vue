<template>
  <UContainer class="py-6">
    <!-- Breadcrumb -->
    <div class="mb-4">
      <UButton
        :to="`/editions/${editionId}/gestion/stock`"
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-heroicons-arrow-left"
      >
        {{ $t('gestion.stock.title') }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div
      v-else-if="!group"
      class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
    >
      <UIcon name="i-heroicons-question-mark-circle" class="size-12 text-gray-400 mx-auto mb-3" />
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ $t('gestion.stock.group_not_found') }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <UCard>
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <UIcon name="i-heroicons-archive-box" class="text-amber-600 size-6 mt-1 shrink-0" />
            <div class="flex-1 min-w-0">
              <h1 class="text-xl font-semibold">{{ group.name }}</h1>
              <p v-if="group.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ group.description }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UTabs
              v-model="viewMode"
              :items="viewModeItems"
              size="sm"
              color="primary"
              variant="pill"
              :ui="{ list: 'w-auto' }"
            />
            <UButton
              v-if="canManage"
              icon="i-heroicons-plus"
              size="sm"
              color="primary"
              @click="openItemModal(null)"
            >
              {{ $t('gestion.stock.new_item') }}
            </UButton>
            <UDropdownMenu v-if="canManage" :items="groupActions">
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                size="sm"
                variant="ghost"
                color="neutral"
              />
            </UDropdownMenu>
          </div>
        </div>
      </UCard>

      <!-- Filtre par tags : c'est ce qui rend les étiquettes utiles sur un stock fourni. Le
           bouton de gestion est à côté, là où l'on constate qu'il manque un tag. -->
      <div v-if="group.items.length" class="flex items-end gap-2">
        <UFormField :label="$t('gestion.stock.tags.filter_label')" class="flex-1">
          <USelectMenu
            v-model="tagsFiltres"
            :items="tagItems"
            multiple
            :placeholder="$t('gestion.stock.tags.filter_placeholder')"
            searchable
            :searchable-placeholder="$t('common.search')"
            class="w-full"
            :ui="{ content: 'min-w-fit' }"
          >
            <template #default="{ modelValue: selected }">
              <span v-if="!selected?.length" class="text-gray-400">
                {{ $t('gestion.stock.tags.filter_placeholder') }}
              </span>
              <div v-else class="flex flex-wrap gap-1">
                <StockTagBadge
                  v-for="tg in selected"
                  :key="tg.value"
                  :tag="{ name: tg.label, color: tg.color }"
                />
              </div>
            </template>
            <template #item-leading="{ item: option }">
              <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: option.color }" />
            </template>
          </USelectMenu>
        </UFormField>
        <UFormField :label="$t('gestion.stock.external_loan')" class="flex-1">
          <USelectMenu
            v-model="etatsFiltres"
            :items="etatsItems"
            multiple
            :placeholder="$t('gestion.stock.tags.filter_placeholder')"
            class="w-full"
            :ui="{ content: 'min-w-fit' }"
          />
        </UFormField>
        <UFormField :label="$t('gestion.stock.loan_place_filter')" class="flex-1">
          <UInput
            v-model="lieuFiltre"
            icon="i-heroicons-magnifying-glass"
            :placeholder="$t('gestion.stock.loan_place_filter_placeholder')"
            class="w-full"
          >
            <template v-if="lieuFiltre" #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                icon="i-heroicons-x-mark"
                :aria-label="$t('common.clear')"
                @click="lieuFiltre = ''"
              />
            </template>
          </UInput>
        </UFormField>
        <UButton
          v-if="canManage"
          icon="i-heroicons-tag"
          color="neutral"
          variant="outline"
          @click="tagsModalOpen = true"
        >
          {{ $t('gestion.stock.tags.manage') }}
        </UButton>
        <!-- Choix des colonnes affichées, servi par l'API du tableau. -->
        <UDropdownMenu
          v-if="viewMode === 'list'"
          :items="
            tableRef?.tableApi
              ?.getAllColumns()
              .filter((colonne: any) => colonne.getCanHide())
              .map((colonne: any) => ({
                label: libelleColonne(colonne.id),
                type: 'checkbox' as const,
                checked: colonne.getIsVisible(),
                onUpdateChecked(coche: boolean) {
                  tableRef?.tableApi?.getColumn(colonne.id)?.toggleVisibility(!!coche)
                },
                onSelect(e?: Event) {
                  e?.preventDefault()
                },
              }))
          "
        >
          <UButton
            icon="i-heroicons-view-columns"
            color="neutral"
            variant="outline"
            trailing-icon="i-heroicons-chevron-down"
          >
            {{ $t('gestion.stock.columns') }}
          </UButton>
        </UDropdownMenu>
      </div>

      <div
        v-if="!group.items.length"
        class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
      >
        <UIcon name="i-heroicons-cube" class="size-10 text-gray-400 mx-auto mb-2" />
        <p class="text-gray-600 dark:text-gray-400 mb-3 text-sm">
          {{ $t('gestion.stock.empty_group') }}
        </p>
        <UButton
          v-if="canManage"
          icon="i-heroicons-plus"
          color="primary"
          size="sm"
          @click="openItemModal(null)"
        >
          {{ $t('gestion.stock.new_item') }}
        </UButton>
      </div>

      <UCard v-else-if="viewMode === 'list'" :ui="{ body: 'p-0 sm:p-0' }">
        <!-- `UTable` plutôt qu'un tableau écrit à la main : le tri par colonne et le choix des
             colonnes visibles viennent avec, au lieu d'être à réécrire ici. Le clic sur une ligne
             mène à la fiche, comme avant. -->
        <UTable
          ref="tableRef"
          v-model:sorting="tri"
          v-model:column-visibility="colonnesVisibles"
          v-model:row-selection="selectionLignes"
          :get-row-id="(objet: any) => String(objet.id)"
          :data="objetsAffiches"
          :columns="colonnes"
          class="w-full"
          @select="(_evenement: Event, ligne: any) => goToItem(ligne.original.id)"
        >
          <template #select-header="{ table }">
            <UCheckbox
              :model-value="
                table.getIsSomePageRowsSelected()
                  ? 'indeterminate'
                  : table.getIsAllPageRowsSelected()
              "
              :aria-label="$t('common.select_all')"
              @update:model-value="
                (coche: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!coche)
              "
            />
          </template>
          <template #select-cell="{ row }">
            <!-- La case ne doit pas emmener sur la fiche : cocher et ouvrir sont deux gestes. -->
            <span @click.stop>
              <UCheckbox
                :model-value="row.getIsSelected()"
                :aria-label="$t('common.select')"
                @update:model-value="
                  (coche: boolean | 'indeterminate') => row.toggleSelected(!!coche)
                "
              />
            </span>
          </template>

          <template #name-cell="{ row }">
            <div class="flex items-center gap-1.5">
              <span class="font-medium">{{ row.original.name }}</span>
              <!-- La description tient rarement sur une ligne de tableau : elle passe dans une
                   infobulle, signalée par une icône, plutôt que d'écraser la colonne. -->
              <UPopover
                v-if="row.original.description?.trim()"
                mode="hover"
                :content="{ side: 'top' }"
              >
                <UIcon
                  name="i-heroicons-information-circle"
                  class="size-4 text-gray-400 shrink-0"
                />
                <template #content>
                  <p class="p-3 text-sm max-w-xs whitespace-pre-wrap">
                    {{ row.original.description }}
                  </p>
                </template>
              </UPopover>
            </div>
          </template>

          <template #quantity-cell="{ row }">
            <span class="font-medium tabular-nums">×{{ row.original.quantity }}</span>
            <!-- Ce qui manque au rangement, repérable sans ouvrir chaque fiche. -->
            <UBadge
              v-if="manquants(row.original) > 0"
              color="warning"
              variant="soft"
              size="lg"
              class="ml-1.5"
            >
              -{{ manquants(row.original) }}
            </UBadge>
          </template>

          <template #tags-cell="{ row }">
            <!-- Les tags se posent et se retirent ici même : c'est en balayant l'inventaire qu'on
                 trie, pas en ouvrant chaque fiche. -->
            <StockItemTagsPicker
              :edition-id="editionId"
              :item="row.original"
              :tags="tags"
              :can-manage="canManage"
              @updated="(tags: any) => majTagsLigne(row.original.id, tags)"
            />
          </template>

          <template #loan-cell="{ row }">
            <!-- Trois temps du prêt, comme sur la fiche : la règle est partagée pour que les deux
                 écrans ne puissent pas diverger. Un tiret pour le matériel de la convention. -->
            <template v-if="etatEmprunt(row.original)">
              <!-- Le lieu et la personne passent dans une infobulle plutôt que sous l'étiquette :
                   sur une liste entière, ces deux lignes par ligne noyaient le tableau. Seule
                   l'étape en cours y figure — rappeler la récupération d'un matériel déjà chez
                   nous n'apprendrait rien. -->
              <UPopover v-if="prochaineEtape(row.original)" mode="hover" :content="{ side: 'top' }">
                <UBadge
                  :color="etatEmprunt(row.original)!.couleur"
                  variant="soft"
                  class="cursor-help"
                >
                  {{ $t(etatEmprunt(row.original)!.libelle) }}
                </UBadge>
                <template #content>
                  <div class="p-3 text-sm space-y-1 max-w-xs">
                    <div v-if="prochaineEtape(row.original)!.lieu" class="flex items-start gap-1.5">
                      <UIcon name="i-heroicons-map-pin" class="size-4 shrink-0 mt-0.5" />
                      <span>{{ prochaineEtape(row.original)!.lieu }}</span>
                    </div>
                    <div v-if="prochaineEtape(row.original)!.qui" class="flex items-start gap-1.5">
                      <UIcon name="i-heroicons-user" class="size-4 shrink-0 mt-0.5" />
                      <span>{{ prochaineEtape(row.original)!.qui }}</span>
                    </div>
                  </div>
                </template>
              </UPopover>
              <!-- Sans indication saisie, l'étiquette seule : une infobulle vide se survolerait
                   pour rien. -->
              <UBadge v-else :color="etatEmprunt(row.original)!.couleur" variant="soft">
                {{ $t(etatEmprunt(row.original)!.libelle) }}
              </UBadge>
            </template>
            <span v-else class="text-gray-400">—</span>
          </template>

          <template #storage-cell="{ row }">
            <div
              v-if="row.original.location || row.original.zone || row.original.marker"
              class="flex items-center flex-wrap gap-1.5 text-sm"
            >
              <span
                v-if="row.original.zone"
                class="size-3 rounded-full border border-gray-300"
                :style="{ backgroundColor: row.original.zone.color }"
              />
              <UIcon v-else-if="row.original.marker" name="i-heroicons-flag" class="size-4" />
              <UIcon v-else name="i-heroicons-map-pin" class="size-4 text-gray-400" />
              <span>
                {{ row.original.zone?.name || row.original.marker?.name || row.original.location }}
              </span>
            </div>
            <span v-else class="text-sm text-gray-400 italic">
              {{ $t('gestion.stock.no_location') }}
            </span>
          </template>

          <template #current-cell="{ row }">
            <ul v-if="currentLocations(row.original).length" class="space-y-1 text-sm">
              <li
                v-for="r in currentLocations(row.original)"
                :key="r.id"
                class="flex items-center flex-wrap gap-1.5"
              >
                <UBadge color="neutral" variant="soft" size="xs" class="tabular-nums shrink-0">
                  ×{{ r.quantityReserved }}
                </UBadge>
                <span
                  v-if="r.zone"
                  class="size-3 rounded-full border border-gray-300"
                  :style="{ backgroundColor: r.zone.color }"
                />
                <UIcon v-else-if="r.marker" name="i-heroicons-flag" class="size-4" />
                <UIcon v-else name="i-heroicons-map-pin" class="size-4 text-gray-400" />
                <span>{{ r.zone?.name || r.marker?.name || r.location }}</span>
              </li>
            </ul>
            <span v-else class="text-sm text-gray-400 italic">—</span>
          </template>

          <template #reservations-cell="{ row }">
            <div
              :class="row.original._count.reservations ? '' : 'text-gray-400'"
              class="tabular-nums text-right"
            >
              {{ row.original._count.reservations }}
            </div>
            <div
              v-if="nextReservation(row.original)"
              class="text-xs text-gray-500 mt-0.5 flex items-center justify-end gap-1"
            >
              <UBadge
                :color="reservationBadgeColor(nextReservation(row.original)!)"
                variant="soft"
                size="xs"
              >
                {{ reservationBadgeLabel(nextReservation(row.original)!) }}
              </UBadge>
              <span class="whitespace-nowrap">
                {{ formatNextDate(nextReservation(row.original)!) }}
              </span>
            </div>
          </template>
        </UTable>
      </UCard>

      <StockPlanning
        v-else-if="viewMode === 'planning'"
        :items="planningItems"
        :start-date="planningStartDate"
        :end-date="planningEndDate"
        @reservation-click="openReservationFromPlanning"
      />
    </div>

    <StockReservationModal
      v-if="planningReservationContext"
      v-model:open="reservationModalOpen"
      :edition-id="editionId"
      :item-id="planningReservationContext.itemId"
      :item-quantity="planningReservationContext.itemQuantity"
      :reservation="planningReservationContext.reservation"
      :can-moderate="canManage"
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
      :edition-start-date="edition?.startDate ?? null"
      :edition-setup-start-date="(edition as any)?.volunteersSetupStartDate ?? null"
      @saved="refreshPlanning"
    />

    <StockGroupModal
      v-model:open="groupModalOpen"
      :edition-id="editionId"
      :group="group"
      @saved="handleGroupSaved"
      @deleted="handleGroupDeleted"
    />
    <StockItemModal
      v-if="group"
      v-model:open="itemModalOpen"
      :edition-id="editionId"
      :group-id="group.id"
      :item="editingItem"
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
      @saved="handleItemSaved"
    />

    <StockTagsModal
      v-model:open="tagsModalOpen"
      :edition-id="editionId"
      :tags="tags"
      @saved="fetchTags"
    />

    <StockBulkReservationModal
      v-if="group && bulkModalItems.length"
      v-model:open="bulkModalOpen"
      :edition-id="editionId"
      :items="bulkModalItems"
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
      :edition-start-date="edition?.startDate ?? null"
      :edition-setup-start-date="(edition as any)?.volunteersSetupStartDate ?? null"
      @saved="handleBulkSaved"
    />

    <!-- Barre flottante quand au moins 1 item est sélectionné -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-full opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-full opacity-0"
      >
        <div
          v-if="someSelected"
          class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-full px-4 py-2 flex items-center gap-3"
        >
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ $t('gestion.stock.selected_count', { count: identifiantsSelectionnes.length }) }}
          </span>
          <UButton
            color="primary"
            size="sm"
            icon="i-heroicons-plus"
            @click="openBulkReservationModal"
          >
            {{ $t('gestion.stock.bulk_reserve', { count: identifiantsSelectionnes.length }) }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-heroicons-x-mark"
            :aria-label="$t('gestion.stock.clear_selection')"
            @click="clearSelection"
          />
        </div>
      </Transition>
    </Teleport>
  </UContainer>
</template>

<script setup lang="ts">
import { useAuthStore, useEditionStore } from '#imports'

import {
  ETATS_EMPRUNT,
  etatEmprunt,
  etatsDepuisUrl,
  filtrerParEtatEmprunt,
  prochaineEtapeEmprunt,
  urlDepuisEtats,
} from '../../../../../utils/etat-emprunt'
import { filtrerParLieuEmprunt } from '../../../../../utils/filtre-lieu-emprunt'
import {
  filtrerParTags,
  tagsDepuisUrl,
  urlDepuisTags,
} from '../../../../../utils/filtre-tags-stock'

import type { TableColumn } from '@nuxt/ui'
import type { Column } from '@tanstack/vue-table'

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const editionId = parseInt(route.params.id as string)

/**
 * Ce qui manque au rangement, pour un objet donné.
 *
 * Rend zéro tant que le comptage n'a pas eu lieu : `finalQuantity` à `null` veut dire « pas
 * encore compté », et afficher un manque sur cette base serait faux.
 */
interface StockTag {
  id: number
  name: string
  color: string
  displayOrder: number
}

const tableRef = ref()
// Le nom d'abord : c'est l'ordre dans lequel on cherche un objet quand on ne sait plus où il est.
const tri = ref<{ id: string; desc: boolean }[]>([{ id: 'name', desc: false }])
const colonnesVisibles = ref<Record<string, boolean>>({})

/**
 * Remplace les tags d'une seule ligne, après enregistrement.
 *
 * Recharger tout le groupe pour une case cochée faisait clignoter le tableau et lui faisait
 * perdre sa position de défilement — désagréable quand on tague une liste de haut en bas.
 */
function majTagsLigne(itemId: number, tags: Array<{ tag: { id: number } }>) {
  const objet = group.value?.items.find((it) => it.id === itemId)
  if (objet) objet.tags = tags as any
}

/** L'étape en cours d'un emprunt : où aller et qui s'en charge, ou `null` s'il n'y a rien à dire. */
function prochaineEtape(materiel: any) {
  return prochaineEtapeEmprunt(materiel)
}

/** Le libellé d'une colonne dans le menu de visibilité, d'après son identifiant. */
function libelleColonne(id: string): string {
  const libelles: Record<string, string> = {
    name: t('gestion.stock.item_name'),
    quantity: t('common.quantity'),
    tags: t('gestion.stock.tags.field_label'),
    loan: t('gestion.stock.external_loan'),
    storage: t('gestion.stock.item_storage_location'),
    current: t('gestion.stock.item_current_location'),
    reservations: t('gestion.stock.reservations_title'),
  }
  return libelles[id] ?? id
}

/** En-tête cliquable, avec la flèche qui dit le sens du tri en cours. */
function enTeteTriable(column: Column<any>, libelle: string) {
  const trie = column.getIsSorted()
  return h(resolveComponent('UButton'), {
    color: 'neutral',
    variant: 'ghost',
    label: libelle,
    icon: trie
      ? trie === 'asc'
        ? 'i-lucide-arrow-up-narrow-wide'
        : 'i-lucide-arrow-down-wide-narrow'
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(trie === 'asc'),
  })
}

/**
 * Les colonnes du tableau.
 *
 * Les emplacements sont triés sur le libellé réellement affiché — zone, marqueur ou texte libre —
 * plutôt que sur un champ : trier sur `location` seul aurait mis ensemble tout ce qui est rangé
 * dans une zone, sous une valeur vide.
 */
const colonnes = computed((): TableColumn<any>[] => [
  {
    id: 'select',
    enableSorting: false,
    enableHiding: false,
    size: 40,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.item_name')),
    enableHiding: false,
  },
  {
    accessorKey: 'quantity',
    header: ({ column }) => enTeteTriable(column, t('common.quantity')),
  },
  {
    id: 'tags',
    accessorFn: (item: any) => (item.tags ?? []).map((r: any) => r.tag.name).join(', '),
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.tags.field_label')),
  },
  {
    id: 'loan',
    accessorFn: (item: any) => etatEmprunt(item)?.cle ?? '',
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.external_loan')),
  },
  {
    id: 'storage',
    accessorFn: (item: any) => item.zone?.name || item.marker?.name || item.location || '',
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.item_storage_location')),
  },
  {
    id: 'current',
    enableSorting: false,
    header: () => t('gestion.stock.item_current_location'),
  },
  {
    id: 'reservations',
    accessorFn: (item: any) => item._count.reservations,
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.reservations_title')),
  },
])

const tags = ref<StockTag[]>([])
const tagsModalOpen = ref(false)
const tagsFiltres = ref<{ label: string; value: number; color: string }[]>([])

const tagItems = computed(() =>
  tags.value.map((tag) => ({ label: tag.name, value: tag.id, color: tag.color }))
)

/**
 * Les objets réellement affichés : la liste du groupe, resserrée par les tags choisis.
 *
 * La règle de filtrage vit dans un utilitaire à part, éprouvé hors du navigateur — cet écran
 * demande une session, et la règle du cumul ne s'y vérifie pas d'un coup d'œil.
 */
const etatsFiltres = ref<{ label: string; value: string }[]>([])

const etatsItems = computed(() =>
  ETATS_EMPRUNT.map((cle) => ({
    value: cle,
    label:
      cle === 'aucun'
        ? t('gestion.stock.loan_none')
        : t(
            {
              a_recuperer: 'gestion.stock.loan_to_pick_up',
              a_rendre: 'gestion.stock.loan_to_return',
              en_retard: 'gestion.stock.loan_overdue',
              rendu: 'gestion.stock.loan_returned',
            }[cle]!
          ),
  }))
)

/**
 * Les objets réellement affichés : la liste du groupe, resserrée par les tags puis par l'état de
 * l'emprunt. Les deux filtres se cumulent entre eux — « fragile » **et** « à récupérer » — même
 * si chacun pris isolément est une union.
 *
 * Les règles vivent dans des utilitaires à part, éprouvés hors du navigateur : cet écran demande
 * une session, et l'on n'y vérifie rien d'un coup d'œil.
 */
const lieuFiltre = ref('')

const objetsAffiches = computed(() =>
  filtrerParLieuEmprunt(
    filtrerParEtatEmprunt(
      filtrerParTags(
        group.value?.items ?? [],
        tagsFiltres.value.map((tg) => tg.value)
      ),
      etatsFiltres.value.map((e) => e.value)
    ),
    lieuFiltre.value
  )
)

async function fetchTags() {
  try {
    const res = await $fetch<{ data: { tags: StockTag[] } }>(
      `/api/editions/${editionId}/stock-tags`
    )
    tags.value = res?.data?.tags ?? []
  } catch {
    tags.value = []
  }
  appliquerFiltreDeLUrl()
}

/**
 * Reprend le filtre porté par l'adresse.
 *
 * Appelé une fois les tags chargés : le sélecteur travaille sur des objets `{ label, value,
 * color }`, qu'on ne peut composer qu'à partir de la liste. Un identifiant qui ne correspond à
 * aucun tag — supprimé depuis, ou lien d'une autre édition — est simplement ignoré.
 */
function appliquerFiltreDeLUrl() {
  const voulus = tagsDepuisUrl(route.query.tags)
  tagsFiltres.value = tagItems.value.filter((tg) => voulus.includes(tg.value))

  const etats = etatsDepuisUrl(route.query.emprunt)
  etatsFiltres.value = etatsItems.value.filter((e) => etats.includes(e.value as never))

  lieuFiltre.value = typeof route.query.lieu === 'string' ? route.query.lieu : ''
}

// L'adresse suit le filtre : un lien se partage, et un rechargement ne perd plus la sélection.
// `replace` plutôt que `push`, sans quoi chaque case cochée s'empilerait dans l'historique et le
// bouton « précédent » deviendrait inutilisable.
watch([tagsFiltres, etatsFiltres, lieuFiltre], () => {
  const parTags = urlDepuisTags(tagsFiltres.value.map((tg) => tg.value))
  const parEtat = urlDepuisEtats(etatsFiltres.value.map((e) => e.value))
  const parLieu = lieuFiltre.value.trim() || undefined
  const { tags: _tags, emprunt: _emprunt, lieu: _lieu, ...reste } = route.query
  router.replace({
    query: {
      ...reste,
      ...(parTags ? { tags: parTags } : {}),
      ...(parEtat ? { emprunt: parEtat } : {}),
      ...(parLieu ? { lieu: parLieu } : {}),
    },
  })
})

function manquants(item: { quantity: number; finalQuantity?: number | null }): number {
  if (item.finalQuantity === null || item.finalQuantity === undefined) return 0
  return Math.max(0, item.quantity - item.finalQuantity)
}
const groupId = computed(() => parseInt(route.params.groupId as string))

type StockReservationStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED'
interface StockItemUpcomingReservation {
  id: number
  status: StockReservationStatus
  startsAt: string
  endsAt: string
  quantityReserved: number
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
}
interface StockItem {
  id: number
  name: string
  description: string | null
  quantity: number
  finalQuantity?: number | null
  tags?: Array<{ tag: { id: number; name: string; color: string } }>
  isExternalLoan?: boolean
  pickedUpAt?: string | null
  returnedAt?: string | null
  returnDueAt?: string | null
  pickupLocation?: string | null
  pickupResponsible?: { id: number; pseudo: string } | null
  pickupContact?: string | null
  returnLocation?: string | null
  returnResponsible?: { id: number; pseudo: string } | null
  returnContact?: string | null
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
  reservations: StockItemUpcomingReservation[]
  _count: { reservations: number }
}
interface StockGroupItem {
  id: number
  name: string
  description: string | null
  displayOrder: number
  items: StockItem[]
}

interface PlanningReservationUser {
  id: number
  pseudo: string
  prenom?: string | null
  nom?: string | null
  emailHash: string | null
  profilePicture: string | null
  updatedAt?: string
}
interface PlanningReservation {
  id: number
  status: StockReservationStatus
  startsAt: string
  endsAt: string
  quantityReserved: number
  usage: string
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
  user: PlanningReservationUser
}
interface PlanningItem {
  id: number
  name: string
  quantity: number
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
  reservations: PlanningReservation[]
}

interface ZoneOption {
  id: number
  name: string
  color: string
  types: string[]
}
interface MarkerOption {
  id: number
  name: string
  color: string | null
  types: string[]
}

const allGroups = ref<StockGroupItem[]>([])
const zones = ref<ZoneOption[]>([])
const markers = ref<MarkerOption[]>([])
const loading = ref(true)
const viewMode = ref<'list' | 'planning'>('list')
const planningItems = ref<PlanningItem[]>([])
const planningLoading = ref(false)

const edition = computed(() => editionStore.getEditionById(editionId))
const group = computed<StockGroupItem | null>(
  () => allGroups.value.find((g) => g.id === groupId.value) || null
)

// Titre de l'onglet : « {nom du groupe} – Stock matériel », cohérent avec la page liste /stock.
// Tant que le groupe n'est pas chargé, on retombe sur le titre générique de la section.
useSeoMeta({
  title: () =>
    group.value?.name
      ? `${group.value.name} – ${t('gestion.stock.title')}`
      : t('gestion.stock.title'),
})

const canManage = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  const userId = authStore.user.id
  if (authStore.isAdminModeActive) return true
  if (edition.value.creatorId === userId) return true
  if (edition.value.convention?.authorId === userId) return true
  const organizers = edition.value.convention?.organizers || []
  return organizers.some((collab: any) => {
    if (collab.user?.id !== userId) return false
    if (collab.rights?.manageStock || collab.rights?.editConvention) return true
    if (collab.perEditionRights) {
      const per = collab.perEditionRights.find((r: any) => r.editionId === edition.value!.id)
      if (per?.canManageStock || per?.canEdit) return true
    }
    return false
  })
})

async function fetchAll() {
  try {
    loading.value = true
    const [groupsRes, zonesRes, markersRes] = await Promise.all([
      $fetch<{ success: boolean; data: { groups: StockGroupItem[] } }>(
        `/api/editions/${editionId}/stock-groups`
      ),
      $fetch<{ success: boolean; data: { zones: any[] } } | any[]>(
        `/api/editions/${editionId}/zones`
      ).catch(() => null),
      $fetch<{ success: boolean; data: { markers: any[] } } | any[]>(
        `/api/editions/${editionId}/markers`
      ).catch(() => null),
    ])
    allGroups.value = groupsRes?.data?.groups || []
    const zonesData = Array.isArray(zonesRes)
      ? zonesRes
      : (zonesRes?.data?.zones ?? (zonesRes as any)?.data ?? [])
    zones.value = (zonesData || []).map((z: any) => ({
      id: z.id,
      name: z.name,
      color: z.color,
      types: Array.isArray(z.zoneTypes) ? z.zoneTypes : [],
    }))
    const markersData = Array.isArray(markersRes)
      ? markersRes
      : (markersRes?.data?.markers ?? (markersRes as any)?.data ?? [])
    markers.value = (markersData || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      color: m.color ?? null,
      types: Array.isArray(m.markerTypes) ? m.markerTypes : [],
    }))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId, { force: true })
  }
})

await fetchAll()
await fetchTags()

const groupModalOpen = ref(false)
const itemModalOpen = ref(false)
const editingItem = ref<StockItem | null>(null)
const reservationModalOpen = ref(false)

// --- Sélection multi-items pour la réservation groupée ---
/**
 * La sélection est celle du tableau, pas une liste tenue à part.
 *
 * `get-row-id` fait porter les clés par l'identifiant de l'objet et non par son rang : sans cela,
 * trier ou filtrer déplacerait les lignes et la sélection suivrait les positions, désignant
 * d'autres objets que ceux cochés.
 */
const selectionLignes = ref<Record<string, boolean>>({})
const bulkModalOpen = ref(false)
const bulkModalItems = ref<{ id: number; name: string; maxQuantity: number }[]>([])

/** Les identifiants cochés, dans l'ordre où le tableau les porte. */
const identifiantsSelectionnes = computed(() =>
  Object.entries(selectionLignes.value)
    .filter(([, coche]) => coche)
    .map(([id]) => Number(id))
)

const someSelected = computed(() => identifiantsSelectionnes.value.length > 0)

function clearSelection() {
  selectionLignes.value = {}
}

function openBulkReservationModal() {
  const items = group.value?.items || []
  const choisis = new Set(identifiantsSelectionnes.value)
  bulkModalItems.value = items
    .filter((it) => choisis.has(it.id))
    .map((it) => ({ id: it.id, name: it.name, maxQuantity: it.quantity }))
  if (bulkModalItems.value.length === 0) return
  bulkModalOpen.value = true
}

async function handleBulkSaved() {
  clearSelection()
  await refreshPlanning()
}

// Changer de groupe vide la sélection : garder des identifiants d'un autre contexte afficherait
// une barre flottante sur des objets qu'on ne voit plus.
watch(groupId, () => {
  clearSelection()
})

// Un objet supprimé ou disparu d'un rechargement quitte aussi la sélection, sans quoi le
// compteur de la barre flottante annoncerait plus d'objets qu'il n'en existe.
watch(
  () => group.value?.items.map((it) => it.id) || [],
  (ids) => {
    if (!someSelected.value) return
    const presents = new Set(ids.map(String))
    const suivant: Record<string, boolean> = {}
    for (const [id, coche] of Object.entries(selectionLignes.value)) {
      if (coche && presents.has(id)) suivant[id] = true
    }
    if (Object.keys(suivant).length !== identifiantsSelectionnes.value.length) {
      selectionLignes.value = suivant
    }
  }
)
const planningReservationContext = ref<{
  itemId: number
  itemQuantity: number
  reservation: PlanningReservation
} | null>(null)

const viewModeItems = computed(() => [
  { label: t('gestion.stock.list_view'), value: 'list', icon: 'i-heroicons-list-bullet' },
  {
    label: t('gestion.stock.planning_view'),
    value: 'planning',
    icon: 'i-heroicons-calendar-days',
  },
])

// Périmètre temporel : montage → démontage si défini, sinon édition seule
const planningStartDate = computed<string | null>(() => {
  const e = edition.value as any
  return e?.volunteersSetupStartDate || e?.startDate || null
})
const planningEndDate = computed<string | null>(() => {
  const e = edition.value as any
  return e?.volunteersTeardownEndDate || e?.endDate || null
})

async function fetchPlanning() {
  if (!group.value) return
  try {
    planningLoading.value = true
    const res = await $fetch<{ success: boolean; data: { items: PlanningItem[] } }>(
      `/api/editions/${editionId}/stock-groups/${group.value.id}/planning`
    )
    planningItems.value = res?.data?.items || []
  } finally {
    planningLoading.value = false
  }
}

// Recharger les données planning à chaque bascule en mode planning, pour
// refléter d'éventuelles créations/modifications faites depuis la vue liste.
watch(viewMode, (mode) => {
  if (mode === 'planning') {
    fetchPlanning()
  }
})

function openReservationFromPlanning(reservation: PlanningReservation, item: PlanningItem) {
  planningReservationContext.value = {
    itemId: item.id,
    itemQuantity: item.quantity,
    reservation,
  }
  reservationModalOpen.value = true
}

async function refreshPlanning() {
  await Promise.all([fetchAll(), fetchPlanning()])
}

// Tick d'horloge réactif pour que les badges « En cours / Prochaine / En retard »
// bascule sans refetch quand la page reste ouverte.
const now = useNow({ interval: 60_000 })

type ReservationState = 'overdue' | 'ongoing' | 'upcoming'

function reservationState(r: StockItemUpcomingReservation): ReservationState {
  const t = now.value.getTime()
  if (r.status === 'PICKED_UP' && new Date(r.endsAt).getTime() < t) return 'overdue'
  if (new Date(r.startsAt).getTime() <= t && new Date(r.endsAt).getTime() > t) return 'ongoing'
  return 'upcoming'
}

function reservationBadgeColor(r: StockItemUpcomingReservation): 'success' | 'info' | 'error' {
  switch (reservationState(r)) {
    case 'overdue':
      return 'error'
    case 'ongoing':
      return 'success'
    case 'upcoming':
      return 'info'
  }
}

function reservationBadgeLabel(r: StockItemUpcomingReservation): string {
  switch (reservationState(r)) {
    case 'overdue':
      return t('gestion.stock.overdue')
    case 'ongoing':
      return t('gestion.stock.ongoing')
    case 'upcoming':
      return t('gestion.stock.upcoming')
  }
}

function formatNextDate(r: StockItemUpcomingReservation): string {
  const state = reservationState(r)
  const date = state === 'upcoming' ? r.startsAt : r.endsAt
  return new Intl.DateTimeFormat(locale.value, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

// Pré-calculs mémoïsés par item pour éviter un re-filtrage à chaque tick
// d'horloge ou re-rendu (la colonne est appelée plusieurs fois par ligne).
const itemsComputeMap = computed<
  Record<
    number,
    { next: StockItemUpcomingReservation | null; current: StockItemUpcomingReservation[] }
  >
>(() => {
  const map: Record<
    number,
    { next: StockItemUpcomingReservation | null; current: StockItemUpcomingReservation[] }
  > = {}
  for (const it of group.value?.items || []) {
    const pickedUp = it.reservations
      .filter((r) => r.status === 'PICKED_UP')
      .slice()
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    map[it.id] = { next: it.reservations[0] ?? null, current: pickedUp }
  }
  return map
})

function nextReservation(item: StockItem): StockItemUpcomingReservation | null {
  return itemsComputeMap.value[item.id]?.next ?? null
}

function currentLocations(item: StockItem): StockItemUpcomingReservation[] {
  return itemsComputeMap.value[item.id]?.current ?? []
}

function openItemModal(item: StockItem | null) {
  editingItem.value = item
  itemModalOpen.value = true
}

function goToItem(itemId: number) {
  router.push(`/editions/${editionId}/gestion/stock/items/${itemId}`)
}

const groupActions = computed(() => [
  [
    {
      label: t('common.edit'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => {
        groupModalOpen.value = true
      },
    },
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => deleteGroup(),
    },
  ],
])

async function deleteGroup() {
  if (!group.value) return
  if (
    !confirm(
      t('gestion.stock.confirm_delete_group', {
        name: group.value.name,
        count: group.value.items.length,
      })
    )
  )
    return
  await $fetch(`/api/editions/${editionId}/stock-groups/${group.value.id}`, { method: 'DELETE' })
  router.push(`/editions/${editionId}/gestion/stock`)
}

async function handleGroupSaved() {
  await refreshPlanning()
}
async function handleGroupDeleted() {
  router.push(`/editions/${editionId}/gestion/stock`)
}
async function handleItemSaved() {
  await refreshPlanning()
}
</script>
