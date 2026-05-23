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
          <UIcon name="i-heroicons-gift" class="text-orange-600 dark:text-orange-400" />
          {{ $t('gestion.ticketing.handout_items_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.ticketing.handout_items_description') }}
        </p>
      </div>

      <div class="space-y-8">
        <TicketingHandoutItemsList
          :items="handoutItems"
          :loading="loadingHandoutItems"
          :edition-id="editionId"
          @refresh="onHandoutItemsRefresh"
        />

        <!-- Onglets par cible (Bénévoles, Organisateurs, plus tard Artistes) -->
        <div v-if="audienceTabs.length" class="border-t border-gray-200 dark:border-gray-800 pt-8">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {{ $t('gestion.ticketing.assign_handout_items_title') }}
          </h2>
          <UTabs v-model="activeAudienceTab" :items="audienceTabs" variant="link">
            <template #tiers>
              <div v-if="loadingTiers" class="text-center py-6">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto" size="24" />
              </div>
              <div
                v-else-if="tiers.length === 0"
                class="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <UIcon name="i-heroicons-ticket" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p class="text-sm text-gray-500">{{ $t('gestion.ticketing.no_tiers_yet') }}</p>
              </div>
              <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
                <li
                  v-for="tier in tiers"
                  :key="tier.id"
                  class="py-3 flex items-center gap-3 flex-wrap"
                >
                  <UIcon
                    name="i-heroicons-ticket"
                    class="text-orange-600 dark:text-orange-400 size-5 shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm">{{ tier.name }}</div>
                    <div
                      v-if="tier.handoutItems && tier.handoutItems.length > 0"
                      class="flex flex-wrap gap-1.5 mt-1"
                    >
                      <UBadge
                        v-for="ri in tier.handoutItems"
                        :key="ri.handoutItemId"
                        color="warning"
                        variant="soft"
                        size="md"
                      >
                        {{ ri.handoutItem?.name }}
                      </UBadge>
                    </div>
                    <p v-else class="text-xs text-gray-400 italic mt-1">
                      {{ $t('gestion.ticketing.no_specific_items_assigned') }}
                    </p>
                  </div>
                  <UButton
                    icon="i-heroicons-gift"
                    color="primary"
                    variant="ghost"
                    size="sm"
                    @click="openTierItemsModal(tier)"
                  >
                    {{ $t('gestion.organizers.manage_articles') }}
                  </UButton>
                </li>
              </ul>
            </template>

            <template #options>
              <div v-if="loadingOptions" class="text-center py-6">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto" size="24" />
              </div>
              <div
                v-else-if="ticketingOptions.length === 0"
                class="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <UIcon
                  name="i-heroicons-adjustments-horizontal"
                  class="mx-auto h-8 w-8 text-gray-400 mb-2"
                />
                <p class="text-sm text-gray-500">{{ $t('gestion.ticketing.no_options_yet') }}</p>
              </div>
              <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
                <li
                  v-for="option in ticketingOptions"
                  :key="option.id"
                  class="py-3 flex items-center gap-3 flex-wrap"
                >
                  <UIcon
                    name="i-heroicons-adjustments-horizontal"
                    class="text-blue-600 dark:text-blue-400 size-5 shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm">{{ option.name }}</div>
                    <div
                      v-if="option.handoutItems && option.handoutItems.length > 0"
                      class="flex flex-wrap gap-1.5 mt-1"
                    >
                      <UBadge
                        v-for="ri in option.handoutItems"
                        :key="ri.handoutItemId"
                        color="warning"
                        variant="soft"
                        size="md"
                      >
                        {{ ri.handoutItem?.name }}
                      </UBadge>
                    </div>
                    <p v-else class="text-xs text-gray-400 italic mt-1">
                      {{ $t('gestion.ticketing.no_specific_items_assigned') }}
                    </p>
                  </div>
                  <UButton
                    icon="i-heroicons-gift"
                    color="primary"
                    variant="ghost"
                    size="sm"
                    @click="openOptionItemsModal(option)"
                  >
                    {{ $t('gestion.organizers.manage_articles') }}
                  </UButton>
                </li>
              </ul>
            </template>

            <template #customfields>
              <div v-if="loadingCustomFields" class="text-center py-6">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto" size="24" />
              </div>
              <div
                v-else-if="customFields.length === 0"
                class="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <UIcon
                  name="i-heroicons-document-text"
                  class="mx-auto h-8 w-8 text-gray-400 mb-2"
                />
                <p class="text-sm text-gray-500">
                  {{ $t('gestion.ticketing.no_custom_fields_yet') }}
                </p>
              </div>
              <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
                <li
                  v-for="cf in customFields"
                  :key="cf.id"
                  class="py-3 flex items-center gap-3 flex-wrap"
                >
                  <UIcon
                    name="i-heroicons-document-text"
                    class="text-indigo-600 dark:text-indigo-400 size-5 shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm">{{ cf.label }}</div>
                    <div
                      v-if="cf.handoutItems && cf.handoutItems.length > 0"
                      class="flex flex-wrap gap-1.5 mt-1"
                    >
                      <UBadge
                        v-for="(ri, idx) in cf.handoutItems"
                        :key="idx"
                        color="warning"
                        variant="soft"
                        size="md"
                      >
                        {{ ri.handoutItem?.name }}
                        <span v-if="ri.choiceValue" class="opacity-75 ml-1"
                          >({{ ri.choiceValue }})</span
                        >
                      </UBadge>
                    </div>
                    <p v-else class="text-xs text-gray-400 italic mt-1">
                      {{ $t('gestion.ticketing.no_specific_items_assigned') }}
                    </p>
                  </div>
                  <UButton
                    icon="i-heroicons-gift"
                    color="primary"
                    variant="ghost"
                    size="sm"
                    @click="openCustomFieldItemsModal(cf)"
                  >
                    {{ $t('gestion.organizers.manage_articles') }}
                  </UButton>
                </li>
              </ul>
            </template>

            <template #volunteers>
              <TicketingVolunteerHandoutItemsList
                :key="volunteerHandoutItemsKey"
                :items="volunteerHandoutItems"
                :loading="loadingVolunteerHandoutItems"
                :edition-id="editionId"
                @refresh="loadVolunteerHandoutItems"
              />
            </template>

            <template #organizers>
              <!-- Bloc 1 : articles globaux pour TOUS les organisateurs -->
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ $t('gestion.organizers.global_handout_items') }}
                  </h3>
                  <UButton
                    size="sm"
                    color="primary"
                    variant="soft"
                    icon="i-heroicons-pencil"
                    @click="openOrganizerItemsModal(null)"
                  >
                    {{ $t('common.edit') }}
                  </UButton>
                </div>
                <div v-if="loadingOrganizerItems" class="text-center py-6">
                  <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto" size="24" />
                </div>
                <div v-else-if="globalOrganizerItems.length > 0" class="flex flex-wrap gap-2">
                  <UBadge
                    v-for="item in globalOrganizerItems"
                    :key="item.id"
                    color="warning"
                    variant="soft"
                    size="md"
                  >
                    {{ item.handoutItemName }}
                  </UBadge>
                </div>
                <div v-else class="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <UIcon name="i-heroicons-gift" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p class="text-sm text-gray-500">
                    {{ $t('gestion.organizers.no_global_handout_items') }}
                  </p>
                </div>
              </div>

              <!-- Bloc 2 : articles spécifiques par organisateur présent -->
              <div class="mt-8 space-y-3">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ $t('gestion.ticketing.per_organizer_handout_items_title') }}
                </h3>
                <div v-if="loadingEditionOrganizers" class="text-center py-6">
                  <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto" size="24" />
                </div>
                <div
                  v-else-if="editionOrganizers.length === 0"
                  class="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <UIcon
                    name="i-heroicons-user-circle"
                    class="mx-auto h-8 w-8 text-gray-400 mb-2"
                  />
                  <p class="text-sm text-gray-500">
                    {{ $t('gestion.organizers.no_organizers_on_edition') }}
                  </p>
                </div>
                <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
                  <li
                    v-for="org in editionOrganizers"
                    :key="org.id"
                    class="py-3 flex items-center gap-3 flex-wrap"
                  >
                    <UiUserAvatar :user="org.user" size="sm" class="shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-sm">
                        {{ org.user?.prenom }} {{ org.user?.nom }}
                      </div>
                      <div
                        v-if="getOrganizerItems(org.id).length > 0"
                        class="flex flex-wrap gap-1.5 mt-1"
                      >
                        <UBadge
                          v-for="item in getOrganizerItems(org.id)"
                          :key="item.id"
                          color="warning"
                          variant="soft"
                          size="md"
                        >
                          {{ item.handoutItemName }}
                        </UBadge>
                      </div>
                      <p v-else class="text-xs text-gray-400 italic mt-1">
                        {{ $t('gestion.ticketing.no_specific_items_assigned') }}
                      </p>
                    </div>
                    <UButton
                      icon="i-heroicons-gift"
                      color="primary"
                      variant="ghost"
                      size="sm"
                      @click="openOrganizerItemsModal(org)"
                    >
                      {{ $t('gestion.organizers.manage_articles') }}
                    </UButton>
                  </li>
                </ul>
              </div>
            </template>

            <template #artists>
              <div class="space-y-3">
                <div v-if="loadingShows" class="text-center py-6">
                  <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto" size="24" />
                </div>
                <div
                  v-else-if="shows.length === 0"
                  class="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <UIcon name="i-heroicons-sparkles" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p class="text-sm text-gray-500">{{ $t('gestion.shows.no_shows') }}</p>
                </div>
                <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
                  <li
                    v-for="show in shows"
                    :key="show.id"
                    class="py-3 flex items-center gap-3 flex-wrap"
                  >
                    <UIcon
                      name="i-heroicons-sparkles"
                      class="text-purple-600 dark:text-purple-400 size-5 shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-sm">{{ show.title }}</div>
                      <div
                        v-if="show.handoutItems && show.handoutItems.length > 0"
                        class="flex flex-wrap gap-1.5 mt-1"
                      >
                        <UBadge
                          v-for="item in show.handoutItems"
                          :key="item.handoutItem.id"
                          color="warning"
                          variant="soft"
                          size="md"
                        >
                          {{ item.handoutItem.name }}
                        </UBadge>
                      </div>
                      <p v-else class="text-xs text-gray-400 italic mt-1">
                        {{ $t('gestion.ticketing.no_specific_items_assigned') }}
                      </p>
                    </div>
                    <UButton
                      icon="i-heroicons-gift"
                      color="primary"
                      variant="ghost"
                      size="sm"
                      @click="openShowItemsModal(show)"
                    >
                      {{ $t('gestion.organizers.manage_articles') }}
                    </UButton>
                  </li>
                </ul>
              </div>
            </template>

            <template #meals>
              <div class="space-y-3">
                <div v-if="loadingMeals" class="text-center py-6">
                  <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto" size="24" />
                </div>
                <div
                  v-else-if="enabledMealsGrouped.length === 0"
                  class="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <UIcon name="cbi:mealie" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p class="text-sm text-gray-500">
                    {{ $t('gestion.ticketing.meals_no_enabled_meals') }}
                  </p>
                </div>
                <div v-else class="space-y-6">
                  <section v-for="group in enabledMealsGrouped" :key="group.date">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2 capitalize">
                      {{ group.label }}
                    </h4>
                    <ul class="divide-y divide-gray-100 dark:divide-gray-800 pl-2">
                      <li
                        v-for="meal in group.meals"
                        :key="meal.id"
                        class="py-3 flex items-center gap-3 flex-wrap"
                      >
                        <UIcon
                          name="cbi:mealie"
                          class="text-orange-600 dark:text-orange-400 size-5 shrink-0"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="font-medium text-sm">
                            {{ getMealTypeLabel(meal.mealType) }}
                          </div>
                          <div
                            v-if="meal.handoutItems && meal.handoutItems.length > 0"
                            class="flex flex-wrap gap-1.5 mt-1"
                          >
                            <UBadge
                              v-for="item in meal.handoutItems"
                              :key="item.handoutItemId"
                              color="warning"
                              variant="soft"
                              size="md"
                            >
                              {{ item.handoutItem?.name }}
                            </UBadge>
                          </div>
                          <p v-else class="text-xs text-gray-400 italic mt-1">
                            {{ $t('gestion.ticketing.no_specific_items_assigned') }}
                          </p>
                        </div>
                        <UButton
                          icon="i-heroicons-gift"
                          color="primary"
                          variant="ghost"
                          size="sm"
                          @click="openMealItemsModal(meal)"
                        >
                          {{ $t('gestion.organizers.manage_articles') }}
                        </UButton>
                      </li>
                    </ul>
                  </section>
                </div>
              </div>
            </template>
          </UTabs>
        </div>

        <OrganizersManageHandoutItemsModal
          v-model:open="organizerItemsModalOpen"
          :edition-id="editionId"
          :organizer="organizerItemsModalTarget"
          @items-updated="loadOrganizerItems"
        />

        <ShowsManageHandoutItemsModal
          v-model:open="showItemsModalOpen"
          :edition-id="editionId"
          :show="showItemsModalTarget"
          @saved="loadShows"
        />

        <MealsManageHandoutItemsModal
          v-model:open="mealItemsModalOpen"
          :edition-id="editionId"
          :meal="mealItemsModalTarget"
          :meal-label="mealItemsModalTarget ? formatMealLabel(mealItemsModalTarget) : ''"
          @saved="loadMeals"
        />

        <TicketingManageTierHandoutItemsModal
          v-model:open="tierItemsModalOpen"
          :edition-id="editionId"
          :tier="tierItemsModalTarget"
          @saved="loadTiers"
        />

        <TicketingManageOptionHandoutItemsModal
          v-model:open="optionItemsModalOpen"
          :edition-id="editionId"
          :option="optionItemsModalTarget"
          @saved="loadOptions"
        />

        <TicketingManageCustomFieldHandoutItemsModal
          v-model:open="customFieldItemsModalOpen"
          :edition-id="editionId"
          :custom-field="customFieldItemsModalTarget"
          @saved="loadCustomFields"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Onglets par cible (organisateurs, artistes, bénévoles).
