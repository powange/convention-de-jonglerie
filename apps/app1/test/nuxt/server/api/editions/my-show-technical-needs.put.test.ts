import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../../layers/artists/server/api/editions/[id]/my-show-technical-needs.put'

// Mock global de Prisma (test/setup-common.ts)
const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'artist@example.com', pseudo: 'artist' }
const eventWith = (body: any) => {
  global.readBody.mockResolvedValue(body)
  return { context: { user: mockUser } } as any
}

describe('/api/editions/[id]/my-show-technical-needs PUT', () => {
  beforeEach(() => {
    prismaMock.editionArtist.findUnique.mockReset()
    prismaMock.showArtist.findFirst.mockReset()
    prismaMock.showAct.findUnique.mockReset()
    prismaMock.showAct.update.mockReset()
    prismaMock.show.findFirst.mockReset()
    prismaMock.show.update.mockReset()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockImplementation((_e: any, p: string) => (p === 'id' ? '1' : null))
  })

  it('rejette un utilisateur non connecté', async () => {
    global.readBody.mockResolvedValue({ actId: 5, technicalNeeds: 'x' })
    await expect(handler({ context: { user: null } } as any)).rejects.toThrow('Unauthorized')
  })

  it("rejette (404) si l'utilisateur n'est pas artiste de l'édition", async () => {
    prismaMock.editionArtist.findUnique.mockResolvedValue(null)
    await expect(handler(eventWith({ actId: 5, technicalNeeds: 'x' }))).rejects.toThrow(
      /pas artiste/
    )
  })

  describe('numéro de cabaret (actId)', () => {
    beforeEach(() => {
      prismaMock.editionArtist.findUnique.mockResolvedValue({ id: 10 })
    })

    it("rejette (403) si l'artiste ne participe pas au numéro", async () => {
      prismaMock.showArtist.findFirst.mockResolvedValue(null)
      await expect(
        handler(eventWith({ actId: 5, technicalNeeds: 'x', expectedTechnicalNeeds: null }))
      ).rejects.toThrow(/ne participez pas à ce numéro/)
    })

    it('renvoie conflict si la valeur a changé entre-temps (pas d’écrasement)', async () => {
      prismaMock.showArtist.findFirst.mockResolvedValue({ id: 99 })
      prismaMock.showAct.findUnique.mockResolvedValue({
        technicalNeeds: 'valeur ACTUELLE',
        stageSetup: null,
      })

      const result = await handler(
        eventWith({
          actId: 5,
          technicalNeeds: 'ma nouvelle valeur',
          stageSetup: 'ma mise en place',
          expectedTechnicalNeeds: 'valeur que j’avais chargée',
          expectedStageSetup: null,
        })
      )

      expect(result.data.conflict).toBe(true)
      expect(result.data.current.technicalNeeds).toBe('valeur ACTUELLE')
      expect(prismaMock.showAct.update).not.toHaveBeenCalled()
    })

    it('met à jour le numéro quand la valeur d’origine correspond', async () => {
      prismaMock.showArtist.findFirst.mockResolvedValue({ id: 99 })
      prismaMock.showAct.findUnique.mockResolvedValue({
        technicalNeeds: 'ancien',
        stageSetup: 'ancienne mise en place',
      })
      prismaMock.showAct.update.mockResolvedValue({
        technicalNeeds: 'nouveau',
        stageSetup: 'nouvelle mise en place',
      })

      const result = await handler(
        eventWith({
          actId: 5,
          technicalNeeds: 'nouveau',
          stageSetup: 'nouvelle mise en place',
          expectedTechnicalNeeds: 'ancien',
          expectedStageSetup: 'ancienne mise en place',
        })
      )

      expect(result.data.conflict).toBe(false)
      expect(result.data.technicalNeeds).toBe('nouveau')
      expect(prismaMock.showAct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: { technicalNeeds: 'nouveau', stageSetup: 'nouvelle mise en place' },
        })
      )
    })
  })

  describe('spectacle standard (showId)', () => {
    beforeEach(() => {
      prismaMock.editionArtist.findUnique.mockResolvedValue({ id: 10 })
    })

    it('rejette (400) si le spectacle est un cabaret', async () => {
      prismaMock.show.findFirst.mockResolvedValue({ type: 'CABARET', technicalNeeds: null })
      await expect(
        handler(eventWith({ showId: 3, technicalNeeds: 'x', expectedTechnicalNeeds: null }))
      ).rejects.toThrow(/cabaret/)
    })

    it("rejette (403) si l'artiste ne participe pas au spectacle", async () => {
      prismaMock.show.findFirst.mockResolvedValue({ type: 'STANDARD', technicalNeeds: null })
      prismaMock.showArtist.findFirst.mockResolvedValue(null)
      await expect(
        handler(eventWith({ showId: 3, technicalNeeds: 'x', expectedTechnicalNeeds: null }))
      ).rejects.toThrow(/ne participez pas à ce spectacle/)
    })

    it('met à jour les besoins techniques du spectacle standard', async () => {
      prismaMock.show.findFirst.mockResolvedValue({ type: 'STANDARD', technicalNeeds: 'ancien' })
      prismaMock.showArtist.findFirst.mockResolvedValue({ id: 42 })
      prismaMock.show.update.mockResolvedValue({ technicalNeeds: 'nouveau' })

      const result = await handler(
        eventWith({ showId: 3, technicalNeeds: 'nouveau', expectedTechnicalNeeds: 'ancien' })
      )

      expect(result.data.conflict).toBe(false)
      expect(result.data.technicalNeeds).toBe('nouveau')
      expect(prismaMock.show.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 }, data: { technicalNeeds: 'nouveau' } })
      )
    })
  })
})
