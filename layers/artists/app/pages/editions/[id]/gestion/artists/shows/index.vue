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
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-sparkles" class="text-purple-600 dark:text-purple-400" />
          {{ $t('gestion.shows.list_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.shows.manage_shows_description') }}
        </p>
      </div>

      <!-- Contenu -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ $t('gestion.shows.title') }}</h2>
            <UButton v-if="canEdit" color="primary" icon="i-heroicons-plus" @click="goToAddShow">
              {{ $t('gestion.shows.add_show') }}
            </UButton>
          </div>
        </template>

        <!-- Statistiques -->
        <div v-if="shows.length > 0" class="mb-4 flex gap-2">
          <UBadge color="neutral" variant="soft">
            {{ $t('common.total') }}: {{ shows.length }}
          </UBadge>
          <UBadge v-if="publicShowsCount > 0" color="success" variant="soft">
            <UIcon name="i-heroicons-eye" class="mr-1" />
            {{ $t('gestion.shows.public_count', { count: publicShowsCount }) }}
          </UBadge>
        </div>

        <!-- Liste des spectacles -->
        <div v-if="loading" class="text-center py-8">
          <p class="text-gray-500">{{ $t('common.loading') }}</p>
        </div>

        <div v-else-if="shows.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-sparkles" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p class="text-gray-500">{{ $t('gestion.shows.no_shows') }}</p>
        </div>

        <div v-else>
          <UContextMenu :items="contextMenuItems">
            <UTable
              v-model:expanded="expandedRows"
              :data="tableRows"
              :columns="columns"
              :get-sub-rows="(row: ShowTableRow) => row.children"
              class="w-full"
              :ui="tableUi"
              @contextmenu="onContextmenu"
            >
              <template #title-cell="{ row }">
                <!-- Numéro d'un cabaret : décalé sous son spectacle, il n'a ni affiche ni type -->
                <!-- `ps-16` et non `ps-8` : le titre d'un spectacle est déjà décalé par son
                     chevron, un retrait plus court alignerait le numéro sur lui au lieu de
                     l'en distinguer. -->
                <div v-if="row.original.kind === 'act'" class="flex items-center gap-2 ps-16">
                  <UBadge color="neutral" variant="subtle" size="sm">
                    {{ $t('gestion.shows.act_number', { number: row.original.position }) }}
                  </UBadge>
                  <span class="font-medium">{{ row.original.act.title }}</span>
                </div>

                <div v-else class="flex items-center gap-3">
                  <!-- Bouton d'ouverture, réservé aux cabarets qui ont des numéros -->
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :icon="
                      row.getIsExpanded() ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'
                    "
                    :class="{ invisible: !row.getCanExpand() }"
                    :aria-label="$t('gestion.shows.toggle_acts')"
                    @click="row.toggleExpanded()"
                  />
                  <img
                    v-if="row.original.show.imageUrl"
                    :src="getShowImageUrl(row.original.show)"
                    :alt="row.original.show.title"
                    class="w-12 h-12 object-cover rounded-lg shrink-0"
                  />
                  <div>
                    <div class="font-medium flex items-center gap-2">
                      {{ row.original.show.title }}
                      <UBadge
                        v-if="row.original.show.type === 'CABARET'"
                        color="info"
                        variant="subtle"
                        size="sm"
                      >
                        {{ $t('gestion.shows.type_cabaret') }}
                      </UBadge>
                      <UBadge v-if="row.getCanExpand()" color="neutral" variant="subtle" size="sm">
                        {{ $t('gestion.shows.acts_count', { count: row.subRows.length }) }}
                      </UBadge>
                    </div>
                    <!-- `whitespace-normal` : les cellules d'UTable interdisent le retour à la
                         ligne, une description un peu longue étirerait la colonne à l'infini. -->
                    <div
                      v-if="row.original.show.description"
                      class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 max-w-md whitespace-normal"
                    >
                      {{ row.original.show.description }}
                    </div>
                  </div>
                </div>
              </template>

              <!-- Un numéro n'a pas d'horaire propre : il se joue dans celui du cabaret.
                   Un spectacle, lui, peut être joué plusieurs fois. -->
              <template #startDateTime-cell="{ row }">
                <div v-if="row.original.kind === 'show'" class="text-gray-600 dark:text-gray-400">
                  <div
                    v-for="performance in row.original.show.performances"
                    :key="performance.id"
                    class="whitespace-nowrap"
                  >
                    {{ formatDateTime(performance.startDateTime) }}
                  </div>
                </div>
              </template>

              <template #duration-cell="{ row }">
                <span class="text-gray-600 dark:text-gray-400">
                  {{ rowDuration(row.original) }}
                </span>
              </template>

              <!-- Le lieu appartient à la représentation : un spectacle peut se jouer
                   à deux endroits différents -->
              <template #location-cell="{ row }">
                <div
                  v-if="row.original.kind === 'show'"
                  class="text-gray-600 dark:text-gray-400 space-y-1"
                >
                  <div v-for="performance in row.original.show.performances" :key="performance.id">
                    <UBadge
                      v-if="performance.zone"
                      :style="{
                        backgroundColor: performance.zone.color + '20',
                        color: performance.zone.color,
                      }"
                      variant="subtle"
                      size="sm"
                    >
                      <UIcon name="i-heroicons-map" class="mr-1" />
                      {{ performance.zone.name }}
                    </UBadge>
                    <UBadge
                      v-else-if="performance.marker"
                      :style="{
                        backgroundColor: (performance.marker.color || '#6b7280') + '20',
                        color: performance.marker.color || '#6b7280',
                      }"
                      variant="subtle"
                      size="sm"
                    >
                      <UIcon name="i-heroicons-map-pin" class="mr-1" />
                      {{ performance.marker.name }}
                    </UBadge>
                    <span
                      v-if="performance.location"
                      :class="{ 'mt-1 block': performance.zone || performance.marker }"
                    >
                      {{ performance.location }}
                    </span>
                    <span v-if="!performance.zone && !performance.marker && !performance.location">
                      -
                    </span>
                  </div>
                </div>
              </template>

              <template #artists-cell="{ row }">
                <div v-if="rowArtists(row.original).length > 0" class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="artist in rowArtists(row.original)"
                    :key="artist.id"
                    color="yellow"
                    variant="subtle"
                    size="sm"
                  >
                    <UiUserName :user="artist.user" />
                  </UBadge>
                </div>
                <span v-else class="text-gray-400">
                  {{ $t('gestion.shows.no_artists_selected') }}
                </span>
              </template>

              <!-- La publication se décide représentation par représentation : l'icône dit
                   « toutes », « aucune », et le compte lève l'ambiguïté entre les deux -->
              <template #isPublic-cell="{ row }">
                <div v-if="row.original.kind === 'show'" class="flex items-center gap-1">
                  <UIcon
                    :name="
                      nombrePubliees(row.original.show) > 0
                        ? 'i-heroicons-eye'
                        : 'i-heroicons-eye-slash'
                    "
                    :class="
                      nombrePubliees(row.original.show) === row.original.show.performances.length
                        ? 'text-green-600 dark:text-green-400'
                        : nombrePubliees(row.original.show) > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-400 dark:text-gray-500'
                    "
                  />
                  <span
                    v-if="row.original.show.performances.length > 1"
                    class="text-xs text-gray-500 dark:text-gray-400"
                  >
                    {{ nombrePubliees(row.original.show) }}/{{
                      row.original.show.performances.length
                    }}
                  </span>
                </div>
              </template>

              <template #actions-cell="{ row }">
                <div class="flex items-center justify-end gap-2">
                  <!-- Un numéro se modifie sur la page dédiée du cabaret -->
                  <UButton
                    v-if="row.original.kind === 'act'"
                    icon="i-heroicons-pencil"
                    color="primary"
                    variant="ghost"
                    size="sm"
                    :title="$t('gestion.shows.edit_acts')"
                    @click="goToEditActs(row.original.show)"
                  />
                  <template v-else>
                    <!-- Écrire à toute la distribution d'un coup, plutôt qu'artiste par artiste -->
                    <UButton
                      icon="i-heroicons-chat-bubble-left-right"
                      color="primary"
                      variant="ghost"
                      size="sm"
                      :loading="ouvertureGroupeId === row.original.show.id"
                      :disabled="uniqueArtists(row.original.show).length === 0"
                      :title="
                        uniqueArtists(row.original.show).length === 0
                          ? $t('gestion.shows.message_group_no_artists')
                          : $t('gestion.shows.message_group')
                      "
                      @click="ouvrirGroupeSpectacle(row.original.show)"
                    />
                    <UButton
                      v-if="row.original.show.type === 'CABARET'"
                      icon="i-heroicons-queue-list"
                      color="primary"
                      variant="ghost"
                      size="sm"
                      :title="$t('gestion.shows.edit_acts')"
                      @click="goToEditActs(row.original.show)"
                    />
                    <UButton
                      icon="i-heroicons-pencil"
                      color="primary"
                      variant="ghost"
                      size="sm"
                      @click="goToEditShow(row.original.show)"
                    />
                    <UButton
                      icon="i-heroicons-trash"
                      color="error"
                      variant="ghost"
                      size="sm"
                      @click="confirmDeleteShow(row.original.show)"
                    />
                  </template>
                </div>
              </template>
            </UTable>
          </UContextMenu>
        </div>
      </UCard>

      <!-- Card Technique -->
      <UCard v-if="canEdit" class="mt-6">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-heroicons-wrench-screwdriver"
                class="text-amber-600 dark:text-amber-400 size-5"
              />
              <h2 class="text-lg font-semibold">{{ $t('gestion.shows.technical_title') }}</h2>
            </div>
            <UButton
              color="primary"
              icon="i-heroicons-arrow-down-tray"
              :loading="exportingTechnicalPdf"
              @click="exportTechnicalNeedsPdf"
            >
              {{ $t('gestion.shows.technical_export_pdf') }}
            </UButton>
          </div>
        </template>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('gestion.shows.technical_export_help') }}
        </p>
      </UCard>
    </div>

    <!-- Modal confirmation suppression -->
    <UiConfirmModal
      v-model="showDeleteConfirm"
      :title="$t('gestion.shows.delete_show')"
      :message="$t('gestion.shows.delete_confirm')"
      confirm-color="error"
      :loading="deletingShow"
      @confirm="deleteShow"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'

definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { formatDateTime } = useDateFormat()
const { getImageUrl } = useImageUrl()

const getShowImageUrl = (show: any) => {
  return getImageUrl(show.imageUrl, 'show', show.id)
}

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Permissions — page réservée aux organisateurs qui gèrent les artistes
const canAccess = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

const canEdit = computed(() => canAccess.value)

// Données
const shows = ref<any[]>([])
const showDeleteConfirm = ref(false)
const showToDelete = ref<any>(null)

/** Représentations publiées d'un spectacle : la publication se décide passage par passage. */
const nombrePubliees = (show: { performances?: { isPublic: boolean }[] }) =>
  (show.performances ?? []).filter((performance) => performance.isPublic).length

// Un spectacle compte comme public dès qu'au moins une de ses représentations est annoncée
const publicShowsCount = computed(() => shows.value.filter((s) => nombrePubliees(s) > 0).length)

/** Date du premier passage : c'est elle qui situe un spectacle dans la programmation. */
const premierPassage = (show: { performances?: { startDateTime: string }[] }) => {
  const premiere = show.performances?.[0]?.startDateTime
  return premiere ? new Date(premiere).getTime() : Number.POSITIVE_INFINITY
}

// Spectacles triés par leur première représentation
const sortedShows = computed(() => {
  return [...shows.value].sort((a, b) => premierPassage(a) - premierPassage(b))
})

