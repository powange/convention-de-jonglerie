<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <!-- La marge négative annule, en mobile seulement, le rembourrage haut du gabarit : trente-deux
         pixels d'air au-dessus du titre, pris sur une carte qui vaut mieux qu'eux ici. -->
    <div v-else class="space-y-6 -mt-8 md:mt-0">
      <!-- En-tête avec navigation. Il se réduit tout seul en mobile hors de l'onglet « À propos ». -->
      <EditionHeader :edition="edition" current-page="map" />

      <!-- Tant que zones et marqueurs chargent, on ignore si la carte du site a du contenu, donc
           quelle vue retenir. Attendre évite de montrer une carte puis de basculer sur l'autre. -->
      <div v-if="siteMapLoading" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
      </div>

      <template v-else>
        <!-- Le sélecteur n'a de sens que si les deux cartes existent : sinon on affiche
             simplement celle qui est disponible. -->
        <UFieldGroup v-if="canSwitchView" size="sm">
          <UButton
            icon="i-lucide-layers"
            :color="activeView === 'site' ? 'primary' : 'neutral'"
            :variant="activeView === 'site' ? 'solid' : 'outline'"
            :label="$t('edition.site_map')"
            @click="selectedView = 'site'"
          />
          <UButton
            icon="i-lucide-map"
            :color="activeView === 'google' ? 'primary' : 'neutral'"
            :variant="activeView === 'google' ? 'solid' : 'outline'"
            :label="$t('map.view_external')"
            @click="selectedView = 'google'"
          />
        </UFieldGroup>

        <!-- Carte externe de l'organisateur. Un organisateur qui a déjà cartographié son terrain
             sur Google n'a pas à tout refaire ici. -->
        <div v-if="activeView === 'google'" :ref="(el) => enregistrerSection(el)">
          <UCard
            class="w-full h-(--carte-hauteur) lg:h-[calc(100vh-var(--ui-header-height)-14rem)]"
            :style="{ '--carte-hauteur': carteHauteur }"
            :ui="{ body: 'h-full p-0' }"
          >
            <iframe
              :src="externalMapEmbedUrl!"
              class="h-full w-full rounded-lg border-0"
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              :title="$t('edition.site_map')"
            />
          </UCard>
        </div>

        <!-- Données servies par le cache hors ligne : le dire plutôt que de laisser croire
             qu'elles sont fraîches. -->
        <UAlert
          v-if="activeView === 'site' && showingCachedMap"
          icon="i-lucide-cloud-off"
          color="warning"
          variant="soft"
          :title="$t('map.offline_title')"
          :description="$t('map.offline_description')"
        />

        <!-- Message si pas de zones ni de markers -->
        <UAlert
          v-if="activeView === 'site' && !hasSiteMap"
          icon="i-lucide-map"
          color="info"
          variant="soft"
          :title="$t('map.no_items')"
        />

        <!-- Contenu principal -->
        <div
          v-if="activeView === 'site' && hasSiteMap"
          class="grid grid-cols-1 gap-6 lg:grid-cols-3"
        >
          <!-- Carte. En mobile elle sort du cadre : les marges négatives annulent le rembourrage
               latéral du gabarit, et la carte perd bordure et coins arrondis pour occuper toute la
               largeur de l'écran. `w-auto` est nécessaire — avec `w-full` la largeur resterait
               celle du conteneur, et les marges négatives ne feraient que la décaler. -->
          <div :ref="(el) => enregistrerSection(el)" class="lg:col-span-2 relative z-0">
            <UCard
              class="w-auto -mx-4 sm:-mx-6 rounded-none ring-0 h-(--carte-hauteur) lg:mx-0 lg:w-full lg:rounded-lg lg:ring-1 lg:h-[calc(100vh-var(--ui-header-height)-16rem)]"
              :style="{ '--carte-hauteur': carteHauteur }"
              :ui="{ body: 'h-full p-0' }"
            >
              <div ref="mapContainerRef" class="h-full w-full rounded-none lg:rounded-lg" />
            </UCard>
          </div>

          <!-- Légende. En dessous de `lg`, elle vit dans le panneau du bas : la laisser aussi dans
               le flux la ferait exister en double, avec deux états de filtres divergents. -->
          <div class="hidden lg:block space-y-4">
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-layers" class="h-5 w-5" />
                  <h2 class="font-semibold">{{ $t('map.zones_list') }}</h2>
                </div>
              </template>

              <ZonesLegend
                :zones="zones"
                :markers="markers"
                :editable="false"
                @focus="handleFocusZone"
                @focus-marker="handleFocusMarker"
                @toggle-visibility="handleToggleVisibility"
              />
            </UCard>
          </div>
        </div>

        <!-- Panneau du bas, en mobile uniquement. Ni voile ni mode modal : on doit pouvoir
             déplacer la carte pendant que le panneau reste ouvert, comme sur une appli de
             cartographie. Non refermable non plus — le cran le plus bas fait office de poignée,
             et une fermeture complète priverait des filtres sans moyen évident de les rouvrir. -->
        <UDrawer
          v-if="estMobile && activeView === 'site' && hasSiteMap"
          v-model:open="panneauOuvert"
          :snap-points="CRANS_PANNEAU"
          :modal="false"
          :overlay="false"
          :dismissible="false"
          :ui="UI_PANNEAU"
        >
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-layers" class="h-5 w-5" />
              <h2 class="font-semibold">{{ $t('map.zones_list') }}</h2>
              <UBadge color="neutral" variant="subtle" size="sm">
                {{ zones.length + markers.length }}
              </UBadge>
            </div>
          </template>

          <template #body>
            <ZonesLegend
              :zones="zones"
              :markers="markers"
              :editable="false"
              @focus="handleFocusZone"
              @focus-marker="handleFocusMarker"
              @toggle-visibility="handleToggleVisibility"
            />
          </template>
        </UDrawer>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import ZonesLegend from '~/components/edition/zones/ZonesLegend.vue'
