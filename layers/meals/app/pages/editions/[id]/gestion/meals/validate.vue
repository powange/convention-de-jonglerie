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
      <div class="space-y-6">
        <div class="flex items-start justify-between gap-4">
          <ManagementPageHeader :titre="$t('gestion.meals.validation_title')" />
          <UButton
            icon="i-heroicons-arrow-left"
            color="neutral"
            variant="soft"
            :to="`/editions/${edition.id}/gestion`"
          >
            {{ $t('common.back') }}
          </UButton>
        </div>
        <UCard>
          <!-- Étape 1: Sélection du repas -->
          <div
            class="mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700"
          >
            <label
              class="block text-base sm:text-lg font-semibold mb-3 text-gray-900 dark:text-white"
            >
              {{ $t('gestion.meals.select_meal') }}
            </label>
            <!-- Le jour par des flèches, le type par trois boutons : une édition tient le
                 plus souvent sur un week-end, et le mouvement réel est « le repas suivant » ou
                 « le dîner du même jour » — pas « viser une ligne dans un menu ». -->
            <div class="flex items-center gap-2 mb-3">
              <UButton
                icon="i-heroicons-chevron-left"
                color="neutral"
                variant="outline"
                size="lg"
                :disabled="loadingMeals || !journeePrecedente"
                :aria-label="$t('gestion.meals.previous_day')"
                @click="allerAuJour(journeePrecedente)"
              />
              <div class="flex-1 text-center text-base sm:text-lg font-medium truncate">
                <span v-if="selectedMeal">{{ formatMealDate(selectedMeal.date) }}</span>
                <span v-else class="text-gray-500">
                  {{ $t('gestion.meals.select_meal_placeholder') }}
                </span>
              </div>
              <UButton
                icon="i-heroicons-chevron-right"
                color="neutral"
                variant="outline"
                size="lg"
                :disabled="loadingMeals || !journeeSuivante"
                :aria-label="$t('gestion.meals.next_day')"
                @click="allerAuJour(journeeSuivante)"
              />
            </div>

            <!-- Seuls les types configurés ce jour-là sont proposés : le jour de montage ne porte
                 souvent que le dîner, et offrir les autres désignerait un repas inexistant. -->
            <UFieldGroup class="w-full">
              <UButton
                v-for="type in typesDisponibles"
                :key="type"
                :color="selectedMeal?.mealType === type ? 'primary' : 'neutral'"
                :variant="selectedMeal?.mealType === type ? 'solid' : 'outline'"
                size="lg"
                class="flex-1 justify-center"
                @click="allerAuType(type)"
              >
                {{ getMealTypeLabel(type) }}
              </UButton>
            </UFieldGroup>
          </div>

          <!-- Statistiques du repas sélectionné -->
          <div v-if="selectedMeal && mealStats" class="mb-6">
            <div
              class="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800"
            >
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-heroicons-chart-bar"
                    class="text-primary-600 dark:text-primary-400 h-5 w-5"
                  />
                  <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ $t('gestion.meals.progress') }}
                  </h3>
                </div>
                <div class="text-right">
                  <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {{ mealStats.validated }} / {{ mealStats.total }}
                  </div>
                  <div class="text-xs text-gray-600 dark:text-gray-400">
                    {{ mealStats.percentage }}% {{ $t('gestion.meals.validated_lowercase') }}
                  </div>
                </div>
              </div>

              <!-- Barre de progression -->
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-primary-500 to-blue-500 transition-all duration-500 ease-out rounded-full flex items-center justify-end pr-2"
                  :style="{ width: `${mealStats.percentage}%` }"
                >
                  <span v-if="mealStats.percentage > 15" class="text-white text-xs font-semibold">
                    {{ mealStats.percentage }}%
                  </span>
                </div>
              </div>

              <!-- Détails par catégorie -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                <button
                  class="text-center p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer group"
                  :disabled="
                    mealStats.breakdown.volunteers.total ===
                    mealStats.breakdown.volunteers.validated
                  "
                  @click="openPendingModal('volunteer')"
                >
                  <div
                    class="text-xs text-gray-600 dark:text-gray-400 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ $t('gestion.meals.volunteers') }}
                  </div>
                  <div
                    class="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ mealStats.breakdown.volunteers.validated }} /
                    {{ mealStats.breakdown.volunteers.total }}
                  </div>
                  <div
                    v-if="
                      mealStats.breakdown.volunteers.total >
                      mealStats.breakdown.volunteers.validated
                    "
                    class="text-xs text-primary-600 dark:text-primary-400 mt-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity"
                  >
                    {{
                      mealStats.breakdown.volunteers.total -
                      mealStats.breakdown.volunteers.validated
                    }}
                    restant{{
                      mealStats.breakdown.volunteers.total -
                        mealStats.breakdown.volunteers.validated >
                      1
                        ? 's'
                        : ''
                    }}
                  </div>
                  <!-- Toujours visible, contrairement au « restants » qui n'apparaît qu'au survol :
                       c'est une consigne pour la cuisine, pas un détail de progression. -->
                  <div
                    v-if="mealStats.breakdown.volunteers.afterShow > 0"
                    class="text-xs text-amber-600 dark:text-amber-400 mt-1"
                  >
                    {{
                      $t('gestion.meals.plates_set_aside', {
                        count: mealStats.breakdown.volunteers.afterShow,
                      })
                    }}
                  </div>
                </button>
                <button
                  class="text-center p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer group"
                  :disabled="
                    mealStats.breakdown.artists.total === mealStats.breakdown.artists.validated
                  "
                  @click="openPendingModal('artist')"
                >
                  <div
                    class="text-xs text-gray-600 dark:text-gray-400 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ $t('gestion.meals.artists') }}
                  </div>
                  <div
                    class="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ mealStats.breakdown.artists.validated }} /
                    {{ mealStats.breakdown.artists.total }}
                  </div>
                  <div
                    v-if="mealStats.breakdown.artists.total > mealStats.breakdown.artists.validated"
                    class="text-xs text-primary-600 dark:text-primary-400 mt-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity"
                  >
                    {{ mealStats.breakdown.artists.total - mealStats.breakdown.artists.validated }}
                    restant{{
                      mealStats.breakdown.artists.total - mealStats.breakdown.artists.validated > 1
                        ? 's'
                        : ''
                    }}
                  </div>
                  <!-- Toujours visible, contrairement au « restants » qui n'apparaît qu'au survol :
                       c'est une consigne pour la cuisine, pas un détail de progression. -->
                  <div
                    v-if="mealStats.breakdown.artists.afterShow > 0"
                    class="text-xs text-amber-600 dark:text-amber-400 mt-1"
                  >
                    {{
                      $t('gestion.meals.plates_set_aside', {
                        count: mealStats.breakdown.artists.afterShow,
                      })
                    }}
                  </div>
                </button>
                <button
                  class="text-center p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer group"
                  :disabled="
                    mealStats.breakdown.participants.total ===
                    mealStats.breakdown.participants.validated
                  "
                  @click="openPendingModal('participant')"
                >
                  <div
                    class="text-xs text-gray-600 dark:text-gray-400 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ $t('gestion.meals.participants') }}
                  </div>
                  <div
                    class="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ mealStats.breakdown.participants.validated }} /
                    {{ mealStats.breakdown.participants.total }}
                  </div>
                  <div
                    v-if="
                      mealStats.breakdown.participants.total >
                      mealStats.breakdown.participants.validated
                    "
                    class="text-xs text-primary-600 dark:text-primary-400 mt-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity"
                  >
                    {{
                      mealStats.breakdown.participants.total -
                      mealStats.breakdown.participants.validated
                    }}
                    restant{{
                      mealStats.breakdown.participants.total -
                        mealStats.breakdown.participants.validated >
                      1
                        ? 's'
                        : ''
                    }}
                  </div>
                </button>
                <button
                  class="text-center p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer group"
                  :disabled="
                    mealStats.breakdown.organizers.total ===
                    mealStats.breakdown.organizers.validated
                  "
                  @click="openPendingModal('organizer')"
                >
                  <div
                    class="text-xs text-gray-600 dark:text-gray-400 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ $t('gestion.meals.organizers') }}
                  </div>
                  <div
                    class="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ mealStats.breakdown.organizers.validated }} /
                    {{ mealStats.breakdown.organizers.total }}
                  </div>
                  <div
                    v-if="
                      mealStats.breakdown.organizers.total >
                      mealStats.breakdown.organizers.validated
                    "
                    class="text-xs text-primary-600 dark:text-primary-400 mt-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity"
                  >
                    {{
                      mealStats.breakdown.organizers.total -
                      mealStats.breakdown.organizers.validated
                    }}
                    restant{{
                      mealStats.breakdown.organizers.total -
                        mealStats.breakdown.organizers.validated >
                      1
                        ? 's'
                        : ''
                    }}
                  </div>
                  <!-- Toujours visible, contrairement au « restants » qui n'apparaît qu'au survol :
                       c'est une consigne pour la cuisine, pas un détail de progression. -->
                  <div
                    v-if="mealStats.breakdown.organizers.afterShow > 0"
                    class="text-xs text-amber-600 dark:text-amber-400 mt-1"
                  >
                    {{
                      $t('gestion.meals.plates_set_aside', {
                        count: mealStats.breakdown.organizers.afterShow,
                      })
                    }}
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- Étape 2: Recherche de personne (si un repas est sélectionné) -->
          <div v-if="selectedMeal" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">
                {{ $t('gestion.meals.search_person') }}
              </label>
              <UInput
                v-model="searchQuery"
                icon="i-heroicons-magnifying-glass"
                :placeholder="$t('gestion.meals.search_person_placeholder')"
                size="lg"
                class="w-full"
              />
            </div>

            <!-- Résultats de recherche -->
            <div v-if="searching" class="flex items-center justify-center py-8">
              <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
            </div>

            <div
              v-else-if="searchQuery && searchResults.length === 0"
              class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <UIcon
                name="i-heroicons-magnifying-glass"
                class="mx-auto h-8 w-8 text-gray-400 mb-2"
              />
              <p class="text-gray-500 dark:text-gray-400">
                {{ $t('gestion.meals.no_results') }}
              </p>
            </div>

            <!-- Affichage en cartes (mobile-friendly) -->
            <div v-else-if="searchResults.length > 0" class="space-y-3">
              <div
                v-for="person in searchResults"
                :key="person.uniqueId"
                class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              >
                <div class="flex items-start justify-between gap-3 mb-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                      <UBadge :color="getPersonTypeBadgeColor(person.type)" variant="soft">
                        {{ $t(`gestion.meals.person_type.${person.type}`) }}
                      </UBadge>
                      <UBadge
                        v-if="person.consumedAt"
                        color="success"
                        variant="soft"
                        class="flex items-center gap-1"
                      >
                        <UIcon name="i-heroicons-check-circle" class="h-4 w-4" />
                        {{ $t('gestion.meals.consumed') }}
                      </UBadge>
                    </div>
                    <h3 class="font-semibold text-gray-900 dark:text-white text-lg">
                      {{ person.lastName }} {{ person.firstName }}
                    </h3>
                    <p v-if="person.pseudo" class="text-sm text-gray-600 dark:text-gray-400">
                      @{{ person.pseudo }}
                    </p>
                  </div>
                  <UButton
                    v-if="!person.consumedAt"
                    color="success"
                    icon="i-heroicons-check"
                    :loading="validatingIds.includes(person.uniqueId)"
                    @click="validateMeal(person)"
                  >
                    {{ $t('gestion.meals.validate') }}
                  </UButton>
                  <UButton
                    v-else
                    color="error"
                    variant="soft"
                    icon="i-heroicons-x-mark"
                    :loading="validatingIds.includes(person.uniqueId)"
                    @click="cancelMeal(person)"
                  >
                    {{ $t('gestion.meals.cancel') }}
                  </UButton>
                </div>

                <!-- Informations détaillées -->
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
                >
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">{{ $t('common.email') }}:</span>
                    <span class="ml-2 text-gray-900 dark:text-white">{{
                      person.email || '-'
                    }}</span>
                  </div>
                  <div v-if="person.phone">
                    <span class="text-gray-500 dark:text-gray-400">{{ $t('common.phone') }}:</span>
                    <span class="ml-2 text-gray-900 dark:text-white">{{ person.phone }}</span>
                  </div>
                  <div v-if="person.consumedAt" class="sm:col-span-2">
                    <span class="text-gray-500 dark:text-gray-400"
                      >{{ $t('gestion.meals.consumed_at') }}:</span
                    >
                    <span class="ml-2 text-success-600 dark:text-success-400 font-medium">
                      {{ formatDateTime(person.consumedAt) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Modal des personnes non validées -->
      <UModal v-model:open="pendingModalOpen" :ui="{ content: 'sm:max-w-4xl' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-users" class="text-primary-500" />
            <span>
              {{ $t('gestion.meals.pending_validations') }}
              <span v-if="pendingType === 'volunteer'">- {{ $t('gestion.meals.volunteers') }}</span>
              <span v-else-if="pendingType === 'artist'">- {{ $t('gestion.meals.artists') }}</span>
              <span v-else-if="pendingType === 'participant'"
                >- {{ $t('gestion.meals.participants') }}</span
              >
              <span v-else-if="pendingType === 'organizer'"
                >- {{ $t('gestion.meals.organizers') }}</span
              >
            </span>
          </div>
        </template>

        <template #body>
          <div v-if="loadingPending" class="flex items-center justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
          </div>

          <div v-else-if="pendingList.length === 0" class="text-center py-8 text-gray-500">
            {{ $t('gestion.meals.all_validated') }}
          </div>

          <!-- Affichage en cartes (mobile-friendly) -->
          <div v-else class="space-y-3">
            <div
              v-for="person in pendingList"
              :key="person.uniqueId"
              class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                    {{ person.lastName }} {{ person.firstName }}
                  </h3>
                  <!-- Devant la file, savoir que cette part est mise de côté évite de chercher
                       quelqu'un qui ne passera qu'après son spectacle. -->
                  <UBadge
                    v-if="person.afterShow"
                    color="warning"
                    variant="subtle"
                    size="sm"
                    icon="i-heroicons-clock"
                    class="mb-1"
                  >
                    {{ $t('gestion.meals.meal_after_show') }}
                  </UBadge>
                  <p
                    v-if="person.pseudo && pendingType !== 'participant'"
                    class="text-sm text-gray-600 dark:text-gray-400"
                  >
                    @{{ person.pseudo }}
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {{ person.email || '-' }}
                  </p>
                  <!-- Le téléphone à côté de l'adresse : au comptoir, on appelle plutôt qu'on
                       n'écrit. Absent chez beaucoup, d'où la ligne qui disparaît au lieu d'un
                       tiret — une ligne vide de plus ferait chercher ce qui n'existe pas. -->
                  <p
                    v-if="person.phone"
                    class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1"
                  >
                    <UIcon name="i-heroicons-phone" class="h-3.5 w-3.5 shrink-0" />
                    {{ person.phone }}
                  </p>
                </div>
                <UButton
                  color="success"
                  icon="i-heroicons-check"
                  :loading="validatingIds.includes(person.uniqueId)"
                  @click="validateMealFromModal(person)"
                >
                  {{ $t('gestion.meals.validate') }}
                </UButton>
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end">
            <UButton color="neutral" variant="soft" @click="pendingModalOpen = false">
              {{ $t('common.close') }}
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  useDebounce,
  useMealTypeLabel,
  useAuthStore,
  useEditionStore,
  formatMealDate,
} from '#imports'

import { repasConnu, repasDepuisUrl, requeteRepas } from '../../../../../utils/repas-dans-url'

// Layer meals : imports cœur via #imports (résolution cross-layer) plutôt que ~/ (qui pointe le layer).

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()
const { getMealTypeLabel } = useMealTypeLabel()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// État
const meals = ref<any[]>([])
// Le repas regardé est conservé dans l'URL — cf. `repas-dans-url.ts` pour le pourquoi.
const router = useRouter()
const selectedMealId = ref<number | null>(repasDepuisUrl(route.query.meal))

// `replace` et non `push` : changer de repas n'est pas un pas de navigation à revenir en arrière.
watch(selectedMealId, () => {
  router.replace({ query: requeteRepas(route.query, selectedMealId.value) })
})
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const validatingIds = ref<string[]>([])
const mealStats = ref<any>(null)
const loadingStats = ref(false)
const pendingModalOpen = ref(false)
const pendingType = ref<'volunteer' | 'artist' | 'participant' | 'organizer'>('volunteer')
const pendingList = ref<any[]>([])

// Debounce pour la recherche
const debouncedSearchQuery = useDebounce(searchQuery, 300)

// Computed pour récupérer l'objet meal complet à partir de l'ID
/** La journée du repas regardé, pivot de la navigation par flèches. */
const journeeCourante = computed(() => (selectedMeal.value ? jourDuRepas(selectedMeal.value) : ''))

const journees = computed(() => journeesDesRepas(meals.value))
const journeePrecedente = computed(() => journeeVoisine(journees.value, journeeCourante.value, -1))
const journeeSuivante = computed(() => journeeVoisine(journees.value, journeeCourante.value, 1))

/** Les types configurés ce jour-là — les seuls à proposer. */
const typesDisponibles = computed(() =>
  journeeCourante.value ? typesDuJour(meals.value, journeeCourante.value) : []
)

/**
 * Changer de journée en gardant le type quand elle le propose.
 *
 * Le repli sur le premier repas du jour évite qu'une flèche ne vide l'écran : sur le jour de
 * montage, qui n'a souvent que le dîner, garder « petit-déjeuner » ne désignerait rien.
 */
const allerAuJour = (jour: string | null) => {
  if (!jour) return
  const cible = repasEnChangeantDeJour(meals.value, jour, selectedMeal.value?.mealType ?? null)
  if (cible) selectedMealId.value = cible.id
}

const allerAuType = (type: string) => {
  const cible = repasDuJour(meals.value, journeeCourante.value, type)
  if (cible) selectedMealId.value = cible.id
}

const selectedMeal = computed(() => {
  if (!selectedMealId.value) return null
  return meals.value.find((meal) => meal.id === selectedMealId.value) || null
})

// État pour les permissions de validation des repas
const canAccessMealValidation = ref(false)

// Vérifier l'accès à cette page : gestion des repas (droit dédié, édition ou
// convention) OU accès à la validation (bénévole/leader de l'équipe de validation).
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  if (editionStore.canManageMeals(edition.value, authStore.user.id)) return true
  if (canAccessMealValidation.value) return true
  return false
})

