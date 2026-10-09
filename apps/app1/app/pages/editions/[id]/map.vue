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
        <!--
          La barre d'actions de la carte. `flex-wrap` et non une rangée figée : sur un téléphone,
          le sélecteur de vue et le bouton d'export ne tiennent pas côte à côte.
        -->
        <div
          v-if="canSwitchView || (activeView === 'site' && hasSiteMap)"
          class="flex flex-wrap items-center gap-2"
        >
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

          <!--
            Export KML de la carte, pour l'ouvrir dans Google Earth ou une application de
            randonnée — sur place, souvent sans réseau.

            ⚠️ IL N'ÉTAIT PROPOSÉ NULLE PART. Le point d'API existait, était écrit pour le public
            et testé pour l'accès public — mais aucun écran ne le référençait, et le middleware
            répondait 401 aux visiteurs faute d'inscription dans `public-routes.ts`. Une
            fonctionnalité complète et inatteignable.

            Un lien et non un `@click` : le navigateur enchaîne le téléchargement lui-même, là
            qu'une ouverture de fenêtre par script se heurte aux bloqueurs.

            📍 Le nom de cette fonction de fenêtre n'est pas écrit entre accents graves à dessein :
            `check-i18n` lit tout mot pointé ainsi comme une clé de traduction manquante. Troisième
            fois que ce faux positif se présente dans ce dépôt.
          -->
          <UButton
            v-if="activeView === 'site' && hasSiteMap"
            :to="`/api/editions/${editionId}/export.kml`"
            external
            target="_blank"
            icon="i-lucide-download"
            variant="outline"
            color="neutral"
            size="sm"
            :label="$t('map.export_kml')"
          />
        </div>

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
          :active-snap-point="cranImpose"
          :modal="false"
          :overlay="false"
          :dismissible="false"
          :ui="UI_PANNEAU"
          @drag="rendreLaMain"
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
  buildItemsPopupHtml,
  buildMarkerAttachmentHtml,
  buildZoneAttachmentHtml,
  groupMarkersByZone,
  zoneNavigationTarget,
} from '~/utils/map-zone-attachment'

import type { ExternalMapProvider } from '~~/shared/utils/external-map'

import { externalMapEmbedUrl as buildExternalMapEmbedUrl } from '~~/shared/utils/external-map'
import { formaterHeure, formaterJournee } from '~~/shared/utils/fuseau-edition'
// ⚠️ Import EXPLICITE : les utils de `shared/` ne sont pas auto-importés — `program.vue` importe
// `estTermine` de la même façon. Sans cette ligne, le filtre lèverait au premier popup.
import { estTermine } from '~~/shared/utils/program-timeline'

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
const {
  zones,
  loading: zonesLoading,
  servedFromCache: zonesFromCache,
  statutErreur: statutZones,
} = useEditionZones(editionId)

// Markers
const {
  markers,
  loading: markersLoading,
  servedFromCache: markersFromCache,
  statutErreur: statutMarqueurs,
} = useEditionMarkers(editionId)

/**
 * Une carte non publique se solde par un 404, pas par une carte vide.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. L'interrupteur « Rendre la carte publique » n'était respecté que par
 * l'en-tête, qui masquait l'onglet. Cette page ne vérifiait rien et affichait zones et repères dès
 * qu'ils existaient : un visiteur qui connaissait l'adresse voyait une carte en cours de
 * préparation, ses repères de service et ses zones « espace interdit » comprises.
 *
 * La garde qui compte est celle du SERVEUR, désormais posée sur les deux points d'API. Celle-ci
 * n'est que la conséquence visible : sans elle, le visiteur recevrait un 404 de l'API et lirait
 * une carte vide, ce qui se comprend comme « l'organisation n'a rien placé » — faux, et
 * décourageant d'y revenir.
 *
 * `showError` et non `throw createError` : les deux listes sont chargées APRÈS le montage, donc
 * bien après l'exécution du `setup`. Lever ici n'aurait aucun effet.
 */
watch([statutZones, statutMarqueurs], ([zonesStatut, marqueursStatut]) => {
  if (zonesStatut === 404 || marqueursStatut === 404) {
    showError({ statusCode: 404, statusMessage: t('map.not_public'), fatal: true })
  }
})

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
  setView,
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

