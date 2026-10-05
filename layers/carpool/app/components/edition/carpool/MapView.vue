<template>
  <div class="space-y-4">
    <div v-if="error" class="text-center py-8 text-gray-500">
      <UIcon name="i-heroicons-exclamation-triangle" class="mx-auto h-12 w-12 text-gray-300 mb-4" />
      <p class="text-lg font-medium">{{ $t('components.carpool.map_error') }}</p>
    </div>

    <!--
      Le conteneur est TOUJOURS rendu, même pendant le chargement : `useLeafletMap` l'attend au
      montage, et un `v-if` sur un état de chargement le lui retirerait au moment précis où il en a
      besoin — la carte ne s'initialiserait jamais.
    -->
    <div v-else class="relative">
      <div
        ref="conteneur"
        class="h-[420px] sm:h-[520px] w-full rounded-lg overflow-hidden z-0"
        :class="{ 'opacity-0': isLoading }"
      />
      <div
        v-if="isLoading"
        class="absolute inset-0 flex items-center justify-center text-sm text-gray-500"
      >
        <UIcon name="i-heroicons-arrow-path" class="animate-spin size-5 mr-2" />
        {{ $t('components.carpool.map_loading') }}
      </div>
    </div>

    <div v-if="!error && !points.length" class="text-center py-6 text-gray-500">
      <p class="text-lg font-medium">{{ $t('components.carpool.map_empty') }}</p>
      <p class="text-sm">{{ $t('components.carpool.map_empty_hint') }}</p>
    </div>

    <!--
      Les annonces sans position, NOMMÉES et cliquables.
      ⚠️ C'est la moitié qui manque à toute carte du covoiturage : la ville se saisissant
      librement, il y en aura toujours. Les taire ferait disparaître des annonces de l'écran sans
      que personne ne puisse s'en apercevoir.
    -->
    <UAlert
      v-if="sansPoint.length"
      icon="i-heroicons-map-pin"
      color="neutral"
      variant="subtle"
      :title="$t('components.carpool.map_without_point')"
    >
      <!--
        ⚠️ `#description` ET NON `#footer` : `UAlert` n'a pas de slot `footer`. Ses slots sont
        `leading`, `title`, `description`, `actions` et `close` — un nom inventé ne rend RIEN, sans
        erreur ni avertissement, et la liste disparaissait purement et simplement. C'est le second
        piège du même genre dans ce dépôt ; la métadonnée du composant fait foi.
      -->
      <template #description>
        <p>{{ $t('components.carpool.map_without_point_hint') }}</p>
        <ul class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <li v-for="item in sansPoint" :key="`${item.genre}-${item.annonce.id}`">
            <ULink
              :to="lienDe(item)"
              class="text-sm underline underline-offset-2 hover:no-underline"
            >
              {{ item.annonce.locationCity }}
            </ULink>
          </li>
        </ul>
      </template>
    </UAlert>
  </div>
</template>

<script setup lang="ts">
import { useLeafletMap } from '~/composables/useLeafletMap'
import { escapeHtml } from '~/utils/mapMarkers'

import {
  cadreDesPoints,
  pointsDuCovoiturage,
  type AnnonceLocalisable,
  type AnnonceSansPoint,
  type PointDuCovoiturage,
} from '../../../utils/points-du-covoiturage'

/**
 * La carte du covoiturage d'une édition : une épingle par VILLE, et le lieu de la convention.
 *
 * Tout ce qui se raisonne vit dans `points-du-covoiturage.ts`, qui est pur et testé. Ce composant
 * ne fait que dessiner : il n'y a ici aucune règle, seulement du Leaflet.
 */
interface Props {
  editionId: number
  offres: AnnonceLocalisable[]
  demandes: AnnonceLocalisable[]
  /** Le lieu de la convention : l'autre extrémité de tous les trajets. */
  convention?: { nom?: string | null; latitude?: number | null; longitude?: number | null } | null
}

const props = defineProps<Props>()
const { t } = useI18n()

const conteneur = ref<HTMLElement | null>(null)

const regroupement = computed(() =>
  pointsDuCovoiturage({ offres: props.offres, demandes: props.demandes })
)
const points = computed(() => regroupement.value.points)
const sansPoint = computed(() => regroupement.value.sansPoint)

const lienDe = (item: AnnonceSansPoint) =>
  item.genre === 'offre'
    ? `/editions/${props.editionId}/carpool/offers/${item.annonce.id}`
    : `/editions/${props.editionId}/carpool/requests/${item.annonce.id}`

