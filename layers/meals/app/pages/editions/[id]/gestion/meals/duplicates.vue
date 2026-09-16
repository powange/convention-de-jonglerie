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
          <UIcon
            name="i-heroicons-document-duplicate"
            class="text-orange-600 dark:text-orange-400"
          />
          {{ t('gestion.meals.duplicates.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ t('gestion.meals.duplicates.description') }}
        </p>
      </div>

      <div class="space-y-6">
        <UAlert
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          :description="t('gestion.meals.duplicates.info')"
        />

        <div v-if="chargement" class="space-y-3">
          <USkeleton v-for="n in 3" :key="n" class="h-24 w-full" />
        </div>

        <UCard v-else-if="personnes.length === 0">
          <div class="text-center py-10">
            <UIcon name="i-heroicons-check-circle" class="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p class="text-gray-600 dark:text-gray-400">
              {{ t('gestion.meals.duplicates.none') }}
            </p>
          </div>
        </UCard>

        <div v-else class="space-y-3">
          <UCard v-for="personne in personnes" :key="personne.userId">
            <!-- Empilé sur mobile : côte à côte, les boutons de retrait réduisaient le nom à
                 deux ou trois caractères. -->
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div class="flex items-start gap-2 md:flex-1">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :icon="
                    deplies.has(personne.userId)
                      ? 'i-heroicons-chevron-down'
                      : 'i-heroicons-chevron-right'
                  "
                  :aria-label="t('gestion.meals.duplicates.toggle_details')"
                  @click="basculer(personne.userId)"
                />
                <div class="min-w-0">
                  <p class="font-semibold text-gray-900 dark:text-white break-words">
                    {{ nomAffiche(personne) }}
                  </p>
                  <div class="mt-1 flex flex-wrap items-center gap-2">
                    <UBadge color="warning" variant="soft">
                      {{
                        t('gestion.meals.duplicates.meals_count', { count: personne.repas.length })
                      }}
                    </UBadge>
                    <UBadge
                      v-for="source in personne.sources"
                      :key="source.source"
                      color="neutral"
                      variant="soft"
                    >
                      {{ libelleDeLaSource(source.source) }} · {{ source.nbRepas }}
                    </UBadge>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap gap-2">
                <template v-for="source in personne.sources" :key="source.source">
                  <UButton
                    v-if="permissions[source.source]"
                    color="error"
                    variant="soft"
                    size="sm"
                    icon="i-heroicons-minus-circle"
                    :loading="retraitEnCours(cleDeLaSource(personne, source.source))"
                    @click="demanderRetraitEnMasse(personne, source.source)"
                  >
                    {{
                      t('gestion.meals.duplicates.remove_source', {
                        source: libelleDeLaSource(source.source),
                        count: source.nbRepas,
                      })
                    }}
                  </UButton>
                  <UTooltip
                    v-else
                    :text="
                      t('gestion.meals.duplicates.no_right', {
                        source: libelleDeLaSource(source.source),
                      })
                    "
                  >
                    <UButton
                      color="neutral"
                      variant="soft"
                      size="sm"
                      icon="i-heroicons-lock-closed"
                      disabled
                    >
                      {{
                        t('gestion.meals.duplicates.remove_source', {
                          source: libelleDeLaSource(source.source),
                          count: source.nbRepas,
                        })
                      }}
                    </UButton>
                  </UTooltip>
                </template>
              </div>
            </div>

            <!-- Le détail, repas par repas : le cas isolé (une seule ligne en doublon) ne se
                 traite pas autrement, et l'action de masse ne dit pas QUELS repas elle touche. -->
            <div
              v-if="deplies.has(personne.userId)"
              class="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700"
            >
              <div v-for="repas in personne.repas" :key="repas.mealId" class="space-y-2">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ libelleDuRepas(repas.mealId) }}
                </p>
                <div
                  v-for="droit in repas.droits"
                  :key="droit.source"
                  class="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-800"
                >
                  <UBadge color="neutral" variant="subtle">
                    {{ libelleDeLaSource(droit.source) }}
                  </UBadge>
                  <div class="ml-auto flex items-center gap-2">
                    <UButton
                      v-if="permissions[droit.source]"
                      color="error"
                      variant="ghost"
                      size="xs"
                      icon="i-heroicons-minus-circle"
                      :loading="retraitEnCours(cleDuRepas(droit))"
                      @click="retirer(cleDuRepas(droit), [droit])"
                    >
                      {{ t('gestion.meals.duplicates.disable') }}
                    </UButton>
                    <UTooltip
                      v-else
                      :text="
                        t('gestion.meals.duplicates.no_right', {
                          source: libelleDeLaSource(droit.source),
                        })
                      "
                    >
                      <UButton
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        icon="i-heroicons-lock-closed"
                        disabled
                      >
                        {{ t('gestion.meals.duplicates.disable') }}
                      </UButton>
                    </UTooltip>
                    <UTooltip
                      :text="
                        t('gestion.meals.duplicates.open_page', {
                          source: libelleDeLaSource(droit.source),
                        })
                      "
                    >
                      <UButton
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        icon="i-heroicons-arrow-top-right-on-square"
                        :to="lienVersLaSource(personne, droit.source)"
                        :aria-label="
                          t('gestion.meals.duplicates.open_page', {
                            source: libelleDeLaSource(droit.source),
                          })
                        "
                      />
                    </UTooltip>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>

    <!-- Confirmation du seul geste large : retirer d'un coup tous les repas d'une source. -->
    <UiConfirmModal
      v-model="confirmationOuverte"
      :title="
        t('gestion.meals.duplicates.confirm_title', {
          source: confirmation ? libelleDeLaSource(confirmation.source) : '',
        })
      "
      :description="descriptionDeLaConfirmation"
      :confirm-label="t('gestion.meals.duplicates.confirm_label')"
      confirm-color="error"
      confirm-icon="i-heroicons-minus-circle"
      icon-name="i-heroicons-exclamation-triangle"
      icon-color="text-red-500"
      :loading="retraitEnCours(confirmation?.cle ?? '')"
      @confirm="confirmerRetraitEnMasse"
      @cancel="confirmation = null"
    />
  </div>
</template>

<script setup lang="ts">
import {
  formatMealDate,
  useApiActionById,
  useAuthStore,
  useEditionStore,
  useMealTypeLabel,
} from '#imports'

import {
  corpsDuRetrait,
  urlDuRetrait,
  type DroitAuRepas,
  type SourceDeRepas,
} from '../../../../../utils/retrait-de-repas'

// Layer meals : imports cœur via #imports (résolution cross-layer) plutôt que ~/ (qui pointe le
// layer). La forme des droits et les requêtes de retrait vivent dans `retrait-de-repas`, testable
// hors Nuxt — c'est là qu'est consigné le piège du `mealId` obligatoire.

interface RepasEnDoublon {
  mealId: number
  droits: DroitAuRepas[]
}

interface PersonneEnDoublon {
  userId: number
  nom: string | null
  prenom: string | null
  pseudo: string | null
  email: string | null
  sources: Array<{ source: SourceDeRepas; nbRepas: number }>
  repas: RepasEnDoublon[]
}

interface RepasDeLEdition {
  id: number
  date: string
  mealType: string
}

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()
const { getMealTypeLabel } = useMealTypeLabel()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageMeals(edition.value, authStore.user.id)
})

