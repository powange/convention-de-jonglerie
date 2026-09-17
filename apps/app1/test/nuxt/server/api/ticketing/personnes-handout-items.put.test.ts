import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

import artistesHandler from '../../../../../server/api/editions/[id]/ticketing/artists/handout-items/index.put'
import organisateursHandler from '../../../../../server/api/editions/[id]/ticketing/organizers/handout-items/index.put'
import benevolesHandler from '../../../../../server/api/editions/[id]/ticketing/volunteers/handout-items/index.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 1, pseudo: 'orga' } } }

const envoyer = (handler: any, body: unknown) => {
  global.readBody = vi.fn().mockResolvedValue(body)
  return handler(evenement as any)
}

const lignesEcrites = (modele: string) =>
  prismaMock[modele].createMany.mock.calls[0]?.[0]?.data ?? []

const porteeEffacee = (modele: string) => prismaMock[modele].deleteMany.mock.calls[0]?.[0]?.where

beforeEach(() => {
  vi.clearAllMocks()
  mockCanManage.mockResolvedValue(true)
  // L'interrupteur « articles à remettre » est allumé par défaut.
  prismaMock.edition.findUnique.mockResolvedValue({ ticketingHandoutItemsEnabled: true })
  // Par défaut, tous les articles demandés appartiennent bien à l'édition.
  prismaMock.ticketingHandoutItem.count.mockImplementation(async ({ where }: any) =>
    Array.isArray(where?.id?.in) ? where.id.in.length : 0
  )
  prismaMock.volunteerTeam.findFirst.mockResolvedValue({ id: 'equipe-accueil' })
  prismaMock.editionOrganizer.findFirst.mockResolvedValue({ id: 7 })
  for (const modele of [
    'editionVolunteerHandoutItem',
    'editionOrganizerHandoutItem',
    'editionArtistHandoutItem',
  ]) {
    prismaMock[modele].deleteMany.mockResolvedValue({ count: 0 })
    prismaMock[modele].createMany.mockResolvedValue({ count: 1 })
  }
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
})

describe('PUT /api/editions/[id]/ticketing/volunteers/handout-items', () => {
  it('enregistre une quantité, que rien ne permettait plus de modifier', async () => {
    const result = await envoyer(benevolesHandler, {
      teamId: null,
      handoutItemIds: [{ handoutItemId: 5, quantity: 4 }],
    })

    expect(result.success).toBe(true)
    expect(lignesEcrites('editionVolunteerHandoutItem')).toEqual([
      { editionId: 22, teamId: null, handoutItemId: 5, quantity: 4 },
    ])
  })

  /*
   * Le cœur du remplacement : l'effacement doit être BORNÉ à la portée envoyée.
   *
   * Un `deleteMany` qui oublierait `teamId` viderait toutes les équipes en réglant le global,
   * et l'écran n'en montrerait rien avant le rechargement. C'est la faute que la forme
   * « remplacement complet » rend facile, et ce test la refuse.
   */
  it('n’efface que la portée visée, pas les autres équipes', async () => {
    await envoyer(benevolesHandler, {
      teamId: 'equipe-accueil',
      handoutItemIds: [{ handoutItemId: 5 }],
    })

    expect(porteeEffacee('editionVolunteerHandoutItem')).toEqual({
      editionId: 22,
      teamId: 'equipe-accueil',
    })
  })

  it('traite l’absence de teamId comme la portée globale', async () => {
    await envoyer(benevolesHandler, { handoutItemIds: [] })

    expect(porteeEffacee('editionVolunteerHandoutItem')).toEqual({ editionId: 22, teamId: null })
  })

  it('vide une portée sans rien réécrire quand la sélection est vide', async () => {
    await envoyer(benevolesHandler, { teamId: null, handoutItemIds: [] })

    expect(prismaMock.editionVolunteerHandoutItem.deleteMany).toHaveBeenCalled()
    expect(prismaMock.editionVolunteerHandoutItem.createMany).not.toHaveBeenCalled()
  })

  /*
   * L'ancien POST se défendait d'un doublon global par un `SELECT … FOR UPDATE`, l'index unique
   * ne protégeant pas `(edition, article, NULL)` sous MySQL. Le remplacement n'a plus de lecture
   * à protéger : deux fois le même article se réduisent à une ligne avant l'écriture.
   */
  it('réduit un article envoyé deux fois à une seule ligne', async () => {
    await envoyer(benevolesHandler, {
      teamId: null,
      handoutItemIds: [
        { handoutItemId: 5, quantity: 1 },
        { handoutItemId: 5, quantity: 3 },
      ],
    })

    expect(lignesEcrites('editionVolunteerHandoutItem')).toEqual([
      { editionId: 22, teamId: null, handoutItemId: 5, quantity: 3 },
    ])
  })

  it('refuse une équipe qui n’est pas de cette édition', async () => {
    prismaMock.volunteerTeam.findFirst.mockResolvedValue(null)

    await expect(
      envoyer(benevolesHandler, { teamId: 'ailleurs', handoutItemIds: [] })
    ).rejects.toBeDefined()
    expect(prismaMock.editionVolunteerHandoutItem.deleteMany).not.toHaveBeenCalled()
  })

  it('refuse un article étranger à l’édition', async () => {
    prismaMock.ticketingHandoutItem.count.mockResolvedValue(1) // un seul des deux existe

    await expect(
      envoyer(benevolesHandler, {
        teamId: null,
        handoutItemIds: [{ handoutItemId: 5 }, { handoutItemId: 99 }],
      })
    ).rejects.toBeDefined()
    expect(prismaMock.editionVolunteerHandoutItem.deleteMany).not.toHaveBeenCalled()
  })

  it('refuse un contributeur sans droit sur la billetterie', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(
      envoyer(benevolesHandler, { teamId: null, handoutItemIds: [{ handoutItemId: 5 }] })
    ).rejects.toBeDefined()
    expect(prismaMock.editionVolunteerHandoutItem.deleteMany).not.toHaveBeenCalled()
  })

  // L'interrupteur éteint refuse les écritures. Les quatre points d'API voisins portaient cet
  // appel APRÈS un `throw`, donc jamais atteint : il ne coupait rien.
  it('refuse l’écriture quand la fonctionnalité est éteinte sur l’édition', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({ ticketingHandoutItemsEnabled: false })

    await expect(
      envoyer(benevolesHandler, { teamId: null, handoutItemIds: [{ handoutItemId: 5 }] })
    ).rejects.toBeDefined()
    expect(prismaMock.editionVolunteerHandoutItem.deleteMany).not.toHaveBeenCalled()
  })
})