import type { EditionMarker } from '~/composables/useEditionMarkers'
import type { EditionZone } from '~/composables/useEditionZones'
import { useEditionStore } from '~/stores/editions'
import { getEditionDisplayName } from '~/utils/editionName'
import {
  buildMarkerAttachmentHtml,
  buildZoneAttachmentHtml,
  groupMarkersByZone,
  zoneNavigationTarget,
} from '~/utils/map-zone-attachment'
import { escapeHtml } from '~/utils/mapMarkers'

import type { ExternalMapProvider } from '~~/shared/utils/external-map'

import { externalMapEmbedUrl as buildExternalMapEmbedUrl } from '~~/shared/utils/external-map'

const route = useRoute()
const { t, locale } = useI18n()
const editionStore = useEditionStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Query params pour focus automatique sur une zone ou un marqueur
const focusZoneId = computed(() => {
  const val = route.query.focusZone
  return val ? parseInt(val as string) : null
})
const focusMarkerId = computed(() => {
  const val = route.query.focusMarker
  return val ? parseInt(val as string) : null
})

// Métadonnées SEO
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))

const seoTitle = computed(() => {
  if (!edition.value) return t('edition.map')
  return `${t('edition.map')} - ${editionName.value}`
})

const seoDescription = computed(() => {
  if (!edition.value) return ''
  return `${t('edition.map')} - ${editionName.value}, ${edition.value.city || ''}`
})

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
})
const loading = computed(() => editionStore.loading)

// Carte externe éventuelle de l'organisateur. Seule la référence est stockée : l'URL intégrable
// se reconstruit ici, ce qui évite d'avoir figé un cadrage ou un numéro de compte en base.
const externalMapEmbedUrl = computed(() => {
  const { externalMapProvider: provider, externalMapRef: mapRef } = edition.value ?? {}
  if (!provider || !mapRef) return null
  return buildExternalMapEmbedUrl({ provider: provider as ExternalMapProvider, ref: mapRef })
})

// Zones
const { zones, loading: zonesLoading, servedFromCache: zonesFromCache } = useEditionZones(editionId)

// Markers
const {
  markers,
  loading: markersLoading,
  servedFromCache: markersFromCache,
} = useEditionMarkers(editionId)

/**
 * Vrai dès qu'une des deux listes vient du cache hors ligne.
 *
 * Sans ce repère, rien ne distingue une carte à jour d'une carte gardée depuis la dernière
 * visite : c'est la même page, avec les mêmes éléments. Le dire évite de laisser quelqu'un se
 * fier à un plan qui a pu changer depuis.
 */
const showingCachedMap = computed(() => zonesFromCache.value || markersFromCache.value)

const siteMapLoading = computed(() => zonesLoading.value || markersLoading.value)
const hasSiteMap = computed(() => zones.value.length > 0 || markers.value.length > 0)

