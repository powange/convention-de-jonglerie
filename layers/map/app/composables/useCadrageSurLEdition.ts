import { watch, type Ref } from 'vue'

import type { LatLngExpression } from 'leaflet'

/**
 * Recentrer la carte sur le lieu de l'édition dès qu'on le connaît — et seulement s'il n'y a
 * rien à cadrer.
 *
 * ## ⚠️ LE DÉFAUT : UNE OPTION LUE UNE SEULE FOIS, TROP TÔT
 *
 * Les deux pages de carte passaient leur centre à `useLeafletEditable` sous cette forme :
 *
 * ```ts
 * center: computed(() => { … edition.value?.latitude … }).value,   // ← `.value`, au setup
 * zoom: edition.value?.latitude ? 15 : 6,
 * ```
 *
 * Le `.value` évalue le `computed` **une fois, pendant le `setup`**. Or l'édition n'est chargée
 * qu'en `onMounted` — par le gabarit pour la page de gestion, par la page elle-même pour la
 * publique. À froid — rechargement, arrivée par URL, premier clic depuis le menu — `edition` est
 * donc encore indéfinie, et la carte s'ouvre sur **[46.60, 1.89] au zoom 6** : la France entière.
 *
 * `fitBoundsToItems` rattrapait le cas où des zones existaient déjà. Il ne rattrapait pas le
 * premier usage — celui de l'organisateur qui arrive pour dessiner sa première zone et doit
 * commencer par retrouver son terrain sur une carte de France.
 *
 * ## ⚠️⚠️ CE QUE CE COMPOSABLE NE DOIT SURTOUT PAS FAIRE
 *
 * **Consommer le drapeau `initialViewSet`.** Les deux pages s'en servent comme d'un coup unique :
 * le premier cadrage gagne. Si le recentrage le posait à `true`, un contenu arrivant ensuite — et
 * les zones arrivent toujours après, elles viennent d'une requête — ne serait **jamais** recadré.
 * On aurait alors troqué « la France au zoom 6 » contre « le bon terrain, mais sans voir les
 * zones qu'on vient d'y dessiner ».
 *
 * D'où la règle : le contenu gagne toujours sur l'adresse. Ce composable n'agit que pendant la
 * fenêtre où il n'y a rien à montrer, et il laisse le drapeau intact.
 */
export function useCadrageSurLEdition(options: {
  /** L'instance Leaflet, nulle jusqu'au montage. */
  map: Ref<unknown>
  /** Les coordonnées de l'édition, indéfinies jusqu'à son chargement. */
  latitude: Ref<number | null | undefined>
  longitude: Ref<number | null | undefined>
  /** Combien d'éléments la carte porte : au-delà de zéro, c'est `fitBoundsToItems` qui décide. */
  nombreDElements: Ref<number>
  /** Le drapeau de cadrage des pages — LU, jamais écrit. */
  cadrageDejaFait: Ref<boolean>
  setView: (centre: LatLngExpression, zoom?: number) => void
}) {
  /** Le zoom d'une adresse : assez serré pour reconnaître le terrain, assez large pour s'y situer. */
  const ZOOM_DU_LIEU = 15

  watch(
    [options.map, options.latitude, options.longitude, options.nombreDElements],
    ([map, latitude, longitude, nombreDElements]) => {
      if (!map || options.cadrageDejaFait.value) return
      // Il y a quelque chose à cadrer : `fitBoundsToItems` fait mieux que n'importe quelle adresse.
      if ((nombreDElements as number) > 0) return
      /*
       * ⚠️ `Number.isFinite` et non `typeof === 'number'` : **`typeof NaN` vaut `'number'`**.
       * Un `NaN` franchissait donc la garde et appelait `setView([NaN, …])`, ce qui déplace la
       * carte sur une position invalide. C'est le test qui l'a dit — la même famille de piège que
       * `Math.max(1, NaN)`, qui rend `NaN` au lieu de sa borne.
       */
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

      options.setView([latitude, longitude], ZOOM_DU_LIEU)
    },
    { immediate: true }
  )
}
