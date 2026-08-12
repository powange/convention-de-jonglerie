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
          <UIcon name="i-lucide-sparkles" class="text-yellow-500" />
          {{ $t('gestion.ai_update.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.ai_update.page_description') }}
        </p>
      </div>

      <!-- Liens externes disponibles -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-link" class="text-blue-500" />
            <h2 class="text-lg font-semibold">{{ $t('gestion.ai_update.external_links') }}</h2>
          </div>
        </template>

        <div v-if="externalUrls.length > 0" class="space-y-2">
          <div
            v-for="link in externalUrls"
            :key="link.url"
            class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
          >
            <UIcon :name="link.icon" class="size-5 text-gray-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ link.label }}</p>
              <a
                :href="link.url"
                target="_blank"
                rel="noopener"
                class="text-xs text-primary-500 hover:underline truncate block"
              >
                {{ link.url }}
              </a>
            </div>
            <UCheckbox v-model="link.selected" />
          </div>
        </div>

        <UAlert
          v-if="externalUrls.length === 0 && !edition.jugglingEdgeUrl"
          icon="i-lucide-info"
          color="info"
          variant="soft"
          :title="$t('gestion.ai_update.no_external_links')"
          :description="$t('gestion.ai_update.no_external_links_description')"
        />

        <!-- URL JugglingEdge -->
        <div class="pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-globe" class="size-5 text-orange-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">JugglingEdge</p>
              <div class="flex gap-2">
                <UInput
                  v-model="jugglingEdgeUrlInput"
                  placeholder="https://www.jugglingedge.com/event.php?EventID=..."
                  class="flex-1"
                  size="sm"
                />
                <UButton
                  size="sm"
                  color="primary"
                  variant="soft"
                  :loading="savingJugglingEdgeUrl"
                  :disabled="jugglingEdgeUrlInput === (edition.jugglingEdgeUrl || '')"
                  @click="saveJugglingEdgeUrl"
                >
                  {{ $t('common.save') }}
                </UButton>
              </div>
            </div>
            <UCheckbox v-model="jugglingEdgeSelected" :disabled="!jugglingEdgeUrlInput" />
          </div>
        </div>
      </UCard>

      <!-- Actions -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sparkles" class="text-yellow-500" />
            <h2 class="text-lg font-semibold">{{ $t('gestion.ai_update.search_updates') }}</h2>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ai_update.search_updates_description') }}
          </p>

          <!-- Choix du provider IA -->
          <UFormField v-if="availableProviders.length > 1" :label="$t('admin.import.ai_provider')">
            <USelect
              v-model="selectedProvider"
              :items="providerItems"
              :loading="loadingProviders"
              class="w-full max-w-md"
            />
          </UFormField>

          <!-- Périmètre : chaque volet coûte des minutes d'appels au modèle. -->
          <UFormField :label="$t('gestion.ai_update.scope_label')">
            <div class="space-y-2">
              <UCheckbox
                v-model="perimetreInfos"
                :label="$t('gestion.ai_update.scope_infos')"
                :description="$t('gestion.ai_update.scope_infos_help')"
              />
              <UCheckbox
                v-model="perimetreProgramme"
                :disabled="!edition.programUrl"
                :label="$t('gestion.ai_update.scope_program')"
                :description="
                  edition.programUrl
                    ? $t('gestion.ai_update.scope_program_help')
                    : $t('gestion.ai_update.scope_program_missing')
                "
              />
              <!-- Journées à relever : chacune coûte un appel au modèle. -->
              <div
                v-if="perimetreProgramme && edition.programUrl && journeesDeLEdition.length > 0"
                class="ml-6 pl-3 border-l border-gray-200 dark:border-gray-700 space-y-1"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{
                      $t('gestion.ai_update.scope_days_count', {
                        count: journeesSelectionnees.length,
                        total: journeesDeLEdition.length,
                      })
                    }}
                  </span>
                  <UButton size="xs" variant="link" @click="basculerToutesLesJournees">
                    {{
                      toutesJourneesCochees
                        ? $t('gestion.ai_update.scope_days_none')
                        : $t('gestion.ai_update.scope_days_all')
                    }}
                  </UButton>
                </div>
                <div
                  v-for="jour in journeesDeLEdition"
                  :key="jour.date"
                  class="flex items-center gap-2"
                >
                  <UCheckbox
                    :model-value="journeesSelectionnees.includes(jour.date)"
                    @update:model-value="basculerJournee(jour.date)"
                  />
                  <span class="text-sm capitalize">{{ jour.label }}</span>
                  <span v-if="jour.dejaRenseignee" class="text-xs text-gray-400">
                    {{ $t('gestion.ai_update.scope_day_already_filled') }}
                  </span>
                </div>
              </div>

              <UCheckbox
                v-model="perimetreServices"
                :label="$t('gestion.ai_update.scope_services')"
                :description="$t('gestion.ai_update.scope_services_help')"
              />
            </div>
          </UFormField>

          <UButton
            color="warning"
            icon="i-lucide-sparkles"
            :loading="generating"
            :disabled="selectedUrls.length === 0 || !perimetreValide"
            @click="searchForUpdates"
          >
            {{ $t('gestion.ai_update.launch_search') }}
          </UButton>

          <!-- Progression -->
          <AdminImportGenerationProgress
            v-if="generating || stepHistory.length > 0"
            :step-history="stepHistory"
            :is-generating="generating"
            method="simple"
            :agent-progress="0"
            :agent-pages-visited="0"
            :current-elapsed-time="currentElapsedTime"
            :current-step-icon="'i-heroicons-cog-6-tooth'"
            :current-step-icon-class="'animate-spin text-warning-500'"
            :is-current-step="isCurrentStep"
            :format-ms="formatMs"
            :format-duration="formatDuration"
            :format-current-step-duration="formatCurrentStepDuration"
            :format-sub-step="formatSubStepWrapper"
          />

          <!-- Erreur -->
          <UAlert
            v-if="generateError"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="$t('gestion.ai_update.search_error')"
          >
            <template #description>{{ generateError }}</template>
          </UAlert>
        </div>
      </UCard>

      <!-- Journées perdues : sans ce rappel, un échec ressemble à « rien à changer ». -->
      <UAlert
        v-if="journeesEnEchec.length > 0 && !generating"
        class="mt-6"
        icon="i-heroicons-exclamation-triangle"
        color="warning"
        variant="soft"
        :title="
          $t(
            'gestion.ai_update.program_days_failed_title',
            { count: journeesEnEchec.length },
            journeesEnEchec.length
          )
        "
        :description="
          $t('gestion.ai_update.program_days_failed_description', {
            days: journeesEnEchec.map((d) => formatProgramDayLabel(d)).join(', '),
          })
        "
      />

      <!-- Résultats -->
      <UCard v-if="updateResult && !generating" class="mt-6">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-file-diff" class="text-green-500" />
            <h2 class="text-lg font-semibold">{{ $t('gestion.ai_update.results_title') }}</h2>
          </div>
        </template>

        <div v-if="differences.length > 0" class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ai_update.differences_found', { count: differences.length }) }}
          </p>

          <div
            v-for="diff in differences"
            :key="diff.field"
            class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{
                diff.label
              }}</span>
              <UCheckbox v-model="diff.apply" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div class="bg-red-50 dark:bg-red-900/20 rounded p-2">
                <span class="text-xs text-red-600 dark:text-red-400 font-medium">{{
                  $t('gestion.ai_update.current_value')
                }}</span>
                <template v-if="isImageField(diff.field)">
                  <img
                    v-if="diff.currentValue"
                    :src="resolveImageUrl(diff.field, diff.currentValue)"
                    :alt="$t('gestion.ai_update.current_value')"
                    class="mt-1 max-h-40 rounded object-contain"
                  />
                  <p v-else class="text-gray-400 mt-1">-</p>
                </template>
                <!-- Comparaison ligne à ligne dès que la valeur en compte plusieurs : les lignes
                     disparues ressortent, les inchangées s'effacent. -->
                <div v-else-if="comparaisonDe(diff)" class="mt-1 space-y-0.5">
                  <p
                    v-for="(ligne, i) in comparaisonDe(diff)!.anciennes"
                    :key="i"
                    class="break-words whitespace-pre-wrap px-1 rounded"
                    :class="
                      ligne.modifiee
                        ? 'bg-red-200/70 dark:bg-red-800/50 text-red-900 dark:text-red-100'
                        : 'text-gray-500 dark:text-gray-400'
                    "
                  >
                    {{ ligne.texte || '\u00a0' }}
                  </p>
                </div>
                <p
                  v-else
                  class="text-gray-700 dark:text-gray-300 mt-1 break-words whitespace-pre-line"
                >
                  {{ formatDiffValue(diff.field, diff.currentValue) }}
                </p>
              </div>
              <div class="bg-green-50 dark:bg-green-900/20 rounded p-2">
                <span class="text-xs text-green-600 dark:text-green-400 font-medium">{{
                  $t('gestion.ai_update.new_value')
                }}</span>
                <template v-if="isImageField(diff.field)">
                  <img
                    v-if="diff.newValue"
                    :src="resolveImageUrl(diff.field, diff.newValue)"
                    :alt="$t('gestion.ai_update.new_value')"
                    class="mt-1 max-h-40 rounded object-contain"
                  />
                  <p v-else class="text-gray-400 mt-1">-</p>
                </template>
                <div v-else-if="comparaisonDe(diff)" class="mt-1 space-y-0.5">
                  <p
                    v-for="(ligne, i) in comparaisonDe(diff)!.nouvelles"
                    :key="i"
                    class="break-words whitespace-pre-wrap px-1 rounded"
                    :class="
                      ligne.modifiee
                        ? 'bg-green-200/70 dark:bg-green-800/50 text-green-900 dark:text-green-100'
                        : 'text-gray-500 dark:text-gray-400'
                    "
                  >
                    {{ ligne.texte || '\u00a0' }}
                  </p>
                </div>
                <p
                  v-else
                  class="text-gray-700 dark:text-gray-300 mt-1 break-words whitespace-pre-line"
                >
                  {{ formatDiffValue(diff.field, diff.newValue) }}
                </p>
              </div>
            </div>
          </div>

          <UButton
            color="primary"
            icon="i-lucide-check"
            :loading="applying"
            :disabled="selectedDifferences.length === 0"
            @click="applyUpdates"
          >
            {{ $t('gestion.ai_update.apply_selected', { count: selectedDifferences.length }) }}
          </UButton>
        </div>

        <!-- Programme : des éléments, pas des champs. Chacun se relit séparément, parce qu'ici
             le modèle n'a pas recopié mais interprété — découpé des créneaux, converti des heures.
             C'est le seul garde-fou contre un horaire inventé. -->
        <div
          v-if="planAffiche.length > 0"
          class="space-y-3"
          :class="{ 'mt-6': differences.length }"
        >
          <h3 class="font-semibold">
            {{ $t('gestion.ai_update.program_items_found', { count: planAffiche.length }) }}
          </h3>

          <div
            v-for="(entree, index) in planAffiche"
            :key="index"
            class="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
          >
            <div class="flex items-start gap-3">
              <UCheckbox v-model="entree.retenu" class="mt-1" />
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">{{ entree.action.propose.titre }}</span>
                  <UBadge
                    :color="entree.action.action === 'creer' ? 'success' : 'warning'"
                    variant="subtle"
                    size="sm"
                  >
                    {{
                      entree.action.action === 'creer'
                        ? $t('gestion.ai_update.program_new')
                        : $t('gestion.ai_update.program_update')
                    }}
                  </UBadge>
                </div>

                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ libelleCreneau(entree.action.propose) }}
                  <template v-if="entree.action.propose.lieu">
                    — {{ entree.action.propose.lieu }}
                  </template>
                </p>

                <!-- Une mise à jour ne montre que ce qui change : le reste est déjà à l'écran
                     sur la frise, et le répéter noierait la seule information utile. -->
                <ul
                  v-if="entree.action.action === 'mettre_a_jour'"
                  class="space-y-0.5 text-sm text-gray-600 dark:text-gray-400"
                >
                  <li v-for="m in entree.action.modifications" :key="m.champ">
                    <span class="font-medium">{{ $t(`gestion.ai_update.field.${m.champ}`) }}</span>
                    :
                    <span class="text-red-600 line-through dark:text-red-400">
                      {{ afficherValeur(m.champ, m.avant) || '—' }}
                    </span>
                    →
                    <span class="text-green-600 dark:text-green-400">
                      {{ afficherValeur(m.champ, m.apres) || '—' }}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <UButton
            color="primary"
            :loading="applicationProgramme"
            :disabled="elementsRetenus.length === 0"
            @click="appliquerProgramme"
          >
            {{ $t('gestion.ai_update.apply_program_items', { count: elementsRetenus.length }) }}
          </UButton>
        </div>

        <div v-if="differences.length === 0 && planAffiche.length === 0" class="text-center py-8">
          <UIcon name="i-lucide-check-circle" class="mx-auto h-12 w-12 text-green-500 mb-4" />
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ai_update.no_differences') }}
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">

