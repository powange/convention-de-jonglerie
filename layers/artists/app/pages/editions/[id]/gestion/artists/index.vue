<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-star" class="text-yellow-600 dark:text-yellow-400" />
          {{ $t('artists.list_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('artists.manage_artists_description') }}
        </p>
      </div>

      <!-- Lien de l'espace artiste : identique pour tous les artistes de l'édition, chacun n'y
           voyant que ses propres informations. Affiché ici pour que l'organisateur puisse le
           communiquer sans avoir à le reconstruire à la main. -->
      <UCard class="mb-6">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('artists.artist_space_link') }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ $t('artists.artist_space_link_help') }}
            </p>
            <p class="mt-2 text-xs font-mono text-gray-600 dark:text-gray-300 break-all">
              {{ artistSpaceUrl }}
            </p>
          </div>
          <UButton
            variant="outline"
            icon="i-heroicons-clipboard-document"
            class="shrink-0"
            @click="copyArtistSpaceUrl"
          >
            {{ $t('common.copy_link') }}
          </UButton>
        </div>
      </UCard>

      <!-- Informations artistes -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-information-circle" class="text-blue-500" />
              {{ $t('artists.artist_info_title') }}
            </h2>
            <div v-if="canEdit" class="flex items-center gap-2">
              <UButton
                v-if="artistInfoDirty"
                color="primary"
                icon="i-heroicons-check"
                :loading="savingArtistInfo"
                @click="saveArtistInfo()"
              >
                {{ $t('common.save') }}
              </UButton>
              <UButton
                v-if="editingArtistInfo"
                color="neutral"
                variant="soft"
                icon="i-heroicons-x-mark"
                @click="cancelArtistInfoEdit"
              >
                {{ $t('common.cancel') }}
              </UButton>
              <UButton
                v-else
                color="primary"
                icon="i-heroicons-pencil-square"
                @click="editingArtistInfo = true"
              >
                {{ $t('common.edit') }}
              </UButton>
            </div>
          </div>
        </template>

        <template v-if="editingArtistInfo">
          <MarkdownEditor
            v-model="artistInfoLocal"
            :placeholder="$t('artists.artist_info_placeholder')"
            class="min-h-40"
          />
        </template>

        <template v-else-if="artistInfoLocal">
          <div class="prose prose-sm dark:prose-invert max-w-none">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div ref="apercuInfos" :class="classeApercu" v-html="artistInfoPreviewHtml" />
            <UButton
              v-if="!artistInfoExpanded && texteInfosDeborde"
              variant="ghost"
              color="primary"
              size="xs"
              class="mt-2"
              @click="artistInfoExpanded = true"
            >
              {{ $t('common.see_more') }}...
            </UButton>
            <UButton
              v-else-if="artistInfoExpanded"
              variant="ghost"
              color="primary"
              size="xs"
              class="mt-2"
              @click="artistInfoExpanded = false"
            >
              {{ $t('common.see_less') }}
            </UButton>
          </div>
        </template>

        <template v-else>
          <p class="text-sm text-gray-400 italic">
            {{ $t('artists.artist_info_empty') }}
          </p>
        </template>
      </UCard>

      <!-- Totaux financiers. Ils suivent les filtres du tableau : filtrer par spectacle donne
           le budget de ce spectacle, ce qui est plus utile qu'un total figé de l'édition. -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <UCard v-for="total in financialTotals" :key="total.label">
          <div class="flex items-start gap-3">
            <div class="rounded-lg p-2 shrink-0" :class="total.iconBg">
              <UIcon :name="total.icon" class="size-5" :class="total.iconColor" />
            </div>
            <div class="min-w-0">
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ total.label }}</p>
              <p class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ formatAmount(total.value) }}
              </p>
              <p v-if="total.hint" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ total.hint }}
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Contenu -->
      <UCard>
        <template #header>
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">{{ $t('artists.title') }}</h2>
              <UButton
                v-if="canEdit"
                color="primary"
                icon="i-heroicons-plus"
                @click="openAddArtistModal"
              >
                {{ $t('artists.add_artist') }}
              </UButton>
            </div>

            <!-- Barre de filtres et contrôles -->
            <div
              v-if="artists.length > 0"
              class="flex flex-col sm:flex-row items-start sm:items-center gap-3"
            >
              <UInput
                v-model="globalFilter"
                :placeholder="$t('artists.search_placeholder')"
                icon="i-heroicons-magnifying-glass"
                class="w-full sm:w-64"
              />

              <!-- Sélection multiple : un même artiste joue souvent dans plusieurs spectacles, et
                   on veut pouvoir regarder deux plateaux à la fois. Rien de coché vaut « tous »,
                   ce que dit le libellé affiché à vide. -->
              <USelectMenu
                v-model="showFilter"
                multiple
                value-key="value"
                :items="showFilterItems"
                :placeholder="$t('artists.all_shows')"
                :search-input="{ placeholder: $t('artists.filter_by_show') }"
                class="w-full sm:w-64"
              />

              <div class="flex items-center gap-2 ml-auto">
                <UBadge color="neutral" variant="soft">
                  {{ $t('common.total') }}: {{ filteredArtists.length }}
                </UBadge>

                <UButton
                  v-if="globalFilter || showFilter.length > 0"
                  icon="i-heroicons-x-mark"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :title="$t('artists.reset_filters')"
                  @click="resetFilters"
                />

                <!-- Les colonnes AVANT l'export, partout : on choisit ce qu'on montre, puis
                     on l'emporte. L'ordre inverse se lisait comme deux boutons sans rapport. -->
                <UiColumnsMenu
                  variant="soft"
                  :table-api="tableRef?.tableApi"
                  :libelle="getColumnLabel"
                />

                <!-- L'export n'a rien à produire sur un tableau vide : un fichier sans lignes
                     se lit comme un export raté, et l'on cherche l'erreur là où il n'y en a
                     pas. -->
                <UiExportMenu
                  variant="outline"
                  :disabled="filteredArtists.length === 0"
                  :on-csv="exporterCsv"
                  :on-pdf="exporterPdf"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- Liste des artistes -->
        <div v-if="loading" class="text-center py-8">
          <p class="text-gray-500">{{ $t('common.loading') }}</p>
        </div>

        <div v-else-if="artists.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-user-group" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p class="text-gray-500">{{ $t('artists.no_artists') }}</p>
        </div>

        <div v-else class="overflow-x-auto">
          <UContextMenu :items="contextMenuItems">
            <UTable
              ref="tableRef"
              v-model:sorting="sorting"
              v-model:column-visibility="columnVisibility"
              v-model:global-filter="globalFilter"
              :data="filteredArtists"
              :columns="columns"
              class="w-full"
              @contextmenu="onRowContextmenu"
            >
              <!-- Nom -->
              <template #name-cell="{ row }">
                <div class="flex items-center gap-2">
                  <UiUserAvatar :user="row.original.user" size="sm" />
                  <span class="font-medium">
                    <UiUserName :user="row.original.user" />
                  </span>
                </div>
              </template>

              <!-- Email -->
              <template #email-cell="{ row }">
                <span class="text-gray-600 dark:text-gray-400">{{ row.original.user.email }}</span>
              </template>

              <!-- Téléphone -->
              <template #phone-cell="{ row }">
                <span class="text-gray-600 dark:text-gray-400">{{
                  row.original.user.phone || '-'
                }}</span>
              </template>

              <!-- Arrivée -->
              <template #arrival-cell="{ row }">
                <div v-if="row.original.arrivalDateTime" class="space-y-1">
                  <div class="text-gray-900 dark:text-white font-medium">
                    {{ formaterDateHeure(row.original.arrivalDateTime, fuseauEdition, locale) }}
                  </div>
                  <div v-if="row.original.pickupRequired" class="text-xs space-y-0.5">
                    <div class="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                      <UIcon name="i-heroicons-map-pin" class="h-3 w-3" />
                      <span>{{
                        row.original.pickupLocation || $t('artists.pickup_location')
                      }}</span>
                    </div>
                    <div
                      v-if="row.original.pickupResponsible"
                      class="flex items-center gap-1 text-gray-600 dark:text-gray-400"
                    >
                      <UIcon name="i-heroicons-user" class="h-3 w-3" />
                      <span>{{ row.original.pickupResponsible.pseudo }}</span>
                    </div>
                  </div>
                </div>
                <span v-else class="text-gray-400">-</span>
              </template>

              <!-- Départ -->
              <template #departure-cell="{ row }">
                <div v-if="row.original.departureDateTime" class="space-y-1">
                  <div class="text-gray-900 dark:text-white font-medium">
                    {{ formaterDateHeure(row.original.departureDateTime, fuseauEdition, locale) }}
                  </div>
                  <div v-if="row.original.dropoffRequired" class="text-xs space-y-0.5">
                    <div class="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                      <UIcon name="i-heroicons-map-pin" class="h-3 w-3" />
                      <span>{{
                        row.original.dropoffLocation || $t('artists.dropoff_location')
                      }}</span>
                    </div>
                    <div
                      v-if="row.original.dropoffResponsible"
                      class="flex items-center gap-1 text-gray-600 dark:text-gray-400"
                    >
                      <UIcon name="i-heroicons-user" class="h-3 w-3" />
                      <span>{{ row.original.dropoffResponsible.pseudo }}</span>
                    </div>
                  </div>
                </div>
                <span v-else class="text-gray-400">-</span>
              </template>

              <!-- Repas -->
              <template #meals-cell="{ row }">
                <UButton
                  :color="getAcceptedMealsCount(row.original) > 0 ? 'primary' : 'neutral'"
                  variant="soft"
                  size="sm"
                  @click="openMealsModal(row.original)"
                >
                  <span class="font-medium">{{ getMealsDisplayText(row.original) }}</span>
                  <UIcon name="i-heroicons-chevron-right" class="ml-1 h-4 w-4" />
                </UButton>
              </template>

              <!-- Spectacles -->
              <template #shows-cell="{ row }">
                <div
                  v-if="row.original.shows && row.original.shows.length > 0"
                  class="flex flex-wrap gap-1"
                >
                  <UBadge
                    v-for="showArtist in row.original.shows"
                    :key="showArtist.show.id"
                    color="purple"
                    variant="subtle"
                    size="sm"
                  >
                    {{ showArtist.show.title }}
                  </UBadge>
                </div>
                <span v-else class="text-gray-400">-</span>
              </template>

              <!-- Paiement -->
              <template #payment-cell="{ row }">
                <div v-if="row.original.payment" class="flex items-center gap-2">
                  <span class="font-medium">{{ formatAmount(Number(row.original.payment)) }}</span>
                  <UBadge
                    :color="row.original.paymentPaid ? 'success' : 'warning'"
                    variant="soft"
                    size="sm"
                  >
                    {{ row.original.paymentPaid ? '✓' : '○' }}
                  </UBadge>
                </div>
                <span v-else class="text-gray-400">-</span>
              </template>

              <!-- Remboursement -->
              <template #reimbursement-cell="{ row }">
                <div
                  v-if="row.original.reimbursementMax || row.original.reimbursementActual"
                  class="space-y-1"
                >
                  <div v-if="row.original.reimbursementMax" class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">Max:</span>
                    <span class="font-medium">{{
                      formatAmount(Number(row.original.reimbursementMax))
                    }}</span>
                  </div>
                  <div v-if="row.original.reimbursementActual" class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">Réel:</span>
                    <span class="font-medium">{{
                      formatAmount(Number(row.original.reimbursementActual))
                    }}</span>
                    <UBadge
                      :color="row.original.reimbursementActualPaid ? 'success' : 'warning'"
                      variant="soft"
                      size="sm"
                    >
                      {{ row.original.reimbursementActualPaid ? '✓' : '○' }}
                    </UBadge>
                  </div>
                </div>
                <span v-else class="text-gray-400">-</span>
              </template>

              <!-- Remboursement des consommables -->
              <template #consumables-cell="{ row }">
                <div
                  v-if="row.original.consumablesMax || row.original.consumablesActual"
                  class="space-y-1"
                >
                  <div v-if="row.original.consumablesMax" class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">Max:</span>
                    <span class="font-medium">{{
                      formatAmount(Number(row.original.consumablesMax))
                    }}</span>
                  </div>
                  <div v-if="row.original.consumablesActual" class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">Réel:</span>
                    <span class="font-medium">{{
                      formatAmount(Number(row.original.consumablesActual))
                    }}</span>
                    <UBadge
                      :color="row.original.consumablesActualPaid ? 'success' : 'warning'"
                      variant="soft"
                      size="sm"
                    >
                      {{ row.original.consumablesActualPaid ? '✓' : '○' }}
                    </UBadge>
                  </div>
                </div>
                <span v-else class="text-gray-400">-</span>
              </template>

              <!-- Hébergement -->
              <template #accommodation-cell="{ row }">
                <div class="space-y-1">
                  <div v-if="row.original.accommodationAutonomous" class="flex items-center gap-2">
                    <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-success-500" />
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                      {{ $t('artists.accommodation_autonomous_yes') }}
                    </span>
                  </div>
                  <div
                    v-if="row.original.accommodationType"
                    class="flex items-center gap-1 text-xs"
                  >
                    <UBadge color="info" variant="subtle" size="sm">
                      {{ accommodationTypeLabel(row.original.accommodationType) }}
                    </UBadge>
                    <span
                      v-if="
                        row.original.accommodationType === 'OTHER' &&
                        row.original.accommodationTypeOther
                      "
                      class="text-gray-500 truncate max-w-30"
                      :title="row.original.accommodationTypeOther"
                    >
                      {{ row.original.accommodationTypeOther }}
                    </span>
                  </div>
                  <button
                    v-if="
                      !row.original.accommodationAutonomous && row.original.accommodationProposal
                    "
                    class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer w-full text-left"
                    @click="openAccommodationModal(row.original)"
                  >
                    <UIcon name="i-heroicons-home" class="h-5 w-5 text-primary-500 shrink-0" />
                    <span class="text-sm text-gray-700 dark:text-gray-300 line-clamp-1 flex-1">
                      {{ row.original.accommodationProposal }}
                    </span>
                    <UIcon name="i-heroicons-chevron-right" class="h-4 w-4 text-primary-500" />
                  </button>
                  <div
                    v-if="
                      !row.original.accommodationAutonomous &&
                      !row.original.accommodationProposal &&
                      !row.original.accommodationType
                    "
                    class="flex items-center gap-2"
                  >
                    <UIcon name="i-heroicons-question-mark-circle" class="h-5 w-5 text-gray-400" />
                    <span class="text-sm text-gray-400">
                      {{ $t('artists.accommodation_not_specified') }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- Facture -->
              <template #invoice-cell="{ row }">
                <UTooltip :text="getInvoiceStatusText(row.original)">
                  <UBadge
                    :color="getInvoiceStatusColor(row.original)"
                    variant="soft"
                    size="sm"
                    class="cursor-help"
                  >
                    {{ getInvoiceStatusIcon(row.original) }}
                  </UBadge>
                </UTooltip>
              </template>

              <!-- Cachet -->
              <template #fee-cell="{ row }">
                <UTooltip :text="getFeeStatusText(row.original)">
                  <UBadge
                    :color="getFeeStatusColor(row.original)"
                    variant="soft"
                    size="sm"
                    class="cursor-help"
                  >
                    {{ getFeeStatusIcon(row.original) }}
                  </UBadge>
                </UTooltip>
              </template>

              <!-- Notes organisateur -->
              <template #notes-cell="{ row }">
                <button
                  v-if="row.original.organizerNotes"
                  class="w-full text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  @click="openNotesModal(row.original)"
                >
                  <p class="text-gray-700 dark:text-gray-300 whitespace-pre-line line-clamp-3">
                    {{ row.original.organizerNotes }}
                  </p>
                  <div class="flex items-center gap-1 text-xs text-primary-500 mt-1">
                    <span>{{ $t('common.view_more') }}</span>
                    <UIcon name="i-heroicons-chevron-right" class="h-3 w-3" />
                  </div>
                </button>
                <button
                  v-else
                  class="w-full text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  @click="openNotesModal(row.original)"
                >
                  <p class="text-gray-400 italic text-xs">
                    {{ $t('artists.no_notes') }}
                  </p>
                  <div class="flex items-center gap-1 text-xs text-primary-500 mt-1">
                    <span>{{ $t('common.add') }}</span>
                    <UIcon name="i-heroicons-plus" class="h-3 w-3" />
                  </div>
                </button>
              </template>

              <!-- Actions -->
              <template #actions-cell="{ row }">
                <div class="flex items-center justify-end gap-2">
                  <UButton
                    icon="i-heroicons-pencil"
                    color="primary"
                    variant="ghost"
                    size="sm"
                    @click="openEditArtistModal(row.original)"
                  />
                  <UButton
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="sm"
                    @click="confirmDeleteArtist(row.original)"
                  />
                </div>
              </template>
            </UTable>
          </UContextMenu>
        </div>
      </UCard>
    </div>

    <!-- Modal artiste -->
    <ArtistsArtistModal
      v-model="showArtistModal"
      :artist="selectedArtist"
      :edition-id="editionId"
      @artist-saved="handleArtistSaved"
    />

    <!-- Modal repas -->
    <ArtistsMealsModal
      v-if="edition?.mealsEnabled && showMealsModal"
      v-model="showMealsModal"
      :artist="selectedArtistForMeals"
      :edition-id="editionId"
      @meals-saved="handleMealsSaved"
    />

    <!-- Modal notes organisateur -->
    <ArtistsOrganizerNotesModal
      v-if="showNotesModal"
      v-model="showNotesModal"
      :artist="selectedArtistForNotes"
      :edition-id="editionId"
      @notes-saved="handleNotesSaved"
    />

    <!-- Modal hébergement -->
    <ArtistsAccommodationModal
      v-if="showAccommodationModal"
      v-model="showAccommodationModal"
      :artist="selectedArtistForAccommodation"
      :accommodation-proposal="selectedArtistForAccommodation?.accommodationProposal || ''"
    />

    <!-- Modal confirmation suppression -->
    <UiConfirmModal
      v-model="showDeleteConfirm"
      :title="$t('artists.delete_artist')"
      :message="$t('artists.delete_confirm')"
      confirm-color="error"
      :loading="deletingArtist"
      @confirm="deleteArtist"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
// Ces deux-ci vivent dans la couche application, que l'alias `~` atteint bien.
import { dessinerCaseACocher, ENTETE_COCHE, styleColonneCoche } from '~/utils/pdf-case-a-cocher'
import { telechargerFichier } from '~/utils/telechargement'

import { getAccommodationTypeLabel, markdownToHtml } from '#imports'

// Chemin relatif, comme `filtres-artistes-url` juste en dessous : l'alias `~` ne résout pas
// vers le dossier du LAYER, et un `~/utils/...` d'apparence normale casse la compilation sans
// que le lint ni les tests ne s'en aperçoivent.
import {
  colonnesImprimables,
  nomFichierArtistes,
  preparerTableauDArtistes,
  texteDesRepas,
} from '../../../../../utils/export-artistes-pdf'
import { filtresDepuisUrl, requeteArtistes } from '../../../../../utils/filtres-artistes-url'

import type { TableColumn } from '@nuxt/ui'
import type { Column } from '@tanstack/vue-table'

import { nomDeFichierCsv, versCsv } from '~~/shared/utils/csv'
import { formaterDateHeure, formaterJournee } from '~~/shared/utils/fuseau-edition'
import { DEFAULT_CURRENCY } from '~~/shared/utils/money'

definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const toast = useToast()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

/**
 * Le fuseau de l'édition : une heure d'arrivée est une heure de LIEU. `formatDateTime` la rendait
 * dans celui du navigateur, donc décalée pour un organisateur en déplacement.
 */
const fuseauEdition = computed(
  () => (edition.value as { timezone?: string | null } | undefined)?.timezone ?? null
)

// URL absolue de l'espace artiste, à communiquer aux artistes de l'édition. `useRequestURL()`
// donne l'origine réelle côté serveur comme côté client, sans la deviner ni la coder en dur.
const artistSpaceUrl = computed(
  () => `${useRequestURL().origin}/editions/${editionId.value}/artist-space`
)

const copyArtistSpaceUrl = async () => {
  try {
    await navigator.clipboard.writeText(artistSpaceUrl.value)
    toast.add({
      title: t('common.success'),
      description: t('common.link_copied'),
      color: 'success',
    })
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('common.copy_error'),
      color: 'error',
    })
  }
}

