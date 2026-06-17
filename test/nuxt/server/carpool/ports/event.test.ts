import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultCarpoolPorts } from '../../../../../server/carpool/ports/default-binding'

const prismaMock = (globalThis as any).prisma

describe('port event du module covoiturage (câblage jonglerie)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('eventExists', () => {
    it('true quand l’édition existe', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({ id: 10 })
      expect(await createDefaultCarpoolPorts().event.eventExists(10)).toBe(true)
      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { id: true },
      })
    })

    it('false quand l’édition est introuvable', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      expect(await createDefaultCarpoolPorts().event.eventExists(999)).toBe(false)
    })
  })
})