import { comparerLignes, meriteUnDiff, type ComparaisonLignes } from '~~/shared/utils/diff-lignes'
import { editionDayKeys } from '~~/shared/utils/program-days'
import {
  planifierImportProgramme,
  type ActionImport,
  type ElementExistant,
  type ElementPropose,
} from '~~/shared/utils/program-import'

definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const route = useRoute()
const { t, locale } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const { getImageUrl } = useImageUrl()
const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// Composable de génération (réutilisation du système d'import)
const {
  generating,
  generateError,
  stepHistory,
  currentElapsedTime,
  formatMs,
  formatDuration,
  formatCurrentStepDuration,
  formatSubStepWrapper,
  isCurrentStep,
  generate,
  availableProviders,
  selectedProvider,
  loadingProviders,
  loadProviders,
  detectServices,
} = useImportGeneration()

/**
 * Programme par journée déjà enregistré, indexé par date.
 *
 * L'édition du store ne le porte pas : il vit dans sa propre table. Sans lui, chaque journée
 * proposée par l'IA paraîtrait nouvelle et on écraserait du texte déjà écrit sans le montrer.
 */
/**
 * Périmètre de l'analyse.
 *
 * Chaque volet coûte des minutes d'appels au modèle — les informations générales interrogent
 * toutes les sources, le programme une fois par journée de convention. Ne demander que ce qu'on
 * veut réellement mettre à jour raccourcit d'autant la séance.
 */
