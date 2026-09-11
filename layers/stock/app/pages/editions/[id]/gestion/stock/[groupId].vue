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

      <!-- Les filtres, et à côté ce qui les alimente : les tags de l'édition et les colonnes
           affichées. Sur écran étroit ils passent dans une modale — trois champs côte à côte n'y
           tiennent pas, et les empiler pousserait le tableau hors de vue. -->
      <div v-if="group.items.length" class="flex items-end gap-2">
        <StockItemFilters
          v-model:nom="nomFiltre"
          v-model:tags="tagsFiltres"
          v-model:etats="etatsFiltres"
          v-model:lieu="lieuFiltre"
          :tag-items="tagItems"
          :etats-items="etatsItems"
          class="hidden lg:flex flex-1 items-end gap-2 min-w-0"
        />

        <UButton
          class="lg:hidden"
          icon="i-heroicons-funnel"
          color="neutral"
          variant="outline"
          @click="filtresModalOpen = true"
        >
          {{ $t('gestion.stock.filters') }}
          <UBadge v-if="nombreFiltresActifs" color="primary" variant="solid" size="sm">
            {{ nombreFiltresActifs }}
          </UBadge>
        </UButton>

        <div class="flex-1 lg:hidden" />

        <UButton
          v-if="canManage"
          icon="i-heroicons-tag"
          color="neutral"
          variant="outline"
          @click="tagsModalOpen = true"
        >
          <span class="hidden sm:inline">{{ $t('gestion.stock.tags.manage') }}</span>
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
          <UButton icon="i-heroicons-view-columns" color="neutral" variant="outline">
            <span class="hidden sm:inline">{{ $t('gestion.stock.columns') }}</span>
          </UButton>
        </UDropdownMenu>
      </div>

      <UModal v-model:open="filtresModalOpen" :title="$t('gestion.stock.filters')">
        <template #body>
          <StockItemFilters
            v-model:nom="nomFiltre"
            v-model:tags="tagsFiltres"
            v-model:etats="etatsFiltres"
            v-model:lieu="lieuFiltre"
            :tag-items="tagItems"
            :etats-items="etatsItems"
            class="space-y-4"
          />
        </template>
        <template #footer>
          <div class="flex w-full justify-between gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="!nombreFiltresActifs"
              @click="reinitialiserFiltres"
            >
              {{ $t('common.reset') }}
            </UButton>
            <UButton color="primary" @click="filtresModalOpen = false">
              {{ $t('common.close') }}
            </UButton>
          </div>
        </template>
      </UModal>

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
        >
          <template #select-header="{ table }">
            <UCheckbox
              :model-value="
                table.getIsSomePageRowsSelected()
                  ? 'indeterminate'
                  : table.getIsAllPageRowsSelected()
              "
              :aria-label="$t('common.select_all')"
              :ui="{ base: 'cursor-pointer' }"
              @update:model-value="
                (coche: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!coche)
              "
            />
          </template>
          <template #select-cell="{ row }">
            <!-- La case ne doit pas emmener sur la fiche : cocher et ouvrir sont deux gestes. -->
            <span @click.stop>
              <!-- Le curseur dit que c'est cliquable : sans lui, la case passait pour un simple
                   indicateur d'état. -->
              <UCheckbox
                :model-value="row.getIsSelected()"
                :aria-label="$t('common.select')"
                :ui="{ base: 'cursor-pointer' }"
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
                      <!-- Le visage devant le nom quand la personne est inscrite ; l'icône
                           générique quand ce n'est qu'un nom écrit à la main. -->
                      <UiUserAvatar
                        v-if="prochaineEtape(row.original)!.compte"
                        :user="prochaineEtape(row.original)!.compte!"
                        size="sm"
                        class="shrink-0 mt-0.5"
                      />
                      <UIcon v-else name="i-heroicons-user" class="size-4 shrink-0 mt-0.5" />
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

          <template #lieuEmprunt-cell="{ row }">
            <span v-if="prochaineEtape(row.original)?.lieu" class="text-sm">
              {{ prochaineEtape(row.original)!.lieu }}
            </span>
            <span v-else class="text-gray-400">—</span>
          </template>

          <template #responsableEmprunt-cell="{ row }">
            <div v-if="prochaineEtape(row.original)?.qui" class="flex items-center gap-1.5">
              <!-- On reconnaît une tête plus vite qu'un pseudo, et c'est cette colonne qu'on lit
                   en cherchant à qui s'adresser. Rien devant un nom écrit à la main : la personne
                   n'a pas de compte, et un avatar par défaut laisserait croire le contraire. -->
              <UiUserAvatar
                v-if="prochaineEtape(row.original)!.compte"
                :user="prochaineEtape(row.original)!.compte!"
                size="sm"
                class="shrink-0"
              />
              <span class="text-sm truncate">{{ prochaineEtape(row.original)!.qui }}</span>
            </div>
            <span v-else class="text-gray-400">—</span>
          </template>

          <template #actions-cell="{ row }">
            <!-- Consulter et modifier, chacun son bouton : la ligne entière servait de lien, et
                 l'on atterrissait sur la fiche en voulant simplement cocher une case. -->
            <div class="flex items-center justify-end gap-0.5">
              <UButton
                icon="i-heroicons-eye"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="$t('common.view')"
                @click="goToItem(row.original.id)"
              />
              <!-- La même modale que sur la fiche du matériel : un seul formulaire d'édition,
                   qu'on l'ouvre d'ici ou de là-bas. -->
              <UButton
                v-if="canManage"
                icon="i-heroicons-pencil-square"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="$t('common.edit')"
                @click="openItemModal(row.original)"
              />
            </div>
          </template>

          <template #storage-cell="{ row }">
            <!-- Deux lignes quand les deux existent : le lieu de la carte situe, la précision
                 écrite à la main retrouve. Un lieu posé sur la carte porte la couleur et l'icône
                 de son type, comme sur la carte elle-même. -->
            <div v-if="emplacementDe(row.original)" class="text-sm">
              <div
                v-if="emplacementDe(row.original)!.carte"
                class="flex items-center flex-wrap gap-1.5"
              >
                <UIcon
                  :name="emplacementDe(row.original)!.carte!.icone"
                  class="size-4 shrink-0"
                  :style="{ color: emplacementDe(row.original)!.carte!.couleur }"
                />
                <span>{{ emplacementDe(row.original)!.carte!.nom }}</span>
              </div>
              <div
                v-if="emplacementDe(row.original)!.texte"
                class="flex items-center flex-wrap gap-1.5"
                :class="emplacementDe(row.original)!.carte ? 'text-gray-500 text-xs mt-0.5' : ''"
              >
                <UIcon
                  v-if="!emplacementDe(row.original)!.carte"
                  name="i-heroicons-map-pin"
                  class="size-4 shrink-0 text-gray-400"
                />
                <span>{{ emplacementDe(row.original)!.texte }}</span>
              </div>
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

      <!--
        Le comptage d'inventaire : une séance, pas une fiche.

        On ouvre les caisses les unes après les autres et l'on note. La vue est donc resserrée à
        ce qui sert à compter — le nom, le théorique, la case, l'écart —, et rien ne part au
        serveur avant qu'on le demande : on compte souvent sans réseau, et une sauvegarde
        silencieuse qui échoue une ligne sur deux laisse un inventaire à moitié écrit.
      -->
      <UCard v-else-if="viewMode === 'comptage'" :ui="{ body: 'p-0 sm:p-0' }">
        <div
          class="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700"
        >
          <span class="text-sm">
            {{
              t(
                'gestion.stock.count_progress',
                { comptes: resume.comptes, total: resume.total },
                resume.total
              )
            }}
          </span>
          <!-- Manquants et surplus ne se compensent pas : deux enceintes perdues et trois
               praticables en trop ne font pas « +1 ». Deux nouvelles différentes. -->
          <span v-if="resume.manquants > 0" class="text-sm font-medium text-error">
            {{ t('gestion.stock.count_missing', { count: resume.manquants }, resume.manquants) }}
          </span>
          <span v-if="resume.surplus > 0" class="text-sm font-medium text-warning">
            {{ t('gestion.stock.count_extra', { count: resume.surplus }, resume.surplus) }}
          </span>
        </div>

        <UTable :data="lignesComptage" :columns="colonnesComptage" class="w-full">
          <template #compte-cell="{ row }">
            <UInput
              :model-value="saisieAffichee(row.original.id)"
              type="number"
              min="0"
              class="w-24"
              :placeholder="t('gestion.stock.count_not_counted')"
              @update:model-value="(valeur: string | number) => saisir(row.original.id, valeur)"
            />
          </template>

          <template #ecart-cell="{ row }">
            <!-- Rien quand la ligne n'est pas comptée, rien non plus quand le compte tombe juste :
                 un tableau constellé de « 0 » ne se lit plus. -->
            <span
              v-if="ecartDe(row.original)"
              class="font-medium tabular-nums"
              :class="ecartDe(row.original)! < 0 ? 'text-error' : 'text-warning'"
            >
              {{ ecartDe(row.original)! > 0 ? '+' : '' }}{{ ecartDe(row.original) }}
            </span>
            <span v-else-if="compteDe(row.original) === null" class="text-gray-400 text-sm italic">
              {{ t('gestion.stock.count_not_counted') }}
            </span>
            <span v-else class="text-gray-400">—</span>
          </template>
        </UTable>
      </UCard>
    </div>

    <!-- La barre n'apparaît qu'une fois quelque chose saisi, et dit combien attend : sans ce
         nombre, on ne sait pas si l'on a oublié d'enregistrer. -->
    <div
      v-if="viewMode === 'comptage' && enAttente > 0"
      class="fixed bottom-0 inset-x-0 z-[60] bg-default ring ring-accented shadow-xl px-4 py-3"
    >
      <div class="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <span class="text-sm font-medium">
          {{ t('gestion.stock.count_pending', { count: enAttente }, enAttente) }}
        </span>
        <div class="flex items-center gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            :disabled="comptageEnCours"
            @click="annulerComptage"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="comptageEnCours" @click="enregistrerComptage">
            {{ t('gestion.stock.count_save') }}
          </UButton>
        </div>
      </div>
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

    <StockBulkEditModal
      v-model="bulkEditModalOpen"
      :edition-id="editionId"
      :item-ids="identifiantsSelectionnes"
      :nb-empruntes="nbEmpruntesSelectionnes"
      :tags="tags"
      :zones="zones"
      :markers="markers"
      @saved="apresModificationParLot"
    />

    <StockBulkMoveModal
      v-if="group"
      v-model="bulkMoveModalOpen"
      :edition-id="editionId"
      :item-ids="identifiantsSelectionnes"
      :groupe-courant-id="group.id"
      :groups="allGroups"
      @saved="apresModificationParLot"
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
          class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-default ring ring-accented shadow-xl rounded-full px-4 py-2 flex items-center gap-3"
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
          <!-- Deux gestes distincts : corriger des champs, et changer de rangement. Déplacer n'a
               qu'une question à poser, il mérite son propre bouton plutôt qu'une ligne perdue au
               milieu de dix champs facultatifs. -->
          <UButton
            v-if="canManage"
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-heroicons-pencil-square"
            @click="bulkEditModalOpen = true"
          >
            {{ $t('common.edit') }}
          </UButton>
          <UButton
            v-if="canManage"
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-heroicons-arrow-right-circle"
            @click="bulkMoveModalOpen = true"
          >
            {{ $t('gestion.stock.bulk_move') }}
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
  apparenceEmplacement,
  libelleEmplacement,
} from '../../../../../utils/apparence-emplacement'
import {
  comptagesAEnvoyer,
  compteRetenu,
  ecartComptage,
  nombreEnAttente,
  resumeComptage,
  type LigneComptage,
} from '../../../../../utils/comptage-stock'
import {
  ETATS_EMPRUNT,
  etatEmprunt,
  etatsDepuisUrl,
  filtrerParEtatEmprunt,
  prochaineEtapeEmprunt,
  urlDepuisEtats,
} from '../../../../../utils/etat-emprunt'
import {
  filtrerParTags,
  tagsDepuisUrl,
  urlDepuisTags,
} from '../../../../../utils/filtre-tags-stock'
import {
  nomFichierInventaire,
  preparerInventairePourPdf,
  resumeInventaire,
} from '../../../../../utils/inventaire-pdf'
import { filtrerParLieuEmprunt, filtrerParNom } from '../../../../../utils/recherche-materiel'

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
// Masquées d'entrée : elles ne servent qu'à préparer une tournée, et le menu « Colonnes » les
// ramène quand on en a besoin.
const colonnesVisibles = ref<Record<string, boolean>>({
  lieuEmprunt: false,
  responsableEmprunt: false,
})

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

