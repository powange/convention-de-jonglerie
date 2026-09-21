<template>
  <UModal
    v-model:open="ouverte"
    :title="$t('gestion.ticketing.handout_volumes_title')"
    :description="$t('gestion.ticketing.handout_volumes_description')"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <div v-if="chargement" class="space-y-2">
          <USkeleton v-for="n in 4" :key="n" class="h-12 w-full" />
        </div>

        <UAlert
          v-else-if="enEchec"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="$t('gestion.ticketing.handout_volumes_error')"
        />

        <div
          v-else-if="volumes.length === 0"
          class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <UIcon name="i-heroicons-gift" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p class="text-sm text-gray-500">
            {{ $t('gestion.ticketing.handout_volumes_empty') }}
          </p>
        </div>

        <template v-else>
          <!-- Sur combien de têtes porte le total. Un chiffre d'articles ne se vérifie pas sans
               lui, et un zéro inattendu désigne aussitôt la population qui manque. -->
          <UAlert
            icon="i-heroicons-information-circle"
            color="neutral"
            variant="subtle"
            :description="phraseDeCadrage"
          />

          <div class="space-y-1">
            <!-- L'en-tête des colonnes, aligné sur la grille des lignes. Masqué sur mobile, où
                 chaque nombre porte déjà son libellé. -->
            <div
              class="hidden sm:grid grid-cols-[1fr_4rem_4rem_4rem_1.5rem] gap-2 px-3 pb-1 text-xs font-medium uppercase tracking-wide text-gray-400"
            >
              <span>{{ $t('gestion.ticketing.handout_volumes_item') }}</span>
              <span class="text-right">{{ $t('gestion.ticketing.handout_volumes_expected') }}</span>
              <span class="text-right">{{ $t('gestion.ticketing.handout_volumes_given') }}</span>
              <span class="text-right">{{ $t('gestion.ticketing.handout_volumes_left') }}</span>
              <span />
            </div>

            <UCollapsible
              v-for="volume in volumes"
              :key="volume.id"
              class="border border-gray-200 dark:border-gray-800 rounded-lg"
            >
              <button
                type="button"
                class="w-full text-left px-3 py-2.5 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_4rem_4rem_4rem_1.5rem] gap-x-2 gap-y-1 items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
              >
                <span class="font-medium text-sm truncate">{{ volume.name }}</span>

                <!-- Mobile : les trois nombres sur une ligne propre, chacun étiqueté. -->
                <div class="sm:hidden col-span-2 flex gap-4 text-xs tabular-nums">
                  <span
                    ><span class="text-gray-400">{{
                      $t('gestion.ticketing.handout_volumes_expected')
                    }}</span>
                    {{ volume.attendu }}</span
                  >
                  <span
                    ><span class="text-gray-400">{{
                      $t('gestion.ticketing.handout_volumes_given')
                    }}</span>
                    {{ volume.sorti }}</span
                  >
                  <span class="font-semibold"
                    ><span class="text-gray-400 font-normal">{{
                      $t('gestion.ticketing.handout_volumes_left')
                    }}</span>
                    {{ volume.reste }}</span
                  >
                </div>

                <span class="hidden sm:block text-right text-sm tabular-nums font-semibold">{{
                  volume.attendu
                }}</span>
                <span class="hidden sm:block text-right text-sm tabular-nums text-gray-500">{{
                  volume.sorti
                }}</span>
                <span class="hidden sm:block text-right text-sm tabular-nums">{{
                  volume.reste
                }}</span>
                <UIcon
                  name="i-heroicons-chevron-down"
                  class="hidden sm:block text-gray-400 shrink-0"
                />
              </button>

              <template #content>
                <div
                  class="px-3 pb-3 pt-1 space-y-3 border-t border-gray-100 dark:border-gray-800/70"
                >
                  <!-- La décomposition : un total qui ne se décompose pas ne se vérifie pas. -->
                  <div>
                    <p class="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
                      {{ $t('gestion.ticketing.handout_volumes_by_population') }}
                    </p>
                    <ul class="text-sm space-y-0.5">
                      <li
                        v-for="population in POPULATIONS"
                        :key="population"
                        class="flex justify-between gap-2 tabular-nums"
                        :class="
                          volume.parPopulation[population].attendu === 0 ? 'text-gray-400' : ''
                        "
                      >
                        <span>{{ $t(LIBELLE_DE_POPULATION[population]) }}</span>
                        <span>
                          {{ volume.parPopulation[population].attendu }}
                          <span class="text-gray-400">
                            ({{ volume.parPopulation[population].sorti }}
                            {{ $t('gestion.ticketing.handout_volumes_given_suffix') }})
                          </span>
                        </span>
                      </li>
                    </ul>
                  </div>

                  <!-- Qui n'a pas encore récupéré : la raison d'être de l'écran en fin
                       d'événement. Pas de troncature — « et 40 autres » ne sert à rappeler
                       personne. -->
                  <div v-if="volume.enAttente.length > 0">
                    <p class="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
                      {{
                        $t('gestion.ticketing.handout_volumes_pending', {
                          count: volume.enAttente.length,
                        })
                      }}
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                      <UBadge
                        v-for="personne in volume.enAttente"
                        :key="personne.cle"
                        :color="COULEUR_DE_POPULATION[personne.population]"
                        variant="soft"
                        size="sm"
                      >
                        {{ personne.nom
                        }}<span v-if="personne.quantity > 1"> ×{{ personne.quantity }}</span>
                      </UBadge>
                    </div>
                  </div>
                  <p v-else class="text-sm text-gray-500">
                    {{ $t('gestion.ticketing.handout_volumes_all_given') }}
                  </p>
                </div>
              </template>
            </UCollapsible>
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/**
 * Les volumes d'articles à remettre : ce qu'il faut avoir, ce qui est sorti, ce qui reste.
 *
 * Deux usages pour un seul écran, parce que c'est un seul calcul : commander six semaines avant,
 * et savoir qui n'a pas récupéré son tee-shirt le dernier jour. Les séparer aurait fait diverger
 * deux chiffres censés dire la même chose.
 *
 * **« Sorti » se lit sur la validation d'entrée** — décision du 21/09/2026 : dès qu'un billet est
 * validé, les articles associés sont réputés remis. Rien ne l'enregistre ailleurs. C'est dit à
 * l'écran plutôt que tu, faute de quoi on lirait « reste » comme un stock.
 */