/**
 * Vue choisie par le visiteur. Volontairement non mémorisée : c'est un choix de consultation, pas
 * un réglage, et le retenir créerait un état invisible difficile à comprendre au retour.
 */
const selectedView = ref<'site' | 'google'>('site')

/** Le sélecteur n'a de sens que si les deux cartes existent. */
const canSwitchView = computed(() => !!externalMapEmbedUrl.value && hasSiteMap.value)

/**
 * Vue réellement affichée. Le choix du visiteur ne s'applique que lorsqu'il y a un choix à faire :
 * sans carte externe on montre celle du site, et sans contenu sur celle du site on montre
 * l'externe — sinon la page paraîtrait vide alors qu'une carte existe.
 */
const activeView = computed<'site' | 'google'>(() => {
  if (!externalMapEmbedUrl.value) return 'site'
  if (!hasSiteMap.value) return 'google'
  return selectedView.value
})

// Map (mode lecture seule)
const mapContainerRef = ref<HTMLElement | null>(null)

// Flag pour ne centrer la carte qu'une seule fois (évite le recentrage après navigation utilisateur)
const initialViewSet = ref(false)

const {
  map,
  addZones,
  addMarkers,
  focusOnZone,
  focusOnMarker,
  setPopupExtra,
  setZoneNavigationTarget,
  showZone,
  hideZone,
  showMarker,
  hideMarker,
  fitBoundsToItems,
} = useLeafletEditable(mapContainerRef, {
  center: computed(() => {
    if (edition.value?.latitude && edition.value?.longitude) {
      return [edition.value.latitude, edition.value.longitude]
    }
    return [46.603354, 1.888334]
  }).value,
  zoom: edition.value?.latitude ? 15 : 6,
  editable: false,
  typeLabel: (type: string) => t(`map.types.${type.toLowerCase()}`),
  popupLabels: { navigate: t('map.popup_navigate') },
})

// Passer sur la carte Google démonte celle du site. Au retour, une nouvelle instance est créée :
// sans cette remise à zéro elle s'ouvrirait sur le centre par défaut plutôt que sur le contenu.
watch(
  () => map.value,
  (instance) => {
    if (!instance) initialViewSet.value = false
  }
)

// Ajouter les zones à la carte quand elles sont chargées ET que la carte est prête
// Note: addZones vérifie déjà les doublons via polygons.value.has(zone.id)
watch(
  [zones, map],
  ([newZones, newMap]) => {
    if (newMap && newZones.length > 0) {
      addZones(
        newZones.map((z) => ({
          id: z.id,
          name: z.name,
          description: z.description,
          color: z.color,
          coordinates: z.coordinates,
          zoneTypes: z.zoneTypes,
          order: z.order,
        }))
      )
    }
  },
  { immediate: true }
)

// Ajouter les markers à la carte quand ils sont chargés ET que la carte est prête
// Note: addMarkers vérifie déjà les doublons via leafletMarkers.value.has(marker.id)
watch(
  [markers, map],
  ([newMarkers, newMap]) => {
    if (newMap && newMarkers.length > 0) {
      addMarkers(
        newMarkers.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          latitude: m.latitude,
          longitude: m.longitude,
          markerTypes: m.markerTypes,
          color: m.color,
          order: m.order,
        }))
      )
    }
  },
  { immediate: true }
)

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId.value, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
})

// Adapter le zoom pour afficher tous les éléments (une seule fois)
// Si un focus spécifique est demandé via query param, ne pas centrer (le focus prend le relais)
// nextTick garantit que les watches addZones/addMarkers ont peuplé les structures Leaflet
watch(
  [zones, markers, map],
  async ([newZones, newMarkers, newMap]) => {
    if (!initialViewSet.value && newMap && (newZones.length > 0 || newMarkers.length > 0)) {
      if (!focusZoneId.value && !focusMarkerId.value) {
        await nextTick()
        fitBoundsToItems()
      }
      initialViewSet.value = true
    }
  },
  { immediate: true }
)

// Focus automatique sur une zone/marqueur via query params
const focusApplied = ref(false)
watch(
  [zones, markers, map],
  ([newZones, newMarkers, newMap]) => {
    if (focusApplied.value || !newMap) return

    if (focusZoneId.value && newZones.some((z) => z.id === focusZoneId.value)) {
      focusOnZone(focusZoneId.value)
      focusApplied.value = true
    } else if (focusMarkerId.value && newMarkers.some((m) => m.id === focusMarkerId.value)) {
      focusOnMarker(focusMarkerId.value)
      focusApplied.value = true
    }
  },
  { immediate: true }
)