// Sur un cabaret, un artiste présent dans plusieurs numéros a autant de liens : on ne
// l'affiche qu'une fois dans la colonne « Artistes » du spectacle.
const uniqueArtists = (show: any) => {
  const seen = new Set<number>()
  return (show.artists ?? [])
    .map((showArtist: any) => showArtist.artist)
    .filter((artist: any) => {
      if (!artist || seen.has(artist.id)) return false
      seen.add(artist.id)
      return true
    })
}

// Les numéros d'un cabaret sont des sous-lignes du spectacle : repliés, le tableau reste une
// liste de spectacles ; dépliés, il montre le déroulé de la soirée sans quitter la page.
interface ShowTableRow {
  kind: 'show' | 'act'
  show: any
  act?: any
  position?: number
  children?: ShowTableRow[]
}

const tableRows = computed<ShowTableRow[]>(() =>
  sortedShows.value.map((show) => ({
    kind: 'show',
    show,
    // `undefined` et non un tableau vide : un spectacle sans numéro ne doit pas s'annoncer
    // dépliable, sinon la table affiche un chevron qui n'ouvre rien.
    children:
      show.type === 'CABARET' && show.acts?.length
        ? [...show.acts]
            .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
            .map((act: any, index: number) => ({
              kind: 'act' as const,
              show,
              act,
              position: index + 1,
            }))
        : undefined,
  }))
)