const chargement = ref(true)
const personnes = ref<PersonneEnDoublon[]>([])
const repasDeLEdition = ref<RepasDeLEdition[]>([])
const permissions = ref<Record<SourceDeRepas, boolean>>({
  volunteer: false,
  artist: false,
  organizer: false,
})

const deplies = ref(new Set<number>())

const basculer = (userId: number) => {
  // Un nouvel ensemble plutôt qu'une mutation : un `Set` modifié en place ne déclenche pas le
  // rendu, et la ligne resterait repliée au clic.
  const suivant = new Set(deplies.value)
  if (suivant.has(userId)) suivant.delete(userId)
  else suivant.add(userId)
  deplies.value = suivant
}

const repasParId = computed(
  () => new Map(repasDeLEdition.value.map((repas) => [repas.id, repas] as const))
)

const libelleDuRepas = (mealId: number): string => {
  const repas = repasParId.value.get(mealId)
  if (!repas) return `#${mealId}`
  return `${formatMealDate(repas.date)} — ${getMealTypeLabel(repas.mealType)}`
}

const libelleDeLaSource = (source: SourceDeRepas): string =>
  t(`gestion.meals.person_type.${source}`)

const nomAffiche = (personne: PersonneEnDoublon): string =>
  `${personne.prenom ?? ''} ${personne.nom ?? ''}`.trim() ||
  personne.pseudo ||
  personne.email ||
  `#${personne.userId}`

/** Les droits d'une personne pour une source, sur tous ses repas en doublon. */
const droitsDeLaSource = (personne: PersonneEnDoublon, source: SourceDeRepas): DroitAuRepas[] =>
  personne.repas.flatMap((repas) => repas.droits.filter((droit) => droit.source === source))

