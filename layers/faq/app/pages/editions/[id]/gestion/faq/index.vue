<template>
  <UContainer class="py-6">
    <div class="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <ManagementPageHeader
          :titre="$t('gestion.faq.title')"
          :description="$t('gestion.faq.description')"
        />
      </div>
      <div class="flex items-center gap-2">
        <!-- Deux documents pour deux usages : celui qu'on laisse à l'accueil, et celui qui sert
             en interne. Le choix se fait au moment de générer plutôt que par une option cachée
             ailleurs, parce qu'il change ce qui sort du site. -->
        <UDropdownMenu v-if="entries.length" :items="elementsPdf">
          <UButton
            icon="i-heroicons-document-arrow-down"
            size="sm"
            color="neutral"
            variant="outline"
            :loading="generationPdf"
          >
            {{ $t('gestion.faq.export_pdf') }}
          </UButton>
        </UDropdownMenu>
        <UButton
          v-if="canManage"
          icon="i-heroicons-plus"
          size="sm"
          color="primary"
          @click="openEntryModal(null)"
        >
          {{ $t('gestion.faq.new_entry') }}
        </UButton>
      </div>
    </div>

    <!-- Visibilité de la page publique (réservé aux éditeurs) -->
    <UCard v-if="canManage" class="mb-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon
              :name="faqPagePublicLocal ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'"
              :class="faqPagePublicLocal ? 'text-success-500' : 'text-gray-400'"
            />
            {{ $t('gestion.faq.page_public') }}
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {{ $t('gestion.faq.page_public_help') }}
          </p>
        </div>
        <USwitch
          v-model="faqPagePublicLocal"
          color="primary"
          :loading="savingPagePublic"
          :disabled="savingPagePublic"
          @update:model-value="handleTogglePagePublic"
        />
      </div>
    </UCard>

    <UiSqueletteDeListe v-if="loading" :lignes="5" :libelle="$t('common.loading')" />

    <UiEtatVide
      v-else-if="!entries.length"
      icone="i-heroicons-question-mark-circle"
      :titre="$t('gestion.faq.empty_state')"
      class="border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
    >
      <template #action>
        <UButton
          v-if="canManage"
          icon="i-heroicons-plus"
          color="primary"
          size="sm"
          @click="openEntryModal(null)"
        >
          {{ $t('gestion.faq.new_entry') }}
        </UButton>
      </template>
    </UiEtatVide>

    <template v-else>
      <UInput
        v-model="searchQuery"
        icon="i-heroicons-magnifying-glass"
        size="lg"
        :placeholder="$t('gestion.faq.search_placeholder')"
        class="w-full mb-4"
      >
        <template v-if="searchQuery" #trailing>
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            icon="i-heroicons-x-mark"
            :aria-label="$t('common.clear')"
            @click="searchQuery = ''"
          />
        </template>
      </UInput>

      <!-- La loupe, et non la boîte vide : il y a des entrées, c'est la recherche qui ne rend
           rien. -->
      <UiEtatVide
        v-if="!displayedEntries.length"
        icone="i-heroicons-magnifying-glass"
        :titre="$t('gestion.faq.no_results', { query: searchQueryDebounced })"
        class="border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
      />

      <UCard v-else>
        <ul class="divide-y divide-gray-100 dark:divide-gray-800">
          <li
            v-for="entry in displayedEntries"
            :key="entry.id"
            :draggable="canManage && !searchActive"
            :class="[
              'py-3 flex items-start gap-3 px-2 -mx-2 rounded transition-colors',
              canManage && !searchActive ? 'cursor-grab active:cursor-grabbing' : '',
              draggedId === entry.id ? 'opacity-50' : '',
              dragOverId === entry.id && draggedId !== entry.id
                ? 'border-l-4 border-primary-500 pl-1'
                : '',
            ]"
            @dragstart="onDragStart(entry, $event)"
            @dragend="onDragEnd"
            @dragover.prevent="onDragOver(entry, $event)"
            @drop="onDrop(entry, $event)"
          >
            <UIcon
              v-if="canManage && !searchActive"
              name="i-heroicons-bars-3"
              class="text-gray-400 size-5 shrink-0 mt-1"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <!-- Highlight safe (texte échappé + <mark> uniquement) -->
                <!-- eslint-disable-next-line vue/no-v-html -->
                <h3
                  class="font-medium text-gray-900 dark:text-white"
                  v-html="questionHtml(entry)"
                />
                <UBadge :color="entry.isPublic ? 'success' : 'neutral'" variant="soft" size="md">
                  <UIcon
                    :name="entry.isPublic ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'"
                    class="size-4 mr-1"
                  />
                  {{ entry.isPublic ? $t('common.public') : $t('common.private') }}
                </UBadge>
              </div>
              <div
                v-if="answerHtmlCache[entry.id]"
                :class="[
                  'prose prose-sm dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 mt-2 wrap-break-word',
                  searchActive ? '' : 'line-clamp-3',
                ]"
              >
                <!-- Rendu markdown sanitisé + highlight DOM-safe -->
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-html="answerHtml(entry)" />
              </div>
            </div>
            <div v-if="canManage" class="flex items-center gap-1 shrink-0">
              <UButton
                :icon="entry.isPublic ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                size="sm"
                variant="ghost"
                color="neutral"
                :title="
                  entry.isPublic ? $t('gestion.faq.make_private') : $t('gestion.faq.make_public')
                "
                :loading="togglingId === entry.id"
                @click="toggleVisibility(entry)"
              />
              <UButton
                icon="i-heroicons-pencil-square"
                size="sm"
                variant="ghost"
                color="neutral"
                :title="$t('common.edit')"
                @click="openEntryModal(entry)"
              />
              <UButton
                icon="i-heroicons-trash"
                size="sm"
                variant="ghost"
                color="error"
                :title="$t('common.delete')"
                @click="deleteEntry(entry)"
              />
            </div>
          </li>
        </ul>
      </UCard>
    </template>

    <FaqEntryModal
      v-model:open="entryModalOpen"
      :edition-id="editionId"
      :entry="editingEntry"
      @saved="handleEntrySaved"
    />

    <!-- Une seule modale pour les confirmations de l'écran. `confirm()` bloquait la page, ne
         suivait pas la langue choisie et ne disait jamais sur quoi portait l'action. -->
    <UiConfirmationDemandee :confirmation="confirmation" />
  </UContainer>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'