const perimetreInfos = ref(true)
const perimetreProgramme = ref(true)
const perimetreServices = ref(true)

/** Les trois volets sont indépendants : chacun se suffit, aucun n'en présuppose un autre. */
const perimetreValide = computed(
  () =>
    perimetreInfos.value ||
    perimetreServices.value ||
    (perimetreProgramme.value &&
      !!edition.value?.programUrl &&
      journeesSelectionnees.value.length > 0)
)

const currentProgramDays = ref<Record<string, string>>({})

/**
 * Vrai seulement si les journées ont été lues avec succès.
 *
 * Sans ce drapeau, « pas encore chargé » et « aucune journée » sont indiscernables. L'endpoint
 * d'enregistrement remplaçant la totalité, appliquer une journée sur un état vide par erreur
 * supprimerait toutes les autres sans rien signaler. Tant qu'il est faux, on ne propose ni
 * n'enregistre aucune journée : les autres champs restent comparables normalement.
 */
const programDaysLoaded = ref(false)

const loadProgramDays = async () => {
  try {
    const reponse = await $fetch<{ data: { days: Array<{ date: string; content: string }> } }>(
      `/api/editions/${editionId}/program-days`
    )
    currentProgramDays.value = Object.fromEntries(
      reponse.data.days.map((jour) => [jour.date, jour.content])
    )
    programDaysLoaded.value = true
  } catch {
    // Un échec ne doit pas empêcher la comparaison des autres champs, mais il interdit de
    // toucher aux journées : on ne sait pas ce qui existe déjà.
    currentProgramDays.value = {}
    programDaysLoaded.value = false
  }
}

