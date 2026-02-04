import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/organizer-management', () => ({
  canAccessConvention: vi.fn(),
}))

import { canAccessConvention } from '#server/utils/organizer-management'
import handler from '../../../../../server/api/conventions/[id]/organizers.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockCanAccess = canAccessConvention as ReturnType<typeof vi.fn>

const mockEvent = {
  context: {
    params: { id: '1' },
    user: {
      id: 1,
      email: 'admin@test.com',
      pseudo: 'admin',
    },
  },
}

describe('/api/conventions/[id]/organizers GET', () => {
  beforeEach(() => {
    mockCanAccess.mockReset()
    prismaMock.conventionOrganizer.findMany.mockReset()
  })

  it('devrait retourner les organisateurs avec succès', async () => {
    const mockOrganizers = [
      {
        id: 1,
        addedAt: new Date('2024-01-01'),
        title: 'Admin',
        rights: {
          editConvention: true,
          deleteConvention: true,
          manageOrganizers: true,
          addEdition: true,
          editAllEditions: true,
          deleteAllEditions: true,
        },
        perEdition: [],
        user: {
          id: 1,
          pseudo: 'admin',
          profilePicture: null,
        },
        addedBy: {
          id: 1,
          pseudo: 'creator',
        },
      },
      {
        id: 2,
        addedAt: new Date('2024-01-02'),
        title: 'Mod',
        rights: {
          editConvention: false,
          deleteConvention: false,
          manageOrganizers: false,
          addEdition: true,
          editAllEditions: true,
          deleteAllEditions: false,
        },
        perEdition: [],
        user: {
          id: 2,
          pseudo: 'moderator',
          profilePicture: 'avatar.jpg',
        },
        addedBy: {
          id: 1,
          pseudo: 'creator',
        },
      },
    ]

    mockCanAccess.mockResolvedValue(true)
    // données brutes renvoyées par Prisma avant mapping
    const raw = mockOrganizers.map((c) => ({
      id: c.id,
      addedAt: c.addedAt,
      title: c.title,
      canEditConvention: c.rights.editConvention,
      canDeleteConvention: c.rights.deleteConvention,
      canManageOrganizers: c.rights.manageOrganizers,
      canAddEdition: c.rights.addEdition,
      canEditAllEditions: c.rights.editAllEditions,
      canDeleteAllEditions: c.rights.deleteAllEditions,
      perEditionPermissions: [],
      user: c.user,
      addedBy: c.addedBy,
    }))
    prismaMock.conventionOrganizer.findMany.mockResolvedValue(raw as any)

    const result = await handler(mockEvent as any)

    expect(result).toEqual(mockOrganizers)
    expect(mockCanAccess).toHaveBeenCalledWith(1, 1, mockEvent)
    expect(prismaMock.conventionOrganizer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conventionId: 1 } })
    )
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    }

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter si utilisateur sans permissions', async () => {
    mockCanAccess.mockResolvedValue(false)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas accès à cette convention"
    )
  })

  it('devrait rejeter un ID de convention invalide', async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid' } },
    }

    // canAccessConvention va lever une erreur pour un ID invalide
    mockCanAccess.mockRejectedValue(new Error('Convention ID invalide'))

    await expect(handler(eventWithBadId as any)).rejects.toThrow('ID de convention invalide')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    mockCanAccess.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait fonctionner pour un organisateur MODERATOR', async () => {
    const mockOrganizers = [
      {
        id: 1,
        addedAt: new Date(),
        title: 'Mod',
        rights: {
          editConvention: false,
          deleteConvention: false,
          manageOrganizers: false,
          addEdition: true,
          editAllEditions: true,
          deleteAllEditions: false,
        },
        perEdition: [],
        user: { id: 2, pseudo: 'moderator' },
        addedBy: { id: 99, pseudo: 'creator' },
      },
    ]

    mockCanAccess.mockResolvedValue(true)
    const raw = mockOrganizers.map((c) => ({
      id: c.id,
      addedAt: c.addedAt,
      title: c.title,
      canEditConvention: c.rights.editConvention,
      canDeleteConvention: c.rights.deleteConvention,
      canManageOrganizers: c.rights.manageOrganizers,
      canAddEdition: c.rights.addEdition,
      canEditAllEditions: c.rights.editAllEditions,
      canDeleteAllEditions: c.rights.deleteAllEditions,
      perEditionPermissions: [],
      user: c.user,
      addedBy: c.addedBy,
    }))
    prismaMock.conventionOrganizer.findMany.mockResolvedValue(raw as any)

    const eventAsModerator = {
      ...mockEvent,
      context: { ...mockEvent.context, user: { id: 2, pseudo: 'moderator' } },
    }

    const result = await handler(eventAsModerator as any)

    expect(result).toEqual(mockOrganizers)
    expect(mockCanAccess).toHaveBeenCalledWith(1, 2, eventAsModerator)
  })

  it("devrait retourner un tableau vide s'il n'y a pas de organisateurs", async () => {
    mockCanAccess.mockResolvedValue(true)
    prismaMock.conventionOrganizer.findMany.mockResolvedValue([])

    const result = await handler(mockEvent as any)

    expect(result).toEqual([])
    expect(prismaMock.conventionOrganizer.findMany).toHaveBeenCalled()
  })

  it("devrait traiter correctement l'ID numérique", async () => {
    const eventWithStringId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '123' } },
    }

    mockCanAccess.mockResolvedValue(true)
    prismaMock.conventionOrganizer.findMany.mockResolvedValue([])

    await handler(eventWithStringId as any)

    expect(mockCanAccess).toHaveBeenCalledWith(123, 1, eventWithStringId)
    expect(prismaMock.conventionOrganizer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conventionId: 123 } })
    )
  })

  it('devrait gérer les erreurs HTTP spécifiques', async () => {
    const httpError = {
      statusCode: 404,
      statusMessage: 'Convention introuvable',
    }

    mockCanAccess.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it('devrait permettre accès à un organisateur sans aucun droit spécifique', async () => {
    // Un organisateur avec tous les droits à false peut quand même consulter la liste
    const mockOrganizers = [
      {
        id: 1,
        addedAt: new Date('2024-01-01'),
        title: 'Organisateur sans droits',
        canEditConvention: false,
        canDeleteConvention: false,
        canManageOrganizers: false,
        canAddEdition: false,
        canEditAllEditions: false,
        canDeleteAllEditions: false,
        perEditionPermissions: [],
        user: { id: 3, pseudo: 'viewer' },
        addedBy: { id: 1, pseudo: 'creator' },
      },
    ]

    mockCanAccess.mockResolvedValue(true)
    prismaMock.conventionOrganizer.findMany.mockResolvedValue(mockOrganizers as any)

    const eventAsViewer = {
      ...mockEvent,
      context: { ...mockEvent.context, user: { id: 3, pseudo: 'viewer' } },
    }

    const result = await handler(eventAsViewer as any)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Organisateur sans droits')
    expect(mockCanAccess).toHaveBeenCalledWith(1, 3, eventAsViewer)
  })
})
