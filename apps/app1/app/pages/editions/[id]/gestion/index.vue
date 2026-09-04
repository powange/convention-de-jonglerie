<template>
  <div>
    <div v-if="initialLoading">
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
      <!-- Amené ici par la détection de position : le dire, et offrir d'en repartir. Sans ce
           bandeau, un organisateur qui ouvre l'application sur le terrain se retrouverait sur
           l'écran de gestion sans savoir pourquoi ni comment en sortir. -->
      <EditionBandeauSurPlace />

      <!-- Contenu de gestion -->
      <div ref="conteneurCartes" class="space-y-6">
        <!-- Statut de l'édition -->
        <UCard v-if="canEdit">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-signal" class="text-blue-500" />
              <h2 class="text-lg font-semibold">{{ $t('edition.status_label') }}</h2>
            </div>
            <USelect
              v-model="localStatus"
              :items="statusOptions"
              value-key="value"
              size="md"
              :ui="{ content: 'min-w-fit' }"
            />

            <!-- Description du statut -->
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ currentStatusDescription }}
            </p>

            <!-- Bouton de sauvegarde (visible uniquement si modification) -->
            <div v-if="hasStatusChanged" class="flex justify-end">
              <UButton
                color="primary"
                icon="i-heroicons-check"
                :loading="savingStatus"
                @click="saveStatus"
              >
                {{ $t('common.save') }}
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Convention. Avant « Informations de l'édition », comme dans le panneau latéral : on va
             du plus englobant (la convention, donc toutes ses éditions) au particulier. -->
        <!-- Sur mobile, le sommaire des catégories remplace la longue page de liens ; ouvrir
             une catégorie n'affiche qu'elle, avec le retour ci-dessous. Au-delà de `md`, ces
             deux blocs disparaissent et tout reste déplié. Le sommaire se construit à partir des
             sections réellement montées, d'où le rendu côté navigateur seulement. -->
        <ClientOnly>
          <div v-if="!categorieOuverte" class="space-y-2 md:hidden">
            <UButton
              v-for="categorie in categories"
              :key="categorie.id"
              block
              size="lg"
              color="neutral"
              variant="outline"
              :icon="categorie.icone"
              trailing-icon="i-heroicons-chevron-right"
              :ui="{ base: 'justify-between' }"
              @click="ouvrir(categorie.id)"
            >
              {{ categorie.titre }}
            </UButton>
          </div>
          <UButton
            v-else
            class="md:hidden"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-arrow-left"
            :label="$t('gestion.back_to_categories')"
            @click="fermer()"
          />
        </ClientOnly>

        <ManagementCategorySection
          v-if="canEditConvention"
          id="convention"
          icon="i-heroicons-building-library"
          icon-class="text-blue-500"
          :title="$t('gestion.convention.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/convention`"
              icon="i-heroicons-building-library"
              :title="$t('gestion.convention.title')"
              :description="$t('gestion.convention.card_description')"
              color="blue"
            />
          </div>
        </ManagementCategorySection>

        <!-- Informations -->
        <ManagementCategorySection
          v-if="canEdit"
          id="infos"
          icon="i-lucide-info"
          icon-class="text-blue-500"
          :title="$t('gestion.infos.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <!-- Informations générales -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/general-info`"
              icon="i-lucide-settings"
              :title="$t('gestion.general_info.title')"
              :description="$t('gestion.infos.general_info_description')"
              color="cyan"
            />

            <!-- À propos -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/about`"
              icon="i-lucide-file-text"
              :title="$t('gestion.about.title')"
              :description="$t('gestion.infos.about_description')"
              color="indigo"
            />

            <!-- Services -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/services`"
              icon="i-lucide-wrench"
              :title="$t('gestion.services.title')"
              :description="$t('gestion.infos.services_description')"
              color="teal"
            />

            <!-- Liens externes -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/external-links`"
              icon="i-lucide-link"
              :title="$t('gestion.external_links.title')"
              :description="$t('gestion.infos.external_links_description')"
              color="violet"
            />

            <!-- Programme. Même rang que dans le panneau latéral, juste avant la carte du
                   site : les deux décrivent ce qui se passe et où. -->
            <ManagementNavigationCard
              v-if="edition.programEnabled"
              :to="`/editions/${edition.id}/gestion/program`"
              icon="i-heroicons-calendar-days"
              :title="$t('edition.program')"
              :description="$t('gestion.infos.program_description')"
              color="amber"
            />

            <!-- Carte du site -->
            <ManagementNavigationCard
              v-if="edition.siteMapEnabled"
              :to="`/editions/${edition.id}/gestion/map`"
              icon="i-lucide-map"
              :title="$t('edition.site_map')"
              :description="$t('gestion.infos.map_description')"
              color="blue"
            />

            <!-- Mise à jour IA (conventions non revendiquées ou admin) -->
            <ManagementNavigationCard
              v-if="isUnclaimedConvention || authStore.isAdminModeActive"
              :to="`/editions/${edition.id}/gestion/ai-update`"
              icon="i-lucide-sparkles"
              :title="$t('gestion.ai_update.title')"
              :description="$t('gestion.ai_update.description')"
              color="yellow"
            />

            <!-- Fonctionnalités -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/features`"
              icon="i-lucide-toggle-right"
              :title="$t('gestion.features.title')"
              :description="$t('gestion.infos.features_description')"
              color="emerald"
            />
          </div>
        </ManagementCategorySection>

        <!-- Modal de confirmation de suppression -->
        <UiConfirmModal
          v-model="showDeleteConfirm"
          :title="$t('gestion.delete_edition')"
          :description="$t('gestion.confirm_delete_edition')"
          :confirm-label="$t('common.delete')"
          confirm-color="error"
          icon-name="i-heroicons-trash"
          icon-color="text-red-500"
          :loading="deletingEdition"
          require-name-confirmation
          :expected-name="editionDisplayName"
          @confirm="confirmDeleteEdition"
          @cancel="showDeleteConfirm = false"
        />

        <!-- Organisateurs -->
        <ManagementCategorySection
          v-if="canManageOrganizers"
          id="organisateurs"
          icon="i-heroicons-user-group"
          icon-class="text-purple-500"
          :title="$t('organizers.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <!-- Gérer les organisateurs -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/organizers`"
              icon="i-heroicons-user-group"
              :title="$t('organizers.manage')"
              :description="$t('organizers.manage_description')"
              color="purple"
            />
          </div>
        </ManagementCategorySection>

        <!-- Gestion bénévole -->
        <ManagementCategorySection
          v-if="edition.volunteersEnabled && (isOrganizer || isTeamLeaderValue)"
          id="benevoles"
          icon="i-heroicons-user-group"
          icon-class="text-primary-500"
          :title="$t('edition.ticketing.volunteer_management')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <!-- Configuration bénévolat -->
            <ManagementNavigationCard
              v-if="canManageVolunteers"
              :to="`/editions/${edition.id}/gestion/volunteers/config`"
              icon="i-heroicons-cog-6-tooth"
              :title="$t('gestion.volunteers.config_title')"
              :description="$t('gestion.volunteers.config_description')"
              color="gray"
            />

            <!-- Page bénévoles -->
            <ManagementNavigationCard
              v-if="canManageVolunteers"
              :to="`/editions/${edition.id}/gestion/volunteers/page`"
              icon="i-heroicons-clipboard-document-list"
              :title="$t('edition.volunteers.volunteer_page')"
              :description="$t('edition.volunteers.page_description')"
              color="indigo"
            />

            <!-- Liens visibles uniquement en mode interne -->
            <template v-if="edition.volunteersMode === 'INTERNAL'">
              <!-- Formulaire d'appel à bénévole -->
              <ManagementNavigationCard
                v-if="canManageVolunteers"
                :to="`/editions/${edition.id}/gestion/volunteers/form`"
                icon="i-heroicons-megaphone"
                :title="$t('edition.volunteers.volunteer_form')"
                :description="$t('edition.volunteers.form_description')"
                color="blue"
              />

              <!-- Gestion des candidatures -->
              <ManagementNavigationCard
                v-if="canManageVolunteers"
                :to="`/editions/${edition.id}/gestion/volunteers/applications`"
                icon="i-heroicons-document-text"
                :title="$t('edition.volunteers.application_management')"
                :description="$t('gestion.volunteers.applications_description')"
                color="green"
              />

              <!-- Les équipes -->
              <ManagementNavigationCard
                v-if="canManageVolunteers"
                :to="`/editions/${edition.id}/gestion/volunteers/teams`"
                icon="i-heroicons-user-group"
                :title="$t('edition.volunteers.teams')"
                :description="$t('gestion.volunteers.teams_description')"
                color="purple"
              />

              <!-- Planning (pas visible pour les team leaders seuls) -->
              <ManagementNavigationCard
                v-if="canManageVolunteers"
                :to="`/editions/${edition.id}/gestion/volunteers/planning`"
                icon="i-heroicons-calendar-days"
                :title="$t('edition.volunteers.planning')"
                :description="$t('gestion.volunteers.planning_description')"
                color="orange"
              />

              <!-- Échanges de créneaux : à la suite du planning, que l'échange modifie. La
                   carte disparaît si l'organisateur a fermé les échanges. -->
              <ManagementNavigationCard
                v-if="canManageVolunteers && edition.volunteersSwapsEnabled !== false"
                :to="`/editions/${edition.id}/gestion/volunteers/swaps`"
                icon="i-lucide-arrow-left-right"
                :title="$t('edition.volunteers.swaps')"
                :description="$t('gestion.volunteers.swaps_description')"
                color="blue"
              />

              <!-- Notifications bénévoles (visible pour les team leaders) -->
              <ManagementNavigationCard
                v-if="canManageVolunteers || isTeamLeaderValue"
                :to="`/editions/${edition.id}/gestion/volunteers/notifications`"
                icon="i-heroicons-bell"
                :title="$t('edition.volunteers.volunteer_notifications')"
                :description="$t('gestion.volunteers.notifications_description')"
                color="yellow"
              />
            </template>
          </div>
        </ManagementCategorySection>

        <!-- Gestion des artistes -->
        <ManagementCategorySection
          v-if="edition.artistsEnabled && canManageArtists"
          id="artistes"
          icon="i-heroicons-star"
          icon-class="text-yellow-500"
          :title="$t('gestion.artists.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <!-- Liste des artistes -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/artists`"
              icon="i-heroicons-users"
              :title="$t('gestion.artists.list_title')"
              :description="
                $t(
                  'gestion.artists.manage_artists_description',
                  'Gérer les artistes et leurs informations'
                )
              "
              color="yellow"
            />

            <!-- Gestion des spectacles -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/artists/shows`"
              icon="i-heroicons-sparkles"
              :title="$t('gestion.shows.list_title')"
              :description="
                $t('gestion.shows.manage_shows_description', 'Créer et organiser les spectacles')
              "
              color="purple"
            />

            <!-- Appels à spectacles -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/shows-call`"
              icon="i-heroicons-megaphone"
              :title="$t('gestion.shows_call.title')"
              :description="$t('gestion.shows_call.list_description')"
              color="amber"
            />

            <!-- Notifications aux artistes -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/artists/notifications`"
              icon="i-heroicons-bell"
              :title="$t('gestion.artists.notifications.title')"
              :description="$t('gestion.artists.notifications.description')"
              color="yellow"
            />
          </div>
        </ManagementCategorySection>

        <!-- Repas (accès complet pour organisateurs) -->
        <ManagementCategorySection
          v-if="edition.mealsEnabled && canManageMeals"
          id="repas"
          icon="cbi:mealie"
          icon-class="text-orange-500"
          :title="$t('gestion.meals.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <!-- Configuration des repas -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/meals`"
              icon="cbi:mealie"
              :title="$t('gestion.meals.configuration_title')"
              :description="$t('gestion.meals.configuration_description')"
              color="orange"
            />

            <!-- Liste des repas -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/meals/list`"
              icon="i-heroicons-list-bullet"
              :title="$t('gestion.meals.list_title')"
              :description="$t('gestion.meals.list_description')"
              color="purple"
            />

            <!-- Validation des repas -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/meals/validate`"
              icon="i-heroicons-check-badge"
              :title="$t('gestion.meals.validation_title')"
              :description="$t('gestion.meals.validation_description')"
              color="green"
            />
          </div>
        </ManagementCategorySection>

        <!-- Validation des repas (accès pour bénévoles d'équipes de validation) -->
        <ManagementCategorySection
          v-else-if="edition.mealsEnabled && canAccessMealValidation"
          id="repas"
          icon="cbi:mealie"
          icon-class="text-orange-500"
          :title="$t('gestion.meals.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <!-- Validation des repas uniquement -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/meals/validate`"
              icon="i-heroicons-check-badge"
              :title="$t('gestion.meals.validation_title')"
              :description="$t('gestion.meals.validation_description')"
              color="green"
            />
          </div>
        </ManagementCategorySection>

        <!-- Contrôle d'accès seul : bénévole en créneau, sans droits sur la billetterie -->
        <ManagementCategorySection
          v-if="edition.ticketingEnabled && !canManageTicketing && canAccessAccessControl"
          id="billetterie"
          icon="i-heroicons-ticket"
          icon-class="text-blue-500"
          :title="$t('gestion.ticketing.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/ticketing/access-control`"
              icon="i-heroicons-shield-check"
              :title="$t('gestion.ticketing.access_control_title')"
              :description="$t('gestion.ticketing.access_control_description')"
              color="blue"
            />
          </div>
        </ManagementCategorySection>

        <!-- Billeterie -->
        <ManagementCategorySection
          v-if="edition.ticketingEnabled && canManageTicketing"
          id="billetterie"
          icon="i-heroicons-ticket"
          icon-class="text-blue-500"
          :title="$t('gestion.ticketing.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <!-- Configuration billetterie -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/ticketing/config`"
              icon="i-heroicons-cog-6-tooth"
              :title="$t('gestion.ticketing.config_title')"
              :description="$t('gestion.ticketing.config_description')"
              color="blue"
            />

            <!-- Lier une billeterie externe -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/ticketing/external`"
              icon="i-heroicons-link"
              :title="$t('gestion.ticketing.external_link_title')"
              :description="$t('gestion.ticketing.external_link_description')"
              color="purple"
            />

            <!-- Gérer les tarifs et options -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/ticketing/tiers`"
              icon="i-heroicons-currency-euro"
              :title="$t('gestion.ticketing.tiers_title')"
              :description="$t('gestion.ticketing.tiers_description')"
              color="orange"
            />

            <!-- Articles à remettre -->
            <ManagementNavigationCard
              v-if="edition.ticketingHandoutItemsEnabled"
              :to="`/editions/${edition.id}/gestion/ticketing/handout-items`"
              icon="i-heroicons-gift"
              :title="$t('gestion.ticketing.handout_items_title')"
              :description="$t('gestion.ticketing.handout_items_card_description')"
              color="orange"
            />

            <!-- Gérer les commandes -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/ticketing/orders`"
              icon="i-heroicons-shopping-cart"
              :title="$t('gestion.ticketing.orders_title')"
              :description="$t('gestion.ticketing.orders_description')"
              color="green"
            />

            <!-- Contrôle d'accès -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/ticketing/access-control`"
              icon="i-heroicons-shield-check"
              :title="$t('gestion.ticketing.access_control_title')"
              :description="$t('gestion.ticketing.access_control_description')"
              color="blue"
            />

            <!-- Compteurs -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/ticketing/counter`"
              icon="i-heroicons-calculator"
              :title="$t('gestion.ticketing.counters_title')"
              :description="$t('gestion.ticketing.counters_description')"
              color="teal"
            />

            <!-- Statistiques -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/ticketing/stats`"
              icon="i-heroicons-chart-bar"
              :title="$t('gestion.ticketing.stats_title')"
              :description="$t('gestion.ticketing.stats_description')"
              color="indigo"
            />
          </div>
        </ManagementCategorySection>

        <!-- Workshops -->
        <ManagementCategorySection
          v-if="canManageWorkshops && edition.workshopsEnabled"
          id="ateliers"
          icon="i-heroicons-academic-cap"
          icon-class="text-indigo-500"
          :title="$t('gestion.workshops.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <!-- Gestion des workshops -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/workshops`"
              icon="i-heroicons-academic-cap"
              :title="$t('gestion.workshops.manage_title')"
              :description="$t('gestion.workshops.manage_description')"
              color="indigo"
            />
          </div>
        </ManagementCategorySection>

        <!-- Tâches -->
        <ManagementCategorySection
          v-if="edition.tasksEnabled && canManageTasks"
          id="taches"
          icon="i-heroicons-clipboard-document-check"
          icon-class="text-rose-500"
          :title="$t('edition.tasks')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/tasks`"
              icon="i-heroicons-clipboard-document-check"
              :title="$t('gestion.task.manage_title')"
              :description="$t('gestion.task.manage_description')"
              color="rose"
            />
          </div>
        </ManagementCategorySection>

        <!-- Stock matériel -->
        <ManagementCategorySection
          v-if="edition.stockEnabled && canAccessStock"
          id="stock"
          icon="i-heroicons-archive-box"
          icon-class="text-amber-600"
          :title="$t('gestion.stock.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/stock`"
              icon="i-heroicons-archive-box"
              :title="$t('gestion.stock.manage_title')"
              :description="$t('gestion.stock.manage_description')"
              color="amber"
            />
          </div>
        </ManagementCategorySection>

        <!-- FAQ -->
        <ManagementCategorySection
          v-if="edition.faqEnabled && canManageFAQ"
          id="faq"
          icon="i-heroicons-question-mark-circle"
          icon-class="text-indigo-500"
          :title="$t('gestion.faq.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/faq`"
              icon="i-heroicons-question-mark-circle"
              :title="$t('gestion.faq.title')"
              :description="$t('gestion.faq.description')"
              color="indigo"
            />
          </div>
        </ManagementCategorySection>

        <!-- Trésorerie -->
        <ManagementCategorySection
          v-if="edition.treasuryEnabled && canManageTreasury"
          id="tresorerie"
          icon="i-heroicons-calculator"
          icon-class="text-sky-600"
          :title="$t('gestion.treasury.title')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/treasury`"
              icon="i-heroicons-calculator"
              :title="$t('gestion.treasury.title')"
              :description="$t('gestion.treasury.subtitle')"
              color="sky"
            />
          </div>
        </ManagementCategorySection>

        <!-- Objets trouvés. La condition énumère qui a le droit d'y entrer plutôt que d'exclure
             un cas : écrite en négatif, elle montrait la carte à quiconque atteignait cette page
             — y compris aux bénévoles en créneau, que la page des objets trouvés refuse. Un lien
             vers une porte fermée vaut moins que pas de lien. Les responsables d'équipe seuls
             restent exclus, comme auparavant. -->
        <ManagementCategorySection
          v-if="canEdit || canManageVolunteers || isOrganizer"
          id="objets-trouves"
          icon="i-heroicons-magnifying-glass"
          icon-class="text-amber-500"
          :title="$t('edition.lost_found')"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <!-- Gestion des objets trouvés -->
            <ManagementNavigationCard
              :to="`/editions/${edition.id}/gestion/lost-found`"
              icon="i-heroicons-magnifying-glass"
              :title="$t('gestion.manage_lost_found')"
              :description="$t('gestion.lost_found_description')"
              color="yellow"
            />
          </div>
        </ManagementCategorySection>

        <!-- Supprimer l'édition -->
        <div v-if="canDelete" class="flex justify-end">
          <UButton
            color="error"
            variant="soft"
            icon="i-heroicons-trash"
            @click="showDeleteConfirm = true"
          >
            {{ $t('gestion.delete_edition') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { getEditionDisplayName } from '~/utils/editionName'

const route = useRoute()
const editionStore = useEditionStore()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))
const editionDisplayName = computed(() =>
  edition.value ? getEditionDisplayName(edition.value) : ''
)
const initialLoading = ref(true)

onMounted(async () => {
  try {
    // Toujours forcer le fetch pour avoir les données complètes (organizers, etc.)
    await editionStore.fetchEditionById(editionId, { force: true })
  } catch (error) {
    console.error('Failed to fetch edition:', error)
  }

  // Charger en un seul appel les accès « bénévole » à la gestion
  if (authStore.user?.id) {
    const access = await editionStore.getManagementAccess(editionId)
    isTeamLeaderValue.value = access.isTeamLeader
    canAccessMealValidation.value = access.canAccessMealValidation
    canAccessAccessControl.value = access.isAccessControlActive
  }

  initialLoading.value = false

  await redirigerSiUneSeuleDestination()
})

const conteneurCartes = ref<HTMLElement | null>(null)

// Le repli par catégorie, sur mobile seulement : voir `useManagementCategories`.
const { categories, categorieOuverte, ouvrir, fermer } = fournirCategoriesGestion()

/**
 * Quand une seule destination est offerte, y aller directement.
 *
 * C'est le cas du bénévole en créneau, qui n'a accès qu'au contrôle d'accès ou à la validation
 * des repas : lui présenter un sommaire d'un seul élément lui demande un clic pour rien, sur
 * un téléphone, en plein service.
 *
 * Le décompte porte sur les liens réellement rendus plutôt que sur une liste de conditions
 * tenue à part : celle-ci se serait désynchronisée du jour où l'on ajoute ou retire une carte.
 */
const redirigerSiUneSeuleDestination = async () => {
  await nextTick()

  const liens = conteneurCartes.value?.querySelectorAll<HTMLAnchorElement>(
    'a[data-carte-gestion][href]'
  )
  if (liens?.length !== 1) return

  const destination = liens[0]?.getAttribute('href')
  // `replace` plutôt que `push` : le retour arrière doit ramener d'où l'on vient, pas rebondir
  // sur un sommaire qui renvoie aussitôt ici.
  if (destination) await navigateTo(destination, { replace: true })
}

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) return true

  // Utilisateurs avec des droits spécifiques
  if (canEdit.value || canManageVolunteers.value) return true

  // Responsables d'équipe de bénévoles
  if (isTeamLeaderValue.value) return true

  // Bénévoles avec accès à la validation des repas
  if (canAccessMealValidation.value) return true

  // Bénévoles en créneau de contrôle d'accès : sans cette ligne, la porte de la gestion leur
  // restait fermée alors même que la page de contrôle d'accès, elle, les acceptait.
  if (canAccessAccessControl.value) return true

  // Tous les organisateurs de la convention (même sans droits)
  if (edition.value.convention?.organizers) {
    return edition.value.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const isUnclaimedConvention = computed(() => {
  if (!edition.value?.convention) return false
  return !edition.value.convention.organizers || edition.value.convention.organizers.length === 0
})

const canDelete = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canDeleteEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

const canManageOrganizers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageOrganizers(edition.value, authStore.user.id)
})

