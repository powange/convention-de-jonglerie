import { describe, it, expect, vi, beforeEach } from 'vitest'

import { prismaMock } from '../../../../__mocks__/prisma'

// Import du handler après les mocks
import updateConventionHandler from '../../../../../server/api/conventions/[id]/index.put'

describe('API Convention - Mise à jour', () => {
  const mockUser = {
    id: 1,
    email: 'creator@example.com',
    pseudo: 'creator',
    nom: 'Creator',
    prenom: 'Test',
  }

  const mockOrganizerUser = {
    id: 2,
    email: 'organizer@example.com',
    pseudo: 'organizer',
    nom: 'Organizer',
    prenom: 'Test',
  }

  const mockConvention = {
    id: 1,
    name: 'Convention de Test',
    description: 'Une convention pour les tests',
    logo: null,
    authorId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    organizers: [],
  }

  const mockUpdatedConvention = {
    ...mockConvention,
    name: 'Convention Mise à Jour',
    description: 'Description mise à jour',
    author: {
      id: 1,
      pseudo: 'creator',
      emailHash: 'dadbcd70e3cf287900f80aedef3f987c', // MD5 de 'creator@example.com'
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn((event, param) => event.params?.[param])
  })

  it("devrait permettre à l'auteur de modifier sa convention", async () => {
    prismaMock.convention.findUnique.mockResolvedValue({
      ...mockConvention,
      organizers: [],
    })
    prismaMock.convention.update.mockResolvedValue(mockUpdatedConvention)

    const requestBody = {
      name: 'Convention Mise à Jour',
      description: 'Description mise à jour',
    }

    const mockEvent = {
      context: { user: mockUser },
      params: { id: '1' },
    }
    global.readBody.mockResolvedValue(requestBody)

    const result = await updateConventionHandler(mockEvent)

    expect(result).toEqual(mockUpdatedConvention)
    expect(prismaMock.convention.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: 'Convention Mise à Jour',
        description: 'Description mise à jour',
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
          },
        },
      },
    })
  })

  it('devrait permettre à un administrateur de modifier la convention', async () => {
    prismaMock.convention.findUnique.mockResolvedValue({
      ...mockConvention,
      authorId: 2, // Autre auteur
      organizers: [
        {
          userId: mockUser.id,
          canEditConvention: true,
        },
      ],
    })
    prismaMock.convention.update.mockResolvedValue(mockUpdatedConvention)

    const requestBody = {
      name: 'Convention Mise à Jour',
      description: 'Description mise à jour',
    }

    const mockEvent = {
      context: { user: mockUser },
      params: { id: '1' },
    }
    global.readBody.mockResolvedValue(requestBody)

    const result = await updateConventionHandler(mockEvent)

    expect(result).toEqual(mockUpdatedConvention)
  })

  it('devrait rejeter les utilisateurs non authentifiés', async () => {
    const mockEvent = {
      context: { user: null },
      params: { id: '1' },
      body: {
        name: 'Test',
      },
    }

    await expect(updateConventionHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait rejeter les utilisateurs non autorisés', async () => {
    prismaMock.convention.findUnique.mockResolvedValue({
      ...mockConvention,
      authorId: 2, // Autre auteur
      organizers: [], // Pas de organisateur
    })

    const mockEvent = {
      context: { user: mockUser },
      params: { id: '1' },
      body: {
        name: 'Test',
      },
    }

    await expect(updateConventionHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait retourner 404 pour une convention inexistante', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(null)

    const mockEvent = {
      context: { user: mockUser },
      params: { id: '999' },
      body: {
        name: 'Test',
      },
    }

    await expect(updateConventionHandler(mockEvent)).rejects.toThrow()
  })

  it("devrait valider les données d'entrée", async () => {
    prismaMock.convention.findUnique.mockResolvedValue({
      ...mockConvention,
      organizers: [],
    })

    const requestBody = {
      name: '', // Nom vide invalide
      description: 'Test',
    }

    const mockEvent = {
      context: { user: mockUser },
      params: { id: '1' },
    }
    global.readBody.mockResolvedValue(requestBody)

    await expect(updateConventionHandler(mockEvent)).rejects.toThrow()
  })

  it("devrait valider l'ID de convention", async () => {
    const mockEvent = {
      context: { user: mockUser },
      params: { id: 'invalid' },
      body: {
        name: 'Test',
      },
    }

    await expect(updateConventionHandler(mockEvent)).rejects.toThrow()
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.convention.findUnique.mockRejectedValue(new Error('Database error'))

    const mockEvent = {
      context: { user: mockUser },
      params: { id: '1' },
      body: {
        name: 'Test',
        description: 'Test',
      },
    }

    await expect(updateConventionHandler(mockEvent)).rejects.toThrow()
  })
})
