import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows/index.get'

const mockCanAccessEditionData = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: mockCanAccessEditionData,
}))

const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows GET', () => {
  const mockUser = {
    id: 1,
    email: 'organizer@example.com',
    pseudo: 'organizer',
    isGlobalAdmin: false,
  }

  const mockShowWithZone = {
    id: 1,
    editionId: 1,
    title: 'Spectacle Feu',
    description: 'Un spectacle de feu',
    startDateTime: new Date('2024-06-15T14:30:00Z'),
    duration: 30,
    location: 'Scène principale',
    imageUrl: 'show_image.jpg',
    zoneId: 1,
    markerId: null,
    artists: [
      {
        artistId: 1,
        artist: {
          user: { id: 1, email: 'artist@example.com', prenom: 'Jean', nom: 'Dupont' },
        },
      },
    ],
    returnableItems: [
      {
        returnableItemId: 1,
        returnableItem: { id: 1, name: 'Balle de jonglage' },
      },
    ],
    zone: { id: 1, name: 'Scène A', color: '#ff0000', zoneType: 'STAGE' },
    marker: null,
  }

  const mockShowWithMarker = {
    id: 2,
    editionId: 1,
    title: 'Atelier Cirque',
    description: null,
    startDateTime: new Date('2024-06-15T16:00:00Z'),
    duration: 60,
    location: null,
    imageUrl: null,
    zoneId: null,
    markerId: 1,
    artists: [],
    returnableItems: [],
    zone: null,
    marker: { id: 1, name: 'Point Info', color: '#00ff00', markerType: 'INFO' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
      if (param === 'id') return '1'
      return null
    })
  })

  describe('Permissions', () => {
    it('devrait rejeter les utilisateurs non connectés', async () => {
      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Unauthorized')
    })

    it('devrait rejeter les utilisateurs sans droits', async () => {
      mockCanAccessEditionData.mockResolvedValue(false)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/droits/i)
    })
  })

  describe('Listing réussi', () => {
    beforeEach(() => {
      mockCanAccessEditionData.mockResolvedValue(true)
    })

    it('devrait retourner la liste des spectacles avec zone et marqueur', async () => {
      prismaMock.show.findMany.mockResolvedValue([mockShowWithZone, mockShowWithMarker])

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.shows).toHaveLength(2)
      expect(result.data.shows[0].zone).toEqual(expect.objectContaining({ id: 1, name: 'Scène A' }))
      expect(result.data.shows[1].marker).toEqual(
        expect.objectContaining({ id: 1, name: 'Point Info' })
      )
    })

    it('devrait retourner les artistes et articles à restituer', async () => {
      prismaMock.show.findMany.mockResolvedValue([mockShowWithZone])

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      expect(result.data.shows[0].artists).toHaveLength(1)
      expect(result.data.shows[0].artists[0].artist.user.prenom).toBe('Jean')
      expect(result.data.shows[0].returnableItems).toHaveLength(1)
      expect(result.data.shows[0].returnableItems[0].returnableItem.name).toBe('Balle de jonglage')
    })

    it('devrait retourner une liste vide si aucun spectacle', async () => {
      prismaMock.show.findMany.mockResolvedValue([])

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.shows).toHaveLength(0)
    })

    it('devrait trier les spectacles par date de début', async () => {
      prismaMock.show.findMany.mockResolvedValue([mockShowWithZone, mockShowWithMarker])

      const mockEvent = { context: { user: mockUser } }
      await handler(mockEvent as any)

      expect(prismaMock.show.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { startDateTime: 'asc' },
        })
      )
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait rejeter un ID invalide', async () => {
      global.getRouterParam = vi.fn().mockReturnValue('invalid')

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/invalide/i)
    })
  })

  describe("Cas avec l'admin global", () => {
    it("devrait autoriser l'admin global via canAccessEditionData", async () => {
      const adminUser = { ...mockUser, isGlobalAdmin: true }
      mockCanAccessEditionData.mockResolvedValue(true)
      prismaMock.show.findMany.mockResolvedValue([])

      const mockEvent = { context: { user: adminUser } }
      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })
})