// On ne montre un onglet que si le module concerné est activé.
const audienceTabs = computed(() => {
  const tabs: Array<{ label: string; icon: string; slot: string; value: string }> = []
  // Cibles « billet » d'abord (tarifs / options / champs personnalisés —
  // ce que reçoit chaque billet acheté), puis cibles spécifiques par rôle.
  tabs.push({
    label: t('gestion.ticketing.audience_tiers'),
    icon: 'i-heroicons-ticket',
    slot: 'tiers',
    value: 'tiers',
  })
  tabs.push({
    label: t('gestion.ticketing.audience_options'),
    icon: 'i-heroicons-adjustments-horizontal',
    slot: 'options',
    value: 'options',
  })
  tabs.push({
    label: t('gestion.ticketing.audience_custom_fields'),
    icon: 'i-heroicons-document-text',
    slot: 'customfields',
    value: 'customfields',
  })
  // L'onglet organisateurs est toujours disponible dans la billetterie
  // (les articles globaux peuvent concerner toute l'équipe d'organisation).
  tabs.push({
    label: t('gestion.ticketing.audience_organizers'),
    icon: 'i-heroicons-user-circle',
    slot: 'organizers',
    value: 'organizers',
  })
  if (edition.value?.artistsEnabled) {
    tabs.push({
      label: t('gestion.ticketing.audience_artists'),
      icon: 'i-heroicons-sparkles',
      slot: 'artists',
      value: 'artists',
    })
  }
  if (edition.value?.volunteersEnabled) {
    tabs.push({
      label: t('gestion.ticketing.audience_volunteers'),
      icon: 'i-heroicons-user-group',
      slot: 'volunteers',
      value: 'volunteers',
    })
  }
  if (edition.value?.mealsEnabled) {
    tabs.push({
      label: t('gestion.ticketing.audience_meals'),
      icon: 'cbi:mealie',
      slot: 'meals',
      value: 'meals',
    })
  }
  return tabs
})