// Permissions — toute la page est réservée aux organisateurs qui gèrent les artistes
const canAccess = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

const canEdit = computed(() => canAccess.value)

// Informations artistes (champ sur l'édition)
const artistInfoLocal = ref(edition.value?.artistInfo ?? '')
const artistInfoDirty = computed(() => artistInfoLocal.value !== (edition.value?.artistInfo ?? ''))
const editingArtistInfo = ref(false)
const artistInfoExpanded = ref(false)

const artistInfoPreviewHtml = ref('')

const renderArtistInfoPreview = async () => {
  if (!edition.value?.artistInfo) {
    artistInfoPreviewHtml.value = ''
    return
  }
  try {
    artistInfoPreviewHtml.value = await markdownToHtml(edition.value.artistInfo)
  } catch {
    artistInfoPreviewHtml.value = ''
  }
}

/**
 * « Voir plus » n'a de sens que si le texte est réellement tronqué.
 *
 * On le mesure plutôt que de compter des caractères : la troncature vient de `line-clamp-3`, qui
 * dépend de la largeur, de la police et du contenu — deux phrases tiennent sur trois lignes ici et
 * déborderaient sur un écran étroit. On compare donc la hauteur réelle du contenu à celle
 * affichée, et seul l'écart décide.
 */
const apercuInfos = ref<HTMLElement | null>(null)
const texteInfosDeborde = ref(false)