// Les cabarets s'ouvrent d'emblée : leur déroulé était déjà visible avant que les numéros
// ne deviennent des lignes, le replier par défaut aurait masqué une information acquise.
const expandedRows = ref<Record<string, boolean>>({})
watch(
  tableRows,
  (rows) => {
    const next: Record<string, boolean> = {}
    rows.forEach((row, index) => {
      if (row.children?.length) next[index] = true
    })
    expandedRows.value = next
  },
  { immediate: true }
)

// Déplier une ligne fait toujours produire à UTable une ligne supplémentaire pour son slot
// `#expanded`, que nous n'utilisons pas : elle apparaissait vide entre le cabaret et ses
// numéros. On la reconnaît à sa cellule unique et vide, là où une vraie ligne en a sept.
const tableUi = { tbody: '[&>tr:has(>td:only-child:empty)]:hidden' }

const columns = computed<TableColumn<ShowTableRow>[]>(() => {
  const cols: TableColumn<ShowTableRow>[] = [
    { id: 'title', header: t('gestion.shows.show_title') },
    { id: 'startDateTime', header: t('gestion.shows.start_datetime') },
    { id: 'duration', header: t('gestion.shows.duration') },
    { id: 'location', header: t('gestion.shows.location') },
    { id: 'artists', header: t('gestion.shows.artists') },
    {
      id: 'isPublic',
      header: t('gestion.shows.is_public'),
      meta: { class: { th: 'text-center', td: 'text-center' } },
    },
  ]
  if (canEdit.value) {
    cols.push({
      id: 'actions',
      header: t('common.actions'),
      meta: { class: { th: 'text-right', td: 'text-right' } },
    })
  }
  return cols
})

const rowDuration = (row: ShowTableRow) => {
  const duration = row.kind === 'act' ? row.act.duration : row.show.duration
  return duration ? `${duration} min` : '-'
}

// Un numéro porte ses propres artistes ; le spectacle affiche l'ensemble, dédoublonné.
const rowArtists = (row: ShowTableRow) =>
  row.kind === 'act'
    ? (row.act.artists ?? []).map((showArtist: any) => showArtist.artist).filter(Boolean)
    : uniqueArtists(row.show)

// Charger l'édition
onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
  await fetchShows()
})

// Récupérer les spectacles
const { execute: fetchShows, loading } = useApiAction(
  () => `/api/editions/${editionId.value}/shows`,
  {
    method: 'GET',
    errorMessages: { default: 'Erreur lors du chargement des spectacles' },
    onSuccess: (response: any) => {
      shows.value = response?.shows || []
    },
  }
)

// Ajout et édition passent par une page dédiée : le formulaire d'un cabaret peut contenir
// une dizaine de numéros, ce qu'une modale ne peut pas présenter lisiblement.
const showsPath = computed(() => `/editions/${editionId.value}/gestion/artists/shows`)

const goToAddShow = () => router.push(`${showsPath.value}/new`)

