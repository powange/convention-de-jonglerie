/**
 * Composable pour générer des liens vers la carte du site d'une édition.
 * Mutualise la logique de vérification de disponibilité de la carte
 * et la construction des URLs avec focusZone/focusMarker.
 */
export const useMapLink = (editionId: number | Ref<number>) => {
  const editionStore = useEditionStore()

  const resolvedEditionId = computed(() => unref(editionId))
  const edition = computed(() => editionStore.getEditionById(resolvedEditionId.value))

  const isMapAvailable = computed(
    () =>
      !!(
        edition.value?.siteMapEnabled &&
        edition.value?.mapPublic &&
        edition.value?.latitude &&
        edition.value?.longitude
      )
  )

  /**
   * Retourne l'URL vers la carte avec focus sur une zone ou un marker, ou null si indisponible.
   * Accepte un objet avec des propriétés `zone` et/ou `marker` (comme un show ou une workshop location).
   */
  const getMapLocationUrl = (item: {
    zone?: { id: number } | null
    marker?: { id: number } | null
  }): string | null => {
    if (!isMapAvailable.value) return null
    if (item.zone) return `/editions/${resolvedEditionId.value}/map?focusZone=${item.zone.id}`
    if (item.marker) return `/editions/${resolvedEditionId.value}/map?focusMarker=${item.marker.id}`
    return null
  }

  return {
    isMapAvailable,
    getMapLocationUrl,
  }
}
