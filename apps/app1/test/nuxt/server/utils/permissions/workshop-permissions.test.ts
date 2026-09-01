import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCanManageWorkshops = vi.hoisted(() => vi.fn())

// canManageWorkshopLocations délègue à canManageWorkshops (droit dédié « gérer les ateliers »)
// après avoir lu l'Edition côté core.
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageWorkshops: mockCanManageWorkshops,
}))

import {
  canCreateWorkshop,
  canManageWorkshopLocations,
} from '../../../../../server/utils/permissions/workshop-permissions'

const prismaMock = (globalThis as any).prisma

const user = { id: 1, isGlobalAdmin: false } as any

describe('canManageWorkshopLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('false si l’édition est introuvable (sans appeler canManageWorkshops)', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)
    expect(await canManageWorkshopLocations(user, 10)).toBe(false)
    expect(mockCanManageWorkshops).not.toHaveBeenCalled()
  })

  it('délègue à canManageWorkshops quand l’édition existe (autorisé)', async () => {
    const edition = { id: 10, convention: { organizers: [] }, organizerPermissions: [] }
    prismaMock.edition.findUnique.mockResolvedValue(edition)
    mockCanManageWorkshops.mockReturnValue(true)

    expect(await canManageWorkshopLocations(user, 10)).toBe(true)
    expect(mockCanManageWorkshops).toHaveBeenCalledWith(edition, user)
  })

  it('false quand canManageWorkshops refuse', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({
      id: 10,
      convention: { organizers: [] },
      organizerPermissions: [],
    })
    mockCanManageWorkshops.mockReturnValue(false)
    expect(await canManageWorkshopLocations(user, 10)).toBe(false)
  })
})

/**
 * Qui peut proposer un atelier.
 *
 * Les artistes ont été ajoutés à la demande d'un organisateur : proposer un atelier fait partie
 * ordinaire de leur venue, et un artiste programmé se retrouvait avec moins de droits qu'un
 * participant muni d'un billet.
 *
 * Chaque chemin est vérifié seul — les autres sources répondant « non » —, sans quoi un test
 * passerait sur le mauvais critère : c'est le premier `true` rencontré qui décide.
 */
describe('canCreateWorkshop', () => {
  const EDITION = 10
  const UTILISATEUR = 7

  /** Une édition sans lien particulier avec l'utilisateur : aucun raccourci ne s'applique. */
  const editionNeutre = {
    id: EDITION,
    creatorId: 999,
    convention: { authorId: 999, organizers: [] },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.findUnique.mockResolvedValue({ isGlobalAdmin: false, email: 'a@b.c' })
    prismaMock.edition.findUnique.mockResolvedValue(editionNeutre)
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)
    prismaMock.editionArtist.findFirst.mockResolvedValue(null)
    prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(null)
  })

  it('autorise un artiste de l’édition', async () => {
    prismaMock.editionArtist.findFirst.mockResolvedValue({ id: 3 })

    expect(await canCreateWorkshop(UTILISATEUR, EDITION)).toBe(true)
    // Sur CETTE édition et CET utilisateur : un `findFirst` trop large autoriserait un artiste
    // programmé ailleurs.
    expect(prismaMock.editionArtist.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { editionId: EDITION, userId: UTILISATEUR } })
    )
  })

  it('refuse quand la personne n’est rien de tout cela', async () => {
    expect(await canCreateWorkshop(UTILISATEUR, EDITION)).toBe(false)
  })

  it('autorise un bénévole accepté, un participant, un organisateur et un admin', async () => {
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 1 })
    expect(await canCreateWorkshop(UTILISATEUR, EDITION)).toBe(true)

    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)
    prismaMock.ticketingOrderItem.findFirst.mockResolvedValue({ id: 2 })
    expect(await canCreateWorkshop(UTILISATEUR, EDITION)).toBe(true)

    prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(null)
    prismaMock.edition.findUnique.mockResolvedValue({
      ...editionNeutre,
      convention: { authorId: 999, organizers: [{ userId: UTILISATEUR }] },
    })
    expect(await canCreateWorkshop(UTILISATEUR, EDITION)).toBe(true)

    prismaMock.edition.findUnique.mockResolvedValue(editionNeutre)
    prismaMock.user.findUnique.mockResolvedValue({ isGlobalAdmin: true, email: 'a@b.c' })
    expect(await canCreateWorkshop(UTILISATEUR, EDITION)).toBe(true)
  })

  it('refuse si l’utilisateur ou l’édition n’existe pas', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await canCreateWorkshop(UTILISATEUR, EDITION)).toBe(false)

    prismaMock.user.findUnique.mockResolvedValue({ isGlobalAdmin: false, email: 'a@b.c' })
    prismaMock.edition.findUnique.mockResolvedValue(null)
    expect(await canCreateWorkshop(UTILISATEUR, EDITION)).toBe(false)
  })
})