// Onglet actif via hash dans l'URL (pour pouvoir partager un lien direct).
const activeAudienceTab = computed({
  get() {
    const hash = route.hash.replace('#', '')
    if (hash && audienceTabs.value.some((t) => t.value === hash)) return hash
    return audienceTabs.value[0]?.value ?? ''
  },
  set(tab: string) {
    router.replace({ hash: `#${tab}` })
  },
})

// Items à remettre
const loadingHandoutItems = ref(true)
const handoutItems = ref<any[]>([])

// Items à remettre pour bénévoles
const loadingVolunteerHandoutItems = ref(true)
const volunteerHandoutItems = ref<any[]>([])
const volunteerHandoutItemsKey = ref(0) // Clé pour forcer le rechargement

// Articles à remettre pour organisateurs (globaux + spécifiques par organisateur).
// `allOrganizerItems` contient TOUTES les assignations renvoyées par l'API ;
// on filtre côté front en globaux (`organizerId === null`) vs spécifiques.
const loadingOrganizerItems = ref(true)
const allOrganizerItems = ref<any[]>([])
const globalOrganizerItems = computed(() =>
  allOrganizerItems.value.filter((item) => item.organizerId === null)
)
const organizerItemsModalOpen = ref(false)
const organizerItemsModalTarget = ref<any>(null)