// Sorti du gabarit pour que la balise tienne sur une ligne : la désactivation ESLint du `v-html`
// porte sur la ligne suivante, et se perdrait si la balise était découpée.
const classeApercu = computed(() => (artistInfoExpanded.value ? '' : 'line-clamp-3'))

const mesurerDebordement = () => {
  const el = apercuInfos.value
  // Déplié, la troncature est levée : la mesure ne voudrait plus rien dire. C'est « Voir moins »
  // qui s'affiche alors, sans condition.
  if (!el || artistInfoExpanded.value) return
  // Un pixel de tolérance : les arrondis de rendu créent un écart qui ne se voit pas.
  texteInfosDeborde.value = el.scrollHeight - el.clientHeight > 1
}

// La largeur change avec la fenêtre, et le contenu après chaque enregistrement.
useResizeObserver(apercuInfos, mesurerDebordement)
watch([artistInfoPreviewHtml, artistInfoExpanded, editingArtistInfo], () =>
  nextTick(mesurerDebordement)
)
onMounted(() => nextTick(mesurerDebordement))

const { execute: saveArtistInfo, loading: savingArtistInfo } = useApiAction(
  () => `/api/editions/${editionId.value}/artist-info`,
  {
    method: 'PUT',
    body: () => ({ artistInfo: artistInfoLocal.value || null }),
    successMessage: { title: t('artists.artist_info_saved') },
    errorMessages: { default: t('artists.artist_info_save_error') },
    onSuccess: () => {
      editionStore.fetchEditionById(editionId.value, { force: true })
      editingArtistInfo.value = false
    },
  }
)