const canEditConvention = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditConvention(edition.value, authStore.user.id)
})

// Droit dédié « gérer les artistes » (édition ou convention) — éditer ne suffit pas
const canManageArtists = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

// Droit dédié « gérer les repas » (édition ou convention)
const canManageMeals = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageMeals(edition.value, authStore.user.id)
})

// Droit dédié « gérer la billetterie » (édition ou convention)
const canManageTicketing = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageTicketing(edition.value, authStore.user.id)
})

// Droit dédié « gérer les ateliers » (édition ou convention)
const canManageWorkshops = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageWorkshops(edition.value, authStore.user.id)
})

// Droit dédié « gérer la FAQ » (édition ou convention)
const canManageFAQ = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageFAQ(edition.value, authStore.user.id)
})

const canManageTreasury = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageTreasury(edition.value, authStore.user.id)
})

// Vérifier si l'utilisateur est organisateur de la convention
const isOrganizer = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.isOrganizer(edition.value, authStore.user.id)
})

// Vérifier si l'utilisateur peut gérer les tâches de cette édition
const canManageTasks = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageTasks(edition.value, authStore.user.id)
})

// Vérifier si l'utilisateur peut gérer le stock matériel
const canManageStock = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageStock(edition.value, authStore.user.id)
})