// Organisateurs présents sur l'édition (pour la liste « par organisateur »).
const loadingEditionOrganizers = ref(true)
const editionOrganizers = ref<any[]>([])

// Spectacles de l'édition (pour l'onglet Artistes).
const loadingShows = ref(true)
const shows = ref<any[]>([])
const showItemsModalOpen = ref(false)
const showItemsModalTarget = ref<any>(null)

// Repas de l'édition (pour l'onglet Repas). On n'affiche que les repas
// activés (`enabled === true`) sur la page de gestion des repas.
const loadingMeals = ref(true)
const meals = ref<any[]>([])
const mealItemsModalOpen = ref(false)
const mealItemsModalTarget = ref<any>(null)

// Tarifs / Options / Champs personnalisés
const loadingTiers = ref(true)
const tiers = ref<any[]>([])
const tierItemsModalOpen = ref(false)
const tierItemsModalTarget = ref<any>(null)

const loadingOptions = ref(true)
const ticketingOptions = ref<any[]>([])
const optionItemsModalOpen = ref(false)
const optionItemsModalTarget = ref<any>(null)

const loadingCustomFields = ref(true)
const customFields = ref<any[]>([])
const customFieldItemsModalOpen = ref(false)
const customFieldItemsModalTarget = ref<any>(null)
const enabledMeals = computed(() => meals.value.filter((m) => m.enabled))
const { getMealTypeLabel } = useMealTypeLabel()
const mealDateFormatter = computed(
  () =>
    new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
)
// Pour les meals : ordre fixe BREAKFAST → LUNCH → DINNER quand un même jour
// regroupe plusieurs types (le label est traduit séparément).
const MEAL_TYPE_ORDER: Record<string, number> = { BREAKFAST: 0, LUNCH: 1, DINNER: 2 }