// Spectacles publics — affichés dans les popups des zones/marqueurs
const { data: publicShows } = useApiFetch<any[]>(`/api/editions/${editionId.value}/shows/public`, {
  lazy: true,
  transform: (payload: any) => payload?.shows || [],
})

const showsByZone = computed(() => {
  const map = new Map<number, any[]>()
  if (!publicShows.value) return map
  for (const show of publicShows.value) {
    if (show.zoneId) {
      if (!map.has(show.zoneId)) map.set(show.zoneId, [])
      map.get(show.zoneId)!.push(show)
    }
  }
  return map
})

const showsByMarker = computed(() => {
  const map = new Map<number, any[]>()
  if (!publicShows.value) return map
  for (const show of publicShows.value) {
    if (show.markerId) {
      if (!map.has(show.markerId)) map.set(show.markerId, [])
      map.get(show.markerId)!.push(show)
    }
  }
  return map
})

const formatPopupDateTime = (dateTimeStr: string) => {
  const date = new Date(dateTimeStr)
  const localeCode = locale.value === 'fr' ? 'fr-FR' : locale.value
  const day = date.toLocaleDateString(localeCode, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const time = date.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })
  return `${day} ${time}`
}

// Workshops — affichés dans les popups des zones/marqueurs.
// On ne charge les ateliers que si le module est activé pour l'édition : inutile
// d'appeler l'API (qui renverrait 403) quand la fonctionnalité est désactivée.
const workshopsEnabled = computed(() => edition.value?.workshopsEnabled === true)

const { data: workshops, execute: loadWorkshops } = useApiFetch<any[]>(
  `/api/editions/${editionId.value}/workshops`,
  {
    lazy: true,
    immediate: false,
    transform: (payload: any) => payload?.workshops || payload || [],
  }
)

// L'édition est chargée de façon asynchrone (store / onMounted) : on déclenche le
// fetch dès que le flag d'activation est connu et vrai. `workshopsEnabled` ne
// repasse jamais à true → false ici, donc l'appel n'est effectué qu'une fois.
watch(
  workshopsEnabled,
  (enabled) => {
    if (enabled) loadWorkshops()
  },
  { immediate: true }
)

// Filtrer les workshops non terminés
const upcomingWorkshops = computed(() => {
  if (!workshops.value) return []
  const now = new Date()
  return workshops.value.filter((ws) => new Date(ws.endDateTime) > now)
})

const workshopsByZone = computed(() => {
  const m = new Map<number, any[]>()
  for (const ws of upcomingWorkshops.value) {
    const zId = ws.location?.zoneId
    if (zId) {
      if (!m.has(zId)) m.set(zId, [])
      m.get(zId)!.push(ws)
    }
  }
  return m
})

const workshopsByMarker = computed(() => {
  const m = new Map<number, any[]>()
  for (const ws of upcomingWorkshops.value) {
    const mId = ws.location?.markerId
    if (mId) {
      if (!m.has(mId)) m.set(mId, [])
      m.get(mId)!.push(ws)
    }
  }
  return m
})

