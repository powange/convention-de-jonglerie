<template>
  <UModal v-model:open="ouverte" fullscreen :title="$t('ticketing.entry_log.title')">
    <template #body>
      <div class="space-y-4">
        <!-- Recherche et filtres. Sur mobile ils passent les uns sous les autres : quatre
             contrôles côte à côte ne tiennent pas, et c'est un écran qu'on consulte parfois
             debout. -->
        <div class="flex flex-col lg:flex-row lg:items-end gap-3">
          <UFormField :label="$t('ticketing.entry_log.search_label')" class="flex-1">
            <UInput
              v-model="recherche"
              icon="i-heroicons-magnifying-glass"
              :placeholder="$t('ticketing.entry_log.search_placeholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('ticketing.entry_log.filter_movement')">
            <USelect
              v-model="filtreMouvement"
              :items="choixDeMouvement"
              value-key="value"
              class="w-full lg:w-48"
              @update:model-value="page = 1"
            />
          </UFormField>

          <UFormField :label="$t('ticketing.entry_log.filter_population')">
            <USelect
              v-model="filtrePopulation"
              :items="choixDePopulation"
              value-key="value"
              class="w-full lg:w-48"
              @update:model-value="page = 1"
            />
          </UFormField>

          <UFormField :label="$t('ticketing.entry_log.filter_from')">
            <UInput
              v-model="depuis"
              type="date"
              :min="borneMin"
              :max="jusqua || borneMax"
              class="w-full lg:w-40"
              @change="page = 1"
            />
          </UFormField>

          <UFormField :label="$t('ticketing.entry_log.filter_to')">
            <UInput
              v-model="jusqua"
              type="date"
              :min="depuis || borneMin"
              :max="borneMax"
              class="w-full lg:w-40"
              @change="page = 1"
            />
          </UFormField>

          <UButton
            v-if="unFiltreEstActif"
            variant="ghost"
            icon="i-heroicons-x-mark"
            @click="reinitialiser"
          >
            {{ $t('ticketing.entry_log.reset') }}
          </UButton>
        </div>

        <!-- Une recherche d'une seule lettre déclencherait quatre balayages de table sans index
             à chaque frappe : le serveur en exige deux, et l'écran le dit plutôt que de ne rien
             faire en silence. -->
        <UAlert
          v-if="recherche.trim().length === 1"
          icon="i-heroicons-information-circle"
          color="neutral"
          variant="soft"
          :description="$t('ticketing.entry_log.search_too_short')"
        />

        <UTable
          :data="mouvements"
          :columns="colonnes"
          :loading="chargement"
          class="border border-accented"
        >
          <template #date-cell="{ row }">
            <span class="text-sm tabular-nums">
              {{ formaterDateHeure(row.original.entryValidatedAt, fuseau, locale) }}
            </span>
          </template>

          <template #personne-cell="{ row }">
            <div class="min-w-0">
              <div class="font-medium truncate">
                {{
                  [row.original.firstName, row.original.lastName].filter(Boolean).join(' ') ||
                  $t('ticketing.access_control.unknown')
                }}
              </div>
              <div v-if="row.original.email" class="text-xs text-gray-500 truncate">
                {{ row.original.email }}
              </div>
            </div>
          </template>

          <template #population-cell="{ row }">
            <UBadge :color="couleurDePopulation(row.original.type)" variant="soft">
              {{ row.original.name || libelleDePopulation(row.original.type) }}
            </UBadge>
          </template>

          <template #mouvement-cell="{ row }">
            <UBadge
              :color="row.original.movement === 'INVALIDATED' ? 'error' : 'success'"
              variant="soft"
            >
              {{
                row.original.movement === 'INVALIDATED'
                  ? $t('ticketing.entry_log.movement_cancelled')
                  : $t('ticketing.entry_log.movement_validated')
              }}
            </UBadge>
          </template>

          <template #agent-cell="{ row }">
            <UiUserDisplayForAdmin
              v-if="row.original.validator"
              :user="row.original.validator"
              size="sm"
              :show-email="false"
              :border="false"
            />
            <span v-else class="text-xs text-gray-500 italic">
              {{ $t('ticketing.access_control.unknown') }}
            </span>
          </template>
        </UTable>

        <div v-if="!chargement && total === 0" class="text-center py-8 text-sm text-gray-500">
          {{ $t('ticketing.entry_log.empty') }}
        </div>

        <div v-if="total > tailleDePage" class="flex justify-center">
          <UPagination
            v-model:page="page"
            :items-per-page="tailleDePage"
            :total="total"
            :sibling-count="1"
          />
        </div>

        <p v-if="total > 0" class="text-center text-xs text-gray-500">
          {{ $t('ticketing.entry_log.count', { count: total }) }}
        </p>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { refDebounced } from '@vueuse/core'

import type { TableColumn } from '@nuxt/ui'

import { formaterDateHeure } from '~~/shared/utils/fuseau-edition'

/**
 * L'historique complet des mouvements d'entrée.
 *
 * Distinct du fil de dix lignes de la page : on vient ici pour arbitrer un litige — « cette
 * personne dit être passée à 14 h » — et non pour surveiller le flux. D'où la recherche, les
 * filtres, et une pagination CÔTÉ SERVEUR : l'historique n'a pas de borne, et charger tout pour
 * n'en afficher que vingt-cinq lignes irait à l'encontre de l'écran qu'on remplace.
 */