onMounted(() => {
  loadProviders()
  loadProgramDays()
  if (!edition.value) {
    editionStore.fetchEditionById(editionId, { force: true })
  }
})

// Items du provider IA
const providerItems = computed(() =>
  availableProviders.value.map((provider) => ({
    label: provider.name + (provider.isDefault ? ` (${t('common.default')})` : ''),
    value: provider.id,
    icon: provider.icon,
  }))
)

// Liens externes de l'édition
const externalUrls = ref<Array<{ url: string; label: string; icon: string; selected: boolean }>>([])

watch(
  edition,
  (ed) => {
    if (!ed) return
    const links: typeof externalUrls.value = []
    if (ed.officialWebsiteUrl) {
      links.push({
        url: ed.officialWebsiteUrl,
        label: t('gestion.ai_update.link_website'),
        icon: 'i-lucide-globe',
        selected: true,
      })
    }
    if (ed.facebookUrl) {
      links.push({
        url: ed.facebookUrl,
        label: 'Facebook',
        icon: 'i-lucide-facebook',
        selected: true,
      })
    }
    if (ed.instagramUrl) {
      links.push({
        url: ed.instagramUrl,
        label: 'Instagram',
        icon: 'i-lucide-instagram',
        selected: false,
      })
    }
    if (ed.ticketingUrl) {
      links.push({
        url: ed.ticketingUrl,
        label: t('gestion.ai_update.link_ticketing'),
        icon: 'i-lucide-ticket',
        selected: true,
      })
    }
    // Cochée d'office : une page dédiée au programme est, par construction, la source la plus
    // riche pour ce que l'IA sait maintenant en tirer — le déroulé jour par jour.
    if (ed.programUrl) {
      links.push({
        url: ed.programUrl,
        label: t('gestion.ai_update.link_program'),
        icon: 'i-lucide-calendar-days',
        selected: true,
      })
    }
    externalUrls.value = links
  },
  { immediate: true }
)

// URL JugglingEdge (séparée car éditable)
const jugglingEdgeUrlInput = ref(edition.value?.jugglingEdgeUrl || '')
const jugglingEdgeSelected = ref(!!edition.value?.jugglingEdgeUrl)
const savingJugglingEdgeUrl = ref(false)

watch(edition, (ed) => {
  if (ed) {
    jugglingEdgeUrlInput.value = ed.jugglingEdgeUrl || ''
    jugglingEdgeSelected.value = !!ed.jugglingEdgeUrl
  }
})

const saveJugglingEdgeUrl = async () => {
  savingJugglingEdgeUrl.value = true
  try {
    await $fetch(`/api/editions/${editionId}`, {
      method: 'PUT',
      body: { jugglingEdgeUrl: jugglingEdgeUrlInput.value.trim() || null },
    })
    await editionStore.fetchEditionById(editionId, { force: true })
    useToast().add({ title: t('common.saved'), color: 'success' })
  } catch {
    useToast().add({ title: t('common.error'), color: 'error' })
  } finally {
    savingJugglingEdgeUrl.value = false
  }
}

const selectedUrls = computed(() => {
  const urls = externalUrls.value.filter((l) => l.selected).map((l) => l.url)
  if (jugglingEdgeSelected.value && jugglingEdgeUrlInput.value.trim()) {
    urls.push(jugglingEdgeUrlInput.value.trim())
  }
  return urls
})

