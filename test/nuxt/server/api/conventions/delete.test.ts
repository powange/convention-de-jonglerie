import { describe, it, expect, beforeEach } from 'vitest'

import handler from '../../../../../server/api/conventions/[id]/index.delete'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

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

describe('/api/conventions/[id] DELETE', () => {
  beforeEach(() => {
    prismaMock.convention.findUnique.mockReset()
    prismaMock.convention.delete.mockReset()
  })

  it("devrait supprimer une convention en tant qu'auteur", async () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      authorId: 1, // Utilisateur connecté est l'auteur
      organizers: [],
      editions: [],
      isArchived: false,
    } as any

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention as any)
    prismaMock.convention.delete.mockResolvedValue(mockConvention)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      data: null,
      message: 'Convention supprimée avec succès',
    })
    expect(prismaMock.convention.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    )
    expect(prismaMock.convention.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })

  it('devrait supprimer une convention en tant que organisateur ADMINISTRATOR', async () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      authorId: 2, // Utilisateur connecté n'est pas l'auteur
      organizers: [{ userId: 1, canDeleteConvention: true }],
      editions: [],
      isArchived: false,
    } as any

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention as any)
    prismaMock.convention.delete.mockResolvedValue(mockConvention)

    const result = await handler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      data: null,
      message: 'Convention supprimée avec succès',
    })
    expect(prismaMock.convention.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    }

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter un ID de convention invalide', async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid' } },
    }

    await expect(handler(eventWithBadId as any)).rejects.toThrow('ID de convention invalide')
  })

  it('devrait rejeter si convention introuvable', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Convention introuvable')
  })

  it('devrait rejeter si utilisateur sans droits', async () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      authorId: 2, // Utilisateur connecté n'est pas l'auteur
      organizers: [], // Pas de organisateurs avec droits
      editions: [],
      isArchived: false,
    } as any

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention as any)

    await expect(handler(mockEvent as any)).rejects.toThrow('Droit insuffisant')
  })

  it('devrait rejeter si organisateur MODERATOR uniquement', async () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      authorId: 2,
      organizers: [],
      editions: [],
      isArchived: false,
    } as any

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention as any)

    await expect(handler(mockEvent as any)).rejects.toThrow('Droit insuffisant')
  })

  it('devrait gérer les erreurs de base de données lors de la recherche', async () => {
    prismaMock.convention.findUnique.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait gérer les erreurs de base de données lors de la suppression', async () => {
    const mockConvention = {
      id: 1,
      authorId: 1,
      organizers: [],
      editions: [],
      isArchived: false,
    } as any

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention as any)
    prismaMock.convention.delete.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait gérer les erreurs HTTP spécifiques', async () => {
    const httpError = {
      statusCode: 403,
      message: 'Permission refusée',
    }

    prismaMock.convention.findUnique.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it("devrait traiter correctement l'ID numérique", async () => {
    const eventWithStringId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: '123' } },
    }

    const mockConvention = {
      id: 123,
      authorId: 1,
      organizers: [],
      editions: [],
      isArchived: false,
    } as any

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
    prismaMock.convention.delete.mockResolvedValue(mockConvention)

    await handler(eventWithStringId as any)

    expect(prismaMock.convention.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 123 } })
    )
    expect(prismaMock.convention.delete).toHaveBeenCalledWith({
      where: { id: 123 },
    })
  })

  it('devrait permettre à un auteur ET organisateur ADMIN de supprimer', async () => {
    const mockConvention = {
      id: 1,
      authorId: 1, // Utilisateur est l'auteur
      organizers: [{ userId: 1, canDeleteConvention: true }],
      editions: [],
      isArchived: false,
    } as any

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
    prismaMock.convention.delete.mockResolvedValue(mockConvention)

    const result = await handler(mockEvent as any)

    expect(result.message).toContain('supprimée avec succès')
  })
})
