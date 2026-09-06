export interface EditionMarker {
  id: number
  name: string
  description: string | null
  latitude: number
  longitude: number
  markerTypes: string[]
  color: string | null
  order: number
  /** Zone à laquelle ce marqueur est rattaché — son entrée. `null` quand il est autonome. */
  zoneId: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateMarkerData {
  name: string
  description?: string | null
  latitude: number
  longitude: number
  markerTypes?: string[]
  color?: string | null
  zoneId?: number | null
}

export interface UpdateMarkerData {
  name?: string
  description?: string | null
  latitude?: number
  longitude?: number
  markerTypes?: string[]
  color?: string | null
  /** Absent = inchangé, `null` = détaché. */
  zoneId?: number | null
}

export const useEditionMarkers = (editionId: Ref<number | undefined>) => {
  const { t } = useI18n()

  const markers = ref<EditionMarker[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Vrai quand la réponse vient du cache hors ligne plutôt que du réseau.
   *
   * Le service worker le signale par un en-tête : la requête réussit dans les deux cas, et rien
   * d'autre ne les distingue. L'indicateur du navigateur ne suffirait pas — il vaut vrai sur un
   * réseau sans accès à Internet, c'est-à-dire le wifi d'une convention.
   */
  const servedFromCache = ref(false)

  const fetchMarkers = async () => {
    if (!editionId.value) return

    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean; data: { markers: EditionMarker[] } }>(
        `/api/editions/${editionId.value}/markers`,
        {
          onResponse({ response: raw }) {
            servedFromCache.value = raw.headers.get('x-from-cache') === '1'
          },
        }
      )
      markers.value = response.data.markers
    } catch (err: any) {
      error.value = err.data?.message || t('common.error')
      console.error('Error fetching markers:', err)
    } finally {
      loading.value = false
    }
  }

  // Ref pour stocker les données de création en attente
  const pendingCreateData = ref<CreateMarkerData | null>(null)

  const { execute: executeCreateMarker, loading: creating } = useApiAction(
    () => `/api/editions/${editionId.value}/markers`,
    {
      method: 'POST',
      body: () => pendingCreateData.value,
      successMessage: {
        title: t('map.marker_save_success'),
      },
      errorMessages: {
        default: t('common.error'),
      },
      onSuccess: (response: { success: boolean; marker: EditionMarker }) => {
        markers.value.push(response.marker)
        pendingCreateData.value = null
      },
    }
  )

  // Ref pour stocker les données de mise à jour en attente
  const pendingUpdateData = ref<UpdateMarkerData | null>(null)

  const { execute: executeUpdateMarker, loading: updating } = useApiActionById(
    (markerId) => `/api/editions/${editionId.value}/markers/${markerId}`,
    {
      method: 'PUT',
      body: () => pendingUpdateData.value,
      successMessage: {
        title: t('map.marker_save_success'),
      },
      errorMessages: {
        default: t('common.error'),
      },
      onSuccess: (response: { success: boolean; marker: EditionMarker }, markerId: number) => {
        const index = markers.value.findIndex((m) => m.id === markerId)
        if (index !== -1) {
          markers.value[index] = response.marker
        }
        pendingUpdateData.value = null
      },
    }
  )

  const { execute: deleteMarker, loading: deleting } = useApiActionById(
    (markerId) => `/api/editions/${editionId.value}/markers/${markerId}`,
    {
      method: 'DELETE',
      successMessage: {
        title: t('map.marker_delete_success'),
      },
      errorMessages: {
        default: t('common.error'),
      },
      onSuccess: (_response: { success: boolean }, markerId: number) => {
        const index = markers.value.findIndex((m) => m.id === markerId)
        if (index !== -1) {
          markers.value.splice(index, 1)
        }
      },
    }
  )

  // Ref pour stocker les IDs de réorganisation en attente
  const pendingReorderIds = ref<number[] | null>(null)

  const { execute: executeReorderMarkers, loading: reordering } = useApiAction(
    () => `/api/editions/${editionId.value}/markers/reorder`,
    {
      method: 'PUT',
      body: () => (pendingReorderIds.value ? { markerIds: pendingReorderIds.value } : null),
      onSuccess: (response: { success: boolean; markers: EditionMarker[] }) => {
        markers.value = response.markers
        pendingReorderIds.value = null
      },
    }
  )

  const createNewMarker = async (data: CreateMarkerData) => {
    pendingCreateData.value = data
    return executeCreateMarker()
  }

  const updateExistingMarker = async (markerId: number, data: UpdateMarkerData) => {
    pendingUpdateData.value = data
    return executeUpdateMarker(markerId)
  }

  /**
   * `execute` rend `null` pour un échec, et seulement pour un échec : `SUCCES_SANS_CONTENU` couvre
   * le cas de cette API, qui répond `createSuccessResponse(null, …)`. Un simple `Boolean` suffit
   * donc à en tirer le verdict que l'appelant attend pour retirer l'objet de la carte.
   */
  const deleteExistingMarker = async (markerId: number) => {
    return Boolean(await deleteMarker(markerId))
  }

  const reorderExistingMarkers = async (markerIds: number[]) => {
    pendingReorderIds.value = markerIds
    return executeReorderMarkers()
  }

  const updateMarkerPosition = async (markerId: number, latitude: number, longitude: number) => {
    return updateExistingMarker(markerId, { latitude, longitude })
  }

  // Charger les marqueurs au montage si editionId est défini
  watch(
    editionId,
    (newId) => {
      if (newId) {
        fetchMarkers()
      }
    },
    { immediate: true }
  )

  return {
    markers: shallowReadonly(markers),
    loading: readonly(loading),
    creating: readonly(creating),
    updating: readonly(updating),
    deleting: readonly(deleting),
    reordering: readonly(reordering),
    error: readonly(error),
    servedFromCache: readonly(servedFromCache),
    fetchMarkers,
    createMarker: createNewMarker,
    updateMarker: updateExistingMarker,
    deleteMarker: deleteExistingMarker,
    reorderMarkers: reorderExistingMarkers,
    updateMarkerPosition,
  }
}