const cancelArtistInfoEdit = () => {
  artistInfoLocal.value = edition.value?.artistInfo ?? ''
  editingArtistInfo.value = false
}

// Sync artistInfoLocal quand l'édition change (sauf si l'utilisateur est en train d'éditer)
watch(
  () => edition.value?.artistInfo,
  (val) => {
    if (!editingArtistInfo.value) {
      artistInfoLocal.value = val ?? ''
    }
    renderArtistInfoPreview()
  }
)

// Données
const artists = ref<any[]>([])
const showArtistModal = ref(false)
const selectedArtist = ref<any>(null)
const showMealsModal = ref(false)
const selectedArtistForMeals = ref<any>(null)
const showNotesModal = ref(false)
const selectedArtistForNotes = ref<any>(null)
const showAccommodationModal = ref(false)
const selectedArtistForAccommodation = ref<any>(null)
const showDeleteConfirm = ref(false)
const artistToDelete = ref<any>(null)

// Table ref pour accès API TanStack
// `ref()` simple, comme ailleurs dans le dépôt : `@nuxt/ui` n'expose pas `UTable` comme type
// dans cette version, et l'annotation ne résolvait rien.
const tableRef = ref()

// État du tri
const sorting = ref<{ id: string; desc: boolean }[]>([])

// Visibilité des colonnes
const columnVisibility = ref<Record<string, boolean>>({})

