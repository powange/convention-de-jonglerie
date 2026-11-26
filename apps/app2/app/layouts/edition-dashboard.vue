<template>
  <UDashboardGroup storage-key="flowvent-gestion">
    <UDashboardSidebar collapsible resizable :ui="{ overlay: 'z-50', content: 'z-50' }">
      <template #header="{ collapsed }">
        <div class="flex w-full items-center justify-between">
          <NuxtLink v-if="!collapsed" to="/dashboard" class="flex items-center gap-2">
            <AppLogo class="h-6 w-auto" />
          </NuxtLink>
          <UDashboardSidebarCollapse
            :icon="
              collapsed ? 'i-heroicons-chevron-double-right' : 'i-heroicons-chevron-double-left'
            "
            size="xs"
          />
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          v-model="sectionsOuvertes"
          :collapsed="collapsed"
          :items="navigation"
          orientation="vertical"
          color="primary"
          variant="pill"
          highlight
          :ui="{
            link: 'text-base items-start gap-3 py-4 lg:gap-1.5 lg:py-1.5',
            linkLeadingIcon: 'size-6 lg:size-5',
            linkLabel: 'whitespace-normal',
            childLink: 'text-base items-start gap-3 py-4 lg:gap-1.5 lg:py-1.5',
            childLinkIcon: 'size-6 lg:size-5',
            childLinkLabel: 'whitespace-normal',
          }"
        />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar>
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #left>
            <div v-if="edition" data-entete-gestion class="flex flex-col">
              <span class="text-sm font-semibold">{{ edition.name }}</span>
              <span v-if="dates" class="text-xs text-muted">{{ dates }}</span>
            </div>
          </template>
          <template #right>
            <UButton
              :to="`/events/${refPublique}`"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-arrow-top-right-on-square"
              label="Voir l'événement"
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>

<script setup lang="ts">
/**
 * Habillage de la gestion d'un événement Flowvent — le pendant du layout `edition-dashboard`
 * d'app1, attribué par `routeRules` à toute la zone `/events/:id/gestion/**`.
 *
 * Les entrées de chaque module porté (cf. docs/flowvent-modules.md) : la carte du site, et les
 * bénévoles dans l'ordre et sous les conditions d'app1 (échanges fermés → pas d'entrée ; renforts
 * seulement avec une équipe volante ; responsable d'équipe → notifications et renforts seuls).
 * Libellés en clair : Flowvent est en français seul, comme ses autres écrans.
 */
import { useEditionStore } from '~/stores/editions'

import type { Droits, Modules } from '#shared/modules-evenement'
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const editionStore = useEditionStore()

// L'id numérique (API, store) et l'identifiant public (adresses) de l'événement.
const editionId = useEditionIdRef()
const refPublique = computed(() => String(route.params.id))

// Modules actifs (et droits) de l'événement : clé partagée, que l'accueil rafraîchit après un
// changement de module.
const { data: acces } = useFetch<{ modules: Modules; droits: Droits }>(
  () => `/api/events/${refPublique.value}/acces-gestion`,
  { key: `acces-gestion-${refPublique.value}`, server: false }
)
const moduleBenevoles = computed(() => acces.value?.modules.benevoles !== false)
const carteDuSite = computed(() => !!acces.value?.modules.carte && !!acces.value?.droits.modifier)
// Artistes et spectacles : module activé ET droit dédié (même règle qu'app1).
const artistesOuverts = computed(
  () => !!acces.value?.modules.artistes && !!acces.value?.droits.artistes
)
// Billetterie : module activé ET droit dédié (même règle qu'app1).
const billetterieOuverte = computed(
  () => !!acces.value?.modules.billetterie && !!acces.value?.droits.billetterie
)
// Repas : module activé ET (droit dédié OU validation des repas — responsable de l'équipe qui
// valide, ou bénévole en créneau actif). La configuration et les listes restent au droit dédié.
const gereLesRepas = computed(() => !!acces.value?.droits.repas)
const valideLesRepas = ref(false)
const repasOuverts = computed(
  () => !!acces.value?.modules.repas && (gereLesRepas.value || valideLesRepas.value)
)
// Stock : le droit dédié, ou responsable d'une équipe de bénévoles (même règle qu'app1,
// `canAccessStock`) — un responsable va chercher le matériel de son équipe.
const stockOuvert = computed(
  () => !!acces.value?.modules.stock && (!!acces.value?.droits.stock || estResponsable.value)
)
const edition = computed(() => editionStore.getEditionById(editionId.value))
const peutGerer = computed(() => editionStore.canManageVolunteers(edition.value))
const estResponsable = ref(false)

const dates = computed(() => (edition.value ? periodeEvenement(edition.value) : ''))