/**
 * Permissions de validation, recalculées dès que l'un des deux ingrédients arrive.
 *
 * N'observer que l'authentification ouvrait une course : arrivé par une URL directe ou après
 * un rechargement, l'utilisateur atteignait cette page avant que l'édition ne soit chargée.
 * La permission tombait alors à faux et n'était plus jamais reprise — le bénévole voyait
 * « Accès refusé » sur la page même que la carte et le menu lui proposaient. En passant par
 * un lien depuis la gestion, où l'édition était déjà en cache, tout marchait : c'est ce qui
 * rendait le défaut si difficile à voir.
 */
watch(
  () => [authStore.isAuthenticated, edition.value?.id] as const,
  async ([isAuthenticated, id]) => {
    if (isAuthenticated && authStore.user?.id && id) {
      canAccessMealValidation.value = await editionStore.canAccessMealValidation(id)
    } else {
      canAccessMealValidation.value = false
    }
  },
  { immediate: true }
)

// Formater le label d'un repas
// L'heure d'une validation passe par le composable : Europe/Paris, et la langue choisie.
const { formatDateTime } = useDateFormat()

// Couleur du badge selon le type de personne
const getPersonTypeBadgeColor = (type: string) => {
  switch (type) {
    case 'volunteer':
      return 'primary'
    case 'artist':
      return 'warning'
    case 'participant':
      return 'secondary'
    case 'organizer':
      return 'indigo'
    default:
      return 'neutral'
  }
}

