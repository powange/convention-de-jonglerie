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
              :to="`/events/${editionId}`"
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
 * Flowvent n'a qu'un module d'organisation, les bénévoles : la barre latérale n'en porte que les
 * entrées, dans l'ordre et sous les conditions d'app1 (échanges fermés → pas d'entrée ; renforts
 * seulement avec une équipe volante ; responsable d'équipe → notifications et renforts seuls).
 * Libellés en clair : Flowvent est en français seul, comme ses autres écrans.
 */
import type { NavigationMenuItem } from '@nuxt/ui'

import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const editionStore = useEditionStore()

const editionId = computed(() => Number(route.params.id))
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
  const base = `/events/${editionId.value}/gestion/volunteers`
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
        label: 'Bénévoles',
        icon: 'i-heroicons-hand-raised',
        value: 'benevoles',
        defaultOpen: true,
        children: enfants,
        ...pastilleMenu('benevoles-candidatures', 'benevoles-echanges'),
      },
    ],
    [
      {
        label: 'Page publique des bénévoles',
        icon: 'i-heroicons-eye',
        to: `/events/${editionId.value}/volunteers`,
      },
    ],
  ]
})

onMounted(async () => {
  await editionStore.fetchEditionById(editionId.value).catch(() => null)
  estResponsable.value = await editionStore.isTeamLeader(editionId.value)
  rafraichirCompteursNavigation({ editionId: editionId.value }, compteursVisibles.value)
})

watch(editionId, async (nouvelle) => {
  oublierCompteursNavigation()
  await editionStore.fetchEditionById(nouvelle).catch(() => null)
  rafraichirCompteursNavigation({ editionId: nouvelle }, compteursVisibles.value)
})
</script>