// Filtres, conservés dans l'URL — même règle que le planning et les candidatures de bénévoles,
// cf. `filtres-artistes-url.ts`.
const filtresInitiaux = filtresDepuisUrl(route.query)
const globalFilter = ref(filtresInitiaux.recherche)
const showFilter = ref<string[]>(filtresInitiaux.spectacles)

// `replace` et non `push` : choisir un filtre n'est pas un pas de navigation à revenir en arrière.
//
// `deep` parce que le filtre de spectacles est maintenant un tableau : ce watcher ne ferait rien
// si le composant le mutait au lieu de le remplacer, et l'URL cesserait de suivre sans que rien
// ne le signale. Le surcoût est nul — recopier une query identique ne déclenche aucune navigation.
watch(
  [globalFilter, showFilter],
  () => {
    router.replace({
      query: requeteArtistes(route.query, {
        spectacles: showFilter.value,
        recherche: globalFilter.value,
      }),
    })
  },
  { deep: true }
)

// Liste des spectacles pour le filtre
const allShows = computed(() => {
  const showsMap = new Map<number, string>()
  artists.value.forEach((artist) => {
    artist.shows?.forEach((sa: any) => {
      if (!showsMap.has(sa.show.id)) {
        showsMap.set(sa.show.id, sa.show.title)
      }
    })
  })
  return Array.from(showsMap.entries()).map(([id, title]) => ({
    label: title,
    value: String(id),
  }))
})

// Plus d'entrée « tous les spectacles » : en sélection multiple, ne rien cocher le dit déjà, et
// une telle entrée cohabiterait mal avec les autres — que signifierait « tous » coché en même
// temps qu'un spectacle précis ?
const showFilterItems = computed(() => allShows.value)

// Artistes filtrés par spectacle
const filteredArtists = computed(() => {
  if (showFilter.value.length === 0) return artists.value
  // Un artiste est retenu dès qu'il joue dans L'UN des spectacles cochés : cocher deux plateaux
  // montre les deux distributions réunies, et non leur intersection, qui serait presque toujours
  // vide.
  return artists.value.filter((artist) =>
    artist.shows?.some((sa: any) => showFilter.value.includes(String(sa.show.id)))
  )
})

/**
 * Somme d'un champ monétaire sur les artistes affichés, les montants non saisis comptant pour 0.
 *
 * Le `Number()` n'est pas décoratif : ces colonnes sont des `Decimal` Prisma, qui traversent
 * JSON sous forme de chaînes (« 150.00 »). Les additionner directement concaténerait.
 */
const sumField = (field: string) =>
  filteredArtists.value.reduce((total, artist) => total + (Number(artist[field]) || 0), 0)

/**
 * Montant dans la devise de l'édition, sans décimales inutiles : « 1 250 € » plutôt que
 * « 1250,00 € ». La devise vient de l'édition et non d'un « € » écrit en dur : une édition en
 * francs suisses afficherait sinon des euros.
 */
const editionCurrency = computed(() => edition.value?.currency || DEFAULT_CURRENCY)

const formatAmount = (amount: number) =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: editionCurrency.value,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)