// Charger les repas
const { execute: fetchMeals, loading: loadingMeals } = useApiAction(
  `/api/editions/${editionId}/meals`,
  {
    method: 'GET',
    errorMessages: { default: t('gestion.meals.error_loading_meals') },
    onSuccess: (response: any) => {
      meals.value = response?.meals || []

      // Un lien peut citer un repas supprimé, ou celui d'une autre édition : on l'écarte avant
      // la sélection automatique, qui ne se déclenche qu'en l'absence de choix. Sans cela,
      // l'écran restait vide sans rien expliquer.
      selectedMealId.value = repasConnu(selectedMealId.value, meals.value)

      // Sélectionner automatiquement le repas en cours ou à venir
      if (meals.value.length > 0 && !selectedMealId.value) {
        const now = new Date()

        // Chercher le repas en cours ou le prochain repas à venir
        const currentOrUpcomingMeal = meals.value.find((meal) => {
          const mealDate = new Date(meal.date)
          // Considérer un repas comme "en cours" s'il est dans les 3 heures avant ou après l'heure actuelle
          const threeHoursBefore = new Date(mealDate.getTime() - 3 * 60 * 60 * 1000)
          const threeHoursAfter = new Date(mealDate.getTime() + 3 * 60 * 60 * 1000)
          return now >= threeHoursBefore && now <= threeHoursAfter
        })

        if (currentOrUpcomingMeal) {
          // Repas en cours trouvé
          selectedMealId.value = currentOrUpcomingMeal.id
        } else {
          // Sinon, chercher le prochain repas à venir
          const upcomingMeals = meals.value.filter((meal) => new Date(meal.date) > now)
          if (upcomingMeals.length > 0) {
            // Trier par date croissante et prendre le premier
            upcomingMeals.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            selectedMealId.value = upcomingMeals[0].id
          } else {
            // Sinon, prendre le dernier repas (le plus récent)
            const sortedMeals = [...meals.value].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
            selectedMealId.value = sortedMeals[0].id
          }
        }
      }
    },
  }
)