import {
  countMatches,
  highlightHtml,
  highlightText,
  markdownToHtml,
  parseSearchTerms,
  useAuthStore,
  useEditionStore,
} from '#imports'

import { nomFichierFaq, preparerFaqPourPdf } from '../../../../../utils/faq-pdf'

import { requeteAvec, texteDepuisUrl } from '~~/shared/utils/filtres-url'
import { htmlVersTexte } from '~~/shared/utils/html-to-text'

// Layer faq : imports du cœur applicatif via #imports (auto-imports fusionnés entre layers).

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

interface FaqEntry {
  id: number
  question: string
  answer: string
  isPublic: boolean
  displayOrder: number
}

const route = useRoute()
const { t } = useI18n()
const editionId = parseInt(route.params.id as string)
if (Number.isNaN(editionId)) {
  throw createError({ statusCode: 404, statusMessage: 'Édition introuvable', fatal: true })
}

const authStore = useAuthStore()
const editionStore = useEditionStore()

const entries = ref<FaqEntry[]>([])
const loading = ref(true)
const answerHtmlCache = ref<Record<number, string>>({})
const faqPagePublicLocal = ref(false)

// La page est accessible aux organisateurs et bénévoles avec accès gestion
// (le menu latéral filtre déjà la visibilité du lien) pour consultation. Seuls
// les utilisateurs avec le droit dédié `canManageFAQ` (édition ou convention)
// peuvent modifier : créer/éditer/supprimer/réordonner/toggler la visibilité
// publique. Les API serveur appliquent la même règle.
const edition = computed(() => editionStore.getEditionById(editionId))
const canManage = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageFAQ(edition.value, authStore.user.id)
})

// --- Recherche ---
// Conservée dans l'URL : une recherche dans la FAQ sert à montrer une réponse précise à
// quelqu'un, et le lien doit donc la porter. `replace` et non `push` : chaque lettre tapée
// laisserait autrement un pas dans l'historique.
const router = useRouter()
const searchQuery = ref(texteDepuisUrl(route.query.search))
const searchQueryDebounced = ref(searchQuery.value)
const updateDebounced = useDebounceFn((v: string) => {
  searchQueryDebounced.value = v
}, 150)
watch(searchQuery, (v) => {
  updateDebounced(v)
  router.replace({ query: requeteAvec(route.query, { search: v }) })
})

const searchTerms = computed(() => parseSearchTerms(searchQueryDebounced.value))
const searchActive = computed(() => searchTerms.value.length > 0)