// Repas groupés par date, triés par date asc puis par mealType (matin → soir).
const enabledMealsGrouped = computed<Array<{ date: string; label: string; meals: any[] }>>(() => {
  const byDate = new Map<string, any[]>()
  for (const meal of enabledMeals.value) {
    const key = meal.date
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(meal)
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([date, list]) => ({
      date,
      label: mealDateFormatter.value.format(new Date(date)),
      meals: list
        .slice()
        .sort((a, b) => (MEAL_TYPE_ORDER[a.mealType] ?? 99) - (MEAL_TYPE_ORDER[b.mealType] ?? 99)),
    }))
})

function formatMealLabel(meal: any): string {
  const date = mealDateFormatter.value.format(new Date(meal.date))
  return `${date} — ${getMealTypeLabel(meal.mealType)}`
}

// Permissions (mêmes règles que la page tarifs)
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})
const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  if (authStore.user.id === edition.value.creatorId) return true
  if (canEdit.value || canManageVolunteers.value) return true
  if (edition.value.convention?.organizers) {
    return edition.value.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }
  return false
})

const loadHandoutItems = async () => {
  loadingHandoutItems.value = true
  try {
    const response = await $fetch<any>(`/api/editions/${editionId}/ticketing/handout-items`)
    handoutItems.value = response.data?.handoutItems || []
  } catch {
    // Erreur silencieuse
  } finally {
    loadingHandoutItems.value = false
  }
}

// Quand les articles à remettre changent, forcer un rechargement des articles
// bénévoles pour que la liste des articles disponibles se mette à jour.
const onHandoutItemsRefresh = async () => {
  await loadHandoutItems()
  volunteerHandoutItemsKey.value++
}

const loadVolunteerHandoutItems = async () => {
  loadingVolunteerHandoutItems.value = true
  try {
    const response = await $fetch<any>(
      `/api/editions/${editionId}/ticketing/volunteers/handout-items`
    )
    volunteerHandoutItems.value = response.items
  } catch {
    // Erreur silencieuse
  } finally {
    loadingVolunteerHandoutItems.value = false
  }
}

// Charge l'ensemble des items assignés aux organisateurs (globaux + spécifiques).
const loadOrganizerItems = async () => {
  loadingOrganizerItems.value = true
  try {
    const response = await $fetch<any>(
      `/api/editions/${editionId}/ticketing/organizers/handout-items`
    )
    allOrganizerItems.value = response.items || []
  } catch {
    // Erreur silencieuse
  } finally {
    loadingOrganizerItems.value = false
  }
}

