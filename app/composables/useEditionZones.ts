export interface EditionZone {
  id: number
  name: string
  description: string | null
  color: string
  coordinates: [number, number][]
  zoneTypes: string[]
  order: number
  createdAt: string
  updatedAt: string
}

export interface CreateZoneData {
  name: string
  description?: string | null
  color: string
  coordinates: [number, number][]
  zoneTypes?: string[]
}

export interface UpdateZoneData {
  name?: string
  description?: string | null
  color?: string
  coordinates?: [number, number][]
  zoneTypes?: string[]
}

export const useEditionZones = (editionId: Ref<number | undefined>) => {
  const { t } = useI18n()

  const zones = ref<EditionZone[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchZones = async () => {
    if (!editionId.value) return

    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean; zones: EditionZone[] }>(
        `/api/editions/${editionId.value}/zones`
      )
      zones.value = response.zones
    } catch (err: any) {
      error.value = err.data?.message || t('common.error')
      console.error('Error fetching zones:', err)
    } finally {
      loading.value = false
    }
  }

  // Ref pour stocker les données de création en attente
  const pendingCreateData = ref<CreateZoneData | null>(null)

  const { execute: executeCreateZone, loading: creating } = useApiAction(
    () => `/api/editions/${editionId.value}/zones`,
    {
      method: 'POST',
      body: () => pendingCreateData.value,
      successMessage: {
        title: t('gestion.map.save_success'),
      },
      errorMessages: {
        default: t('common.error'),
      },
      onSuccess: (response: { success: boolean; zone: EditionZone }) => {
        zones.value.push(response.zone)
        pendingCreateData.value = null
      },
    }
  )

  // Ref pour stocker les données de mise à jour en attente
  const pendingUpdateData = ref<UpdateZoneData | null>(null)

  const { execute: executeUpdateZone, loading: updating } = useApiActionById(
    (zoneId) => `/api/editions/${editionId.value}/zones/${zoneId}`,
    {
      method: 'PUT',
      body: () => pendingUpdateData.value,
      successMessage: {
        title: t('gestion.map.save_success'),
      },
      errorMessages: {
        default: t('common.error'),
      },
      onSuccess: (response: { success: boolean; zone: EditionZone }, zoneId: number) => {
        const index = zones.value.findIndex((z) => z.id === zoneId)
        if (index !== -1) {
          zones.value[index] = response.zone
        }
        pendingUpdateData.value = null
      },
    }
  )

  const { execute: deleteZone, loading: deleting } = useApiActionById(
    (zoneId) => `/api/editions/${editionId.value}/zones/${zoneId}`,
    {
      method: 'DELETE',
      successMessage: {
        title: t('gestion.map.delete_success'),
      },
      errorMessages: {
        default: t('common.error'),
      },
      onSuccess: (_response: { success: boolean }, zoneId: number) => {
        const index = zones.value.findIndex((z) => z.id === zoneId)
        if (index !== -1) {
          zones.value.splice(index, 1)
        }
      },
    }
  )

  // Ref pour stocker les IDs de réorganisation en attente
  const pendingReorderIds = ref<number[] | null>(null)

  const { execute: executeReorderZones, loading: reordering } = useApiAction(
    () => `/api/editions/${editionId.value}/zones/reorder`,
    {
      method: 'PUT',
      body: () => (pendingReorderIds.value ? { zoneIds: pendingReorderIds.value } : null),
      onSuccess: (response: { success: boolean; zones: EditionZone[] }) => {
        zones.value = response.zones
        pendingReorderIds.value = null
      },
    }
  )

  const createNewZone = async (data: CreateZoneData) => {
    pendingCreateData.value = data
    return executeCreateZone()
  }

  const updateExistingZone = async (zoneId: number, data: UpdateZoneData) => {
    pendingUpdateData.value = data
    return executeUpdateZone(zoneId)
  }

  const deleteExistingZone = async (zoneId: number) => {
    return deleteZone(zoneId)
  }

  const reorderExistingZones = async (zoneIds: number[]) => {
    pendingReorderIds.value = zoneIds
    return executeReorderZones()
  }

  const updateZoneCoordinates = async (zoneId: number, coordinates: [number, number][]) => {
    return updateExistingZone(zoneId, { coordinates })
  }

  // Charger les zones au montage si editionId est défini
  watch(
    editionId,
    (newId) => {
      if (newId) {
        fetchZones()
      }
    },
    { immediate: true }
  )

  return {
    zones: readonly(zones),
    loading: readonly(loading),
    creating: readonly(creating),
    updating: readonly(updating),
    deleting: readonly(deleting),
    reordering: readonly(reordering),
    error: readonly(error),
    fetchZones,
    createZone: createNewZone,
    updateZone: updateExistingZone,
    deleteZone: deleteExistingZone,
    reorderZones: reorderExistingZones,
    updateZoneCoordinates,
  }
}