describe('PUT /api/editions/[id]/ticketing/organizers/handout-items', () => {
  it('enregistre la portée d’un organisateur précis', async () => {
    await envoyer(organisateursHandler, {
      organizerId: 7,
      handoutItemIds: [{ handoutItemId: 5, quantity: 2 }],
    })

    expect(lignesEcrites('editionOrganizerHandoutItem')).toEqual([
      { editionId: 22, organizerId: 7, handoutItemId: 5, quantity: 2 },
    ])
    expect(porteeEffacee('editionOrganizerHandoutItem')).toEqual({
      editionId: 22,
      organizerId: 7,
    })
  })

  it('traite l’absence d’organizerId comme la portée globale', async () => {
    await envoyer(organisateursHandler, { handoutItemIds: [] })

    expect(porteeEffacee('editionOrganizerHandoutItem')).toEqual({
      editionId: 22,
      organizerId: null,
    })
  })

  it('refuse un organisateur qui n’est pas de cette édition', async () => {
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)

    await expect(
      envoyer(organisateursHandler, { organizerId: 999, handoutItemIds: [] })
    ).rejects.toBeDefined()
    expect(prismaMock.editionOrganizerHandoutItem.deleteMany).not.toHaveBeenCalled()
  })
})

describe('PUT /api/editions/[id]/ticketing/artists/handout-items', () => {
  it('remplace les articles de tous les artistes de l’édition', async () => {
    await envoyer(artistesHandler, { handoutItemIds: [{ handoutItemId: 5, quantity: 3 }] })

    expect(lignesEcrites('editionArtistHandoutItem')).toEqual([
      { editionId: 22, handoutItemId: 5, quantity: 3 },
    ])
    expect(porteeEffacee('editionArtistHandoutItem')).toEqual({ editionId: 22 })
  })

  it('accepte encore une liste d’identifiants nus', async () => {
    await envoyer(artistesHandler, { handoutItemIds: [5, 6] })

    expect(lignesEcrites('editionArtistHandoutItem')).toEqual([
      { editionId: 22, handoutItemId: 5, quantity: 1 },
      { editionId: 22, handoutItemId: 6, quantity: 1 },
    ])
  })
})