// Résultat et différences
const updateResult = ref<any>(null)
const differences = ref<
  Array<{
    field: string
    label: string
    currentValue: string
    newValue: string
    apply: boolean
  }>
>([])

const selectedDifferences = computed(() => differences.value.filter((d) => d.apply))

/**
 * Éléments de programme proposés, confrontés à ceux déjà en base.
 *
 * L'extraction est rejouée d'une séance à l'autre : sans cette confrontation, une seconde passe
 * doublerait le programme. Les éléments identiques sont écartés de la revue — les montrer
 * n'apporterait rien et noierait ce qui change réellement.
 */
const elementsExistants = ref<ElementExistant[]>([])
const planAffiche = ref<Array<{ action: ActionImport; retenu: boolean }>>([])
const applicationProgramme = ref(false)

const elementsRetenus = computed(() => planAffiche.value.filter((e) => e.retenu))

const chargerElementsExistants = async () => {
  try {
    const reponse = await $fetch<{ data: { items: ElementExistant[] } }>(
      `/api/editions/${editionId}/program-items`
    )
    elementsExistants.value = reponse.data?.items ?? []
  } catch (error) {
    // Sans cette lecture on ne peut pas distinguer un ajout d'un doublon : mieux vaut ne rien
    // proposer que de proposer de tout recréer.
    console.error('Lecture des éléments de programme impossible', error)
    elementsExistants.value = []
    throw error
  }
}

