import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultLostFoundPorts } from '../../../../../server/lost-found/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('port event du module objets trouvés (câblage jonglerie)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getEventTiming', () => {
    it('lit l’existence + la date de début de l’Edition', async () => {
      const startDate = new Date('2026-07-01')
      prismaMock.edition.findUnique.mockResolvedValue({ startDate })

      const res = await createDefaultLostFoundPorts().event.getEventTiming(10)

      expect(res).toEqual({ found: true, startDate })
      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { startDate: true },
      })
    })

    it('édition introuvable → found:false, startDate:null', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      expect(await createDefaultLostFoundPorts().event.getEventTiming(999)).toEqual({
        found: false,
        startDate: null,
      })
    })
  })
})
