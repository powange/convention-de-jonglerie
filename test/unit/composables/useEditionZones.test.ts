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
import { useEditionZones, type EditionZone } from '../../../app/composables/useEditionZones'

describe('useEditionZones', () => {
  const mockZones: EditionZone[] = [
    {
      id: 1,
      name: 'Zone Camping',
      description: 'Zone de camping principale',
      color: '#22c55e',
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
        [48.8586, 2.3512],
      ],
      zoneTypes: ['CAMPING'],
      order: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      name: 'Zone Spectacles',
      description: 'Scène principale',
      color: '#8b5cf6',
      coordinates: [
        [48.8596, 2.3542],
        [48.8606, 2.3552],
        [48.8616, 2.3522],
      ],
      zoneTypes: ['SHOWS'],
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
      const { zones, loading, error } = useEditionZones(editionId)

      expect(zones.value).toEqual([])
      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('devrait charger les zones automatiquement si editionId est défini', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, data: { zones: mockZones } })

      const editionId = ref<number | undefined>(1)
      const { zones } = useEditionZones(editionId)

      await nextTick()
      // Attendre que la promesse soit résolue
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockFetch).toHaveBeenCalledWith('/api/editions/1/zones')
      expect(zones.value).toEqual(mockZones)
    })

    it('ne devrait pas charger les zones si editionId est undefined', async () => {
      const editionId = ref<number | undefined>(undefined)
      useEditionZones(editionId)

      await nextTick()

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('fetchZones', () => {
    it('devrait récupérer les zones avec succès', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, data: { zones: mockZones } })

      const editionId = ref<number | undefined>(1)
      const { zones, loading, error, fetchZones } = useEditionZones(editionId)

      // Attendre le premier fetch automatique
      await new Promise((resolve) => setTimeout(resolve, 0))
      mockFetch.mockClear()

      // Déclencher un nouveau fetch
      mockFetch.mockResolvedValueOnce({ success: true, data: { zones: mockZones } })
      await fetchZones()

      expect(zones.value).toEqual(mockZones)
      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('devrait gérer les erreurs de récupération', async () => {
      mockFetch.mockRejectedValueOnce({
        data: { message: 'Erreur serveur' },
      })

      const editionId = ref<number | undefined>(1)
      const { error, fetchZones } = useEditionZones(editionId)

      // Attendre le premier fetch qui échoue
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(error.value).toBe('Erreur serveur')
    })

    it('ne devrait pas fetch si editionId est undefined', async () => {
      const editionId = ref<number | undefined>(undefined)
      const { fetchZones } = useEditionZones(editionId)

      await fetchZones()

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('createZone', () => {
    it('devrait créer une zone avec succès', async () => {
      // Premier fetch automatique
      mockFetch.mockResolvedValueOnce({ success: true, data: { zones: [] } })

      const editionId = ref<number | undefined>(1)
      const { zones, createZone, creating } = useEditionZones(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))

      const newZone: EditionZone = {
        ...mockZones[0],
        id: 3,
        name: 'Nouvelle Zone',
      }

      mockFetch.mockResolvedValueOnce({ success: true, zone: newZone })

      await createZone({
        name: 'Nouvelle Zone',
        color: '#22c55e',
        coordinates: [
          [48.8566, 2.3522],
          [48.8576, 2.3532],
          [48.8586, 2.3512],
        ],
        zoneTypes: ['CAMPING'],
      })

      expect(mockFetch).toHaveBeenLastCalledWith('/api/editions/1/zones', {
        method: 'POST',
        body: expect.objectContaining({
          name: 'Nouvelle Zone',
          color: '#22c55e',
        }),
        query: undefined,
      })

      // Vérifie que la zone a été ajoutée au state
      expect(zones.value).toContainEqual(newZone)
    })
  })

  describe('updateZone', () => {
    it('devrait mettre à jour une zone avec succès', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, data: { zones: mockZones } })

      const editionId = ref<number | undefined>(1)
      const { zones, updateZone } = useEditionZones(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))

      const updatedZone = { ...mockZones[0], name: 'Zone Mise à jour' }
      mockFetch.mockResolvedValueOnce({ success: true, zone: updatedZone })

      await updateZone(1, { name: 'Zone Mise à jour' })

      expect(mockFetch).toHaveBeenLastCalledWith('/api/editions/1/zones/1', {
        method: 'PUT',
        body: expect.objectContaining({
          name: 'Zone Mise à jour',
        }),
        query: undefined,
      })

      // Vérifie que la zone a été mise à jour dans le state
      const zone = zones.value.find((z) => z.id === 1)
      expect(zone?.name).toBe('Zone Mise à jour')
    })
  })

  describe('deleteZone', () => {
    it('devrait supprimer une zone avec succès', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, data: { zones: mockZones } })

      const editionId = ref<number | undefined>(1)
      const { zones, deleteZone } = useEditionZones(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(zones.value).toHaveLength(2)

      mockFetch.mockResolvedValueOnce({ success: true })

      await deleteZone(1)

      expect(mockFetch).toHaveBeenLastCalledWith('/api/editions/1/zones/1', {
        method: 'DELETE',
        body: undefined,
        query: undefined,
      })

      // Vérifie que la zone a été supprimée du state
      expect(zones.value).toHaveLength(1)
      expect(zones.value.find((z) => z.id === 1)).toBeUndefined()
    })
  })

  describe('updateZoneCoordinates', () => {
    it('devrait mettre à jour les coordonnées via updateZone', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, data: { zones: mockZones } })

      const editionId = ref<number | undefined>(1)
      const { updateZoneCoordinates } = useEditionZones(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))

      const newCoordinates: [number, number][] = [
        [48.9, 2.4],
        [48.91, 2.41],
        [48.92, 2.39],
      ]

      const updatedZone = { ...mockZones[0], coordinates: newCoordinates }
      mockFetch.mockResolvedValueOnce({ success: true, zone: updatedZone })

      await updateZoneCoordinates(1, newCoordinates)

      expect(mockFetch).toHaveBeenLastCalledWith('/api/editions/1/zones/1', {
        method: 'PUT',
        body: { coordinates: newCoordinates },
        query: undefined,
      })
    })
  })

  describe('reorderZones', () => {
    it('devrait réorganiser les zones', async () => {
      mockFetch.mockResolvedValueOnce({ success: true, data: { zones: mockZones } })

      const editionId = ref<number | undefined>(1)
      const { zones, reorderZones } = useEditionZones(editionId)

      await new Promise((resolve) => setTimeout(resolve, 0))

      const reorderedZones = [mockZones[1], mockZones[0]].map((z, i) => ({ ...z, order: i }))
      mockFetch.mockResolvedValueOnce({ success: true, zones: reorderedZones })

      await reorderZones([2, 1])

      expect(mockFetch).toHaveBeenLastCalledWith('/api/editions/1/zones/reorder', {
        method: 'PUT',
        body: { zoneIds: [2, 1] },
        query: undefined,
      })

      expect(zones.value).toEqual(reorderedZones)
    })
  })

  describe('watch editionId', () => {
    it('devrait recharger les zones quand editionId change', async () => {
      const editionId = ref<number | undefined>(undefined)
      const { zones } = useEditionZones(editionId)

      await nextTick()
      expect(mockFetch).not.toHaveBeenCalled()

      mockFetch.mockResolvedValueOnce({ success: true, data: { zones: mockZones } })
      editionId.value = 1

      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockFetch).toHaveBeenCalledWith('/api/editions/1/zones')
      expect(zones.value).toEqual(mockZones)
    })
  })
})