const libelleCreneau = (element: ElementPropose) => {
  const heure = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  return element.fin
    ? `${heure(element.debut)} → ${new Date(element.fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : heure(element.debut)
}

/** Les instants s'affichent en heure locale ; le reste tel quel. */
const afficherValeur = (champ: string, valeur: string | null) => {
  if (!valeur) return ''
  if (champ !== 'debut' && champ !== 'fin') return valeur
  return new Date(valeur).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Applique les éléments retenus : création ou correction, un appel par élément.
 *
 * Les créations arrivent en **brouillon**. Une extraction automatique peut se tromper d'horaire,
 * et rien ne doit paraître au public avant d'avoir été relu sur la frise.
 */
const appliquerProgramme = async () => {
  applicationProgramme.value = true
  const echecs: string[] = []
  try {
    for (const entree of elementsRetenus.value) {
      const { action } = entree
      const corps = {
        title: action.propose.titre,
        description: action.propose.description ?? null,
        startDateTime: action.propose.debut,
        endDateTime: action.propose.fin ?? null,
        locationName: action.propose.lieu ?? null,
      }
      try {
        if (action.action === 'creer') {
          await $fetch(`/api/editions/${editionId}/program-items`, {
            method: 'POST',
            body: { ...corps, isPublic: false },
          })
        } else if (action.action === 'mettre_a_jour') {
          // `isPublic` est volontairement absent : corriger un horaire ne doit pas dépublier un
          // élément que l'organisateur avait déjà rendu visible.
          await $fetch(`/api/editions/${editionId}/program-items/${action.existantId}`, {
            method: 'PUT',
            body: corps,
          })
        }
      } catch (error: any) {
        // Un élément refusé ne doit pas emporter les suivants : on poursuit et on récapitule.
        echecs.push(`${action.propose.titre} — ${error?.data?.message || error?.message || ''}`)
      }
    }

    const traites = elementsRetenus.value.length - echecs.length
    if (traites > 0) {
      useToast().add({
        title: t('gestion.ai_update.program_applied', { count: traites }),
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
    if (echecs.length > 0) {
      useToast().add({
        title: t('gestion.ai_update.program_partial_failure', { count: echecs.length }),
        description: echecs.slice(0, 3).join(' · '),
        color: 'warning',
        icon: 'i-lucide-alert-triangle',
      })
    }

    // Ce qui est passé disparaît de la revue ; ce qui a échoué y reste, décoché.
    await chargerElementsExistants()
    planAffiche.value = planAffiche.value
      .filter((e) => !e.retenu || echecs.some((m) => m.startsWith(e.action.propose.titre)))
      .map((e) => ({ ...e, retenu: false }))
  } finally {
    applicationProgramme.value = false
  }
}

// Labels lisibles pour les champs
// Champs qui contiennent des URLs d'images
const IMAGE_FIELDS = ['edition.imageUrl', 'convention.logo']
const DATE_FIELDS = ['edition.startDate', 'edition.endDate']

const isImageField = (field: string) => IMAGE_FIELDS.includes(field)
const isDateField = (field: string) => DATE_FIELDS.includes(field)

const resolveImageUrl = (field: string, value: string): string | null => {
  if (!value) return null
  if (field === 'edition.imageUrl') {
    return getImageUrl(value, 'edition', editionId)
  }
  if (field === 'convention.logo') {
    return getImageUrl(value, 'convention', edition.value?.convention?.id)
  }
  return value
}

const formatDiffValue = (field: string, value: string): string => {
  if (!value) return '-'
  if (isDateField(field)) {
    try {
      const date = new Date(value)
      if (isNaN(date.getTime())) return value
      const hasTime = value.includes('T')
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    } catch {
      return value
    }
  }
  // Ne plus tronquer la description pour faciliter la comparaison
  return value
}

/**
 * Comparaison ligne à ligne d'une différence, ou `null` si elle n'apporte rien.
 *
 * Calculée une fois par différence et mémorisée : le gabarit l'invoque deux fois par ligne
 * affichée, et refaire une plus longue sous-séquence commune à chaque rendu serait ruineux.
 * Le cache est vidé à chaque nouvelle analyse, les différences étant alors toutes remplacées.
 */
const cacheComparaisons = new Map<string, ComparaisonLignes | null>()

const comparaisonDe = (diff: {
  field: string
  currentValue: string
  newValue: string
}): ComparaisonLignes | null => {
  const cle = diff.field
  if (cacheComparaisons.has(cle)) return cacheComparaisons.get(cle)!

  const ancien = formatDiffValue(diff.field, diff.currentValue)
  const nouveau = formatDiffValue(diff.field, diff.newValue)
  const comparaison = meriteUnDiff(ancien, nouveau) ? comparerLignes(ancien, nouveau) : null

  cacheComparaisons.set(cle, comparaison)
  return comparaison
}

const fieldLabels: Record<string, string> = {
  'convention.name': 'Nom de la convention',
  'convention.email': 'Email',
  'convention.description': 'Description convention',
  'edition.name': "Nom de l'édition",
  'edition.description': "Description de l'édition",
  'edition.startDate': 'Date de début',
  'edition.endDate': 'Date de fin',
  'edition.addressLine1': 'Adresse',
  'edition.city': 'Ville',
  'edition.country': 'Pays',
  'edition.postalCode': 'Code postal',
  'edition.imageUrl': 'Affiche',
  'edition.ticketingUrl': 'Billetterie',
  'edition.facebookUrl': 'Facebook',
  'edition.instagramUrl': 'Instagram',
  'edition.officialWebsiteUrl': 'Site officiel',
  'edition.latitude': 'Latitude',
  'edition.longitude': 'Longitude',
  'edition.programUrl': 'Lien du programme',
  'edition.program': 'Programme général',
}

/** `2025-07-16` → `jeudi 16 juillet`. Midi UTC pour ne pas glisser d'un jour selon le fuseau. */
const formatProgramDayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

/** Journées de l'édition, avec ce qui est déjà renseigné : de quoi ne redemander que le manquant. */
const journeesDeLEdition = computed(() => {
  if (!edition.value) return []
  return editionDayKeys(edition.value.startDate, edition.value.endDate).map((date) => ({
    date,
    label: formatProgramDayLabel(date),
    dejaRenseignee: !!currentProgramDays.value[date],
  }))
})

/** Dates cochées. Chacune coûte un appel au modèle, d'où le choix laissé à l'utilisateur. */
const journeesSelectionnees = ref<string[]>([])

/**
 * Tout est proposé à l'arrivée des journées — ne rien cocher d'office obligerait à tout cliquer.
 *
 * Une seule fois, cependant : se contenter de tester « rien n'est coché » ferait tout recocher
 * dans le dos de quelqu'un qui vient de tout décocher, au premier rafraîchissement venu.
 */
const selectionInitialisee = ref(false)
watch(
  journeesDeLEdition,
  (journees) => {
    if (journees.length && !selectionInitialisee.value) {
      journeesSelectionnees.value = journees.map((j) => j.date)
      selectionInitialisee.value = true
    }
  },
  { immediate: true }
)

const toutesJourneesCochees = computed(
  () =>
    journeesDeLEdition.value.length > 0 &&
    journeesSelectionnees.value.length === journeesDeLEdition.value.length
)

const basculerToutesLesJournees = () => {
  journeesSelectionnees.value = toutesJourneesCochees.value
    ? []
    : journeesDeLEdition.value.map((j) => j.date)
}

const basculerJournee = (date: string) => {
  const i = journeesSelectionnees.value.indexOf(date)
  if (i === -1) journeesSelectionnees.value.push(date)
  else journeesSelectionnees.value.splice(i, 1)
}

// Comparer les données IA avec l'édition actuelle
const compareResults = (aiData: any) => {
  const diffs: typeof differences.value = []
  if (!edition.value || !aiData) return diffs

  const ed = edition.value
  const conv = ed.convention

  // Comparer les champs de la convention
  if (aiData.convention) {
    if (conv?.name && aiData.convention.name && aiData.convention.name !== conv.name) {
      diffs.push({
        field: 'convention.name',
        label: fieldLabels['convention.name'],
        currentValue: conv.name,
        newValue: aiData.convention.name,
        apply: false,
      })
    }
    if (aiData.convention.email && aiData.convention.email !== (conv?.email || '')) {
      diffs.push({
        field: 'convention.email',
        label: fieldLabels['convention.email'],
        currentValue: conv?.email || '',
        newValue: aiData.convention.email,
        apply: false,
      })
    }
  }

  // Comparer les champs de l'édition
  if (aiData.edition) {
    const editionFields: Array<{ key: string; edValue: any }> = [
      { key: 'name', edValue: ed.name },
      { key: 'description', edValue: ed.description },
      { key: 'programUrl', edValue: ed.programUrl },
      { key: 'program', edValue: ed.program },
      { key: 'startDate', edValue: ed.startDate },
      { key: 'endDate', edValue: ed.endDate },
      { key: 'addressLine1', edValue: ed.addressLine1 },
      { key: 'city', edValue: ed.city },
      { key: 'country', edValue: ed.country },
      { key: 'postalCode', edValue: ed.postalCode },
      { key: 'imageUrl', edValue: ed.imageUrl },
      { key: 'ticketingUrl', edValue: ed.ticketingUrl },
      { key: 'facebookUrl', edValue: ed.facebookUrl },
      { key: 'instagramUrl', edValue: ed.instagramUrl },
      { key: 'officialWebsiteUrl', edValue: ed.officialWebsiteUrl },
    ]

    for (const { key, edValue } of editionFields) {
      const aiValue = aiData.edition[key]
      if (!aiValue) continue

      // L'IA renvoie une heure murale : elle ne vaut quelque chose qu'accompagnée du fuseau de
      // l'édition. On compare ensuite des instants, pas des chaînes, pour ne pas proposer de
      // remplacer une date par elle-même.
      if (key === 'startDate' || key === 'endDate') {
        const tz = aiData.edition.timezone || ed.timezone || 'UTC'
        const aiDateStr = wallClockToUtcIso(String(aiValue), tz)
        // Une date illisible n'est pas une proposition : la passer sous silence vaut mieux que
        // de proposer d'écraser une date correcte par une valeur inventée.
        if (!aiDateStr) continue

        const currentDate = edValue ? new Date(edValue).getTime() : 0
        const aiDate = new Date(aiDateStr).getTime()
        if (!isNaN(aiDate) && currentDate !== aiDate) {
          diffs.push({
            field: `edition.${key}`,
            label: fieldLabels[`edition.${key}`] || key,
            currentValue: String(edValue || ''),
            newValue: aiDateStr,
            apply: !edValue,
          })
        }
        continue
      }

      const currentStr = String(edValue || '')
      const aiStr = String(aiValue)

      if (aiStr && aiStr !== currentStr) {
        diffs.push({
          field: `edition.${key}`,
          label: fieldLabels[`edition.${key}`] || key,
          currentValue: currentStr,
          newValue: aiStr,
          apply: !currentStr, // Pré-cocher si la valeur actuelle est vide
        })
      }
    }

    // Comparer les booléens (services/features) — uniquement si l'IA détecte true et l'édition a false
    const booleanFields = [
      'hasFoodTrucks',
      'hasKidsZone',
      'acceptsPets',
      'hasTentCamping',
      'hasTruckCamping',
      'hasGym',
      'hasFamilyCamping',
      'hasSleepingRoom',
      'hasFireSpace',
      'hasGala',
      'hasOpenStage',
      'hasConcert',
      'hasLongShow',
      'hasCantine',
      'hasAerialSpace',
      'hasSlacklineSpace',
      'hasUnicycleSpace',
      'hasWorkshops',
      'hasToilets',
      'hasShowers',
      'hasAccessibility',
      'hasCashPayment',
      'hasCreditCardPayment',
      'hasAfjTokenPayment',
      'hasATM',
    ]

    for (const key of booleanFields) {
      if (aiData.edition[key] === true && !(ed as any)[key]) {
        diffs.push({
          field: `edition.${key}`,
          label: key,
          currentValue: 'false',
          newValue: 'true',
          apply: true,
        })
      }
    }

    /**
     * Programme par journée : une différence par jour, pas une pour l'ensemble.
     *
     * On ne propose que les journées effectivement mentionnées par l'IA. Celles déjà saisies
     * qu'elle passe sous silence restent intactes — une source incomplète ne doit pas effacer un
     * programme écrit à la main. Et une journée hors des dates de l'édition est ignorée : elle ne
     * pourrait pas s'afficher côté public.
     */
    const joursDeLEdition = new Set(editionDayKeys(ed.startDate, ed.endDate))
    const dejaProposes = new Set<string>()

    for (const jour of programDaysLoaded.value && Array.isArray(aiData.edition.programDays)
      ? aiData.edition.programDays
      : []) {
      const date = String(jour?.date || '')
      const contenu = String(jour?.content || '').trim()
      if (!contenu || !joursDeLEdition.has(date) || dejaProposes.has(date)) continue
      dejaProposes.add(date)

      const actuel = currentProgramDays.value[date] || ''
      if (contenu === actuel) continue

      diffs.push({
        field: `programDay.${date}`,
        label: `Programme du ${formatProgramDayLabel(date)}`,
        currentValue: actuel,
        newValue: contenu,
        apply: !actuel,
      })
    }
  }

  return diffs
}

// Lancer la recherche
/** Journées que le modèle n'a pas pu relever lors de la dernière analyse. */
const journeesEnEchec = ref<string[]>([])

const searchForUpdates = async () => {
  // Les différences vont être remplacées : les comparaisons mémorisées ne valent plus rien.
  cacheComparaisons.clear()
  journeesEnEchec.value = []
  // `detectServices` est porté par le composable : on l'aligne sur le périmètre choisi.
  detectServices.value = perimetreServices.value
  updateResult.value = null
  differences.value = []

  const urlsText = selectedUrls.value.join('\n')
  // La page du programme est signalée à part : elle reçoit une passe d'extraction dédiée, le
  // budget de l'extraction générale étant partagé entre toutes les sources.
  const result = await generate(urlsText, undefined, edition.value?.programUrl || undefined, {
    extractInfos: perimetreInfos.value,
    extractProgram: perimetreProgramme.value,
    editionStartDate: edition.value?.startDate?.slice(0, 10),
    editionEndDate: edition.value?.endDate?.slice(0, 10),
    programDates: perimetreProgramme.value ? journeesSelectionnees.value : undefined,
  })

  journeesEnEchec.value = result?.programDayFailures ?? []

  if (result?.json) {
    try {
      const parsed = JSON.parse(result.json)
      updateResult.value = parsed
      differences.value = compareResults(parsed)

      // Le plan de programme se calcule à part : ce ne sont pas des champs à comparer mais des
      // éléments à créer ou à corriger, chacun avec sa propre décision.
      const proposes = Array.isArray(parsed?.edition?.programItems)
        ? (parsed.edition.programItems as ElementPropose[])
        : []
      if (proposes.length > 0) {
        await chargerElementsExistants()
        planAffiche.value = planifierImportProgramme(proposes, elementsExistants.value)
          // Les éléments inchangés n'appellent aucune décision : les afficher noierait le reste.
          .filter((action) => action.action !== 'inchange')
          .map((action) => ({ action, retenu: true }))
      } else {
        planAffiche.value = []
      }
    } catch {
      generateError.value = "Erreur lors de l'analyse du résultat IA"
    }
  }
}

// Appliquer les mises à jour sélectionnées
const applying = ref(false)

const applyUpdates = async () => {
  if (selectedDifferences.value.length === 0) return

  applying.value = true
  try {
    const editionUpdates: Record<string, any> = {}
    const conventionUpdates: Record<string, any> = {}

    const journeesRetenues: Record<string, string> = {}

    for (const diff of selectedDifferences.value) {
      if (diff.field.startsWith('programDay.')) {
        journeesRetenues[diff.field.replace('programDay.', '')] = diff.newValue
      } else if (diff.field.startsWith('edition.')) {
        const key = diff.field.replace('edition.', '')
        editionUpdates[key] =
          diff.newValue === 'true' ? true : diff.newValue === 'false' ? false : diff.newValue
      } else if (diff.field.startsWith('convention.')) {
        const key = diff.field.replace('convention.', '')
        conventionUpdates[key] = diff.newValue
      }
    }

    // Appliquer les mises à jour de l'édition
    if (Object.keys(editionUpdates).length > 0) {
      await $fetch(`/api/editions/${editionId}`, {
        method: 'PUT',
        body: editionUpdates,
      })
    }

    // Le programme par journée s'enregistre en bloc : l'endpoint remplace l'ensemble. On repart
    // donc des journées déjà saisies et on n'écrase que celles retenues, sinon valider une seule
    // journée supprimerait toutes les autres.
    if (Object.keys(journeesRetenues).length > 0) {
      // Double barrière : la comparaison ne propose déjà rien sans lecture réussie, mais une
      // journée sélectionnée avant un rechargement raté ne doit pas non plus passer ici.
      if (!programDaysLoaded.value) {
        throw new Error(
          'Le programme par journée n’a pas pu être lu : les journées ne sont pas enregistrées.'
        )
      }
      const fusion = { ...currentProgramDays.value, ...journeesRetenues }
      await $fetch(`/api/editions/${editionId}/program-days`, {
        method: 'PUT',
        body: {
          days: Object.entries(fusion).map(([date, content]) => ({ date, content })),
        },
      })
      await loadProgramDays()
    }

    // Rafraîchir les données
    await editionStore.fetchEditionById(editionId, { force: true })

    // Marquer les différences appliquées
    differences.value = differences.value.filter((d) => !d.apply)

    useToast().add({
      title: t('gestion.ai_update.updates_applied'),
      color: 'success',
    })
  } catch (error: any) {
    useToast().add({
      title: t('common.error'),
      description: error?.data?.message || error?.message,
      color: 'error',
    })
  } finally {
    applying.value = false
  }
}

useSeoMeta({
  title: t('gestion.ai_update.title'),
})
</script>