const canAccessStock = computed(() => canManageStock.value || isTeamLeaderValue.value)

// Vérifier si l'utilisateur peut accéder à la validation des repas
// (bénévole d'équipe de validation des repas)
const canAccessMealValidation = ref(false)
/**
 * Bénévole d'une équipe habilitée au contrôle d'accès, pendant son créneau (à quinze minutes
 * près, retard compris). C'est le serveur qui tranche : la page ne fait que relayer.
 */
const canAccessAccessControl = ref(false)

// État pour vérifier si l'utilisateur est team leader
const isTeamLeaderValue = ref(false)

// Gestion du statut de l'édition
const localStatus = ref<'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'>(
  edition.value?.status || 'OFFLINE'
)

// Mettre à jour localStatus quand l'édition change
watch(
  () => edition.value?.status,
  (newStatus) => {
    if (newStatus) {
      localStatus.value = newStatus
    }
  },
  { immediate: true }
)

// Description du statut actuel
const currentStatusDescription = computed(() => {
  return t(`edition.status_description.${localStatus.value.toLowerCase()}`)
})

// Détecter si le statut a changé
const hasStatusChanged = computed(() => {
  return edition.value && localStatus.value !== edition.value.status
})

// Options de statut depuis le composable partagé
const { statusOptions } = useEditionStatus()

// Suppression d'édition avec modal de confirmation
const showDeleteConfirm = ref(false)

const { execute: executeDeleteEdition, loading: deletingEdition } = useApiAction(
  () => `/api/editions/${edition.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('messages.edition_deleted') },
    errorMessages: { default: t('errors.edition_deletion_failed') },
    onSuccess: () => {
      editionStore.editions = editionStore.editions.filter((e) => e.id !== editionId)
      showDeleteConfirm.value = false
      router.push('/')
    },
  }
)

const confirmDeleteEdition = () => {
  if (!edition.value) return
  executeDeleteEdition()
}

const { execute: executeSaveStatus, loading: savingStatus } = useApiAction(
  () => `/api/editions/${edition.value?.id}/status`,
  {
    method: 'PATCH',
    body: () => ({ status: localStatus.value }),
    successMessage: { title: t('edition.status_updated') },
    errorMessages: { default: t('errors.status_update_failed') },
    onSuccess: async () => {
      await editionStore.fetchEditionById(editionId, { force: true })
    },
    onError: () => {
      if (edition.value) {
        localStatus.value = edition.value.status
      }
    },
  }
)

const saveStatus = () => {
  if (!edition.value || !hasStatusChanged.value) return
  executeSaveStatus()
}
</script>
