import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick, watch, readonly, computed } from 'vue'

// Mock Vue functions (auto-imported by Nuxt)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('computed', computed)

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

// Mock useToast
const mockToastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({
  add: mockToastAdd,
}))

// Mock useI18n
vi.stubGlobal('useI18n', () => ({
  t: (key: string) => key,
}))

// Mock navigateTo
vi.stubGlobal('navigateTo', vi.fn())

// Import the actual useApiAction implementation (will use mocked $fetch)
import { useApiAction, useApiActionById } from '../../../app/composables/useApiAction'

// Make useApiAction and useApiActionById available as globals (auto-import by Nuxt)
vi.stubGlobal('useApiAction', useApiAction)
vi.stubGlobal('useApiActionById', useApiActionById)

// Importer après les mocks
import { useEditionMarkers, type EditionMarker } from '../../../app/composables/useEditionMarkers'

describe('useEditionMarkers', () => {
  const mockMarkers: EditionMarker[] = [
    {
      id: 1,
      name: 'Entrée principale',
      description: 'Entrée du site',
      latitude: 48.8566,
      longitude: 2.3522,
      markerType: 'ENTRANCE',
      order: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      name: 'Point Info',
      description: 'Accueil et informations',
      latitude: 48.8576,
      longitude: 2.3532,
      markerType: 'INFO',
      order: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('initialisation', () => {
    it('devrait initialiser avec les valeurs par défaut', () => {
      const editionId = ref<number | undefined>(undefined)
      const { markers, loading, error } = useEditionMarkers(editionId)

      expect(markers.value).toEqual([])
      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('devrait charger les markers automatiquement si editionId est défini', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, markers: mockMarkers })

      const editionId = ref<number | undefined>(1)
      const { markers } = useEditionMarkers(editionId)

      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockFetch).toHaveBeenCalledWith('/api/editions/1/markers')
      expect(markers.value).toEqual(mockMarkers)
    })

    it('ne devrait pas charger les markers si editionId est undefined', async () => {
      const editionId = ref<number | undefined>(undefined)
      useEditionMarkers(editionId)

      await nextTick()

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('fetchMarkers', () => {
    it('devrait récupérer les markers avec succès', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, markers: mockMarkers })

      const editionId = ref<number | undefined>(1)
      const { markers, loading, error, fetchMarkers } = useEditionMarkers(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))
      mockFetch.mockClear()

      mockFetch.mockResolvedValueOnce({ success: true, markers: mockMarkers })
      await fetchMarkers()

      expect(markers.value).toEqual(mockMarkers)
      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('devrait gérer les erreurs de récupération', async () => {
      mockFetch.mockRejectedValueOnce({
        data: { message: 'Erreur serveur' },
      })

      const editionId = ref<number | undefined>(1)
      const { error } = useEditionMarkers(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(error.value).toBe('Erreur serveur')
    })

    it('ne devrait pas fetch si editionId est undefined', async () => {
      const editionId = ref<number | undefined>(undefined)
      const { fetchMarkers } = useEditionMarkers(editionId)

      await fetchMarkers()

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('createMarker', () => {
    it('devrait créer un marker avec succès', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, markers: [] })

      const editionId = ref<number | undefined>(1)
      const { markers, createMarker } = useEditionMarkers(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))

      const newMarker: EditionMarker = {
        ...mockMarkers[0],
        id: 3,
        name: 'Nouveau Marker',
      }

      mockFetch.mockResolvedValueOnce({ success: true, marker: newMarker })

      await createMarker({
        name: 'Nouveau Marker',
        latitude: 48.8566,
        longitude: 2.3522,
        markerType: 'ENTRANCE',
      })

      expect(mockFetch).toHaveBeenLastCalledWith('/api/editions/1/markers', {
        method: 'POST',
        body: expect.objectContaining({
          name: 'Nouveau Marker',
          latitude: 48.8566,
          longitude: 2.3522,
        }),
        query: undefined,
      })

      expect(markers.value).toContainEqual(newMarker)
    })
  })

  describe('updateMarker', () => {
    it('devrait mettre à jour un marker avec succès', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, markers: mockMarkers })

      const editionId = ref<number | undefined>(1)
      const { markers, updateMarker } = useEditionMarkers(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))

      const updatedMarker = { ...mockMarkers[0], name: 'Marker Mis à jour' }
      mockFetch.mockResolvedValueOnce({ success: true, marker: updatedMarker })

      await updateMarker(1, { name: 'Marker Mis à jour' })

      expect(mockFetch).toHaveBeenLastCalledWith('/api/editions/1/markers/1', {
        method: 'PUT',
        body: expect.objectContaining({
          name: 'Marker Mis à jour',
        }),
        query: undefined,
      })

      const marker = markers.value.find((m) => m.id === 1)
      expect(marker?.name).toBe('Marker Mis à jour')
    })
  })

  describe('deleteMarker', () => {
    it('devrait supprimer un marker avec succès', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, markers: mockMarkers })

      const editionId = ref<number | undefined>(1)
      const { markers, deleteMarker } = useEditionMarkers(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(markers.value).toHaveLength(2)

      mockFetch.mockResolvedValueOnce({ success: true })

      await deleteMarker(1)

      expect(mockFetch).toHaveBeenLastCalledWith('/api/editions/1/markers/1', {
        method: 'DELETE',
        body: undefined,
        query: undefined,
      })

      expect(markers.value).toHaveLength(1)
      expect(markers.value.find((m) => m.id === 1)).toBeUndefined()
    })
  })

  describe('updateMarkerPosition', () => {
    it('devrait mettre à jour la position via updateMarker', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, markers: mockMarkers })

      const editionId = ref<number | undefined>(1)
      const { updateMarkerPosition } = useEditionMarkers(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))

      const newLat = 48.9
      const newLng = 2.4

      const updatedMarker = { ...mockMarkers[0], latitude: newLat, longitude: newLng }
      mockFetch.mockResolvedValueOnce({ success: true, marker: updatedMarker })

      await updateMarkerPosition(1, newLat, newLng)

      expect(mockFetch).toHaveBeenLastCalledWith('/api/editions/1/markers/1', {
        method: 'PUT',
        body: { latitude: newLat, longitude: newLng },
        query: undefined,
      })
    })
  })

  describe('reorderMarkers', () => {
    it('devrait réorganiser les markers', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, markers: mockMarkers })

      const editionId = ref<number | undefined>(1)
      const { markers, reorderMarkers } = useEditionMarkers(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))

      const reorderedMarkers = [mockMarkers[1], mockMarkers[0]].map((m, i) => ({ ...m, order: i }))
      mockFetch.mockResolvedValueOnce({ success: true, markers: reorderedMarkers })

      await reorderMarkers([2, 1])

      expect(mockFetch).toHaveBeenLastCalledWith('/api/editions/1/markers/reorder', {
        method: 'PUT',
        body: { markerIds: [2, 1] },
        query: undefined,
      })

      expect(markers.value).toEqual(reorderedMarkers)
    })
  })

  describe('watch editionId', () => {
    it('devrait recharger les markers quand editionId change', async () => {
      const editionId = ref<number | undefined>(undefined)
      const { markers } = useEditionMarkers(editionId)

      await nextTick()
      expect(mockFetch).not.toHaveBeenCalled()

      mockFetch.mockResolvedValueOnce({ success: true, markers: mockMarkers })
      editionId.value = 1

      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockFetch).toHaveBeenCalledWith('/api/editions/1/markers')
      expect(markers.value).toEqual(mockMarkers)
    })
  })

  describe('états de chargement', () => {
    it('devrait exposer les états de chargement principaux', () => {
      const editionId = ref<number | undefined>(undefined)
      const { loading, creating } = useEditionMarkers(editionId)

      // Les états de chargement principaux doivent être définis
      expect(loading.value).toBe(false)
      expect(creating.value).toBe(false)
    })
  })
})
