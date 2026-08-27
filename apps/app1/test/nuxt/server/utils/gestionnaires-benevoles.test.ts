import { describe, it, expect, beforeEach, vi } from 'vitest'

import { listerGestionnairesBenevoles } from '#server/utils/organizer-management'

const prismaMock = (globalThis as any).prisma

/**
 * Garde-fou : cette liste doit reproduire exactement la règle de `canManageEditionVolunteers`.
 * Deux façons de répondre à la même question finissent par diverger — et la divergence se
 * traduirait ici par des organisateurs jamais prévenus d'une candidature, ou prévenus alors
 * qu'ils n'y ont pas accès.
 */
describe('listerGestionnairesBenevoles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('réunit créateur, auteur de convention et organisateurs habilités', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({
      creatorId: 1,
      convention: { authorId: 2, organizers: [{ userId: 3 }] },
      organizerPermissions: [{ organizer: { userId: 4 } }],
    })

    const gestionnaires = await listerGestionnairesBenevoles(7)

    expect([...gestionnaires].sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('ne compte qu’une fois qui cumule plusieurs titres', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({
      // Le créateur de l'édition est aussi l'auteur de la convention et organisateur
      creatorId: 1,
      convention: { authorId: 1, organizers: [{ userId: 1 }] },
      organizerPermissions: [{ organizer: { userId: 1 } }],
    })

    expect(await listerGestionnairesBenevoles(7)).toEqual([1])
  })

  it('ne retient que les organisateurs ayant le droit sur les bénévoles', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({
      creatorId: 1,
      convention: { authorId: 2, organizers: [] },
      organizerPermissions: [],
    })

    await listerGestionnairesBenevoles(7)

    // Le filtre est porté par la requête : sans lui, tout organisateur serait notifié
    const requete = prismaMock.edition.findUnique.mock.calls[0][0]
    expect(requete.select.convention.select.organizers.where).toEqual({
      canManageVolunteers: true,
    })
    expect(requete.select.organizerPermissions.where).toEqual({ canManageVolunteers: true })
  })

  it('rend une liste vide pour une édition introuvable', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    expect(await listerGestionnairesBenevoles(7)).toEqual([])
  })
})
