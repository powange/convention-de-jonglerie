import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultWorkshopsPorts } from '../../../../../server/workshops/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('port event du module ateliers (câblage jonglerie)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getConfig', () => {
    it('lit les flags + dates de l’Edition', async () => {
      const startDate = new Date('2026-07-01')
      const endDate = new Date('2026-07-05')
      prismaMock.edition.findUnique.mockResolvedValue({
        workshopsEnabled: true,
        workshopLocationsFreeInput: true,
        startDate,
        endDate,
      })

      const res = await createDefaultWorkshopsPorts().event.getConfig(10)

      expect(res).toEqual({
        found: true,
        enabled: true,
        locationsFreeInput: true,
        startDate,
        endDate,
      })
      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: {
          workshopsEnabled: true,
          workshopLocationsFreeInput: true,
          startDate: true,
          endDate: true,
        },
      })
    })

    it('module désactivé + saisie libre off', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        workshopsEnabled: false,
        workshopLocationsFreeInput: false,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-05'),
      })
      const res = await createDefaultWorkshopsPorts().event.getConfig(10)
      expect(res.found).toBe(true)
      expect(res.enabled).toBe(false)
      expect(res.locationsFreeInput).toBe(false)
    })

    it('édition introuvable → found:false, tout désactivé', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      expect(await createDefaultWorkshopsPorts().event.getConfig(999)).toEqual({
        found: false,
        enabled: false,
        locationsFreeInput: false,
        startDate: null,
        endDate: null,
      })
    })
  })
})
