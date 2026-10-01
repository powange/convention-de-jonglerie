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

    it('🔬 devrait annoncer les éditions PUBLIÉES *et* PLANIFIÉES, mais pas les autres', async () => {
      /*
       * ⚠️ CE QUI N'ALLAIT PAS : `status: 'PUBLISHED'` en dur. Les appels d'une édition `PLANNED`
       * étaient ABSENTS de cette liste, alors que leur page reste atteignable par son adresse et
       * que le serveur accepte d'y candidater (`applications/index.post.ts`). Une édition annoncée
       * mais pas encore publiée est précisément celle qui cherche des artistes.
       *
       * La liste est l'INTERSECTION de deux règles qui existaient déjà : ce qu'un visiteur peut
       * voir (tout sauf `OFFLINE`) et ce qui accueille des candidatures (tout sauf `CANCELLED`).
       * On mesure donc les quatre statuts, et non la seule présence de `PLANNED` : c'est
       * l'intersection qui porte le sens, et une règle élargie à `OFFLINE` ou `CANCELLED` serait
       * un défaut d'un autre genre — la première exposerait une édition cachée, la seconde
       * enverrait des dossiers pour un événement qui n'aura pas lieu.
       */
      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCall])

      const mockEvent = { context: {} }

      await handler(mockEvent as any)

      const where = prismaMock.editionShowCall.findMany.mock.calls[0][0].where
      expect([...where.edition.status.in].sort()).toEqual(['PLANNED', 'PUBLISHED'])
    })

    it('🔬 devrait écarter les appels dont la DATE LIMITE est passée', async () => {
      /*
       * ⚠️ LE DÉFAUT PRINCIPAL DU POINT : le filtre ne portait que sur la visibilité de l'appel et
       * la date de fin de l'ÉDITION. Un appel dont l'échéance était dépassée restait listé avec son
       * bouton « Postuler maintenant », et c'est la page de candidature qui annonçait ensuite que
       * c'était trop tard. Une liste intitulée « appels ouverts » ne doit pas s'en remettre à
       * l'écran suivant pour dire non.
       *
       * On mesure la REQUÊTE et non le résultat : le mock de Prisma ignore le `where`, donc un
       * test qui compterait les appels rendus resterait vert avec le filtre retiré.
       */
      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCall])

      const mockEvent = { context: {} }

      await handler(mockEvent as any)

      const where = prismaMock.editionShowCall.findMany.mock.calls[0][0].where
      expect(where.OR).toEqual([{ deadline: null }, { deadline: { gte: expect.any(Date) } }])
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
    it('🔬 place les appels SANS date limite en DERNIER', async () => {
      /*
       * ⚠️ MySQL place les NULL EN TÊTE d'un `ORDER BY ... ASC` : les appels sans échéance
       * arrivaient donc AVANT les plus urgents, soit l'inverse de ce que la page promet. L'option
       * `nulls` de Prisma relève du drapeau d'aperçu `orderByNulls`, que le schéma de ce dépôt
       * n'active pas — le tri se termine donc en mémoire.
       *
       * La base rend ici l'ordre qu'elle produirait réellement : les NULL devant.
       */
      const sansEcheance = { ...mockShowCall, id: 10, name: 'Sans échéance', deadline: null }
      const dansDeuxJours = {
        ...mockShowCall,
        id: 11,
        name: 'Urgent',
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      }
      prismaMock.editionShowCall.findMany.mockResolvedValue([sansEcheance, dansDeuxJours])

      const result = await handler({ context: {} } as any)

      expect(result.showCalls.map((c: any) => c.id)).toEqual([11, 10])
    })

    it('ne REMANIE PAS l’ordre que la base a établi entre les appels datés', async () => {
      /*
       * 🔬 Le tri de JavaScript est stable depuis ES2019, et on s'en sert : ne comparer que
       * « a-t-il une échéance ? » conserve l'ordre de la base à l'intérieur de chaque groupe.
       * Trier sur la date elle-même referait le travail du `orderBy` — et perdrait son critère
       * secondaire, la date de début d'édition.
       */
      const a = { ...mockShowCall, id: 1, deadline: new Date('2026-07-01') }
      const b = { ...mockShowCall, id: 2, deadline: new Date('2026-08-01') }
      const c = { ...mockShowCall, id: 3, deadline: null }
      prismaMock.editionShowCall.findMany.mockResolvedValue([c, a, b])

      const result = await handler({ context: {} } as any)

      expect(result.showCalls.map((x: any) => x.id)).toEqual([1, 2, 3])
      expect(result.count).toBe(3)
    })

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
