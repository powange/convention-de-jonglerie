export interface VolunteerTimeSlotAPI {
  id: string
  title: string
  description?: string
  start: string // ISO string
  end: string // ISO string
  teamId?: string
  team?: {
    id: string
    name: string
    color: string
  }
  maxVolunteers: number
  assignedVolunteers: number
  delayMinutes?: number | null
  assignments: Array<{
    id: string
    user: {
      id: number
      pseudo: string
      nom?: string
      prenom?: string
      emailHash: string
      email?: string // Optionnel - présent pour les gestionnaires
      profilePicture?: string | null
      updatedAt: string
    }
  }>
  color: string
  resourceId: string
}

export interface CreateTimeSlotData {
  title: string
  description?: string
  teamId?: string
  startDateTime: string // ISO string ou format datetime-local
  endDateTime: string // ISO string ou format datetime-local
  maxVolunteers: number
}

export type UpdateTimeSlotData = Partial<CreateTimeSlotData>

export function useVolunteerTimeSlots(editionId: MaybeRefOrGetter<number | undefined>) {
  const { $fetch } = useNuxtApp()

  // État réactif
  const timeSlots = ref<VolunteerTimeSlotAPI[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Récupérer tous les créneaux
  const fetchTimeSlots = async () => {
    const id = toValue(editionId)
    if (!id) return

    try {
      loading.value = true
      error.value = null
      timeSlots.value = await $fetch(`/api/editions/${id}/volunteer-time-slots`)
    } catch (err: any) {
      error.value = err.data?.message || 'Erreur lors du chargement des créneaux'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Créer un créneau
  const createTimeSlot = async (slotData: CreateTimeSlotData): Promise<VolunteerTimeSlotAPI> => {
    const id = toValue(editionId)
    if (!id) throw new Error('Edition ID is required')

    try {
      loading.value = true
      error.value = null

      // Convertir les dates datetime-local en ISO string si nécessaire
      const processedData = {
        ...slotData,
        startDateTime:
          slotData.startDateTime.includes('T') && !slotData.startDateTime.includes('Z')
            ? new Date(slotData.startDateTime).toISOString()
            : slotData.startDateTime,
        endDateTime:
          slotData.endDateTime.includes('T') && !slotData.endDateTime.includes('Z')
            ? new Date(slotData.endDateTime).toISOString()
            : slotData.endDateTime,
      }

      const newSlot = await $fetch(`/api/editions/${id}/volunteer-time-slots`, {
        method: 'POST',
        body: processedData,
      })
      timeSlots.value.push(newSlot)
      return newSlot
    } catch (err: any) {
      error.value = err.data?.message || 'Erreur lors de la création du créneau'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Mettre à jour un créneau
  const updateTimeSlot = async (
    slotId: string,
    slotData: UpdateTimeSlotData
  ): Promise<VolunteerTimeSlotAPI> => {
    const id = toValue(editionId)
    if (!id) throw new Error('Edition ID is required')

    try {
      loading.value = true
      error.value = null

      // Convertir les dates datetime-local en ISO string si nécessaire
      const processedData = {
        ...slotData,
      }

      if (slotData.startDateTime) {
        processedData.startDateTime =
          slotData.startDateTime.includes('T') && !slotData.startDateTime.includes('Z')
            ? new Date(slotData.startDateTime).toISOString()
            : slotData.startDateTime
      }

      if (slotData.endDateTime) {
        processedData.endDateTime =
          slotData.endDateTime.includes('T') && !slotData.endDateTime.includes('Z')
            ? new Date(slotData.endDateTime).toISOString()
            : slotData.endDateTime
      }

      const updatedSlot = await $fetch(`/api/editions/${id}/volunteer-time-slots/${slotId}`, {
        method: 'PUT',
        body: processedData,
      })
      const index = timeSlots.value.findIndex((s) => s.id === slotId)
      if (index !== -1) {
        timeSlots.value[index] = updatedSlot
      }
      return updatedSlot
    } catch (err: any) {
      error.value = err.data?.message || 'Erreur lors de la mise à jour du créneau'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Supprimer un créneau
  const deleteTimeSlot = async (slotId: string): Promise<void> => {
    const id = toValue(editionId)
    if (!id) throw new Error('Edition ID is required')

    try {
      loading.value = true
      error.value = null
      await $fetch(`/api/editions/${id}/volunteer-time-slots/${slotId}`, {
        method: 'DELETE',
      })
      timeSlots.value = timeSlots.value.filter((s) => s.id !== slotId)
    } catch (err: any) {
      error.value = err.data?.message || 'Erreur lors de la suppression du créneau'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Charger automatiquement au montage
  onMounted(() => {
    fetchTimeSlots()
  })

  return {
    // État
    timeSlots: readonly(timeSlots),
    loading: readonly(loading),
    error: readonly(error),

    // Actions
    fetchTimeSlots,
    createTimeSlot,
    updateTimeSlot,
    deleteTimeSlot,
  }
}
