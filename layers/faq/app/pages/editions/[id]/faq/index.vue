<template>
  <div>
    <div v-if="editionLoading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else>
      <EditionHeader :edition="edition" current-page="faq" />

      <div class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-question-mark-circle" class="text-primary-500" />
            {{ $t('faq.title') }}
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            {{ $t('faq.description') }}
          </p>
        </div>

        <div v-if="loading" class="flex justify-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
        </div>

        <div
          v-else-if="!entries.length"
          class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
        >
          <UIcon
            name="i-heroicons-question-mark-circle"
            class="size-10 text-gray-400 mx-auto mb-2"
          />
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            {{ $t('faq.empty_state') }}
          </p>
        </div>

        <template v-else>
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            size="lg"
            :placeholder="$t('faq.search_placeholder')"
            class="w-full"
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

          <div
            v-if="!accordionItems.length"
            class="text-center py-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
          >
            <UIcon name="i-heroicons-magnifying-glass" class="size-10 text-gray-400 mx-auto mb-2" />
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ $t('faq.no_results', { query: searchQueryDebounced }) }}
            </p>
          </div>

          <UAccordion v-else v-model="openItems" :items="accordionItems" type="multiple">
            <template #default="{ item }">
              <!-- Label avec surlignage : HTML safe (texte échappé + <mark> uniquement) -->
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span class="text-start" v-html="(item as AccordionItem).labelHtml" />
            </template>
            <template #body="{ item }">
              <div
                class="prose prose-sm sm:prose-base dark:prose-invert max-w-none wrap-break-word pl-6 sm:pl-8 pt-2 ml-2"
              >
                <!-- Rendu markdown sanitisé via markdownToHtml + highlight DOM-safe -->
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-html="(item as AccordionItem).html" />
              </div>
            </template>
          </UAccordion>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'

// Layer faq : imports du cœur applicatif via #imports (auto-imports fusionnés entre layers).
import {
  countMatches,
  highlightHtml,
  highlightText,
  markdownToHtml,
  parseSearchTerms,
  useEditionStore,
} from '#imports'

interface FaqEntry {
  id: number
  question: string
  answer: string
}
interface AccordionItem {
  value: string
  label: string
  labelHtml: string
  icon: string
  html: string
  slot: 'body'
}

const route = useRoute()
const editionStore = useEditionStore()
const editionId = parseInt(route.params.id as string)
if (Number.isNaN(editionId)) {
  throw createError({ statusCode: 404, statusMessage: 'Édition introuvable', fatal: true })
}

const editionLoading = computed(() => editionStore.loading)
const edition = computed(() => editionStore.getEditionById(editionId))

const entries = ref<FaqEntry[]>([])
const loading = ref(true)
// Cache du HTML rendu (sans highlight) pour ne pas re-parser le markdown à chaque frappe.
const answerHtmlCache = ref<Record<number, string>>({})

const searchQuery = ref('')
const searchQueryDebounced = ref('')
const updateDebounced = useDebounceFn((v: string) => {
  searchQueryDebounced.value = v
}, 150)
watch(searchQuery, (v) => updateDebounced(v))

const searchTerms = computed(() => parseSearchTerms(searchQueryDebounced.value))

const filteredEntries = computed(() => {
  const terms = searchTerms.value
  if (!terms.length) return entries.value
  // Filtre puis trie par nombre total d'occurrences (question + réponse) décroissant.
  // En cas d'égalité, l'ordre d'origine est préservé (tri stable natif).
  return entries.value
    .map((e) => ({
      entry: e,
      score: countMatches(e.question, terms) + countMatches(e.answer, terms),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.entry)
})

const accordionItems = computed<AccordionItem[]>(() => {
  const terms = searchTerms.value
  return filteredEntries.value.map((e) => ({
    value: `q-${e.id}`,
    label: e.question,
    labelHtml: highlightText(e.question, terms),
    icon: 'i-heroicons-question-mark-circle',
    html: highlightHtml(answerHtmlCache.value[e.id] || '', terms),
    slot: 'body' as const,
  }))
})

// Auto-ouverture des entrées filtrées quand une recherche est active.
const openItems = ref<string[]>([])
watch(
  [searchTerms, filteredEntries],
  ([terms, list]) => {
    openItems.value = terms.length ? list.map((e) => `q-${e.id}`) : []
  },
  { flush: 'post' }
)

/*
 * ⚠⚠ `useRequestFetch` ET NON `$fetch` — constat B6.
 *
 * Cette page est rendue CÔTÉ SERVEUR, et `fetchEntries` est attendu au premier niveau du `setup`.
 * Or `$fetch` n'emporte pas le cookie de session pendant le rendu serveur : la requête partait
 * ANONYME. Pour un éditeur qui rechargeait sa FAQ pas encore publiée, le serveur répondait donc
 * 404 — et comme l'échec est levé en `fatal`, ce n'était pas une liste vide, c'était la page
 * entière qui disparaissait. `useRequestFetch` réexpédie les en-têtes de la requête entrante.
 *
 * 📍 Le composable est appelé ICI, au `setup` : l'appeler depuis l'intérieur de la fonction
 * asynchrone le placerait hors du contexte Nuxt une fois la première micro-tâche passée.
 */
const requeteAvecSession = useRequestFetch()

async function fetchEntries() {
  try {
    loading.value = true
    // `publicOnly=1` : ne renvoie que les entrées publiques même si l'utilisateur
    // connecté est éditeur (sinon il verrait les privées sur la page publique).
    const res = await requeteAvecSession<{
      success: boolean
      data: {
        faqEnabled: boolean
        faqPagePublic: boolean
        publicPageVisible: boolean
        entries: FaqEntry[]
      }
    }>(`/api/editions/${editionId}/faq`, { query: { publicOnly: '1' } })
    /*
     * ⚠️ ON LIT LE VERDICT DU SERVEUR, on ne le recalcule pas. Cette condition portait sur
     * `faqEnabled && faqPagePublic` sans regarder QUI demande : un éditeur ne pouvait donc jamais
     * relire sa FAQ avant publication — pas même en navigation interne, où son cookie accompagne
     * pourtant la requête. Le serveur, lui, le sait : c'est lui qui vient de décider de ne pas
     * répondre 404.
     */
    if (!res?.data?.publicPageVisible) {
      throw createError({ statusCode: 404, statusMessage: 'FAQ non disponible', fatal: true })
    }
    entries.value = res?.data?.entries || []
    const rendered = await Promise.all(entries.value.map((e) => markdownToHtml(e.answer)))
    const cache: Record<number, string> = {}
    entries.value.forEach((e, i) => {
      cache[e.id] = rendered[i] || ''
    })
    answerHtmlCache.value = cache
  } catch (e: unknown) {
    const err = e as { statusCode?: number; status?: number }
    // Propager les erreurs HTTP déjà typées (404, etc.), wrapper le reste en 500
    if (err?.statusCode || err?.status) throw e
    throw createError({
      statusCode: 500,
      statusMessage: 'FAQ indisponible',
      fatal: true,
    })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId, { force: true })
  }
})

await fetchEntries()
</script>
