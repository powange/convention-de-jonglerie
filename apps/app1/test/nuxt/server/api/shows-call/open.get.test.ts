import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/shows-call/open.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/shows-call/open GET', () => {
  const mockConvention = {
    id: 1,
    name: 'Convention de Jonglerie',
    logo: 'https://example.com/logo.png',
  }

  const mockEdition = {
    id: 1,
    name: 'Édition 2025',
    startDate: new Date('2025-07-01'),
    endDate: new Date('2025-07-05'),
    city: 'Paris',
    country: 'France',
    imageUrl: 'https://example.com/edition.jpg',
    convention: mockConvention,
  }

  const mockShowCall = {
    id: 1,
    name: 'Appel à spectacles principal',
    visibility: 'PUBLIC',
    mode: 'INTERNAL',
    externalUrl: null,
    description: "Description de l'appel à spectacles",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Dans 7 jours
    askPortfolioUrl: true,
    askVideoUrl: true,
    askTechnicalNeeds: true,
    askAccommodation: false,
    edition: mockEdition,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Accès public', () => {
    it('devrait retourner les appels à spectacles ouverts sans authentification', async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCall])

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.showCalls).toHaveLength(1)
      expect(result.count).toBe(1)
      expect(result.showCalls[0]).toMatchObject({
        id: mockShowCall.id,
        name: mockShowCall.name,
        visibility: mockShowCall.visibility,
        mode: mockShowCall.mode,
      })
    })

    it('devrait retourner un tableau vide si aucun appel ouvert', async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([])

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.showCalls).toHaveLength(0)
      expect(result.count).toBe(0)
    })
  })

  describe('Filtrage des appels', () => {
    it('devrait filtrer uniquement les appels ouverts (visibility: PUBLIC)', async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCall])

      const mockEvent = { context: {} }

      await handler(mockEvent as any)

      expect(prismaMock.editionShowCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visibility: 'PUBLIC',
          }),
        })
      )
    })

    it('devrait filtrer sur les éditions publiées', async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCall])

      const mockEvent = { context: {} }

      await handler(mockEvent as any)

      expect(prismaMock.editionShowCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            edition: expect.objectContaining({
              status: 'PUBLISHED',
            }),
          }),
        })
      )
    })

    it("devrait filtrer sur les éditions dont la date de fin n'est pas passée", async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCall])

      const mockEvent = { context: {} }

      await handler(mockEvent as any)

      expect(prismaMock.editionShowCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            edition: expect.objectContaining({
              endDate: expect.objectContaining({
                gte: expect.any(Date),
              }),
            }),
          }),
        })
      )
    })
  })

  describe('Données retournées', () => {
    it("devrait inclure les informations de l'édition", async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCall])

      const mockEvent = { context: {} }

      const result = await handler(mockEvent as any)

      expect(result.showCalls[0].edition).toMatchObject({
        id: mockEdition.id,
        name: mockEdition.name,
        city: mockEdition.city,
        country: mockEdition.country,
      })
    })

    it('devrait inclure les informations de la convention', async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCall])

      const mockEvent = { context: {} }

      const result = await handler(mockEvent as any)

      expect(result.showCalls[0].edition.convention).toMatchObject({
        id: mockConvention.id,
        name: mockConvention.name,
        logo: mockConvention.logo,
      })
    })

    it('devrait inclure les champs du formulaire', async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCall])

      const mockEvent = { context: {} }

      const result = await handler(mockEvent as any)

      expect(result.showCalls[0]).toMatchObject({
        askPortfolioUrl: mockShowCall.askPortfolioUrl,
        askVideoUrl: mockShowCall.askVideoUrl,
        askTechnicalNeeds: mockShowCall.askTechnicalNeeds,
        askAccommodation: mockShowCall.askAccommodation,
      })
    })
  })

  describe('Tri des résultats', () => {
    it('devrait trier par date limite puis par date de début', async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([])

      const mockEvent = { context: {} }

      await handler(mockEvent as any)

      expect(prismaMock.editionShowCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ deadline: 'asc' }, { edition: { startDate: 'asc' } }],
        })
      )
    })
  })

  describe('Appels avec mode EXTERNAL', () => {
    it("devrait retourner l'URL externe si mode EXTERNAL", async () => {
      const externalShowCall = {
        ...mockShowCall,
        mode: 'EXTERNAL',
        externalUrl: 'https://external-form.com',
      }
      prismaMock.editionShowCall.findMany.mockResolvedValue([externalShowCall])

      const mockEvent = { context: {} }

      const result = await handler(mockEvent as any)

      expect(result.showCalls[0].mode).toBe('EXTERNAL')
      expect(result.showCalls[0].externalUrl).toBe('https://external-form.com')
    })
  })

  describe('Plusieurs appels ouverts', () => {
    it('devrait retourner plusieurs appels de différentes éditions', async () => {
      const mockEdition2 = {
        ...mockEdition,
        id: 2,
        name: 'Édition 2025 Bis',
        city: 'Lyon',
      }

      const showCall2 = {
        ...mockShowCall,
        id: 2,
        name: 'Autre appel',
        edition: mockEdition2,
      }

      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCall, showCall2])

      const mockEvent = { context: {} }

      const result = await handler(mockEvent as any)

      expect(result.showCalls).toHaveLength(2)
      expect(result.count).toBe(2)
      expect(result.showCalls[0].edition.id).toBe(1)
      expect(result.showCalls[1].edition.id).toBe(2)
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.editionShowCall.findMany.mockRejectedValue(new Error('Database error'))

      const mockEvent = { context: {} }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })
})