type Population = 'participants' | 'benevoles' | 'artistes' | 'organisateurs'

interface VolumeDunArticle {
  id: number
  name: string
  attendu: number
  sorti: number
  reste: number
  parPopulation: Record<Population, { attendu: number; sorti: number }>
  enAttente: Array<{ cle: string; nom: string; population: Population; quantity: number }>
}

const props = defineProps<{ open: boolean; editionId: number }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t } = useI18n()

const ouverte = computed({
  get: () => props.open,
  set: (valeur) => emit('update:open', valeur),
})

const POPULATIONS: Population[] = ['participants', 'benevoles', 'artistes', 'organisateurs']

const LIBELLE_DE_POPULATION: Record<Population, string> = {
  participants: 'common.participants',
  benevoles: 'common.volunteers',
  artistes: 'common.artists',
  organisateurs: 'common.organizers',
}

const COULEUR_DE_POPULATION: Record<Population, 'neutral' | 'primary' | 'warning' | 'info'> = {
  participants: 'neutral',
  benevoles: 'primary',
  artistes: 'warning',
  organisateurs: 'info',
}

const volumes = ref<VolumeDunArticle[]>([])
const personnes = ref<Record<Population, number> | null>(null)
const enEchec = ref(false)

const { execute, loading: chargement } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/handout-items/volumes`,
  {
    method: 'GET',
    errorMessages: { default: t('gestion.ticketing.handout_volumes_error') },
    onSuccess: (reponse: any) => {
      volumes.value = reponse?.volumes ?? []
      personnes.value = reponse?.personnes ?? null
      enEchec.value = false
    },
    onError: () => {
      enEchec.value = true
    },
  }
)

/** Sur combien de personnes porte le total, population par population. */
const phraseDeCadrage = computed(() => {
  const compte = personnes.value
  if (!compte) return ''
  const parties = POPULATIONS.filter((population) => compte[population] > 0).map(
    (population) => `${compte[population]} ${t(LIBELLE_DE_POPULATION[population]).toLowerCase()}`
  )
  if (parties.length === 0) return t('gestion.ticketing.handout_volumes_nobody')
  return t('gestion.ticketing.handout_volumes_scope', { liste: parties.join(', ') })
})

/**
 * Charger à l'ouverture, et à chaque ouverture.
 *
 * Ces chiffres bougent à chaque vente et à chaque entrée : un cache ferait commander sur un
 * relevé d'hier. Le `.catch` n'est pas décoratif — un rejet non géré dans un watcher interrompt
 * l'hydratation, et l'écran se fige sans rien dire.
 */
watch(
  () => props.open,
  (estOuverte) => {
    if (!estOuverte) return
    execute().catch(() => {
      enEchec.value = true
    })
  }
)
</script>