// Items spécifiques assignés à un organisateur donné (hors globaux).
const getOrganizerItems = (organizerId: number) =>
  allOrganizerItems.value.filter((item) => item.organizerId === organizerId)

// Charge la liste des organisateurs présents sur l'édition.
const loadEditionOrganizers = async () => {
  loadingEditionOrganizers.value = true
  try {
    const response = await $fetch<{ data: { organizers: any[] } }>(
      `/api/editions/${editionId}/organizers/edition-organizers`
    )
    editionOrganizers.value = response.data?.organizers || []
  } catch {
    // Erreur silencieuse
  } finally {
    loadingEditionOrganizers.value = false
  }
}

// Ouvre la modal : `organizer = null` → édition des items globaux.
const openOrganizerItemsModal = (organizer: any | null) => {
  organizerItemsModalTarget.value = organizer
  organizerItemsModalOpen.value = true
}

// Charge la liste des spectacles de l'édition (avec leurs articles associés).
const loadShows = async () => {
  loadingShows.value = true
  try {
    const response = await $fetch<{ data: { shows: any[] } }>(`/api/editions/${editionId}/shows`)
    shows.value = response.data?.shows || []
  } catch {
    // Erreur silencieuse
  } finally {
    loadingShows.value = false
  }
}

const openShowItemsModal = (show: any) => {
  showItemsModalTarget.value = show
  showItemsModalOpen.value = true
}

// Charge la liste des repas configurés sur l'édition.
const loadMeals = async () => {
  loadingMeals.value = true
  try {
    const response = await $fetch<{ data: { meals: any[] } }>(
      `/api/editions/${editionId}/volunteers/meals`
    )
    meals.value = response.data?.meals || []
  } catch {
    // Erreur silencieuse
  } finally {
    loadingMeals.value = false
  }
}

const openMealItemsModal = (meal: any) => {
  mealItemsModalTarget.value = meal
  mealItemsModalOpen.value = true
}

// --- Tarifs ---
const loadTiers = async () => {
  loadingTiers.value = true
  try {
    const response = await $fetch<{ data: { tiers: any[] } }>(
      `/api/editions/${editionId}/ticketing/tiers`
    )
    tiers.value = response.data?.tiers || []
  } catch {
    // Erreur silencieuse
  } finally {
    loadingTiers.value = false
  }
}
const openTierItemsModal = (tier: any) => {
  tierItemsModalTarget.value = tier
  tierItemsModalOpen.value = true
}

// --- Options ---
const loadOptions = async () => {
  loadingOptions.value = true
  try {
    const response = await $fetch<{ data: { options: any[] } }>(
      `/api/editions/${editionId}/ticketing/options`
    )
    ticketingOptions.value = response.data?.options || []
  } catch {
    // Erreur silencieuse
  } finally {
    loadingOptions.value = false
  }
}
const openOptionItemsModal = (option: any) => {
  optionItemsModalTarget.value = option
  optionItemsModalOpen.value = true
}

// --- Champs personnalisés ---
const loadCustomFields = async () => {
  loadingCustomFields.value = true
  try {
    const response = await $fetch<{ data: { customFields: any[] } }>(
      `/api/editions/${editionId}/ticketing/custom-fields`
    )
    customFields.value = response.data?.customFields || []
  } catch {
    // Erreur silencieuse
  } finally {
    loadingCustomFields.value = false
  }
}
const openCustomFieldItemsModal = (cf: any) => {
  customFieldItemsModalTarget.value = cf
  customFieldItemsModalOpen.value = true
}

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch {
      return
    }
  }
  if (canAccess.value) {
    await loadHandoutItems()
    await loadVolunteerHandoutItems()
    await loadOrganizerItems()
    await loadEditionOrganizers()
    await loadTiers()
    await loadOptions()
    await loadCustomFields()
    if (edition.value?.artistsEnabled) {
      await loadShows()
    }
    if (edition.value?.mealsEnabled) {
      await loadMeals()
    }
  }
})

// Recharger quand les permissions changent (mode super admin)
watch(canAccess, async (newValue, oldValue) => {
  if (newValue && !oldValue) {
    await loadHandoutItems()
    await loadVolunteerHandoutItems()
    await loadOrganizerItems()
    await loadEditionOrganizers()
    await loadTiers()
    await loadOptions()
    await loadCustomFields()
    if (edition.value?.artistsEnabled) {
      await loadShows()
    }
    if (edition.value?.mealsEnabled) {
      await loadMeals()
    }
  }
})
</script>