/*
 * ⚠️ Le centre et le zoom passés ci-dessus sont lus UNE SEULE FOIS, au `setup` (`computed(…).value`),
 * alors que l'édition n'arrive qu'en `onMounted`. À froid, la carte s'ouvrait donc sur la France au
 * zoom 6. Ce composable la recentre dès que le lieu est connu — et seulement s'il n'y a rien à
 * cadrer, pour ne pas lutter contre `fitBoundsToItems`.
 */
useCadrageSurLEdition({
  map,
  latitude: computed(() => edition.value?.latitude),
  longitude: computed(() => edition.value?.longitude),
  nombreDElements: computed(() => zones.value.length + markers.value.length),
  cadrageDejaFait: initialViewSet,
  setView,
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

/*
 * LA FRISE ENTIÈRE, EN UN SEUL APPEL.
 *
 * ⚠️ CE BLOC REMPLACE DEUX REQUÊTES — `/shows/public` et `/workshops` — et répare au passage un
 * manque : les ÉLÉMENTS LIBRES du programme (un repas, une scène ouverte, l'ouverture de
 * l'accueil) se rattachent à une zone ou à un repère comme les deux autres sources, et
 * n'apparaissaient dans AUCUN popup.
 *
 * `/program` rend les trois sources, chacune sous son propre interrupteur de module et avec le
 * même filtre `isPublic` pour qui n'édite pas. Une requête de moins, et trois sources au lieu de
 * deux.
 *
 * ⚠️⚠️ L'HISTOIRE DE CE BLOC COMMANDE LA PRUDENCE SUR LES CLÉS. Une version précédente ne
 * montrait rien, pour deux raisons cumulées et toutes deux muettes : le point d'API n'était pas
 * public (401 pour un visiteur), et le `transform` lisait `payload?.shows` là où la réponse porte
 * `{ performances }` — « pas d'erreur, juste des popups sans spectacle ».
 *
 * Deux vérifications faites AVANT d'écrire ce bloc, précisément pour ne pas ajouter un troisième
 * épisode :
 *
 * 1. `construireFriseProgramme` APLATIT le rattachement — `zone: enLieuCarte(a.location?.zone)`
 *    pour un atelier, dont la zone passe par son lieu. Lire `e.zone` suffit donc pour les trois
 *    sources ; lire `e.location?.zone` aurait fait disparaître les spectacles, et l'inverse les
 *    ateliers.
 * 2. l'API rend `zone`/`repere` comme OBJETS, quand le popup ne travaille qu'avec des
 *    identifiants — d'où la mise à plat ici, seul endroit où les deux formes se rencontrent.
 */
interface EntreeDePopup {
  titre: string
  debut: string
  fin: string | null
  duree?: number | null
  source: string
  zoneId: number | null
  markerId: number | null
}

const { data: frise } = useApiFetch<{ entrees: EntreeDePopup[]; fuseau: string | null }>(
  `/api/editions/${editionId.value}/program`,
  {
    lazy: true,
    transform: (payload: any) => ({
      entrees: ((payload?.data?.entrees ?? payload?.entrees ?? []) as any[]).map((e) => ({
        titre: e.titre,
        debut: e.debut,
        fin: e.fin ?? null,
        duree: e.duree ?? e.duration ?? null,
        source: e.source,
        zoneId: e.zone?.id ?? null,
        markerId: e.repere?.id ?? null,
      })),
      fuseau: payload?.data?.fuseau ?? payload?.fuseau ?? null,
    }),
  }
)

/**
 * Ce qui n'est pas encore terminé.
 *
 * ⚠️ UN CHANGEMENT ASSUMÉ : les spectacles étaient listés SANS filtre de temps, les ateliers
 * seulement « à venir ». Les trois sources suivent désormais la même règle. Un popup qui annonce
 * un spectacle terminé la veille est du bruit, et deux règles pour une même liste faisaient une
 * incohérence de plus sur un écran qui en comptait déjà.
 *
 * Le fuseau vient de l'API et non de l'édition : celle-ci n'est chargée qu'après le montage, si
 * bien que le premier calcul se ferait dans le fuseau du navigateur.
 */
const entreesAVenir = computed(() => {
  const maintenant = new Date()
  return (frise.value?.entrees ?? []).filter(
    (e) => !estTermine(e as never, maintenant, frise.value?.fuseau ?? fuseauDeLEdition.value)
  )
})

const grouperParLieu = (cle: 'zoneId' | 'markerId') => {
  const groupes = new Map<number, EntreeDePopup[]>()
  for (const entree of entreesAVenir.value) {
    const id = entree[cle]
    if (!id) continue
    if (!groupes.has(id)) groupes.set(id, [])
    groupes.get(id)!.push(entree)
  }
  return groupes
}

const parZone = computed(() => grouperParLieu('zoneId'))
const parRepere = computed(() => grouperParLieu('markerId'))

/**
 * L'horaire d'un spectacle ou d'un atelier dans un popup, AU FUSEAU DE L'ÉDITION.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. Ces popups appelaient `toLocaleDateString`/`toLocaleTimeString` sans
 * fuseau : l'heure du NAVIGATEUR. Le programme, lui, formate tout au fuseau de l'édition. Un
 * participant qui prépare son voyage depuis un autre fuseau lisait donc « Gala — sam. 12 juil.
 * 21:00 » sur le programme et « 22:00 » dans le popup de la même salle, sans rien pour dire
 * laquelle croire.
 *
 * Les deux surfaces montrent la même chose : elles doivent l'écrire pareil.
 *
 * `fuseauDeLEdition` peut être `null` — une édition sur deux ne le renseigne pas. Les utilitaires
 * retombent alors sur le fuseau du lecteur, c'est-à-dire le comportement d'avant : on ne dégrade
 * rien, et on n'invente pas un lieu qu'on ignore.
 */
const fuseauDeLEdition = computed(() => edition.value?.timezone ?? null)

/** Ce que le composeur de popups a besoin de savoir, et qu'il ne peut pas deviner. */
const libellesDePopup = () => ({
  titreDeSource: (source: string) => t(`program.source.${source}`),
  formaterHorodatage: formatPopupDateTime,
})

const formatPopupDateTime = (dateTimeStr: string) => {
  const jour = formaterJournee(dateTimeStr, fuseauDeLEdition.value, locale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const heure = formaterHeure(dateTimeStr, fuseauDeLEdition.value, locale.value)
  return `${jour} ${heure}`
}

// Mettre à jour les popups quand les spectacles ou workshops sont chargés
/*
 * ⚠️ `edition` FAIT PARTIE DES SOURCES, et c'est indispensable depuis que les horaires suivent son
 * fuseau : l'édition est chargée APRÈS le montage, donc les premiers popups seraient composés
 * avec `null` et garderaient l'heure du navigateur jusqu'à ce qu'autre chose les fasse recalculer.
 */
watch(
  [entreesAVenir, zones, markers, map, edition],
  () => {
    if (!map.value) return

    // Un seul `extra` par élément : le rattachement et les spectacles se composent, sinon le
    // dernier appel effacerait le précédent.
    const attachedByZone = groupMarkersByZone(markers.value)
    const zoneNameById = new Map(zones.value.map((zone) => [zone.id, zone.name]))

    for (const zone of zones.value) {
      const duLieu = parZone.value.get(zone.id) || []
      const attached = attachedByZone.get(zone.id)
      const attachmentHtml = buildZoneAttachmentHtml(attached, t('map.zone_entrances'))
      if (attachmentHtml || duLieu.length > 0) {
        setPopupExtra(
          'zone',
          zone.id,
          attachmentHtml + buildItemsPopupHtml(duLieu, libellesDePopup())
        )
      }
      setZoneNavigationTarget(zone.id, zoneNavigationTarget(attached))
    }

    for (const marker of markers.value) {
      const duRepere = parRepere.value.get(marker.id) || []
      const attachmentHtml = marker.zoneId
        ? buildMarkerAttachmentHtml(zoneNameById.get(marker.zoneId), t('map.marker_entrance_of'))
        : ''
      if (attachmentHtml || duRepere.length > 0) {
        setPopupExtra(
          'marker',
          marker.id,
          attachmentHtml + buildItemsPopupHtml(duRepere, libellesDePopup())
        )
      }
    }
  },
  { immediate: true }
)

/**
 * Carte plein écran et panneau du bas, partagés avec la page de gestion de la carte.
 * Le détail — hauteur mesurée, crans de vaul, avertissement à Leaflet — vit dans le composable.
 */
const {
  estMobile,
  enregistrerSection,
  carteHauteur,
  CRANS_PANNEAU,
  UI_PANNEAU,
  panneauOuvert,
  cranImpose,
  rendreLaMain,
  replierPanneau,
} = useCartePleinEcranMobile(map)

const handleFocusZone = (zone: EditionZone) => {
  focusOnZone(zone.id)
  replierPanneau()
}

const handleFocusMarker = (marker: EditionMarker) => {
  focusOnMarker(marker.id)
  replierPanneau()
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
