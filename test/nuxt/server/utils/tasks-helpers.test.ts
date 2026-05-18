import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  canCommentTask,
  assertAssigneesAreAssignable,
} from '../../../../server/utils/tasks-helpers'

import type { EditionWithPermissions } from '../../../../server/utils/permissions/edition-permissions'
import type { UserForPermissions } from '../../../../server/utils/permissions/types'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const createMockEdition = (
  overrides: Partial<EditionWithPermissions> = {}
): EditionWithPermissions =>
  ({
    id: 1,
    conventionId: 10,
    creatorId: 100,
    name: 'Test Edition',
    convention: {
      id: 10,
      authorId: 200,
      name: 'Test Convention',
      organizers: [],
    },
    organizerPermissions: [],
    ...overrides,
  }) as unknown as EditionWithPermissions

const createMockUser = (overrides: Partial<UserForPermissions> = {}): UserForPermissions => ({
  id: 999,
  email: 'user@example.com',
  pseudo: 'testuser',
  isGlobalAdmin: false,
  ...overrides,
})

describe('tasks-helpers', () => {
  describe('canCommentTask', () => {
    it("autorise le créateur de l'édition", () => {
      const edition = createMockEdition({ creatorId: 42 })
      const user = createMockUser({ id: 42 })
      expect(canCommentTask(edition, user, [])).toBe(true)
    })

    it("autorise l'auteur de la convention", () => {
      const edition = createMockEdition({
        convention: { id: 10, authorId: 77, name: 'X', organizers: [] } as any,
      })
      const user = createMockUser({ id: 77 })
      expect(canCommentTask(edition, user, [])).toBe(true)
    })

    it('autorise un admin global', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 5, isGlobalAdmin: true })
      expect(canCommentTask(edition, user, [])).toBe(true)
    })

    it('autorise un organisateur convention avec canManageTasks', () => {
      const edition = createMockEdition({
        convention: {
          id: 10,
          authorId: 200,
          name: 'X',
          organizers: [{ userId: 999, canManageTasks: true } as any],
        } as any,
      })
      const user = createMockUser({ id: 999 })
      expect(canCommentTask(edition, user, [])).toBe(true)
    })

    it('autorise un utilisateur assigné à la tâche sans canManageTasks', () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 999 })
      expect(canCommentTask(edition, user, [999, 1001])).toBe(true)
    })

    it("refuse un utilisateur sans droit et non assigné", () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 999 })
      expect(canCommentTask(edition, user, [1001, 1002])).toBe(false)
    })

    it("refuse un organisateur convention sans canManageTasks et non assigné", () => {
      const edition = createMockEdition({
        convention: {
          id: 10,
          authorId: 200,
          name: 'X',
          organizers: [{ userId: 999, canManageTasks: false } as any],
        } as any,
      })
      const user = createMockUser({ id: 999 })
      expect(canCommentTask(edition, user, [])).toBe(false)
    })
  })

  describe('assertAssigneesAreAssignable', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      prismaMock.edition.findUnique.mockReset()
      prismaMock.conventionOrganizer.findMany.mockReset()
      prismaMock.editionVolunteerApplication.findMany.mockReset()
    })

    it('ne fait rien si la liste est vide', async () => {
      await expect(assertAssigneesAreAssignable(1, [])).resolves.toBeUndefined()
      expect(prismaMock.edition.findUnique).not.toHaveBeenCalled()
    })

    it("rejette si l'édition est introuvable", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      await expect(assertAssigneesAreAssignable(1, [10])).rejects.toThrow('Édition non trouvée')
    })

    it("accepte le créateur de l'édition", async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        creatorId: 10,
        conventionId: 100,
        convention: { authorId: 200 },
      })
      prismaMock.conventionOrganizer.findMany.mockResolvedValue([])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])

      await expect(assertAssigneesAreAssignable(1, [10])).resolves.toBeUndefined()
    })

    it("accepte l'auteur de la convention", async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        creatorId: 10,
        conventionId: 100,
        convention: { authorId: 200 },
      })
      prismaMock.conventionOrganizer.findMany.mockResolvedValue([])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])

      await expect(assertAssigneesAreAssignable(1, [200])).resolves.toBeUndefined()
    })

    it('accepte un organisateur de la convention', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        creatorId: 10,
        conventionId: 100,
        convention: { authorId: 200 },
      })
      prismaMock.conventionOrganizer.findMany.mockResolvedValue([{ userId: 50 }])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])

      await expect(assertAssigneesAreAssignable(1, [50])).resolves.toBeUndefined()
    })

    it('accepte un bénévole ACCEPTED', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        creatorId: 10,
        conventionId: 100,
        convention: { authorId: 200 },
      })
      prismaMock.conventionOrganizer.findMany.mockResolvedValue([])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([{ userId: 60 }])

      await expect(assertAssigneesAreAssignable(1, [60])).resolves.toBeUndefined()
    })

    it('rejette les ids non autorisés', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        creatorId: 10,
        conventionId: 100,
        convention: { authorId: 200 },
      })
      prismaMock.conventionOrganizer.findMany.mockResolvedValue([{ userId: 50 }])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([{ userId: 60 }])

      await expect(assertAssigneesAreAssignable(1, [50, 60, 999])).rejects.toThrow(
        /ids invalides: 999/
      )
    })

    it('déduplique les ids avant validation', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        creatorId: 10,
        conventionId: 100,
        convention: { authorId: 200 },
      })
      prismaMock.conventionOrganizer.findMany.mockResolvedValue([{ userId: 50 }])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])

      await expect(assertAssigneesAreAssignable(1, [50, 50, 50])).resolves.toBeUndefined()
      // Vérifie qu'on a bien passé une liste dédupliquée à findMany
      expect(prismaMock.conventionOrganizer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: { in: [50] } }),
        })
      )
    })
  })
})
