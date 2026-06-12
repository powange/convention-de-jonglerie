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
            <UButton
              v-if="canEdit"
              color="primary"
              icon="i-heroicons-plus"
              @click="openAddShowModal"
            >
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

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.show_title') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.start_datetime') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.duration') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.location') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.artists') }}
                </th>
                <th
                  class="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.is_public') }}
                </th>
                <th
                  v-if="canEdit"
                  class="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="show in sortedShows"
                :key="show.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="px-4 py-3 text-sm">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="show.imageUrl"
                      :src="getShowImageUrl(show)"
                      :alt="show.title"
                      class="w-12 h-12 object-cover rounded-lg shrink-0"
                    />
                    <div>
                      <div class="font-medium">{{ show.title }}</div>
                      <div
                        v-if="show.description"
                        class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1"
                      >
                        {{ show.description }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ formatDateTime(show.startDateTime) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ show.duration ? `${show.duration} min` : '-' }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <UBadge
                      v-if="show.zone"
                      :style="{ backgroundColor: show.zone.color + '20', color: show.zone.color }"
                      variant="subtle"
                      size="sm"
                    >
                      <UIcon name="i-heroicons-map" class="mr-1" />
                      {{ show.zone.name }}
                    </UBadge>
                    <UBadge
                      v-else-if="show.marker"
                      :style="{
                        backgroundColor: (show.marker.color || '#6b7280') + '20',
                        color: show.marker.color || '#6b7280',
                      }"
                      variant="subtle"
                      size="sm"
                    >
                      <UIcon name="i-heroicons-map-pin" class="mr-1" />
                      {{ show.marker.name }}
                    </UBadge>
                    <span v-if="show.location" :class="{ 'mt-1 block': show.zone || show.marker }">
                      {{ show.location }}
                    </span>
                    <span v-if="!show.zone && !show.marker && !show.location">-</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm">
                  <div v-if="show.artists && show.artists.length > 0" class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="showArtist in show.artists"
                      :key="showArtist.artist.id"
                      color="yellow"
                      variant="subtle"
                      size="sm"
                    >
                      <UiUserName :user="showArtist.artist.user" />
                    </UBadge>
                  </div>
                  <span v-else class="text-gray-400">{{
                    $t('gestion.shows.no_artists_selected')
                  }}</span>
                </td>
                <td class="px-4 py-3 text-sm text-center">
                  <UIcon
                    :name="show.isPublic ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'"
                    :class="
                      show.isPublic
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400 dark:text-gray-500'
                    "
                  />
                </td>
                <td v-if="canEdit" class="px-4 py-3 text-sm text-right">
                  <div class="flex items-center justify-end gap-2">
                    <UButton
                      icon="i-heroicons-pencil"
                      color="primary"
                      variant="ghost"
                      size="sm"
                      @click="openEditShowModal(show)"
                    />
                    <UButton
                      icon="i-heroicons-trash"
                      color="error"
                      variant="ghost"
                      size="sm"
                      @click="confirmDeleteShow(show)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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

    <!-- Modal spectacle -->
    <ShowsShowModal
      v-model="showShowModal"
      :show="selectedShow"
      :edition-id="editionId"
      @show-saved="handleShowSaved"
    />

    <!-- Modal confirmation suppression -->
    <UiConfirmModal
      v-model="showDeleteConfirm"
      :title="$t('gestion.shows.delete_show')"
      :message="$t('gestion.shows.delete_confirm')"
      confirm-color="error"
      @confirm="deleteShow"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
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
const showShowModal = ref(false)
const selectedShow = ref<any>(null)
const showDeleteConfirm = ref(false)
const showToDelete = ref<any>(null)

// Nombre de spectacles publics
const publicShowsCount = computed(() => shows.value.filter((s) => s.isPublic).length)

// Spectacles triés par date
const sortedShows = computed(() => {
  return [...shows.value].sort((a, b) => {
    return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
  })
})

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

// Ouvrir le modal d'ajout
const openAddShowModal = () => {
  selectedShow.value = null
  showShowModal.value = true
}

// Ouvrir le modal d'édition
const openEditShowModal = (show: any) => {
  selectedShow.value = show
  showShowModal.value = true
}

// Gérer la sauvegarde
const handleShowSaved = () => {
  fetchShows()
}

// --- Export PDF des besoins techniques ---
interface TechnicalApplication {
  id: number
  artistName: string
  showTitle: string
  technicalNeeds: string | null
}
interface TechnicalGroup {
  show: { id: number; title: string } | null
  applications: TechnicalApplication[]
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
      data: { editionName: string; groups: TechnicalGroup[] }
    }>(`/api/editions/${editionId.value}/shows-call/technical-needs`)
    const { editionName, groups } = res.data

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

    if (!groups.length) {
      writeWrapped(t('gestion.shows.technical_pdf_empty'), { size: 11 })
    }

    for (const group of groups) {
      ensureSpace(10)
      // Titre du show (ou "Sans spectacle lié")
      const showTitle = group.show
        ? group.show.title
        : t('gestion.shows.technical_pdf_no_show_group')
      writeWrapped(showTitle, { size: 14, bold: true, color: [80, 50, 130] })
      y += 1

      for (const app of group.applications) {
        ensureSpace(8)
        const sub = `${app.artistName} — ${app.showTitle}`
        writeWrapped(sub, { size: 11, bold: true })
        const needs = app.technicalNeeds?.trim() || t('gestion.shows.technical_pdf_no_needs')
        writeWrapped(needs, { size: 10 })
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
const { execute: deleteShow, loading: _deletingShow } = useApiAction(
  () => `/api/editions/${editionId.value}/shows/${showToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.shows.show_deleted') },
    errorMessages: { default: t('gestion.shows.error_delete') },
    onSuccess: () => {
      showToDelete.value = null
      fetchShows()
    },
    onError: () => {
      showToDelete.value = null
    },
  }
)
</script>