const buildItemsPopupHtml = (shows: any[], wsItems: any[]) => {
  let html = ''

  if (shows.length > 0) {
    const sorted = [...shows].sort(
      (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    )
    html += '<hr style="margin: 8px 0; border-color: #e5e7eb;"/>'
    html += `<div style="margin-top: 4px;"><strong>🎭 ${escapeHtml(t('edition.public_shows'))}</strong>`
    html += '<div style="margin-top: 4px; font-size: 13px;">'
    for (const show of sorted) {
      html += `<div style="margin-top: 4px;">• ${escapeHtml(show.title)} — ${formatPopupDateTime(show.startDateTime)}`
      if (show.duration) html += ` (${show.duration} min)`
      html += '</div>'
    }
    html += '</div></div>'
  }

  if (wsItems.length > 0) {
    const sorted = [...wsItems].sort(
      (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    )
    html += '<hr style="margin: 8px 0; border-color: #e5e7eb;"/>'
    html += `<div style="margin-top: 4px;"><strong>🎓 ${escapeHtml(t('workshops.page_title'))}</strong>`
    html += '<div style="margin-top: 4px; font-size: 13px;">'
    for (const ws of sorted) {
      html += `<div style="margin-top: 4px;">• ${escapeHtml(ws.title)} — ${formatPopupDateTime(ws.startDateTime)}`
      html += '</div>'
    }
    html += '</div></div>'
  }

  return html
}

// Mettre à jour les popups quand les spectacles ou workshops sont chargés
watch(
  [publicShows, workshops, zones, markers, map],
  () => {
    if (!map.value) return

    // Un seul `extra` par élément : le rattachement et les spectacles se composent, sinon le
    // dernier appel effacerait le précédent.
    const attachedByZone = groupMarkersByZone(markers.value)
    const zoneNameById = new Map(zones.value.map((zone) => [zone.id, zone.name]))

    for (const zone of zones.value) {
      const zoneShows = showsByZone.value.get(zone.id) || []
      const zoneWorkshops = workshopsByZone.value.get(zone.id) || []
      const attached = attachedByZone.get(zone.id)
      const attachmentHtml = buildZoneAttachmentHtml(attached, t('map.zone_entrances'))
      if (attachmentHtml || zoneShows.length > 0 || zoneWorkshops.length > 0) {
        setPopupExtra(
          'zone',
          zone.id,
          attachmentHtml + buildItemsPopupHtml(zoneShows, zoneWorkshops)
        )
      }
      setZoneNavigationTarget(zone.id, zoneNavigationTarget(attached))
    }

    for (const marker of markers.value) {
      const markerShows = showsByMarker.value.get(marker.id) || []
      const markerWorkshops = workshopsByMarker.value.get(marker.id) || []
      const attachmentHtml = marker.zoneId
        ? buildMarkerAttachmentHtml(zoneNameById.get(marker.zoneId), t('map.marker_entrance_of'))
        : ''
      if (attachmentHtml || markerShows.length > 0 || markerWorkshops.length > 0) {
        setPopupExtra(
          'marker',
          marker.id,
          attachmentHtml + buildItemsPopupHtml(markerShows, markerWorkshops)
        )
      }
    }
  },
  { immediate: true }
)

/**
 * En dessous de `lg`, la carte occupe tout ce qui reste sous elle jusqu'au bas de l'écran.
 *
 * La hauteur est **mesurée** et non calculée : ce qui la surplombe — barre d'onglets de l'édition,
 * sélecteur de vue, encart hors ligne — change de hauteur selon l'édition et la largeur de
 * l'écran. Une formule en dur se décalerait au premier onglet ajouté.
 *
 * `dvh` et non `vh` : sur mobile, la barre d'URL se rétracte au défilement, et `vh` fige la
 * hauteur d'avant rétractation — la carte dépasserait alors du bas.
 */
const mapSectionRef = ref<HTMLElement | null>(null)
const estMobile = useMediaQuery('(max-width: 1023px)')

/**
 * Une ref de fonction plutôt qu'un `ref="…"` nommé : la section n'existe qu'une fois zones et
 * marqueurs chargés, donc bien après `onMounted`, et deux branches d'affichage se la partagent.
 */
const enregistrerSection = (el: unknown) => {
  if (el) {
    mapSectionRef.value = el as HTMLElement
    return
  }
  // Vue passe `null` au démontage. Ne pas effacer aveuglément : en basculant d'une vue à l'autre,
  // la nouvelle section s'enregistre parfois avant que l'ancienne ne se retire, et l'effacement
  // emporterait alors la référence qu'on vient d'obtenir. On ne libère que si l'élément retenu a
  // réellement quitté le document.
  if (mapSectionRef.value && !mapSectionRef.value.isConnected) mapSectionRef.value = null
}

/**
 * Position de la section, suivie en continu.
 *
 * Observée plutôt que mesurée à la main : au moment où l'élément entre dans le DOM, il n'est pas
 * encore positionné et toute mesure immédiate vaut zéro. `useElementBounding` s'appuie sur un
 * ResizeObserver et se remet à jour quand la géométrie change pour de bon — rotation de l'écran,
 * barre d'onglets qui passe sur deux lignes, encart hors ligne qui apparaît.
 */
const { top: hautSection } = useElementBounding(mapSectionRef)

const carteHauteur = computed(() => {
  // `hautSection` est relatif à la fenêtre : le défilement s'y ajoute pour obtenir une distance
  // au haut du document, qui elle ne bouge pas quand on fait défiler la page.
  const haut = Math.round(hautSection.value + (import.meta.client ? window.scrollY : 0))
  // Zéro signale une mise en page pas encore faite : s'y fier donnerait une carte haute d'un écran
  // entier, débordant largement par le bas.
  if (haut <= 0) return '24rem'
  // Un plancher évite une carte inutilisable sur un écran très court ou en paysage.
  return `max(20rem, calc(100dvh - ${haut}px))`
})

/**
 * Crans du panneau, du plus discret au plein écran.
 *
 * Le premier est en pixels : une poignée doit garder la même hauteur quel que soit le téléphone,
 * là où un pourcentage la ferait maigrir sur les petits écrans — précisément ceux où elle doit
 * rester saisissable.
 *
 * La valeur est calée sur le contenu : le bandeau de poignée occupe les 28 premiers pixels, le
 * titre s'arrête vers 80, et le premier filtre commence juste après. Le cran s'arrête avant lui —
 * au repos on voit la poignée et le titre, rien de tronqué. Vaul retranche 27 px entre la valeur
 * donnée et la hauteur réellement visible, d'où 111 pour 84 à l'écran.
 *
 * Cela suppose un titre sur une seule ligne. S'il venait à passer sur deux — traduction plus
 * longue, écran très étroit — il faudrait mesurer l'en-tête à l'exécution plutôt que de figer.
 *
 * Le cran actif n'est volontairement pas piloté depuis ici : lier `activeSnapPoint` figeait le
 * panneau entre deux crans dès qu'on le tirait ailleurs que par la poignée, et il y restait.
 * Mesuré : arrêt à 486 px, sans retour, là où vaul laissé libre revient proprement à 511.
 */
const CRANS_PANNEAU = ['111px', 0.5, 0.92]
const panneauOuvert = ref(true)

/**
 * Habillage du panneau.
 *
 * La poignée est étendue à toute la largeur : vaul cale sa zone de préhension dessus, et celle
 * d'origine — 48 px au centre — obligeait à viser une bande étroite juste au-dessus de la carte.
 * Un doigt qui la manquait tombait sur Leaflet, qui faisait défiler le plan au lieu d'ouvrir le
 * panneau. Mesuré : de 48 px de large à 390, et le panneau s'ouvre désormais depuis n'importe quel
 * point de la largeur. La barre visible est redessinée en pseudo-élément — elle reste un indice
 * sans redevenir la seule prise.
 */
const UI_PANNEAU = {
  content: 'lg:hidden',
  body: 'overflow-y-auto',
  // Bandeau de poignée resserré : la marge du thème (16 px) et une hauteur de 32 laissaient
  // 48 px de vide au-dessus du titre. Ramené à 28. La zone de préhension de vaul reste haute de
  // 44 px indépendamment de ce bandeau — on gagne du blanc sans rétrécir la cible tactile.
  //
  // Centrage par marge automatique et non par `flex` : le thème impose son propre mode d'affichage
  // à la poignée, et la barre visible se retrouvait plaquée contre le bord gauche.
  handle:
    "!mt-2 !w-full !h-5 !bg-transparent !rounded-none pt-2 before:content-[''] before:block " +
    'before:mx-auto before:w-12 before:h-1.5 before:rounded-full before:bg-accented',
}

/**
 * Leaflet garde en mémoire la taille de son conteneur : sans cet avertissement, il continue de
 * dessiner pour l'ancienne — tuiles manquantes en bas et clics décalés par rapport à ce qu'on voit.
 */
watch(carteHauteur, () =>
  nextTick(() => {
    // Le composable expose la carte en `readonly()`, ce qui efface le type de ses méthodes. Le
    // transtypage ne contourne pas une protection : il rend seulement visible une méthode que
    // l'instance possède bel et bien à l'exécution.
    const carte = map.value as { invalidateSize?: () => void } | null
    carte?.invalidateSize?.()
  })
)

const handleFocusZone = (zone: EditionZone) => {
  focusOnZone(zone.id)
}

const handleFocusMarker = (marker: EditionMarker) => {
  focusOnMarker(marker.id)
}

const handleToggleVisibility = (item: {
  id: number
  type: 'zone' | 'marker'
  visible: boolean
}) => {
  if (item.type === 'zone') {
    if (item.visible) {
      showZone(item.id)
    } else {
      hideZone(item.id)
    }
  } else {
    if (item.visible) {
      showMarker(item.id)
    } else {
      hideMarker(item.id)
    }
  }
}
</script>
