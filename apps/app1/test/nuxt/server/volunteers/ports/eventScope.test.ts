import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createDefaultVolunteerPorts } from '../../../../../server/volunteers/ports/default-binding'
import {
  setVolunteerPorts,
  useVolunteerPorts,
} from '../../../../../server/volunteers/ports/registry'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('port eventScope (câblage jonglerie par défaut)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRelatedEventIds', () => {
    it('retourne les eventId des éditions sœurs en une seule requête', async () => {
      prismaMock.edition.findMany.mockResolvedValue([
        { eventId: 10 },
        { eventId: 11 },
        { eventId: 12 },
      ])

      const ids = await createDefaultVolunteerPorts().eventScope.getRelatedEventIds(10)

      expect(ids).toEqual([10, 11, 12])
      expect(prismaMock.edition.findMany).toHaveBeenCalledTimes(1)
      expect(prismaMock.edition.findMany).toHaveBeenCalledWith({
        where: { convention: { editions: { some: { id: 10 } } } },
        select: { eventId: true },
      })
    })

    it('retombe sur [eventId] si aucune édition trouvée', async () => {
      prismaMock.edition.findMany.mockResolvedValue([])

      const ids = await createDefaultVolunteerPorts().eventScope.getRelatedEventIds(99)

      expect(ids).toEqual([99])
    })
  })

  /*
   * Ces deux méthodes remplacent des lectures directes d'`Edition` que le layer bénévoles avait
   * réintroduites (créneaux récurrents, rappels, notifications d'échanges) : le fuseau et le nom
   * affiché doivent rester EXACTEMENT ceux d'avant.
   */
  describe('getTimezone', () => {
    it("rend le fuseau de l'édition", async () => {
      prismaMock.edition.findUnique.mockResolvedValue({ timezone: 'America/Montreal' })

      const fuseau = await createDefaultVolunteerPorts().eventScope.getTimezone(10)

      expect(fuseau).toBe('America/Montreal')
      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { timezone: true },
      })
    })

    it('rend null quand le fuseau ou l’édition manquent', async () => {
      prismaMock.edition.findUnique.mockResolvedValueOnce({ timezone: null })
      prismaMock.edition.findUnique.mockResolvedValueOnce(null)
      const ports = createDefaultVolunteerPorts()

      expect(await ports.eventScope.getTimezone(10)).toBeNull()
      expect(await ports.eventScope.getTimezone(99)).toBeNull()
    })
  })

  describe('getDisplayName', () => {
    it("préfère le nom de l'édition", async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        name: 'Édition 2027',
        convention: { name: 'Conv' },
      })

      expect(await createDefaultVolunteerPorts().eventScope.getDisplayName(10)).toBe('Édition 2027')
    })

    it("retombe sur le nom de la convention quand l'édition n'en a pas", async () => {
      prismaMock.edition.findUnique.mockResolvedValue({ name: null, convention: { name: 'Conv' } })

      expect(await createDefaultVolunteerPorts().eventScope.getDisplayName(10)).toBe('Conv')
    })

    it('rend null pour une édition introuvable — les appelants ne notifient alors personne', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)

      expect(await createDefaultVolunteerPorts().eventScope.getDisplayName(99)).toBeNull()
    })
  })

  describe('getEventDisplayData', () => {
    it('mappe ville/pays/image/convention par eventId', async () => {
      prismaMock.edition.findMany.mockResolvedValue([
        {
          eventId: 10,
          city: 'Lyon',
          country: 'France',
          imageUrl: 'a.png',
          convention: { id: 1, name: 'Conv', logo: 'l.png' },
        },
      ])

      const data = await createDefaultVolunteerPorts().eventScope.getEventDisplayData([10])

      expect(data).toEqual({
        10: {
          city: 'Lyon',
          country: 'France',
          imageUrl: 'a.png',
          convention: { id: 1, name: 'Conv', logo: 'l.png' },
        },
      })
      expect(prismaMock.edition.findMany).toHaveBeenCalledWith({
        where: { eventId: { in: [10] } },
        select: {
          eventId: true,
          city: true,
          country: true,
          imageUrl: true,
          convention: { select: { id: true, name: true, logo: true } },
        },
      })
    })

    it('court-circuite sans requête pour une liste vide', async () => {
      const data = await createDefaultVolunteerPorts().eventScope.getEventDisplayData([])

      expect(data).toEqual({})
      expect(prismaMock.edition.findMany).not.toHaveBeenCalled()
    })

    it('ne renvoie aucune clé réservée (id/name/dates/volunteers*)', async () => {
      prismaMock.edition.findMany.mockResolvedValue([
        {
          eventId: 10,
          city: 'Lyon',
          country: 'France',
          imageUrl: null,
          convention: { id: 1, name: 'Conv', logo: null },
        },
      ])

      const data = await createDefaultVolunteerPorts().eventScope.getEventDisplayData([10])

      for (const key of ['id', 'name', 'startDate', 'endDate']) {
        expect(data[10]).not.toHaveProperty(key)
      }
      expect(Object.keys(data[10]).some((k) => k.startsWith('volunteers'))).toBe(false)
    })
  })

  describe('setVolunteerPorts (surcharge 2ᵉ app)', () => {
    afterEach(() => {
      setVolunteerPorts(null)
    })

    it('une surcharge remplace le câblage par défaut, eventScope inclus', async () => {
      const getRelatedEventIds = vi.fn(async (id: number) => [id])
      const getEventDisplayData = vi.fn(async () => ({}))
      // Remplacement complet en repartant du défaut puis en écrasant le port eventScope
      setVolunteerPorts({
        ...createDefaultVolunteerPorts(),
        eventScope: { getRelatedEventIds, getEventDisplayData },
      })

      const ids = await useVolunteerPorts().eventScope.getRelatedEventIds(7)

      expect(ids).toEqual([7])
      expect(getRelatedEventIds).toHaveBeenCalledWith(7)
      // La surcharge n'a pas touché au câblage jonglerie (pas de lecture Edition).
      expect(prismaMock.edition.findMany).not.toHaveBeenCalled()
    })
  })
})
