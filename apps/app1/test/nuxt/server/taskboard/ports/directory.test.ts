import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultTaskboardPorts } from '../../../../../server/taskboard/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const u = (id: number, pseudo: string) => ({
  id,
  pseudo,
  prenom: `P${id}`,
  nom: `N${id}`,
  email: `u${id}@x.fr`,
  emailHash: `h${id}`,
  profilePicture: null,
})

describe('port directory du module tâches (câblage jonglerie)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAssignableUsers', () => {
    it('agrège organisateurs + bénévoles, déduplique par id et trie par pseudo', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        creatorId: 2,
        conventionId: 3,
        convention: { authorId: 1 },
      })
      // 1er findUnique = auteur convention, 2e = créateur édition
      prismaMock.user.findUnique
        .mockResolvedValueOnce(u(1, 'alice'))
        .mockResolvedValueOnce(u(2, 'bob'))
      prismaMock.conventionOrganizer.findMany.mockResolvedValue([{ user: u(3, 'carol') }])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        { user: u(1, 'alice') }, // doublon de l'auteur → dédupliqué
        { user: u(4, 'dave') },
      ])

      const users = await createDefaultTaskboardPorts().directory.getAssignableUsers(10)

      expect(users.map((x) => x.id)).toEqual([1, 2, 3, 4])
      expect(users.map((x) => x.pseudo)).toEqual(['alice', 'bob', 'carol', 'dave'])
      expect(prismaMock.editionVolunteerApplication.findMany).toHaveBeenCalledWith({
        where: { eventId: 10, status: 'ACCEPTED' },
        select: { user: { select: expect.any(Object) } },
      })
    })

    it('renvoie [] si l’édition est introuvable', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      expect(await createDefaultTaskboardPorts().directory.getAssignableUsers(999)).toEqual([])
    })
  })

  describe('isTasksEnabled', () => {
    it('found + enabled', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({ tasksEnabled: true })
      expect(await createDefaultTaskboardPorts().directory.isTasksEnabled(10)).toEqual({
        found: true,
        enabled: true,
      })
    })

    it('found + disabled', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({ tasksEnabled: false })
      expect(await createDefaultTaskboardPorts().directory.isTasksEnabled(10)).toEqual({
        found: true,
        enabled: false,
      })
    })

    it('not found', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      expect(await createDefaultTaskboardPorts().directory.isTasksEnabled(999)).toEqual({
        found: false,
        enabled: false,
      })
    })
  })
})