// Rechercher des personnes ayant accès au repas sélectionné
const { execute: executeSearchPeople, loading: searching } = useApiAction(
  () => `/api/editions/${editionId}/meals/${selectedMeal.value?.id}/search`,
  {
    method: 'GET',
    query: () => ({ q: searchQuery.value }),
    errorMessages: { default: t('gestion.meals.error_searching') },
    onSuccess: (response: any) => {
      searchResults.value = response?.results || []
    },
    onError: () => {
      searchResults.value = []
    },
  }
)

const searchPeople = () => {
  if (!selectedMeal.value || !searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  executeSearchPeople()
}

// Charger les statistiques du repas sélectionné
const fetchMealStats = async () => {
  if (!selectedMeal.value) {
    mealStats.value = null
    return
  }

  loadingStats.value = true
  try {
    const data = await $fetch<{ data: { stats: any } }>(
      `/api/editions/${editionId}/meals/${selectedMeal.value.id}/stats`
    )
    mealStats.value = data.data?.stats || null
  } catch {
    mealStats.value = null
  } finally {
    loadingStats.value = false
  }
}

// Valider un repas
const validateMeal = async (person: any) => {
  validatingIds.value.push(person.uniqueId)
  try {
    await $fetch(`/api/editions/${editionId}/meals/${selectedMeal.value.id}/validate`, {
      method: 'post',
      body: {
        type: person.type,
        id: person.id,
      },
    })

    toast.add({
      title: t('gestion.meals.meal_validated'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    // Rafraîchir la recherche et les stats pour mettre à jour le statut
    await Promise.all([searchPeople(), fetchMealStats()])
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: err?.data?.message || t('gestion.meals.error_validating'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    validatingIds.value = validatingIds.value.filter((id) => id !== person.uniqueId)
  }
}

// Ouvrir la modal des personnes non validées
const openPendingModal = async (type: 'volunteer' | 'artist' | 'participant' | 'organizer') => {
  pendingType.value = type
  pendingModalOpen.value = true
  await fetchPendingList()
}

// Récupérer la liste des personnes non validées
const { execute: executeFetchPending, loading: loadingPending } = useApiAction(
  () => `/api/editions/${editionId}/meals/${selectedMeal.value?.id}/pending`,
  {
    method: 'GET',
    query: () => ({ type: pendingType.value }),
    errorMessages: { default: t('gestion.meals.error_loading_pending') },
    onSuccess: (response: any) => {
      // Trier par nom de famille, puis prénom
      const pending = response?.pending || []
      pendingList.value = pending.sort((a: any, b: any) => {
        const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '', 'fr')
        if (lastNameCompare !== 0) return lastNameCompare
        return (a.firstName || '').localeCompare(b.firstName || '', 'fr')
      })
    },
    onError: () => {
      pendingList.value = []
    },
  }
)

const fetchPendingList = () => {
  if (!selectedMeal.value) return
  executeFetchPending()
}

// Valider un repas depuis la modal
const validateMealFromModal = async (person: any) => {
  await validateMeal(person)
  // Rafraîchir la liste des personnes non validées
  await fetchPendingList()
}

// Annuler un repas
const cancelMeal = async (person: any) => {
  validatingIds.value.push(person.uniqueId)
  try {
    await $fetch(`/api/editions/${editionId}/meals/${selectedMeal.value.id}/cancel`, {
      method: 'post',
      body: {
        type: person.type,
        id: person.id,
      },
    })

    toast.add({
      title: t('gestion.meals.meal_cancelled'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    // Rafraîchir la recherche et les stats pour mettre à jour le statut
    await Promise.all([searchPeople(), fetchMealStats()])
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: err?.data?.message || t('gestion.meals.error_cancelling'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    validatingIds.value = validatingIds.value.filter((id) => id !== person.uniqueId)
  }
}

// Watchers
watch(debouncedSearchQuery, () => {
  searchPeople()
})

watch(selectedMeal, () => {
  // Réinitialiser la recherche quand on change de repas
  searchQuery.value = ''
  searchResults.value = []
  // Charger les statistiques du nouveau repas
  fetchMealStats()
})

// Recharger la liste des personnes non validées à chaque ouverture de la modal
watch(pendingModalOpen, (isOpen) => {
  if (isOpen && selectedMeal.value) {
    fetchPendingList()
  }
})

// Lifecycle
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch {
      // Erreur silencieuse
    }
  }

  await fetchMeals()
})
</script>