const { map, isLoading, error, updateMarkers, fitBounds } = useLeafletMap(conteneur, {
  // Le centre et le zoom ne servent que le temps d'un battement : `fitBounds` les remplace dès que
  // les points sont connus. Sans eux, Leaflet refuse d'initialiser la carte.
  zoom: 6,
})

/**
 * Le contenu d'une popup, en HTML.
 *
 * ⚠️ TOUT CE QUI VIENT DE L'UTILISATEUR EST ÉCHAPPÉ. `bindPopup` reçoit du HTML brut : un nom de
 * ville contenant une balise s'exécuterait dans la page. `escapeHtml` est le helper déjà employé
 * par les autres cartes du dépôt, pour cette raison exacte.
 */
function popupDuPoint(point: PointDuCovoiturage): string {
  const titre = `<strong>${escapeHtml(point.ville)}</strong>`

  const lignes: string[] = []
  if (point.offres.length) {
    lignes.push(escapeHtml(t('components.carpool.map_offers_here', point.offres.length)))
  }
  if (point.demandes.length) {
    lignes.push(escapeHtml(t('components.carpool.map_requests_here', point.demandes.length)))
  }

  // Trois liens au plus : au-delà, la popup devient une liste à faire défiler, et les onglets
  // « Offres » et « Demandes » font ce travail bien mieux.
  const liens: string[] = []
  const PLAFOND = 3
  for (const offre of point.offres.slice(0, PLAFOND)) {
    liens.push(
      `<a href="/editions/${props.editionId}/carpool/offers/${offre.id}">${escapeHtml(t('components.carpool.map_see_offer'))}</a>`
    )
  }
  for (const demande of point.demandes.slice(0, Math.max(0, PLAFOND - liens.length))) {
    liens.push(
      `<a href="/editions/${props.editionId}/carpool/requests/${demande.id}">${escapeHtml(t('components.carpool.map_see_request'))}</a>`
    )
  }
  const reste = point.total - liens.length
  if (reste > 0) lignes.push(escapeHtml(t('components.carpool.map_and_more', reste)))

  return [
    titre,
    ...lignes.map((l) => `<div>${l}</div>`),
    ...liens.map((l) => `<div>${l}</div>`),
  ].join('')
}

/** Une pastille dont la couleur dit ce qu'on trouve là, et le chiffre combien. */
function iconeDuPoint(point: PointDuCovoiturage) {
  const couleur = !point.demandes.length
    ? '#2563eb' // offres seules — bleu
    : !point.offres.length
      ? '#16a34a' // demandes seules — vert
      : '#7c3aed' // les deux — violet
  return window.L!.divIcon({
    className: '',
    html: `<div style="background:${couleur};color:#fff;border:2px solid #fff;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font:600 12px/1 sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4)">${point.total}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

function iconeDeLaConvention() {
  return window.L!.divIcon({
    className: '',
    html: `<div style="background:#dc2626;color:#fff;border:2px solid #fff;border-radius:9999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 1px 5px rgba(0,0,0,.45)">★</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  })
}

/**
 * Redessine la carte.
 *
 * ⚠️ `updateMarkers` ET NON l'option `markers` du composable : celle-ci est lue UNE SEULE FOIS, au
 * montage. L'écran porte un interrupteur « archives » qui change les listes — passer un `computed`
 * à l'option laisserait la carte figée sur son premier état, sans rien signaler.
 */
function redessiner() {
  if (!map.value || !window.L) return

  const marqueurs = points.value.map((point) => ({
    id: point.cle,
    position: point.position,
    popupContent: popupDuPoint(point),
    icon: iconeDuPoint(point),
  }))

  const c = props.convention
  if (c && typeof c.latitude === 'number' && typeof c.longitude === 'number') {
    // Ajouté en DERNIER pour passer devant : c'est la destination commune, elle ne doit pas se
    // retrouver sous une épingle de ville.
    marqueurs.push({
      id: 'convention',
      position: [c.latitude, c.longitude],
      popupContent: `<strong>${escapeHtml(c.nom || t('components.carpool.map_convention'))}</strong>`,
      icon: iconeDeLaConvention(),
    })
  }

  updateMarkers(marqueurs)

  const cadre = cadreDesPoints(points.value, props.convention)
  // `maxZoom` : un point unique ferait plonger la vue au niveau de la rue, où l'on ne comprend plus
  // où l'on est.
  if (cadre) fitBounds(cadre, { padding: [40, 40], maxZoom: 10 })
}

watch([map, () => props.offres, () => props.demandes], redessiner, { immediate: true, deep: true })
</script>