// Le défraiement et les consommables affichent le réel en grand et le plafond en dessous :
// c'est l'écart entre les deux qui indique si l'enveloppe est tenue.
const financialTotals = computed(() => [
  {
    label: t('artists.total_payments'),
    value: sumField('payment'),
    hint: '',
    icon: 'i-heroicons-banknotes',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: t('artists.total_reimbursements'),
    value: sumField('reimbursementActual'),
    hint: t('artists.total_of_max', { amount: formatAmount(sumField('reimbursementMax')) }),
    icon: 'i-heroicons-truck',
    iconBg: 'bg-sky-100 dark:bg-sky-900/40',
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
  {
    label: t('artists.total_consumables'),
    value: sumField('consumablesActual'),
    hint: t('artists.total_of_max', { amount: formatAmount(sumField('consumablesMax')) }),
    icon: 'i-heroicons-shopping-bag',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
])

/**
 * Le tableau que l'on a sous les yeux, en PDF.
 *
 * Les artistes **filtrés**, dans les **colonnes affichées**, et dans leur ordre à l'écran :
 * exporter autre chose que ce qui est montré produit un document que personne ne sait relire.
 *
 * Ce qui en sort est décidé dans `export-artistes-pdf`, éprouvé par des tests — un PDF ne se
 * rattrape pas une fois envoyé. Ici ne reste que la mise en forme, qui dépend des traductions.
 *
 * `jspdf` est importé à la demande : quelques centaines de kilo-octets qui n'ont rien à faire
 * dans le chargement d'une page que l'on n'exporte pas à chaque visite.
 */
const exportEnCours = ref(false)

/** Le jour d'un repas, nommé dans le fuseau de l'édition — « vendredi ». */
const jourDuRepas = (journee: string) =>
  journee ? formaterJournee(journee, fuseauEdition.value, locale.value, { weekday: 'long' }) : ''

/** Le moment de la journée, dans sa forme courte : « matin », « midi », « soir ». */
const momentDuRepas = (mealType: string) =>
  ({
    BREAKFAST: t('gestion.meals.breakfast'),
    LUNCH: t('gestion.meals.lunch'),
    DINNER: t('gestion.meals.dinner'),
  })[mealType] ?? ''

/**
 * La valeur d'une cellule, réduite en texte.
 *
 * Les colonnes que le tableau rend par des composants — repas, hébergement, facture, cachet —
 * n'ont pas de valeur textuelle à récupérer : on la reconstruit ici, à partir des mêmes
 * fonctions que l'écran, pour que le PDF dise la même chose que la page.
 */
const valeurPourPdf = (artist: any, colonneId: string): string => {
  switch (colonneId) {
    case 'name':
      return [artist.user?.prenom, artist.user?.nom].filter(Boolean).join(' ')
    case 'email':
      return artist.user?.email ?? ''
    case 'phone':
      return artist.user?.phone ?? ''
    case 'arrival':
      return artist.arrivalDateTime
        ? formaterDateHeure(artist.arrivalDateTime, fuseauEdition.value, locale.value)
        : ''
    case 'departure':
      return artist.departureDateTime
        ? formaterDateHeure(artist.departureDateTime, fuseauEdition.value, locale.value)
        : ''
    // Nommés et non comptés : à l'écran « 2/3 » ouvre le détail d'un clic, sur papier personne
    // ne peut cliquer — et c'est cette liste qu'on emporte en cuisine.
    case 'meals':
      return texteDesRepas(artist.mealSelections, jourDuRepas, momentDuRepas)
    case 'shows':
      return (artist.shows ?? []).map((sa: any) => sa.show.title).join(', ')
    case 'payment':
      return formatAmount(Number(artist.payment ?? 0))
    case 'reimbursement':
      return formatAmount(Number(artist.reimbursementMax || artist.reimbursementActual || 0))
    case 'consumables':
      return formatAmount(Number(artist.consumablesMax || artist.consumablesActual || 0))
    case 'accommodation':
      return [
        artist.accommodationAutonomous ? t('artists.accommodation_autonomous_yes') : '',
        artist.accommodationType ? accommodationTypeLabel(artist.accommodationType) : '',
        artist.accommodationType === 'OTHER' ? (artist.accommodationTypeOther ?? '') : '',
      ]
        .filter(Boolean)
        .join(' - ')
    case 'invoice':
      return getInvoiceStatusText(artist)
    case 'fee':
      return getFeeStatusText(artist)
    case 'notes':
      return artist.organizerNotes ?? ''
    default:
      return ''
  }
}

/**
 * Les colonnes retenues pour un export, telles que la TABLE les donne.
 *
 * L'ordre et la visibilité viennent d'elle, et non d'une liste tenue en parallèle qui finirait
 * par diverger. Les deux formats la lisent au même endroit : sans cela, décocher une colonne
 * l'aurait retirée du PDF mais pas du fichier tableur, et rien à l'écran ne l'aurait expliqué.
 */
const colonnesAExporter = () => {
  const idsVisibles = (tableRef.value?.tableApi?.getVisibleLeafColumns() ?? []).map(
    (colonne: any) => colonne.id
  )
  return colonnesImprimables(idsVisibles, getColumnLabel)
}

/**
 * La même liste, en fichier tableur.
 *
 * Sans passer par `texteImprimable` : ses deux corrections ne servent qu'au PDF. Elle remplace
 * l'espace insécable étroite des montants, qu'une police WinAnsi imprime en barre oblique — un
 * tableur, lui, la lit très bien — et elle aplatit les retours à la ligne, qu'une cellule CSV
 * entre guillemets porte sans difficulté.
 */
const exporterCsv = () => {
  if (filteredArtists.value.length === 0) return

  const colonnes = colonnesAExporter()

  telechargerFichier(
    nomDeFichierCsv(`artistes-edition-${editionId.value}`),
    versCsv(
      colonnes.map((colonne) => colonne.entete),
      filteredArtists.value.map((artiste: any) =>
        colonnes.map((colonne) => valeurPourPdf(artiste, colonne.id))
      )
    ),
    'text/csv;charset=utf-8'
  )

  toast.add({ title: t('common.export_success'), color: 'success' })
}

async function exporterPdf() {
  if (filteredArtists.value.length === 0) return

  exportEnCours.value = true
  try {
    const colonnes = colonnesAExporter()
    if (colonnes.length === 0) return

    const { entetes, lignes } = preparerTableauDArtistes(
      filteredArtists.value,
      colonnes,
      valeurPourPdf
    )

    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)

    // Paysage : ce tableau peut compter une douzaine de colonnes, dont plusieurs de texte libre.
    const doc = new jsPDF({ orientation: 'landscape' })
    const MARGE = 14
    const maintenant = new Date()

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(t('artists.list_title'), MARGE, 16)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const sousTitre = [edition.value?.convention?.name, edition.value?.name]
      .filter(Boolean)
      .join(' - ')
    if (sousTitre) doc.text(sousTitre, MARGE, 22)

    // Le nombre d'artistes et la date : sans eux, impossible de savoir, trois semaines plus tard,
    // si le document qu'on a sous les yeux est à jour ou s'il portait un filtre.
    doc.setFontSize(9)
    doc.text(
      `${formaterJournee(maintenant, fuseauEdition.value, locale.value)} - ${t('common.total')}: ${filteredArtists.value.length}`,
      MARGE,
      sousTitre ? 28 : 22
    )

    // Une colonne de cases en tête : cette liste s'imprime pour appeler les artistes un à un,
    // et l'on coche au fur et à mesure. Sans case, on coche quand même — sur le nom.
    // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
    doc.autoTable({
      startY: sousTitre ? 33 : 27,
      margin: { left: MARGE, right: MARGE },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [124, 58, 237] },
      columnStyles: styleColonneCoche(),
      head: [[ENTETE_COCHE, ...entetes]],
      body: lignes.map((ligne) => ['', ...ligne]),
      didDrawCell: (cellule: unknown) => dessinerCaseACocher(doc, cellule as never),
    })

    doc.save(nomFichierArtistes(edition.value?.name, maintenant))
  } catch (error) {
    console.error('Export PDF des artistes :', error)
    toast.add({
      title: t('artists.export_pdf_error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    exportEnCours.value = false
  }
}

const resetFilters = () => {
  globalFilter.value = ''
  showFilter.value = []
  sorting.value = []
}

// Helper pour les en-têtes triables
function getSortableHeader(column: Column<any>, label: string) {
  const isSorted = column.getIsSorted()
  return h(resolveComponent('UButton'), {
    color: 'neutral',
    variant: 'ghost',
    label,
    icon: isSorted
      ? isSorted === 'asc'
        ? 'i-lucide-arrow-up-narrow-wide'
        : 'i-lucide-arrow-down-wide-narrow'
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(isSorted === 'asc'),
  })
}

// Labels des colonnes pour le sélecteur de visibilité
const getColumnLabel = (columnId: string): string => {
  const labels: Record<string, string> = {
    name: t('common.name'),
    email: t('common.email'),
    phone: t('edition.ticketing.phone'),
    arrival: t('artists.arrival'),
    departure: t('artists.departure'),
    meals: t('common.meals_short'),
    shows: t('artists.shows'),
    payment: t('artists.payment_amount'),
    reimbursement: t('artists.reimbursement_max_actual'),
    consumables: t('artists.consumables_max_actual'),
    accommodation: t('artists.accommodation'),
    invoice: t('artists.invoice_short'),
    fee: t('artists.fee_short'),
    notes: t('artists.organizer_notes'),
    actions: t('common.actions'),
  }
  return labels[columnId] || columnId
}

// Définition des colonnes
const columns = computed((): TableColumn<any>[] => [
  {
    id: 'name',
    accessorFn: (row: any) => `${row.user?.prenom} ${row.user?.nom}`,
    header: ({ column }) => getSortableHeader(column, t('common.name')),
    enableHiding: false,
  },
  {
    id: 'email',
    accessorFn: (row: any) => row.user?.email,
    header: ({ column }) => getSortableHeader(column, t('common.email')),
  },
  {
    id: 'phone',
    accessorFn: (row: any) => row.user?.phone,
    header: t('edition.ticketing.phone'),
    enableSorting: false,
  },
  {
    id: 'arrival',
    accessorKey: 'arrivalDateTime',
    header: ({ column }) => getSortableHeader(column, t('artists.arrival')),
  },
  {
    id: 'departure',
    accessorKey: 'departureDateTime',
    header: ({ column }) => getSortableHeader(column, t('artists.departure')),
  },
  ...(edition.value?.mealsEnabled
    ? [
        {
          id: 'meals',
          header: t('common.meals_short'),
          enableSorting: false,
          meta: { class: { th: 'text-center', td: 'text-center' } },
        } as TableColumn<any>,
      ]
    : []),
  {
    id: 'shows',
    accessorFn: (row: any) => row.shows?.map((sa: any) => sa.show.title).join(', ') || '',
    header: ({ column }) => getSortableHeader(column, t('artists.shows')),
  },
  {
    id: 'payment',
    accessorKey: 'payment',
    header: ({ column }) => getSortableHeader(column, t('artists.payment_amount')),
  },
  {
    id: 'reimbursement',
    accessorFn: (row: any) => row.reimbursementMax || row.reimbursementActual || 0,
    header: ({ column }) => getSortableHeader(column, t('artists.reimbursement_max_actual')),
  },
  {
    id: 'consumables',
    accessorFn: (row: any) => row.consumablesMax || row.consumablesActual || 0,
    header: ({ column }) => getSortableHeader(column, t('artists.consumables_max_actual')),
  },
  {
    id: 'accommodation',
    header: t('artists.accommodation'),
    enableSorting: false,
  },
  {
    id: 'invoice',
    header: t('artists.invoice_short'),
    enableSorting: false,
    meta: { class: { th: 'text-center', td: 'text-center' } },
  },
  {
    id: 'fee',
    header: t('artists.fee_short'),
    enableSorting: false,
    meta: { class: { th: 'text-center', td: 'text-center' } },
  },
  ...(canEdit.value
    ? [
        {
          id: 'notes',
          header: t('artists.organizer_notes'),
          enableSorting: false,
          size: 300,
        } as TableColumn<any>,
        {
          id: 'actions',
          header: t('common.actions'),
          enableSorting: false,
          enableHiding: false,
          meta: { class: { th: 'text-right', td: 'text-right' } },
        } as TableColumn<any>,
      ]
    : []),
])

// Charger l'édition
onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
  await Promise.all([fetchArtists(), renderArtistInfoPreview()])
})

// Récupérer les artistes
const { execute: fetchArtists, loading } = useApiAction(
  () => `/api/editions/${editionId.value}/artists`,
  {
    method: 'GET',
    errorMessages: { default: 'Erreur lors du chargement des artistes' },
    onSuccess: (response: any) => {
      artists.value = response?.artists || []
    },
  }
)

// Ouvrir le modal d'ajout
const openAddArtistModal = () => {
  selectedArtist.value = null
  showArtistModal.value = true
}

// Ouvrir le modal d'édition
// Menu contextuel (clic droit sur une ligne) : regroupe les actions dispersées
// dans les cellules (repas, hébergement, notes) et celles de la colonne Actions.
const contextMenuItems = ref<any[]>([])
const onRowContextmenu = (_e: Event, row: { original: any }) => {
  const artist = row.original
  contextMenuItems.value = [
    { type: 'label', label: artist.user?.pseudo || artist.name || t('common.artist') },
    {
      label: t('common.edit'),
      icon: 'i-heroicons-pencil',
      onSelect: () => openEditArtistModal(artist),
    },
    { type: 'separator' },
    {
      label: t('common.meals_short'),
      icon: 'i-heroicons-cake',
      onSelect: () => openMealsModal(artist),
    },
    {
      label: t('artists.accommodation'),
      icon: 'i-heroicons-home',
      onSelect: () => openAccommodationModal(artist),
    },
    {
      label: t('artists.organizer_notes'),
      icon: 'i-heroicons-chat-bubble-left-ellipsis',
      onSelect: () => openNotesModal(artist),
    },
    { type: 'separator' },
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error',
      onSelect: () => confirmDeleteArtist(artist),
    },
  ]
}

