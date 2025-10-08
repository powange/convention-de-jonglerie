import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  createCustomMarkerIcon,
  getEditionStatus,
  type MarkerOptions,
} from '../../app/utils/mapMarkers'

// Mock Leaflet et Blob/URL APIs
const mockLeafletIcon = vi.fn()
const mockL = {
  icon: mockLeafletIcon,
}

// Mock pour Blob et URL.createObjectURL
const mockCreateObjectURL = vi.fn()
const mockBlob = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()

  // Mock global Blob
  global.Blob = mockBlob.mockImplementation((content, options) => ({
    content,
    options,
    type: options?.type,
  }))

  // Mock global URL
  global.URL = {
    createObjectURL: mockCreateObjectURL,
  } as any

  mockCreateObjectURL.mockReturnValue('blob:marker-icon-url')
  mockLeafletIcon.mockReturnValue({ iconUrl: 'blob:marker-icon-url', iconSize: [25, 41] })
})

describe('mapMarkers utils', () => {
  describe('createCustomMarkerIcon', () => {
    it('devrait créer une icône pour un événement en cours', () => {
      const options: MarkerOptions = {
        isUpcoming: false,
        isOngoing: true,
        isFavorite: false,
      }

      createCustomMarkerIcon(mockL, options)

      expect(mockBlob).toHaveBeenCalledWith(
        [expect.stringContaining('fill="#10b981"')], // Vert pour en cours
        { type: 'image/svg+xml' }
      )

      expect(mockCreateObjectURL).toHaveBeenCalledWith({
        content: [expect.stringContaining('fill="#10b981"')],
        options: { type: 'image/svg+xml' },
        type: 'image/svg+xml',
      })

      expect(mockLeafletIcon).toHaveBeenCalledWith({
        iconUrl: 'blob:marker-icon-url',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        shadowSize: [41, 41],
      })
    })

    it('devrait créer une icône pour un événement à venir', () => {
      const options: MarkerOptions = {
        isUpcoming: true,
        isOngoing: false,
        isFavorite: false,
      }

      createCustomMarkerIcon(mockL, options)

      expect(mockBlob).toHaveBeenCalledWith(
        [expect.stringContaining('fill="#3b82f6"')], // Bleu pour à venir
        { type: 'image/svg+xml' }
      )
    })

    it('devrait créer une icône pour un événement passé', () => {
      const options: MarkerOptions = {
        isUpcoming: false,
        isOngoing: false,
        isFavorite: false,
      }

      createCustomMarkerIcon(mockL, options)

      expect(mockBlob).toHaveBeenCalledWith(
        [expect.stringContaining('fill="#6b7280"')], // Gris pour passé
        { type: 'image/svg+xml' }
      )
    })

    it('devrait créer une icône avec contour favori', () => {
      const options: MarkerOptions = {
        isUpcoming: true,
        isOngoing: false,
        isFavorite: true,
      }

      createCustomMarkerIcon(mockL, options)

      const svgCall = mockBlob.mock.calls[0][0][0]
      expect(svgCall).toContain('stroke="#eab308"') // Jaune pour favori
      expect(svgCall).toContain('stroke-width="3"') // Contour plus épais
    })

    it('devrait créer une icône avec contour normal', () => {
      const options: MarkerOptions = {
        isUpcoming: true,
        isOngoing: false,
        isFavorite: false,
      }

      createCustomMarkerIcon(mockL, options)

      const svgCall = mockBlob.mock.calls[0][0][0]
      expect(svgCall).toContain('stroke="#1f2937"') // Gris foncé normal
      expect(svgCall).toContain('stroke-width="1"') // Contour normal
    })

    it("devrait retourner l'icône Leaflet créée", () => {
      const options: MarkerOptions = {
        isUpcoming: false,
        isOngoing: true,
        isFavorite: false,
      }

      const icon = createCustomMarkerIcon(mockL, options)

      expect(icon).toEqual({ iconUrl: 'blob:marker-icon-url', iconSize: [25, 41] })
    })

    it('devrait gérer toutes les combinaisons de statut', () => {
      const testCases = [
        {
          options: { isUpcoming: true, isOngoing: false, isFavorite: false },
          expectedColor: '#3b82f6', // Bleu
          expectedStroke: '#1f2937',
          expectedStrokeWidth: '1',
        },
        {
          options: { isUpcoming: false, isOngoing: true, isFavorite: false },
          expectedColor: '#10b981', // Vert
          expectedStroke: '#1f2937',
          expectedStrokeWidth: '1',
        },
        {
          options: { isUpcoming: false, isOngoing: false, isFavorite: false },
          expectedColor: '#6b7280', // Gris
          expectedStroke: '#1f2937',
          expectedStrokeWidth: '1',
        },
        {
          options: { isUpcoming: true, isOngoing: false, isFavorite: true },
          expectedColor: '#3b82f6', // Bleu
          expectedStroke: '#eab308', // Jaune favori
          expectedStrokeWidth: '3',
        },
        {
          options: { isUpcoming: false, isOngoing: true, isFavorite: true },
          expectedColor: '#10b981', // Vert
          expectedStroke: '#eab308', // Jaune favori
          expectedStrokeWidth: '3',
        },
      ]

      testCases.forEach(
        ({ options, expectedColor, expectedStroke, expectedStrokeWidth }, index) => {
          vi.clearAllMocks()

          createCustomMarkerIcon(mockL, options)

          const svgCall = mockBlob.mock.calls[0][0][0]
          expect(svgCall, `Test case ${index}`).toContain(`fill="${expectedColor}"`)
          expect(svgCall, `Test case ${index}`).toContain(`stroke="${expectedStroke}"`)
          expect(svgCall, `Test case ${index}`).toContain(`stroke-width="${expectedStrokeWidth}"`)
        }
      )
    })

    it('devrait générer un SVG valide', () => {
      const options: MarkerOptions = {
        isUpcoming: true,
        isOngoing: false,
        isFavorite: false,
      }

      createCustomMarkerIcon(mockL, options)

      const svgCall = mockBlob.mock.calls[0][0][0]

      // Vérifier la structure SVG
      expect(svgCall).toContain('<svg width="25" height="41"')
      expect(svgCall).toContain('viewBox="0 0 25 41"')
      expect(svgCall).toContain(
        '<path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.5 12.5 28.5 12.5 28.5s12.5-20 12.5-28.5C25 5.596 19.404 0 12.5 0z"'
      )
      expect(svgCall).toContain('<circle cx="12.5" cy="12.5" r="6" fill="white" opacity="0.9"/>')
      expect(svgCall).toContain('</svg>')
    })
  })

  describe('getEditionStatus', () => {
    const originalDate = Date

    beforeEach(() => {
      // Mock de la date courante au 15 juin 2024 à 12:00:00 UTC
      const mockDate = new Date('2024-06-15T12:00:00Z')
      vi.spyOn(global, 'Date').mockImplementation(((...args: any[]) => {
        if (args.length === 0) {
          return mockDate
        }
        return new originalDate(...(args as any))
      }) as any)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('devrait détecter un événement en cours', () => {
      const status = getEditionStatus('2024-06-10', '2024-06-20')

      expect(status.isOngoing).toBe(true)
      expect(status.isUpcoming).toBe(false)
      expect(status.isPast).toBe(false)
    })

    it('devrait détecter un événement à venir', () => {
      const status = getEditionStatus('2024-06-20', '2024-06-25')

      expect(status.isUpcoming).toBe(true)
      expect(status.isOngoing).toBe(false)
      expect(status.isPast).toBe(false)
    })

    it('devrait détecter un événement passé', () => {
      const status = getEditionStatus('2024-06-01', '2024-06-10')

      expect(status.isPast).toBe(true)
      expect(status.isUpcoming).toBe(false)
      expect(status.isOngoing).toBe(false)
    })

    it("devrait gérer un événement qui commence aujourd'hui", () => {
      const status = getEditionStatus('2024-06-15', '2024-06-20')

      expect(status.isOngoing).toBe(true)
      expect(status.isUpcoming).toBe(false)
      expect(status.isPast).toBe(false)
    })

    it("devrait gérer un événement qui se termine aujourd'hui", () => {
      const status = getEditionStatus('2024-06-10T00:00:00Z', '2024-06-15T23:59:59Z')

      expect(status.isOngoing).toBe(true)
      expect(status.isUpcoming).toBe(false)
      expect(status.isPast).toBe(false)
    })

    it("devrait gérer un événement d'un jour", () => {
      const status = getEditionStatus('2024-06-15T00:00:00Z', '2024-06-15T23:59:59Z')

      expect(status.isOngoing).toBe(true)
      expect(status.isUpcoming).toBe(false)
      expect(status.isPast).toBe(false)
    })

    it('devrait gérer différents formats de date', () => {
      const testCases = [
        {
          startDate: '2024-06-20T10:00:00Z',
          endDate: '2024-06-25T18:00:00Z',
          expectedUpcoming: true,
        },
        {
          startDate: '2024-06-01T00:00:00.000Z',
          endDate: '2024-06-10T23:59:59.999Z',
          expectedPast: true,
        },
        {
          startDate: '2024-06-14T12:00:00+02:00',
          endDate: '2024-06-16T12:00:00+02:00',
          expectedOngoing: true,
        },
      ]

      testCases.forEach(
        ({ startDate, endDate, expectedUpcoming, expectedPast, expectedOngoing }) => {
          const status = getEditionStatus(startDate, endDate)

          if (expectedUpcoming) {
            expect(status.isUpcoming).toBe(true)
            expect(status.isOngoing).toBe(false)
            expect(status.isPast).toBe(false)
          } else if (expectedPast) {
            expect(status.isPast).toBe(true)
            expect(status.isUpcoming).toBe(false)
            expect(status.isOngoing).toBe(false)
          } else if (expectedOngoing) {
            expect(status.isOngoing).toBe(true)
            expect(status.isUpcoming).toBe(false)
            expect(status.isPast).toBe(false)
          }
        }
      )
    })

    it('devrait maintenir la cohérence logique des statuts', () => {
      const testDates = [
        ['2024-06-01', '2024-06-05'], // Passé
        ['2024-06-10', '2024-06-20'], // En cours
        ['2024-06-25', '2024-06-30'], // À venir
        ['2024-06-15', '2024-06-15'], // Aujourd'hui
      ]

      testDates.forEach(([start, end]) => {
        const status = getEditionStatus(start, end)

        // Un seul statut doit être vrai
        const trueCount = [status.isUpcoming, status.isOngoing, status.isPast].filter(
          Boolean
        ).length
        expect(trueCount).toBe(1)

        // isPast doit être l'inverse des deux autres
        expect(status.isPast).toBe(!status.isUpcoming && !status.isOngoing)
      })
    })
  })
})