/** L'emplacement de rangement, avec sa couleur et son icône. */
function emplacementDe(materiel: any) {
  return apparenceEmplacement(materiel.zone, materiel.marker, materiel.location)
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
    lieuEmprunt: t('gestion.stock.loan_place'),
    responsableEmprunt: t('gestion.stock.loan_responsible'),
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
  // Le lieu et la personne de l'étape en cours, masqués par défaut : ils ne servent qu'au moment
  // de préparer une tournée de récupération ou de retour, et encombreraient la liste le reste du
  // temps. La même logique que l'infobulle les alimente — pas de seconde règle qui divergerait.
  {
    id: 'lieuEmprunt',
    accessorFn: (item: any) => prochaineEtapeEmprunt(item)?.lieu ?? '',
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.loan_place')),
  },
  {
    id: 'responsableEmprunt',
    accessorFn: (item: any) => prochaineEtapeEmprunt(item)?.qui ?? '',
    header: ({ column }) => enTeteTriable(column, t('gestion.stock.loan_responsible')),
  },
  {
    id: 'storage',
    accessorFn: (item: any) => libelleEmplacement(emplacementDe(item)),
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
  // Ouvrir la fiche devient un geste explicite : la ligne entière servait de lien, et l'on
  // atterrissait sur la fiche en voulant cocher une case ou poser un tag.
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    size: 100,
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
const nomFiltre = ref('')
const lieuFiltre = ref('')
const filtresModalOpen = ref(false)

/**
 * Combien de filtres sont posés.
 *
 * Sert la pastille du bouton sur écran étroit : les filtres y sont cachés dans une modale, et
 * sans ce compte on chercherait longtemps pourquoi la liste paraît incomplète.
 */
const nombreFiltresActifs = computed(
  () =>
    (nomFiltre.value.trim() ? 1 : 0) +
    (tagsFiltres.value.length > 0 ? 1 : 0) +
    (etatsFiltres.value.length > 0 ? 1 : 0) +
    (lieuFiltre.value.trim() ? 1 : 0)
)

function reinitialiserFiltres() {
  nomFiltre.value = ''
  tagsFiltres.value = []
  etatsFiltres.value = []
  lieuFiltre.value = ''
}

const objetsAffiches = computed(() =>
  filtrerParLieuEmprunt(
    filtrerParNom(
      filtrerParEtatEmprunt(
        filtrerParTags(
          group.value?.items ?? [],
          tagsFiltres.value.map((tg) => tg.value)
        ),
        etatsFiltres.value.map((e) => e.value)
      ),
      nomFiltre.value
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

  nomFiltre.value = typeof route.query.nom === 'string' ? route.query.nom : ''
  lieuFiltre.value = typeof route.query.lieu === 'string' ? route.query.lieu : ''
}

// L'adresse suit le filtre : un lien se partage, et un rechargement ne perd plus la sélection.
// `replace` plutôt que `push`, sans quoi chaque case cochée s'empilerait dans l'historique et le
// bouton « précédent » deviendrait inutilisable.
watch([nomFiltre, tagsFiltres, etatsFiltres, lieuFiltre], () => {
  const parNom = nomFiltre.value.trim() || undefined
  const parTags = urlDepuisTags(tagsFiltres.value.map((tg) => tg.value))
  const parEtat = urlDepuisEtats(etatsFiltres.value.map((e) => e.value))
  const parLieu = lieuFiltre.value.trim() || undefined
  const { nom: _nom, tags: _tags, emprunt: _emprunt, lieu: _lieu, ...reste } = route.query
  router.replace({
    query: {
      ...reste,
      ...(parNom ? { nom: parNom } : {}),
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
/**
 * Le responsable tel que la liste le reçoit.
 *
 * L'avatar n'a d'intérêt que pour la modale d'édition, qui affiche la personne dans un sélecteur :
 * la liste, elle, n'en montre que le pseudo. Il est là parce que la modale s'ouvre désormais aussi
 * depuis cette page, et qu'elle doit y montrer la même chose qu'ailleurs.
 */
interface StockItemResponsable {
  id: number
  pseudo: string
  profilePicture?: string | null
  emailHash?: string | null
}
interface StockItem {
  id: number
  name: string
  description: string | null
  quantity: number
  finalQuantity?: number | null
  // La modale d'édition écrit ces deux champs : la liste doit les porter, sans quoi elle rouvrirait
  // la fiche avec des champs vides et les enregistrerait tels quels.
  notes: string | null
  ownerContact?: string | null
  tags?: Array<{ tag: { id: number; name: string; color: string } }>
  isExternalLoan?: boolean
  pickedUpAt?: string | null
  returnedAt?: string | null
  returnDueAt?: string | null
  pickupLocation?: string | null
  pickupResponsible?: StockItemResponsable | null
  pickupContact?: string | null
  returnLocation?: string | null
  returnResponsible?: StockItemResponsable | null
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
const viewMode = ref<'list' | 'planning' | 'comptage'>('list')
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

const bulkEditModalOpen = ref(false)
const bulkMoveModalOpen = ref(false)

/**
 * Combien d'objets cochés sont des emprunts.
 *
 * La modale l'annonce : les champs de prêt ne toucheront que ceux-là, et poser un lieu de
 * récupération sur du matériel de la convention créerait des données que rien n'affiche.
 */
const nbEmpruntesSelectionnes = computed(() => {
  const choisis = new Set(identifiantsSelectionnes.value)
  return (group.value?.items ?? []).filter((it) => choisis.has(it.id) && it.isExternalLoan).length
})

async function apresModificationParLot() {
  clearSelection()
  await fetchAll()
  await refreshPlanning()
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

/**
 * La séance de comptage.
 *
 * Les saisies vivent à part de la liste chargée : tant qu'on n'a pas enregistré, elles n'ont
 * d'existence qu'ici. `undefined` — la ligne n'a pas été touchée ; `null` — la case a été vidée,
 * ce qui efface le comptage ; un nombre — le compte du jour.
 */
const saisies = ref<Record<number, number | null>>({})
const comptageEnCours = ref(false)

/** Les objets du groupe, augmentés de ce que la séance a saisi. */
const lignesComptage = computed<LigneComptage[]>(() =>
  (group.value?.items ?? []).map((objet: any) => ({
    id: objet.id,
    name: objet.name,
    quantity: objet.quantity,
    finalQuantity: objet.finalQuantity ?? null,
    ...(objet.id in saisies.value ? { saisie: saisies.value[objet.id] } : {}),
  }))
)

const resume = computed(() => resumeComptage(lignesComptage.value))
const enAttente = computed(() => nombreEnAttente(lignesComptage.value))

const colonnesComptage = computed((): TableColumn<any>[] => [
  { id: 'name', accessorKey: 'name', header: t('gestion.stock.item_name') },
  { id: 'quantity', accessorKey: 'quantity', header: t('gestion.stock.count_expected') },
  { id: 'compte', header: t('gestion.stock.count_counted') },
  { id: 'ecart', header: t('gestion.stock.count_gap') },
])

const compteDe = (ligne: LigneComptage) => compteRetenu(ligne)
const ecartDe = (ligne: LigneComptage) => ecartComptage(ligne)

/**
 * Ce que la case affiche : la saisie du jour, sinon l'enregistré, sinon rien.
 *
 * Une chaîne, parce que c'est ce que le champ attend — et la chaîne vide est justement ce qui
 * distingue « non compté » de « compté à zéro ».
 */
function saisieAffichee(id: number): string {
  const ligne = lignesComptage.value.find((l) => l.id === id)
  const compte = compteRetenu(ligne ?? { id, quantity: 0, finalQuantity: null })
  return compte === null ? '' : String(compte)
}

/**
 * Enregistre une frappe dans la séance, sans rien envoyer.
 *
 * Une case vidée vaut `null` et non zéro : c'est le geste qui efface un comptage écrit par
 * erreur, et le confondre avec « zéro exemplaire » ferait disparaître du matériel sur le papier.
 */
function saisir(id: number, valeur: string | number) {
  const texte = String(valeur).trim()
  if (texte === '') {
    saisies.value = { ...saisies.value, [id]: null }
    return
  }
  const nombre = Number(texte)
  if (!Number.isFinite(nombre) || nombre < 0) return
  saisies.value = { ...saisies.value, [id]: Math.floor(nombre) }
}

function annulerComptage() {
  // N'efface que la séance en cours. Les comptages déjà écrits se défont en vidant leur case et
  // en enregistrant — un geste, pas deux.
  saisies.value = {}
}

async function enregistrerComptage() {
  const comptage = comptagesAEnvoyer(lignesComptage.value)
  if (comptage.length === 0) return

  comptageEnCours.value = true
  try {
    await $fetch(`/api/editions/${editionId}/stock-items/bulk`, {
      method: 'PATCH',
      body: { itemIds: comptage.map((entree) => entree.id), comptage },
    })
    useToast().add({
      title: t('common.saved'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    saisies.value = {}
    await fetchAll()
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    comptageEnCours.value = false
  }
}

// Quitter la page avec des saisies non enregistrées, c'est perdre une séance de comptage. On
// prévient — le navigateur se charge du reste.
onBeforeRouteLeave(() => {
  if (enAttente.value === 0) return true
  return window.confirm(t('gestion.stock.count_leave_warning'))
})

const viewModeItems = computed(() => [
  { label: t('gestion.stock.list_view'), value: 'list', icon: 'i-heroicons-list-bullet' },
  // Le comptage n'est proposé qu'à qui peut écrire : une vue de saisie sans droit d'enregistrer
  // serait une invitation à perdre son travail.
  ...(canManage.value
    ? [
        {
          label: t('gestion.stock.count_view'),
          value: 'comptage',
          icon: 'i-heroicons-clipboard-document-check',
        },
      ]
    : []),
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

const exportEnCours = ref(false)

/**
 * La fiche d'inventaire à emporter.
 *
 * Elle sert là où l'application ne sert à rien : le hangar sans réseau, le camion qu'on charge.
 * D'où une colonne « Compté » laissée vide pour écrire à la main — une fiche qu'on ne peut pas
 * annoter ne vaut pas le papier.
 *
 * La préparation des données vit dans `inventaire-pdf`, éprouvée à part ; ici, il n'y a que de la
 * mise en page. Même partage que la FAQ, qui a fait ce chemin avant.
 */
async function exporterInventaire() {
  const lignes = preparerInventairePourPdf((group.value?.items ?? []) as any[])
  if (lignes.length === 0) {
    useToast().add({
      title: t('gestion.stock.export_pdf_empty'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'warning',
    })
    return
  }

  exportEnCours.value = true
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)

    // Paysage : six colonnes dont deux de texte libre ne tiennent pas en portrait sans que les
    // noms d'objets se coupent en trois.
    const doc = new jsPDF({ orientation: 'landscape' })
    const MARGE = 14

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(group.value?.name ?? t('gestion.stock.title'), MARGE, 16)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const sousTitre = [edition.value?.convention?.name, edition.value?.name]
      .filter(Boolean)
      .join(' - ')
    if (sousTitre) doc.text(sousTitre, MARGE, 22)

    // La date, parce qu'une fiche détachée de l'écran n'en a plus d'autre : deux inventaires
    // d'années différentes se ressemblent trop pour qu'on les distingue sans elle.
    const resume = resumeInventaire(lignes)
    doc.setFontSize(9)
    doc.text(
      `${formatDate(new Date())} — ${t('gestion.stock.export_pdf_summary', {
        objets: resume.objets,
        comptes: resume.comptes,
        empruntes: resume.empruntes,
      })}`,
      MARGE,
      sousTitre ? 28 : 22
    )

    // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
    doc.autoTable({
      startY: sousTitre ? 33 : 27,
      margin: { left: MARGE, right: MARGE },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [27, 77, 92] },
      head: [
        [
          t('gestion.stock.item_name'),
          t('gestion.stock.count_expected'),
          t('gestion.stock.count_counted'),
          t('gestion.stock.item_storage_location'),
          t('gestion.stock.tags.field_label'),
          t('gestion.stock.loan_state'),
        ],
      ],
      body: lignes.map((ligne) => [
        ligne.nom,
        ligne.quantite,
        ligne.compte,
        ligne.emplacement,
        ligne.tags,
        ligne.etatEmprunt ? t(ligne.etatEmprunt) : '',
      ]),
      // La colonne « Compté » reste large et vide : c'est là qu'on écrit au crayon.
      columnStyles: {
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
      },
    })

    doc.save(nomFichierInventaire(group.value?.name, edition.value?.name))
  } catch (e: any) {
    useToast().add({
      title: e?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    exportEnCours.value = false
  }
}

const groupActions = computed(() => [
  [
    {
      label: t('gestion.stock.export_pdf'),
      icon: 'i-heroicons-document-arrow-down',
      onSelect: () => exporterInventaire(),
    },
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
