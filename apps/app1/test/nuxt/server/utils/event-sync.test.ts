import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  syncEventMetadataFromEdition,
  syncEventsForConvention,
} from '../../../../server/utils/event-sync'

// Mock global de Prisma défini dans test/setup-common.ts (passé explicitement comme client)
const prismaMock = (globalThis as any).prisma

describe('event-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('syncEventMetadataFromEdition', () => {
    it('recopie nom/dates/statut sur l’Event (nom = « Convention - Edition »)', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        eventId: 10,
        name: 'Été 2026',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-03'),
        status: 'PUBLISHED',
        convention: { name: 'Festival Jonglerie' },
      })

      await syncEventMetadataFromEdition(5, prismaMock)

      expect(prismaMock.event.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          name: 'Festival Jonglerie - Été 2026',
          startDate: new Date('2026-07-01'),
          endDate: new Date('2026-07-03'),
          status: 'PUBLISHED',
        },
      })
    })

    it('utilise le seul nom de convention si l’édition n’a pas de nom', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        eventId: 11,
        name: null,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-03'),
        status: 'OFFLINE',
        convention: { name: 'Festival Jonglerie' },
      })

      await syncEventMetadataFromEdition(6, prismaMock)

      expect(prismaMock.event.update.mock.calls[0][0].data.name).toBe('Festival Jonglerie')
    })

    it('ne fait rien si l’édition est introuvable', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)

      await syncEventMetadataFromEdition(999, prismaMock)

      expect(prismaMock.event.update).not.toHaveBeenCalled()
    })
  })

  describe('syncEventsForConvention', () => {
    it('re-synchronise chaque édition de la convention', async () => {
      prismaMock.edition.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }])
      prismaMock.edition.findUnique.mockResolvedValue({
        eventId: 1,
        name: 'E',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-03'),
        status: 'PUBLISHED',
        convention: { name: 'C' },
      })

      await syncEventsForConvention(42, prismaMock)

      expect(prismaMock.edition.findMany).toHaveBeenCalledWith({
        where: { conventionId: 42 },
        select: { id: true },
      })
      expect(prismaMock.event.update).toHaveBeenCalledTimes(2)
    })
  })
})