const openEditArtistModal = (artist: any) => {
  selectedArtist.value = artist
  showArtistModal.value = true
}

// Gérer la sauvegarde
const handleArtistSaved = () => {
  fetchArtists()
}

// Confirmer la suppression
const confirmDeleteArtist = (artist: any) => {
  artistToDelete.value = artist
  showDeleteConfirm.value = true
}

// Supprimer l'artiste
// Même remarque que pour la suppression d'un spectacle : `UiConfirmModal` n'émet que
// `confirm` et `cancel`, la refermer revient à l'appelant.
const { execute: deleteArtist, loading: deletingArtist } = useApiAction(
  () => `/api/editions/${editionId.value}/artists/${artistToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('artists.artist_deleted') },
    errorMessages: { default: t('artists.error_delete') },
    onSuccess: () => {
      showDeleteConfirm.value = false
      artistToDelete.value = null
      fetchArtists()
    },
    onError: () => {
      showDeleteConfirm.value = false
      artistToDelete.value = null
    },
  }
)

// Ouvrir le modal de gestion des repas
const openMealsModal = (artist: any) => {
  selectedArtistForMeals.value = artist
  showMealsModal.value = true
}

// Gérer la sauvegarde des repas
const handleMealsSaved = () => {
  // Rafraîchir les artistes pour obtenir les repas mis à jour
  fetchArtists()
  toast.add({
    title: t('artists.meals.meals_updated'),
    color: 'success',
  })
}

// Ouvrir le modal de gestion des notes
const openNotesModal = (artist: any) => {
  selectedArtistForNotes.value = artist
  showNotesModal.value = true
}

// Gérer la sauvegarde des notes
const handleNotesSaved = () => {
  fetchArtists()
}

// Ouvrir le modal d'hébergement
const openAccommodationModal = (artist: any) => {
  selectedArtistForAccommodation.value = artist
  showAccommodationModal.value = true
}

// Compter les repas acceptés (cochés)
const getAcceptedMealsCount = (artist: any) => {
  if (!artist.mealSelections || artist.mealSelections.length === 0) return 0
  return artist.mealSelections.filter((selection: any) => selection.accepted).length
}

// Obtenir le texte d'affichage des repas (acceptés/total)
const getMealsDisplayText = (artist: any) => {
  if (!artist.mealSelections || artist.mealSelections.length === 0) return '0/0'
  const acceptedCount = artist.mealSelections.filter((selection: any) => selection.accepted).length
  const totalCount = artist.mealSelections.length
  return `${acceptedCount}/${totalCount}`
}

// Label du type d'hébergement
const accommodationTypeLabel = (type: string) => getAccommodationTypeLabel(type, t)

// Fonctions pour l'état de la facture
const getInvoiceStatusIcon = (artist: any) => {
  if (!artist.invoiceRequested) return '○'
  if (artist.invoiceRequested && !artist.invoiceProvided) return '⏳'
  return '✓'
}

const getInvoiceStatusColor = (artist: any) => {
  if (!artist.invoiceRequested) return 'neutral'
  if (artist.invoiceRequested && !artist.invoiceProvided) return 'warning'
  return 'success'
}

const getInvoiceStatusText = (artist: any) => {
  if (!artist.invoiceRequested) return t('artists.invoice_not_requested')
  if (artist.invoiceRequested && !artist.invoiceProvided) return t('artists.invoice_requested')
  return t('artists.invoice_provided')
}

// Fonctions pour l'état du cachet
const getFeeStatusIcon = (artist: any) => {
  if (!artist.feeRequested) return '○'
  if (artist.feeRequested && !artist.feeProvided) return '⏳'
  return '✓'
}

const getFeeStatusColor = (artist: any) => {
  if (!artist.feeRequested) return 'neutral'
  if (artist.feeRequested && !artist.feeProvided) return 'warning'
  return 'success'
}

const getFeeStatusText = (artist: any) => {
  if (!artist.feeRequested) return t('artists.fee_not_requested')
  if (artist.feeRequested && !artist.feeProvided) return t('artists.fee_requested')
  return t('artists.fee_provided')
}
</script>