// Menu contextuel (clic droit sur une ligne) : mêmes actions que la colonne
// « Actions », qui n'est affichée qu'aux utilisateurs pouvant éditer.
const contextMenuItems = ref<any[]>([])
const onContextmenu = (_event: Event, row: TableRow<ShowTableRow>) => {
  if (!canEdit.value) {
    contextMenuItems.value = []
    return
  }
  const { kind, show, act } = row.original

  // Sur un numéro, les actions du spectacle (modifier, supprimer) porteraient à confusion :
  // seule l'édition du déroulé a un sens, et elle vise le cabaret entier.
  if (kind === 'act') {
    contextMenuItems.value = [
      { type: 'label', label: act.title },
      {
        label: t('gestion.shows.edit_acts'),
        icon: 'i-heroicons-queue-list',
        onSelect: () => goToEditActs(show),
      },
    ]
    return
  }

  const items: any[] = [{ type: 'label', label: show.title }]
  if (show.type === 'CABARET') {
    items.push({
      label: t('gestion.shows.edit_acts'),
      icon: 'i-heroicons-queue-list',
      onSelect: () => goToEditActs(show),
    })
  }
  items.push({
    label: t('common.edit'),
    icon: 'i-heroicons-pencil',
    onSelect: () => goToEditShow(show),
  })
  items.push({ type: 'separator' })
  items.push({
    label: t('common.delete'),
    icon: 'i-heroicons-trash',
    color: 'error',
    onSelect: () => confirmDeleteShow(show),
  })
  contextMenuItems.value = items
}

const goToEditShow = (show: any) => router.push(`${showsPath.value}/${show.id}`)
const goToEditActs = (show: any) => router.push(`${showsPath.value}/${show.id}/numeros`)

