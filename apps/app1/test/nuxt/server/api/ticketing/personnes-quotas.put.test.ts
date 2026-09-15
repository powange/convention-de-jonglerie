import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

import artistesGlobalHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/artists/quotas.put'
import spectacleHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/artists/shows/[showId]/quotas.put'
import organisateurHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/organizers/[editionOrganizerId]/quotas.put'
import globalHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/organizers/quotas.put'
import equipeHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/volunteers/teams/[teamId]/quotas.put'
import benevolesGlobalHandler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/volunteers/quotas.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * L'écriture des quotas d'un organisateur — la ligne globale et celle d'un organisateur nommé.
 *
 * Le point qui mérite d'être tenu ici plutôt qu'à l'écran : sous MySQL, deux NULL sont distincts
 * dans un index unique. `@@unique([editionId, quotaId, organizerId])` ne protège donc PAS la ligne
 * globale contre les doublons, et c'est la suppression préalable qui tient réellement l'unicité.
 */
describe('association des quotas aux personnes présentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
    prismaMock.ticketingQuota.count.mockImplementation(async ({ where }: any) => where.id.in.length)
    for (const table of [
      prismaMock.editionOrganizerQuota,
      prismaMock.editionVolunteerQuota,
      prismaMock.editionArtistQuota,
    ]) {
      table.deleteMany.mockResolvedValue({ count: 0 })
      table.createMany.mockResolvedValue({ count: 1 })
    }
  })

  describe('tous les organisateurs', () => {
    const evenement = { context: { params: { id: '22' }, user: { id: 1, pseudo: 'orga' } } }

    const envoyer = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return globalHandler(evenement as any)
    }

    it('écrit la ligne globale avec un organisateur nul', async () => {
      const result: any = await envoyer({ quotaIds: [5, 6] })

      expect(result.success).toBe(true)
      expect(prismaMock.editionOrganizerQuota.createMany.mock.calls[0][0].data).toEqual([
        { editionId: 22, quotaId: 5, organizerId: null },
        { editionId: 22, quotaId: 6, organizerId: null },
      ])
    })

    it('efface d’abord la ligne globale, et elle seule', async () => {
      // `organizerId: null` dans la clause : sans lui, l'appel emporterait aussi les associations
      // propres à chaque organisateur.
      await envoyer({ quotaIds: [5] })

      expect(prismaMock.editionOrganizerQuota.deleteMany).toHaveBeenCalledWith({
        where: { editionId: 22, organizerId: null },
      })
    })

    it('vide la ligne globale quand on n’envoie rien', async () => {
      await envoyer({ quotaIds: [] })

      expect(prismaMock.editionOrganizerQuota.deleteMany).toHaveBeenCalled()
      expect(prismaMock.editionOrganizerQuota.createMany).not.toHaveBeenCalled()
    })

    it('dédoublonne un quota envoyé deux fois', async () => {
      await envoyer({ quotaIds: [5, 5] })

      expect(prismaMock.editionOrganizerQuota.createMany.mock.calls[0][0].data).toEqual([
        { editionId: 22, quotaId: 5, organizerId: null },
      ])
    })

    it('refuse un quota d’une autre édition, sans rien écrire', async () => {
      prismaMock.ticketingQuota.count.mockResolvedValue(1)

      await expect(envoyer({ quotaIds: [5, 999] })).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.editionOrganizerQuota.deleteMany).not.toHaveBeenCalled()
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer({ quotaIds: [5] })).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('un organisateur nommé', () => {
    const evenement = {
      context: { params: { id: '22', editionOrganizerId: '77' }, user: { id: 1, pseudo: 'orga' } },
    }

    beforeEach(() => {
      prismaMock.editionOrganizer.findFirst.mockResolvedValue({ id: 77 })
    })

    const envoyer = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return organisateurHandler(evenement as any)
    }

    it('écrit les associations de ce seul organisateur', async () => {
      const result: any = await envoyer({ quotaIds: [9] })

      expect(result.success).toBe(true)
      expect(prismaMock.editionOrganizerQuota.deleteMany).toHaveBeenCalledWith({
        where: { editionId: 22, organizerId: 77 },
      })
      expect(prismaMock.editionOrganizerQuota.createMany.mock.calls[0][0].data).toEqual([
        { editionId: 22, quotaId: 9, organizerId: 77 },
      ])
    })

    it('refuse un organisateur qui n’est pas inscrit sur cette édition', async () => {
      prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)

      await expect(envoyer({ quotaIds: [9] })).rejects.toMatchObject({ statusCode: 404 })
      expect(prismaMock.editionOrganizerQuota.deleteMany).not.toHaveBeenCalled()
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyer({ quotaIds: [9] })).rejects.toMatchObject({ statusCode: 403 })
      expect(prismaMock.editionOrganizer.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('bénévoles', () => {
    const envoyerGlobal = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return benevolesGlobalHandler({
        context: { params: { id: '22' }, user: { id: 1, pseudo: 'orga' } },
      } as any)
    }

    const envoyerEquipe = (body: unknown, teamId = 'equipe-accueil') => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return equipeHandler({
        context: { params: { id: '22', teamId }, user: { id: 1, pseudo: 'orga' } },
      } as any)
    }

    it('écrit la ligne globale avec une équipe nulle', async () => {
      await envoyerGlobal({ quotaIds: [5] })

      expect(prismaMock.editionVolunteerQuota.deleteMany).toHaveBeenCalledWith({
        where: { editionId: 22, teamId: null },
      })
      expect(prismaMock.editionVolunteerQuota.createMany.mock.calls[0][0].data).toEqual([
        { editionId: 22, quotaId: 5, teamId: null },
      ])
    })

    it('écrit les quotas d’une équipe sans toucher aux autres', async () => {
      prismaMock.volunteerTeam.findFirst.mockResolvedValue({ id: 'equipe-accueil' })

      await envoyerEquipe({ quotaIds: [9] })

      // La cible est dans le `where` : sans elle, l'appel emporterait la ligne globale et les
      // autres équipes.
      expect(prismaMock.editionVolunteerQuota.deleteMany).toHaveBeenCalledWith({
        where: { editionId: 22, teamId: 'equipe-accueil' },
      })
      expect(prismaMock.editionVolunteerQuota.createMany.mock.calls[0][0].data).toEqual([
        { editionId: 22, quotaId: 9, teamId: 'equipe-accueil' },
      ])
    })

    it('refuse une équipe qui n’est pas de cette édition', async () => {
      prismaMock.volunteerTeam.findFirst.mockResolvedValue(null)

      await expect(envoyerEquipe({ quotaIds: [9] })).rejects.toMatchObject({ statusCode: 404 })
      expect(prismaMock.editionVolunteerQuota.deleteMany).not.toHaveBeenCalled()
    })

    it('cherche l’équipe par eventId, pas par editionId', async () => {
      // Les équipes de bénévolat sont rattachées à l'`Event`. Se tromper de colonne accepterait
      // l'équipe d'une autre édition.
      prismaMock.volunteerTeam.findFirst.mockResolvedValue({ id: 'equipe-accueil' })

      await envoyerEquipe({ quotaIds: [9] })

      expect(prismaMock.volunteerTeam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eventId: 22 }),
        })
      )
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyerGlobal({ quotaIds: [5] })).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('artistes', () => {
    const envoyerGlobal = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return artistesGlobalHandler({
        context: { params: { id: '22' }, user: { id: 1, pseudo: 'orga' } },
      } as any)
    }

    const envoyerSpectacle = (body: unknown) => {
      global.readBody = vi.fn().mockResolvedValue(body)
      return spectacleHandler({
        context: { params: { id: '22', showId: '10' }, user: { id: 1, pseudo: 'orga' } },
      } as any)
    }

    it('écrit la ligne globale avec un spectacle nul', async () => {
      await envoyerGlobal({ quotaIds: [5] })

      expect(prismaMock.editionArtistQuota.createMany.mock.calls[0][0].data).toEqual([
        { editionId: 22, quotaId: 5, showId: null },
      ])
    })

    it('écrit les quotas d’un spectacle', async () => {
      prismaMock.show.findFirst.mockResolvedValue({ id: 10 })

      await envoyerSpectacle({ quotaIds: [9] })

      expect(prismaMock.editionArtistQuota.deleteMany).toHaveBeenCalledWith({
        where: { editionId: 22, showId: 10 },
      })
      expect(prismaMock.editionArtistQuota.createMany.mock.calls[0][0].data).toEqual([
        { editionId: 22, quotaId: 9, showId: 10 },
      ])
    })

    it('refuse un spectacle d’une autre édition', async () => {
      prismaMock.show.findFirst.mockResolvedValue(null)

      await expect(envoyerSpectacle({ quotaIds: [9] })).rejects.toMatchObject({ statusCode: 404 })
      expect(prismaMock.editionArtistQuota.deleteMany).not.toHaveBeenCalled()
    })

    it('refuse à qui ne gère pas la billetterie', async () => {
      mockCanManage.mockResolvedValue(false)

      await expect(envoyerGlobal({ quotaIds: [5] })).rejects.toMatchObject({ statusCode: 403 })
    })
  })
})