// Clés de chargement : elles ne servent qu'à savoir quel bouton fait tourner sa roue.
const cleDeLaSource = (personne: PersonneEnDoublon, source: SourceDeRepas) =>
  `${source}:${personne.userId}`
const cleDuRepas = (droit: DroitAuRepas) => `${droit.source}:${droit.userId}:${droit.mealId}`

const charger = async () => {
  chargement.value = true
  try {
    const reponse = await $fetch<{
      data: {
        meals: RepasDeLEdition[]
        personnes: PersonneEnDoublon[]
        permissions: Record<SourceDeRepas, boolean>
      }
    }>(`/api/editions/${editionId.value}/meals/duplicates`)
    repasDeLEdition.value = reponse.data.meals
    personnes.value = reponse.data.personnes
    permissions.value = reponse.data.permissions
  } catch (error) {
    console.error('Erreur lors du chargement des doublons de repas:', error)
    toast.add({
      title: t('common.error'),
      description: t('gestion.meals.duplicates.load_error'),
      color: 'error',
    })
  } finally {
    chargement.value = false
  }
}

/**
 * Le retrait en cours.
 *
 * `useApiActionById` ne passe pas l'identifiant au constructeur d'URL ni au corps : il faut donc
 * poser ici ce sur quoi ils travaillent. Les trois sources n'ont ni la même URL ni le même corps —
 * un organisateur se désigne par son repas, faute de ligne à modifier.
 */
const actionEnCours = ref<{ cle: string; droits: DroitAuRepas[] } | null>(null)

const { execute: executerRetrait, isLoading: retraitEnCours } = useApiActionById(
  () => urlDuRetrait(editionId.value, actionEnCours.value?.droits ?? []),
  {
    method: 'PUT',
    body: () => corpsDuRetrait(actionEnCours.value?.droits ?? []),
    successMessage: { title: t('gestion.meals.duplicates.removed') },
    errorMessages: {
      403: t('gestion.meals.duplicates.remove_forbidden'),
      default: t('gestion.meals.duplicates.remove_error'),
    },
    onSuccess: () => charger(),
  }
)

const retirer = async (cle: string, droits: DroitAuRepas[]) => {
  if (droits.length === 0) return
  actionEnCours.value = { cle, droits }
  await executerRetrait(cle)
  actionEnCours.value = null
}

const confirmation = ref<{
  cle: string
  droits: DroitAuRepas[]
  personne: PersonneEnDoublon
  source: SourceDeRepas
} | null>(null)

const confirmationOuverte = computed({
  get: () => confirmation.value !== null,
  set: (ouverte: boolean) => {
    if (!ouverte) confirmation.value = null
  },
})

const descriptionDeLaConfirmation = computed(() => {
  const enCours = confirmation.value
  if (!enCours) return ''
  return t('gestion.meals.duplicates.confirm_description', {
    name: nomAffiche(enCours.personne),
    count: enCours.droits.length,
    source: libelleDeLaSource(enCours.source),
  })
})

const demanderRetraitEnMasse = (personne: PersonneEnDoublon, source: SourceDeRepas) => {
  const droits = droitsDeLaSource(personne, source)
  if (droits.length === 0) return
  confirmation.value = { cle: cleDeLaSource(personne, source), droits, personne, source }
}

const confirmerRetraitEnMasse = async () => {
  const enCours = confirmation.value
  if (!enCours) return
  await retirer(enCours.cle, enCours.droits)
  confirmation.value = null
}

const lienVersLaSource = (personne: PersonneEnDoublon, source: SourceDeRepas) => {
  // L'adresse de courriel vise plus sûrement qu'un nom, qui peut être porté deux fois.
  const recherche = personne.email || `${personne.nom ?? ''} ${personne.prenom ?? ''}`.trim()
  if (source === 'volunteer') {
    return {
      path: `/editions/${editionId.value}/gestion/volunteers/applications`,
      query: recherche ? { search: recherche } : {},
    }
  }
  if (source === 'artist') {
    return {
      path: `/editions/${editionId.value}/gestion/artists`,
      query: recherche ? { search: recherche } : {},
    }
  }
  // La page des organisateurs n'a pas de filtre de liste — et n'en a pas besoin : son tableau
  // tient sur un écran là où les deux autres se comptent en centaines de lignes.
  return { path: `/editions/${editionId.value}/gestion/organizers` }
}

onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
  if (canAccess.value) await charger()
  else chargement.value = false
})
</script>
