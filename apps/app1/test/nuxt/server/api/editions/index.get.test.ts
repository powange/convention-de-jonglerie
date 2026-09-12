import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/editions/index.get'
import { global } from '../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Mock des utilitaires
vi.mock('../../../../server/utils/email-hash', () => ({
  getEmailHash: vi.fn((email: string) => `hash_${email}`),
}))

describe('/api/editions GET', () => {
  const mockEdition = {
    id: 1,
    conventionId: 1,
    name: 'Edition 2024',
    description: 'Description test',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    addressLine1: '123 rue Test',
    addressLine2: null,
    postalCode: '75001',
    city: 'Paris',
    region: 'Île-de-France',
    country: 'France',
    latitude: 48.8566,
    longitude: 2.3522,
    imageUrl: null,
    creatorId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    hasFoodTrucks: true,
    hasKidsZone: false,
    acceptsPets: true,
    hasTentCamping: true,
    hasTruckCamping: false,
    hasFamilyCamping: true,
    hasSleepingRoom: true,
    hasGym: true,
    hasFireSpace: false,
    hasGala: true,
    hasOpenStage: true,
    hasConcert: false,
    hasCantine: true,
    hasAerialSpace: false,
    hasSlacklineSpace: true,
    hasToilets: true,
    hasShowers: true,
    hasAccessibility: true,
    hasWorkshops: true,
    hasLongShow: false,
    hasATM: true,
    status: 'PUBLISHED',
    creator: {
      id: 1,
      pseudo: 'testuser',
    },
    favoritedBy: [],
    convention: {
      id: 1,
      name: 'Convention Test',
      description: 'Description convention',
      logo: null,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getQuery = vi.fn()
  })

  it('devrait retourner toutes les éditions avec pagination', async () => {
    global.getQuery.mockReturnValue({})
    prismaMock.edition.count.mockResolvedValue(25)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    const result = await handler(mockEvent as any)

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('pagination')
    expect(result.data).toHaveLength(1)
    expect(result.pagination.totalCount).toBe(25)
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.limit).toBe(12)
    expect(result.pagination.totalPages).toBe(3)
  })

  it('devrait supporter la pagination avec page et limit', async () => {
    global.getQuery.mockReturnValue({ page: '2', limit: '10' })
    prismaMock.edition.count.mockResolvedValue(50)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    const result = await handler(mockEvent as any)

    expect(result.pagination.page).toBe(2)
    expect(result.pagination.limit).toBe(10)
    expect(result.pagination.totalPages).toBe(5)

    expect(prismaMock.edition.findMany).toHaveBeenCalledWith({
      where: { status: { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] } },
      select: expect.any(Object),
      orderBy: { startDate: 'asc' },
      skip: 10, // (page 2 - 1) * limit 10
      take: 10,
    })
  })

  it('devrait filtrer par nom', async () => {
    global.getQuery.mockReturnValue({ name: 'Test Convention' })
    prismaMock.edition.count.mockResolvedValue(5)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    await handler(mockEvent as any)

    expect(prismaMock.edition.count).toHaveBeenCalledWith({
      where: {
        name: { contains: 'Test Convention' },
        status: { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] },
      },
    })
  })

  it('devrait filtrer par pays', async () => {
    global.getQuery.mockReturnValue({ countries: '["France","Belgium"]' })
    prismaMock.edition.count.mockResolvedValue(10)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    await handler(mockEvent as any)

    // Vérifie que la requête inclut les pays demandés avec leurs variantes (i18n-iso-countries)
    expect(prismaMock.edition.count).toHaveBeenCalled()
    const callArgs = prismaMock.edition.count.mock.calls[0][0] as {
      where: { country: { in: string[] } }
    }
    expect(callArgs.where.country.in).toContain('France')
    expect(callArgs.where.country.in).toContain('Belgium')
    // Les variantes multilingues sont également incluses (ex: Frankreich, Belgique)
    expect(callArgs.where.country.in.length).toBeGreaterThan(2)
    expect(callArgs.where.status).toEqual({ in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] })
  })

  it('devrait filtrer par dates', async () => {
    const startDate = '2024-06-01'
    const endDate = '2024-06-30'
    global.getQuery.mockReturnValue({ startDate, endDate })
    prismaMock.edition.count.mockResolvedValue(3)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    await handler(mockEvent as any)

    expect(prismaMock.edition.count).toHaveBeenCalledWith({
      where: {
        startDate: { gte: new Date(startDate) },
        endDate: { lte: new Date(endDate) },
        status: { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] },
      },
    })
  })

  it('devrait filtrer par services', async () => {
    global.getQuery.mockReturnValue({
      hasFoodTrucks: 'true',
      hasToilets: 'true',
      acceptsPets: 'true',
    })
    prismaMock.edition.count.mockResolvedValue(2)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    await handler(mockEvent as any)

    expect(prismaMock.edition.count).toHaveBeenCalledWith({
      where: {
        hasFoodTrucks: true,
        hasToilets: true,
        acceptsPets: true,
        status: { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] },
      },
    })
  })

  it('devrait filtrer par période temporelle', async () => {
    global.getQuery.mockReturnValue({
      showPast: 'true',
      showCurrent: 'false',
      showFuture: 'true',
    })
    prismaMock.edition.count.mockResolvedValue(15)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    await handler(mockEvent as any)

    const expectedWhere = expect.objectContaining({
      AND: expect.arrayContaining([
        { status: { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] } },
        expect.objectContaining({
          OR: expect.arrayContaining([
            { endDate: { lt: expect.any(Date) } }, // showPast
            { startDate: { gt: expect.any(Date) } }, // showFuture
          ]),
        }),
      ]),
    })

    expect(prismaMock.edition.count).toHaveBeenCalledWith({
      where: expectedWhere,
    })
  })

  it("devrait gérer les organisateurs d'édition si disponible", async () => {
    global.getQuery.mockReturnValue({})
    prismaMock.edition.count.mockResolvedValue(1)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({}) // Table existe

    const mockEvent = {}
    const result = await handler(mockEvent as any)

    expect(result.data[0]).toBeDefined()
    expect(result.data[0].id).toBe(1)
    // Note: Les organisateurs ne sont pas inclus dans l'API de liste des éditions
    // Cette fonctionnalité pourrait être ajoutée plus tard si nécessaire
  })

  it('devrait gérer les erreurs', async () => {
    global.getQuery.mockReturnValue({})
    prismaMock.edition.count.mockRejectedValue(new Error('Database error'))

    const mockEvent = {}

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait trier par date de début croissante', async () => {
    global.getQuery.mockReturnValue({})
    prismaMock.edition.count.mockResolvedValue(1)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    await handler(mockEvent as any)

    expect(prismaMock.edition.findMany).toHaveBeenCalledWith({
      where: { status: { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] } },
      select: expect.any(Object),
      orderBy: { startDate: 'asc' },
      skip: 0,
      take: 12,
    })
  })

  it('ne devrait rien retourner si aucun filtre temporel actif', async () => {
    global.getQuery.mockReturnValue({
      showPast: 'false',
      showCurrent: 'false',
      showFuture: 'false',
    })
    prismaMock.edition.count.mockResolvedValue(0)
    prismaMock.edition.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    const result = await handler(mockEvent as any)

    expect(result.data).toHaveLength(0)
    expect(prismaMock.edition.count).toHaveBeenCalledWith({
      where: { id: -1 }, // Condition impossible
    })
  })

  it('devrait afficher par défaut les éditions publiées, planifiées et annulées', async () => {
    global.getQuery.mockReturnValue({})
    prismaMock.edition.count.mockResolvedValue(5)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    await handler(mockEvent as any)

    expect(prismaMock.edition.count).toHaveBeenCalledWith({
      where: { status: { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] } },
    })
    expect(prismaMock.edition.findMany).toHaveBeenCalledWith({
      where: { status: { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] } },
      select: expect.any(Object),
      orderBy: { startDate: 'asc' },
      skip: 0,
      take: 12,
    })
  })

  /**
   * Ce test disait l'inverse jusqu'à la PR qui l'a retourné : il s'appelait « devrait inclure les
   * éditions hors ligne si includeOffline=true » et vérifiait qu'un appel **sans session ni
   * utilisateur** — `mockEvent = {}`, exactement comme ci-dessous — obtenait bien les éditions
   * `OFFLINE`. Il ne constatait pas la faille, il l'entérinait.
   *
   * Une édition `OFFLINE` est « complète mais volontairement cachée ». La route est publique
   * (`public-routes.ts`, sans session) : aucun paramètre ne doit pouvoir lever ce filtre.
   */
  it('ne montre pas les éditions cachées, même si l’URL le demande', async () => {
    global.getQuery.mockReturnValue({ includeOffline: 'true' })
    prismaMock.edition.count.mockResolvedValue(10)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    const mockEvent = {}
    await handler(mockEvent as any)

    for (const appel of [
      prismaMock.edition.count.mock.calls[0][0],
      prismaMock.edition.findMany.mock.calls[0][0],
    ]) {
      expect(appel.where.status.in).not.toContain('OFFLINE')
      expect(appel.where.status).toEqual({ in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] })
    }
  })

  it('rend exactement la même chose avec et sans le paramètre', async () => {
    // Le contrôle qui compte : ce n'est pas seulement que OFFLINE a disparu, c'est que le
    // paramètre ne change plus *rien*. Sans cette comparaison, une nouvelle branche pourrait
    // réintroduire un traitement particulier sans faire tomber le test ci-dessus.
    prismaMock.edition.count.mockResolvedValue(10)
    prismaMock.edition.findMany.mockResolvedValue([mockEdition])
    prismaMock.editionOrganizer.findFirst.mockRejectedValue(new Error('Table not found'))

    global.getQuery.mockReturnValue({})
    await handler({} as any)
    const sansParametre = prismaMock.edition.findMany.mock.calls[0][0]

    global.getQuery.mockReturnValue({ includeOffline: 'true' })
    await handler({} as any)
    const avecParametre = prismaMock.edition.findMany.mock.calls[1][0]

    expect(avecParametre).toEqual(sansParametre)
  })
})