const props = defineProps<{
  open: boolean
  editionId: number
  /** Fuseau de l'édition : une entrée se date à l'heure du LIEU, pas du navigateur. */
  fuseau?: string | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t, locale } = useI18n()

const ouverte = computed({
  get: () => props.open,
  set: (valeur) => emit('update:open', valeur),
})

const LIBELLES_DE_POPULATION: Record<string, string> = {
  ticket: 'common.participant',
  volunteer: 'common.volunteer',
  artist: 'common.artist',
  organizer: 'common.organizer',
}

/** Le libellé d'une population, avec un repli : le serveur peut en nommer une qu'on ne connaît pas. */
const libelleDePopulation = (type: string) =>
  t(LIBELLES_DE_POPULATION[type] ?? 'common.participant')

const couleurDePopulation = (type: string) =>
  type === 'volunteer'
    ? ('primary' as const)
    : type === 'artist'
      ? ('warning' as const)
      : type === 'organizer'
        ? ('info' as const)
        : ('neutral' as const)

const page = ref(1)
const tailleDePage = 25
const recherche = ref('')
const filtreMouvement = ref('')
const filtrePopulation = ref('')
const depuis = ref('')
const jusqua = ref('')

const choixDeMouvement = computed(() => [
  { label: t('ticketing.entry_log.all_movements'), value: '' },
  { label: t('ticketing.entry_log.movement_validated'), value: 'VALIDATED' },
  { label: t('ticketing.entry_log.movement_cancelled'), value: 'INVALIDATED' },
])

const choixDePopulation = computed(() => [
  { label: t('ticketing.entry_log.all_populations'), value: '' },
  { label: t('common.participant'), value: 'ticket' },
  { label: t('common.volunteer'), value: 'volunteer' },
  { label: t('common.artist'), value: 'artist' },
  { label: t('common.organizer'), value: 'organizer' },
])

const unFiltreEstActif = computed(
  () =>
    !!recherche.value ||
    !!filtreMouvement.value ||
    !!filtrePopulation.value ||
    !!depuis.value ||
    !!jusqua.value
)

const reinitialiser = () => {
  recherche.value = ''
  filtreMouvement.value = ''
  filtrePopulation.value = ''
  depuis.value = ''
  jusqua.value = ''
  page.value = 1
}

const colonnes = computed((): TableColumn<Record<string, unknown>>[] => [
  { id: 'date', header: t('ticketing.entry_log.column_date') },
  { id: 'personne', header: t('ticketing.entry_log.column_person') },
  { id: 'population', header: t('ticketing.entry_log.column_population') },
  { id: 'mouvement', header: t('ticketing.entry_log.column_movement') },
  { id: 'agent', header: t('ticketing.entry_log.column_agent') },
])

const mouvements = ref<any[]>([])
const total = ref(0)
const chargement = ref(false)

/**
 * Les bornes proposées par les sélecteurs de date : du premier au dernier mouvement du journal.
 *
 * Elles viennent du serveur et sont calculées SANS les filtres. Des bornes qui suivraient le
 * filtre courant se resserreraient à chaque choix, et on ne pourrait plus élargir la période.
 * Les deux champs se cloisonnent en plus l'un l'autre : « du » ne peut pas dépasser « au ».
 */
const borneMin = ref<string | undefined>(undefined)
const borneMax = ref<string | undefined>(undefined)

const enJournee = (valeur: string | null | undefined) =>
  valeur ? new Date(valeur).toISOString().slice(0, 10) : undefined

/**
 * La recherche est temporisée, les filtres ne le sont pas.
 *
 * Un `contains` sur quatre tables à chaque frappe est exactement ce que le constat P2 reproche à
 * la recherche voisine. Un filtre, lui, est un geste unique : l'attente n'y servirait qu'à donner
 * l'impression que l'écran ne répond pas.
 */
const rechercheTemporisee = refDebounced(recherche, 350)

const charger = async () => {
  chargement.value = true
  try {
    const terme = rechercheTemporisee.value.trim()
    const reponse: any = await $fetch(`/api/editions/${props.editionId}/ticketing/entry-log`, {
      query: {
        page: page.value,
        pageSize: tailleDePage,
        ...(terme.length >= 2 ? { search: terme } : {}),
        ...(filtreMouvement.value ? { movement: filtreMouvement.value } : {}),
        ...(filtrePopulation.value ? { kind: filtrePopulation.value } : {}),
        ...(depuis.value ? { from: depuis.value } : {}),
        ...(jusqua.value ? { to: jusqua.value } : {}),
      },
    })
    mouvements.value = reponse?.data ?? []
    total.value = reponse?.pagination?.totalCount ?? 0
    borneMin.value = enJournee(reponse?.bornes?.premiere)
    borneMax.value = enJournee(reponse?.bornes?.derniere)
  } catch {
    // Une modale d'historique qui échoue ne doit pas laisser à l'écran les lignes de la requête
    // précédente : elles se liraient comme le résultat de la recherche en cours.
    mouvements.value = []
    total.value = 0
  } finally {
    chargement.value = false
  }
}

// Revenir à la première page dès que le critère change : rester en page 4 d'une recherche qui
// n'a plus que deux résultats donne un tableau vide qu'on prend pour une absence de résultat.
watch(rechercheTemporisee, () => {
  page.value = 1
})

watch(
  [() => props.open, page, rechercheTemporisee, filtreMouvement, filtrePopulation, depuis, jusqua],
  () => {
    if (props.open) charger()
  },
  { immediate: true }
)
</script>