// Quand une recherche est active : filtrer + trier par nombre d'occurrences décroissant.
// Sinon : ordre d'origine (basé sur displayOrder côté API), DnD utilisable.
const displayedEntries = computed(() => {
  const terms = searchTerms.value
  if (!terms.length) return entries.value
  return entries.value
    .map((e) => ({
      entry: e,
      score: countMatches(e.question, terms) + countMatches(e.answer, terms),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.entry)
})

function questionHtml(entry: FaqEntry): string {
  return highlightText(entry.question, searchTerms.value)
}
function answerHtml(entry: FaqEntry): string {
  return highlightHtml(answerHtmlCache.value[entry.id] || '', searchTerms.value)
}

async function fetchEntries() {
  try {
    loading.value = true
    const res = await $fetch<{
      success: boolean
      data: { entries: FaqEntry[]; faqPagePublic?: boolean }
    }>(`/api/editions/${editionId}/faq`)
    entries.value = res?.data?.entries || []
    faqPagePublicLocal.value = res?.data?.faqPagePublic === true
    await Promise.all(entries.value.map((e) => renderAnswer(e)))
  } finally {
    loading.value = false
  }
}

const { execute: executerBasculePagePublic, loading: savingPagePublic } = useApiAction(
  `/api/editions/${editionId}`,
  {
    method: 'PUT',
    body: () => ({ faqPagePublic: faqPagePublicLocal.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    // L'interrupteur est déjà basculé à l'écran : un échec doit le REMETTRE, sans quoi il
    // afficherait un état que la base ne porte pas.
    onError: () => {
      faqPagePublicLocal.value = !faqPagePublicLocal.value
    },
  }
)

const handleTogglePagePublic = () => executerBasculePagePublic()

async function renderAnswer(entry: FaqEntry) {
  answerHtmlCache.value[entry.id] = await markdownToHtml(entry.answer)
}

/**
 * Le document imprimable de la FAQ.
 *
 * Les réponses sont écrites en markdown : on les passe par le rendu de la page puis on retire le
 * balisage, plutôt que d'écrire une seconde interprétation du markdown qui divergerait de ce que
 * l'écran affiche.
 */
const generationPdf = ref(false)

const elementsPdf = computed(() => [
  [
    {
      label: t('gestion.faq.export_pdf_public'),
      icon: 'i-heroicons-eye',
      onSelect: () => genererPdf(false),
    },
    {
      label: t('gestion.faq.export_pdf_all'),
      icon: 'i-heroicons-eye-slash',
      onSelect: () => genererPdf(true),
    },
  ],
])

async function genererPdf(inclurePrivees: boolean) {
  generationPdf.value = true
  try {
    const sources = await Promise.all(
      entries.value.map(async (entree) => ({
        question: entree.question,
        reponseTexte: htmlVersTexte(await markdownToHtml(entree.answer)),
        isPublic: entree.isPublic,
      }))
    )

    const aImprimer = preparerFaqPourPdf(sources, { inclurePrivees })
    if (!aImprimer.length) {
      useToast().add({
        title: t('gestion.faq.export_pdf_empty'),
        icon: 'i-heroicons-exclamation-circle',
        color: 'warning',
      })
      return
    }

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()

    const MARGE = 20
    const LARGEUR = doc.internal.pageSize.getWidth() - MARGE * 2
    const BAS_DE_PAGE = doc.internal.pageSize.getHeight() - MARGE
    let y = MARGE

    /** Passe à la page suivante quand la hauteur demandée ne tient plus. */
    const reserver = (hauteur: number) => {
      if (y + hauteur > BAS_DE_PAGE) {
        doc.addPage()
        y = MARGE
      }
    }

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(t('gestion.faq.title'), MARGE, y)
    y += 8

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const sousTitre = [edition.value?.convention?.name, edition.value?.name]
      .filter(Boolean)
      .join(' - ')
    if (sousTitre) {
      doc.text(sousTitre, MARGE, y)
      y += 8
    }
    y += 4

    for (const entree of aImprimer) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      const question = doc.splitTextToSize(
        entree.prive ? `${entree.question}  [${t('common.private')}]` : entree.question,
        LARGEUR
      )
      reserver(question.length * 6 + 8)
      doc.text(question, MARGE, y)
      y += question.length * 6 + 2

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      // Les paragraphes sont rendus un a un : `splitTextToSize` ne coupe que sur la largeur, et
      // une reponse en plusieurs paragraphes deviendrait sinon un pave continu.
      for (const paragraphe of entree.reponse.split('\n\n')) {
        const lignes = doc.splitTextToSize(paragraphe, LARGEUR)
        for (const ligne of lignes) {
          reserver(6)
          doc.text(ligne, MARGE, y)
          y += 6
        }
        y += 2
      }
      y += 6
    }

    doc.save(nomFichierFaq(edition.value?.name))
  } catch (e: any) {
    useToast().add({
      title: e?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    generationPdf.value = false
  }
}

await fetchEntries()

const entryModalOpen = ref(false)
const editingEntry = ref<FaqEntry | null>(null)

function openEntryModal(entry: FaqEntry | null) {
  editingEntry.value = entry
  entryModalOpen.value = true
}

async function handleEntrySaved() {
  await fetchEntries()
}

const confirmation = useConfirmation()

function deleteEntry(entry: FaqEntry) {
  confirmation.demanderConfirmation({
    titre: t('common.delete'),
    description: t('gestion.faq.confirm_delete', { question: entry.question }),
    libelleConfirmer: t('common.delete'),
    agir: () => performDeleteEntry(entry),
  })
}

const { execute: executerSuppressionEntree } = useApiActionById(
  (id) => `/api/editions/${editionId}/faq/${id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('common.deleted') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => fetchEntries(),
  }
)

const performDeleteEntry = (entry: FaqEntry) => executerSuppressionEntree(entry.id)

/*
 * `useApiActionById` porte son propre `loadingId` : c'est exactement ce que `togglingId` faisait
 * à la main, et l'écran s'en sert pour n'animer QUE la ligne touchée.
 */
const entreeABasculer = ref<FaqEntry | null>(null)

const { execute: executerBasculeVisibilite, loadingId: togglingId } = useApiActionById(
  (id) => `/api/editions/${editionId}/faq/${id}`,
  {
    method: 'PUT',
    body: () => ({ isPublic: !entreeABasculer.value?.isPublic }),
    silentSuccess: true,
    errorMessages: { default: t('common.error') },
    // On ne reporte le changement à l'écran qu'APRÈS le succès : l'inverse afficherait une
    // visibilité que le serveur a refusée.
    onSuccess: () => {
      const entree = entreeABasculer.value
      if (entree) entree.isPublic = !entree.isPublic
    },
  }
)

async function toggleVisibility(entry: FaqEntry) {
  entreeABasculer.value = entry
  await executerBasculeVisibilite(entry.id)
}

/*
 * Le réordonnancement est OPTIMISTE : `entries.value` est déjà réarrangé à l'écran quand l'appel
 * part. L'échec doit donc défaire, et c'est le rechargement qui s'en charge — pas un `onError`
 * qui tenterait de recalculer l'ordre d'avant.
 */
const { execute: executerReordonnancement } = useApiAction(
  `/api/editions/${editionId}/faq/reorder`,
  {
    method: 'PUT',
    body: () => ({ orderedIds: entries.value.map((x) => x.id) }),
    silentSuccess: true,
    errorMessages: { default: t('common.error') },
    onError: () => fetchEntries(),
  }
)

// --- Drag & drop pour réordonner ---
const draggedId = ref<number | null>(null)
const dragOverId = ref<number | null>(null)

function onDragStart(entry: FaqEntry, e: DragEvent) {
  draggedId.value = entry.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(entry.id))
  }
}

function onDragEnd() {
  draggedId.value = null
  dragOverId.value = null
}

function onDragOver(entry: FaqEntry, _e: DragEvent) {
  dragOverId.value = entry.id
}

async function onDrop(target: FaqEntry, e: DragEvent) {
  e.preventDefault()
  const fromId = draggedId.value
  draggedId.value = null
  dragOverId.value = null
  if (!fromId || fromId === target.id) return
  const fromIdx = entries.value.findIndex((x) => x.id === fromId)
  const targetIdx = entries.value.findIndex((x) => x.id === target.id)
  if (fromIdx === -1 || targetIdx === -1) return
  const next = [...entries.value]
  const [moved] = next.splice(fromIdx, 1)
  // L'indice vient d'être trouvé dans ce même tableau : ce garde-fou ne se déclenche pas, il dit
  // au compilateur ce que la recherche ci-dessus garantit déjà.
  if (!moved) return
  next.splice(targetIdx, 0, moved)
  entries.value = next
  await executerReordonnancement()
}
</script>