/** Mêmes compteurs qu'app1, demandés seulement à qui a le droit de les voir (sinon des 403). */
const compteursVisibles = computed(() =>
  peutGerer.value ? ['benevoles-candidatures', 'benevoles-echanges'] : []
)

function pastilleMenu(...cles: string[]) {
  const compte = cumulerCompteurs(cles.map((cle) => compteurNavigation(cle).value))
  const pastille = pastilleNavigation(compte, { seuilUrgent: 1 })
  if (!pastille) return {}
  const couleur = couleurPastille(pastille.ton)
  return { badge: { label: pastille.texte, color: couleur }, chip: { color: couleur } }
}

const sectionsOuvertes = ref(['benevoles'])

const navigation = computed<NavigationMenuItem[][]>(() => {
  const base = `/events/${refPublique.value}/gestion/volunteers`
  const enfants: NavigationMenuItem[] = []

  if (peutGerer.value) {
    enfants.push(
      { label: 'Configuration', icon: 'i-heroicons-cog-6-tooth', to: `${base}/config` },
      {
        label: 'Page bénévole',
        icon: 'i-heroicons-clipboard-document-list',
        to: `${base}/page`,
      },
      { label: 'Formulaire de candidature', icon: 'i-heroicons-megaphone', to: `${base}/form` },
      {
        label: 'Candidatures',
        icon: 'i-heroicons-document-text',
        to: `${base}/applications`,
        ...pastilleMenu('benevoles-candidatures'),
      },
      { label: 'Équipes', icon: 'i-heroicons-user-group', to: `${base}/teams` },
      {
        label: 'Répartition dans les équipes',
        icon: 'i-heroicons-rectangle-group',
        to: `${base}/team-distribution`,
      },
      { label: 'Planning', icon: 'i-heroicons-calendar-days', to: `${base}/planning` }
    )
    if (edition.value?.volunteersSwapsEnabled !== false) {
      enfants.push({
        label: 'Échanges de créneaux',
        icon: 'i-lucide-arrow-left-right',
        to: `${base}/swaps`,
        ...pastilleMenu('benevoles-echanges'),
      })
    }
  }

  if (peutGerer.value || estResponsable.value) {
    enfants.push({ label: 'Notifications', icon: 'i-heroicons-bell', to: `${base}/notifications` })
    if (edition.value?.volunteersHasFloatingTeam) {
      enfants.push({ label: 'Renforts', icon: 'i-heroicons-bolt', to: `${base}/renforts` })
    }
  }

  return [
    [
      {
        label: 'Accueil',
        icon: 'i-heroicons-home',
        to: `/events/${refPublique.value}/gestion`,
        exact: true,
      },
      {
        label: "Informations de l'événement",
        icon: 'i-lucide-settings',
        to: `/events/${refPublique.value}/gestion/evenement`,
      },
      {
        label: 'Organisateurs',
        icon: 'i-heroicons-user-plus',
        to: `/events/${refPublique.value}/gestion/organisateurs`,
      },
      // Carte du site : module activé ET droit « modifier l'événement » (même règle qu'app1).
      ...(carteDuSite.value
        ? [
            {
              label: 'Carte du site',
              icon: 'i-heroicons-map',
              to: `/events/${refPublique.value}/gestion/map`,
            },
          ]
        : []),
    ],
    ...(billetterieOuverte.value
      ? [
          [
            {
              label: 'Billetterie',
              icon: 'i-heroicons-ticket',
              value: 'billetterie',
              children: [
                {
                  label: 'Configuration',
                  icon: 'i-heroicons-cog-6-tooth',
                  to: `/events/${refPublique.value}/gestion/ticketing/config`,
                },
                {
                  label: 'Lier une billetterie externe',
                  icon: 'i-heroicons-link',
                  to: `/events/${refPublique.value}/gestion/ticketing/external`,
                },
                {
                  label: 'Tarifs & options',
                  icon: 'i-heroicons-currency-euro',
                  to: `/events/${refPublique.value}/gestion/ticketing/tiers`,
                },
                {
                  label: 'Quotas',
                  icon: 'i-heroicons-chart-bar',
                  to: `/events/${refPublique.value}/gestion/ticketing/quotas`,
                },
                // Seulement si l'événement remet des articles (même condition qu'app1).
                ...(edition.value?.ticketingHandoutItemsEnabled !== false
                  ? [
                      {
                        label: 'Articles à remettre',
                        icon: 'i-heroicons-gift',
                        to: `/events/${refPublique.value}/gestion/ticketing/handout-items`,
                      },
                    ]
                  : []),
                {
                  label: 'Commandes',
                  icon: 'i-heroicons-shopping-cart',
                  to: `/events/${refPublique.value}/gestion/ticketing/orders`,
                },
                {
                  label: 'Compteurs',
                  icon: 'i-heroicons-calculator',
                  to: `/events/${refPublique.value}/gestion/ticketing/counter`,
                },
                {
                  label: 'Statistiques',
                  icon: 'i-heroicons-chart-bar',
                  to: `/events/${refPublique.value}/gestion/ticketing/stats`,
                },
                {
                  label: "Contrôle d'accès",
                  icon: 'i-heroicons-shield-check',
                  to: `/events/${refPublique.value}/gestion/ticketing/access-control`,
                },
              ],
            },
          ],
        ]
      : []),
    ...(artistesOuverts.value
      ? [
          [
            {
              label: 'Artistes',
              icon: 'i-heroicons-star',
              value: 'artistes',
              children: [
                {
                  label: 'Gestion des artistes',
                  icon: 'i-heroicons-users',
                  to: `/events/${refPublique.value}/gestion/artists`,
                  exact: true,
                },
                {
                  label: 'Spectacles',
                  icon: 'i-heroicons-sparkles',
                  to: `/events/${refPublique.value}/gestion/artists/shows`,
                },
                {
                  label: 'Appels à spectacles',
                  icon: 'i-heroicons-megaphone',
                  to: `/events/${refPublique.value}/gestion/shows-call`,
                },
                {
                  label: 'Notifications aux artistes',
                  icon: 'i-heroicons-bell',
                  to: `/events/${refPublique.value}/gestion/artists/notifications`,
                },
              ],
            },
          ],
        ]
      : []),
    ...(repasOuverts.value
      ? [
          [
            {
              label: 'Repas',
              icon: 'i-heroicons-cake',
              value: 'repas',
              children: [
                ...(gereLesRepas.value
                  ? [
                      {
                        label: 'Configuration des repas',
                        icon: 'i-heroicons-cog-6-tooth',
                        to: `/events/${refPublique.value}/gestion/meals`,
                        exact: true,
                      },
                      {
                        label: 'Liste des repas',
                        icon: 'i-heroicons-list-bullet',
                        to: `/events/${refPublique.value}/gestion/meals/list`,
                      },
                      {
                        label: 'Doublons',
                        icon: 'i-heroicons-document-duplicate',
                        to: `/events/${refPublique.value}/gestion/meals/duplicates`,
                      },
                    ]
                  : []),
                {
                  label: 'Validation des repas',
                  icon: 'i-heroicons-check-badge',
                  to: `/events/${refPublique.value}/gestion/meals/validate`,
                },
              ],
            },
          ],
        ]
      : []),
    ...(stockOuvert.value
      ? [
          [
            {
              label: 'Stock matériel',
              icon: 'i-heroicons-archive-box',
              value: 'stock',
              children: [
                {
                  label: 'Groupes',
                  icon: 'i-heroicons-archive-box',
                  to: `/events/${refPublique.value}/gestion/stock`,
                  exact: true,
                },
                {
                  label: 'Emprunts',
                  icon: 'i-heroicons-hand-raised',
                  to: `/events/${refPublique.value}/gestion/stock/loans`,
                },
                {
                  label: 'Ce qui manque',
                  icon: 'i-heroicons-shopping-cart',
                  to: `/events/${refPublique.value}/gestion/stock/missing`,
                },
              ],
            },
          ],
        ]
      : []),
    // Sans aucun droit sur les bénévoles, la section n'apparaît pas (plutôt qu'un groupe vide).
    ...(enfants.length && moduleBenevoles.value
      ? [
          [
            {
              label: 'Bénévoles',
              icon: 'i-heroicons-hand-raised',
              value: 'benevoles',
              defaultOpen: true,
              children: enfants,
              ...pastilleMenu('benevoles-candidatures', 'benevoles-echanges'),
            },
          ],
        ]
      : []),
    ...(moduleBenevoles.value
      ? [
          [
            {
              label: 'Page publique des bénévoles',
              icon: 'i-heroicons-eye',
              to: `/events/${refPublique.value}/volunteers`,
            },
          ],
        ]
      : []),
  ]
})

onMounted(async () => {
  await editionStore.fetchEditionById(editionId.value).catch(() => null)
  ;[estResponsable.value, valideLesRepas.value] = await Promise.all([
    editionStore.isTeamLeader(editionId.value),
    editionStore.canAccessMealValidation(editionId.value),
  ])
  rafraichirCompteursNavigation({ editionId: editionId.value }, compteursVisibles.value)
})

watch(editionId, async (nouvelle) => {
  oublierCompteursNavigation()
  await editionStore.fetchEditionById(nouvelle).catch(() => null)
  rafraichirCompteursNavigation({ editionId: nouvelle }, compteursVisibles.value)
})
</script>