// --- Export PDF des besoins techniques ---
interface TechnicalAct {
  title: string
  technicalNeeds: string | null
  stageSetup: string | null
  artists: string[]
}
interface TechnicalShow {
  title: string
  type: string
  technicalNeeds: string | null
  artists: string[]
  acts: TechnicalAct[]
}
const exportingTechnicalPdf = ref(false)

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function exportTechnicalNeedsPdf() {
  exportingTechnicalPdf.value = true
  try {
    const res = await $fetch<{
      success: boolean
      data: { editionName: string; shows: TechnicalShow[] }
    }>(`/api/editions/${editionId.value}/shows/technical-needs`)
    const { editionName, shows } = res.data

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const marginX = 15
    const maxY = pageHeight - 15
    const contentWidth = pageWidth - 2 * marginX
    let y = 20

    const ensureSpace = (needed: number) => {
      if (y + needed > maxY) {
        doc.addPage()
        y = 20
      }
    }

    const writeWrapped = (
      text: string,
      opts: { size: number; bold?: boolean; color?: [number, number, number] }
    ) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
      doc.setFontSize(opts.size)
      if (opts.color) doc.setTextColor(...opts.color)
      else doc.setTextColor(20, 20, 20)
      const lines = doc.splitTextToSize(text, contentWidth) as string[]
      const lineHeight = opts.size * 0.45
      for (const line of lines) {
        ensureSpace(lineHeight)
        doc.text(line, marginX, y)
        y += lineHeight
      }
    }

    // Titre principal
    const title = editionName
      ? t('gestion.shows.technical_pdf_title_with_edition', { edition: editionName })
      : t('gestion.shows.technical_pdf_title')
    writeWrapped(title, { size: 18, bold: true })
    y += 2
    writeWrapped(
      t('gestion.shows.technical_pdf_generated_on', {
        date: new Date().toLocaleDateString(locale.value, {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
      }),
      { size: 9, color: [110, 110, 110] }
    )
    y += 4

    if (!shows.length) {
      writeWrapped(t('gestion.shows.technical_pdf_empty'), { size: 11 })
    }

    for (const show of shows) {
      ensureSpace(10)
      writeWrapped(show.title, { size: 14, bold: true, color: [80, 50, 130] })
      y += 1

      // Besoins techniques au niveau du spectacle
      if (show.technicalNeeds?.trim()) {
        writeWrapped(show.technicalNeeds.trim(), { size: 10 })
      } else if (show.type !== 'CABARET') {
        writeWrapped(t('gestion.shows.technical_pdf_no_needs'), { size: 10 })
      }
      // Artistes du spectacle (STANDARD : les artistes vivent au niveau du spectacle)
      if (show.type !== 'CABARET' && show.artists.length) {
        writeWrapped(
          t('gestion.shows.technical_pdf_artists', { artists: show.artists.join(', ') }),
          {
            size: 9,
            color: [110, 110, 110],
          }
        )
      }

      // Numéros (CABARET) : besoins techniques + mise en place scène + artistes
      for (const act of show.acts) {
        ensureSpace(8)
        writeWrapped(act.title, { size: 11, bold: true })
        const needs = act.technicalNeeds?.trim() || t('gestion.shows.technical_pdf_no_needs')
        writeWrapped(needs, { size: 10 })
        if (act.stageSetup?.trim()) {
          writeWrapped(
            t('gestion.shows.technical_pdf_stage_setup', { value: act.stageSetup.trim() }),
            { size: 10 }
          )
        }
        if (act.artists.length) {
          writeWrapped(
            t('gestion.shows.technical_pdf_artists', { artists: act.artists.join(', ') }),
            { size: 9, color: [110, 110, 110] }
          )
        }
        y += 3
      }
      y += 3
    }

    const slug = slugify(editionName || `edition-${editionId.value}`)
    const date = new Date().toISOString().slice(0, 10)
    doc.save(`besoins-techniques-${slug}-${date}.pdf`)
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    exportingTechnicalPdf.value = false
  }
}

// Confirmer la suppression
const confirmDeleteShow = (show: any) => {
  showToDelete.value = show
  showDeleteConfirm.value = true
}

// Supprimer le spectacle
/**
 * `UiConfirmModal` n'émet que `confirm` et `cancel` : la refermer revient à l'appelant.
 *
 * Elle restait donc ouverte après la suppression. Pire, ses rappels vidaient déjà
 * `showToDelete` : reconfirmer sur la modale restée à l'écran envoyait un DELETE sur
 * `/shows/undefined`, qu'on retrouve dans les journaux de production.
 */
/**
 * Ouvre le groupe de messagerie du spectacle et y emmène l'organisateur.
 *
 * Le groupe est créé au premier appel puis retrouvé ensuite : rouvrir ne duplique rien, et la
 * conversation garde son historique. Ses participants sont la distribution du spectacle et les
 * organisateurs habilités sur les artistes.
 */
const ouvertureGroupeId = ref<number | null>(null)

const { execute: ouvrirGroupe } = useApiAction<unknown, { conversationId: string }>(
  '/api/messenger/show-group',
  {
    method: 'POST',
    body: () => ({ showId: ouvertureGroupeId.value }),
    silentSuccess: true,
    errorMessages: { default: t('gestion.shows.message_group_error') },
    onSuccess: async (reponse: { conversationId: string }) => {
      ouvertureGroupeId.value = null
      await navigateTo(`/messenger?conversationId=${reponse.conversationId}`)
    },
    onError: () => {
      ouvertureGroupeId.value = null
    },
  }
)

const ouvrirGroupeSpectacle = (show: { id: number }) => {
  ouvertureGroupeId.value = show.id
  ouvrirGroupe()
}

const { execute: deleteShow, loading: deletingShow } = useApiAction(
  () => `/api/editions/${editionId.value}/shows/${showToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.shows.show_deleted') },
    errorMessages: { default: t('gestion.shows.error_delete') },
    onSuccess: () => {
      showDeleteConfirm.value = false
      showToDelete.value = null
      fetchShows()
    },
    onError: () => {
      // Fermée aussi en échec : la garder ouverte inviterait à reconfirmer un spectacle
      // que l'on vient d'oublier, et le toast d'erreur dit déjà ce qui s'est passé.
      showDeleteConfirm.value = false
      showToDelete.value = null
    },
  }
)
</script>
