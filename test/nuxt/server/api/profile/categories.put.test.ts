import { describe, it, expect, beforeEach, vi } from 'vitest'

import categoriesHandler from '#server/api/profile/categories.put'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/profile/categories.put', () => {
  beforeEach(() => {
    prismaMock.user.update.mockReset()
    global.readBody = vi.fn()
  })

  it('devrait mettre à jour les catégories avec succès', async () => {
    const requestBody = {
      isVolunteer: true,
      isArtist: false,
      isOrganizer: true,
    }

    const mockUpdatedUser = {
      id: 1,
      email: 'test@example.com',
      emailHash: 'hash',
      pseudo: 'testuser',
      nom: 'Test',
      prenom: 'User',
      phone: null,
      profilePicture: null,
      preferredLanguage: 'fr',
      isVolunteer: true,
      isArtist: false,
      isOrganizer: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.update.mockResolvedValue(mockUpdatedUser)

    const event = {
      context: { user: { id: 1 } },
    } as any

    const result = await categoriesHandler(event)

    expect(result).toEqual({
      id: mockUpdatedUser.id,
      email: mockUpdatedUser.email,
      emailHash: mockUpdatedUser.emailHash,
      pseudo: mockUpdatedUser.pseudo,
      nom: mockUpdatedUser.nom,
      prenom: mockUpdatedUser.prenom,
      phone: mockUpdatedUser.phone,
      profilePicture: mockUpdatedUser.profilePicture,
      preferredLanguage: mockUpdatedUser.preferredLanguage,
      isVolunteer: mockUpdatedUser.isVolunteer,
      isArtist: mockUpdatedUser.isArtist,
      isOrganizer: mockUpdatedUser.isOrganizer,
      createdAt: mockUpdatedUser.createdAt,
      updatedAt: mockUpdatedUser.updatedAt,
    })

    // Vérifier que update a été appelé avec les bons paramètres
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isVolunteer: true,
        isArtist: false,
        isOrganizer: true,
      },
      select: {
        id: true,
        email: true,
        emailHash: true,
        pseudo: true,
        nom: true,
        prenom: true,
        phone: true,
        profilePicture: true,
        preferredLanguage: true,
        isVolunteer: true,
        isArtist: true,
        isOrganizer: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  })

  it('devrait accepter toutes les catégories à true', async () => {
    const requestBody = {
      isVolunteer: true,
      isArtist: true,
      isOrganizer: true,
    }

    const mockUpdatedUser = {
      id: 1,
      email: 'test@example.com',
      emailHash: 'hash',
      pseudo: 'testuser',
      nom: 'Test',
      prenom: 'User',
      phone: null,
      profilePicture: null,
      preferredLanguage: 'fr',
      isVolunteer: true,
      isArtist: true,
      isOrganizer: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.update.mockResolvedValue(mockUpdatedUser)

    const event = {
      context: { user: { id: 1 } },
    } as any

    await categoriesHandler(event)

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isVolunteer: true,
        isArtist: true,
        isOrganizer: true,
      },
      select: expect.any(Object),
    })
  })

  it('devrait accepter toutes les catégories à false', async () => {
    const requestBody = {
      isVolunteer: false,
      isArtist: false,
      isOrganizer: false,
    }

    const mockUpdatedUser = {
      id: 1,
      email: 'test@example.com',
      emailHash: 'hash',
      pseudo: 'testuser',
      nom: 'Test',
      prenom: 'User',
      phone: null,
      profilePicture: null,
      preferredLanguage: 'fr',
      isVolunteer: false,
      isArtist: false,
      isOrganizer: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.user.update.mockResolvedValue(mockUpdatedUser)

    const event = {
      context: { user: { id: 1 } },
    } as any

    await categoriesHandler(event)

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isVolunteer: false,
        isArtist: false,
        isOrganizer: false,
      },
      select: expect.any(Object),
    })
  })

  it("devrait rejeter si isVolunteer n'est pas un boolean", async () => {
    const requestBody = {
      isVolunteer: 'invalid',
      isArtist: false,
      isOrganizer: false,
    }

    global.readBody.mockResolvedValue(requestBody)

    const event = {
      context: { user: { id: 1 } },
    } as any

    await expect(categoriesHandler(event)).rejects.toThrow('Données invalides')
  })

  it("devrait rejeter si isArtist n'est pas un boolean", async () => {
    const requestBody = {
      isVolunteer: false,
      isArtist: 'invalid',
      isOrganizer: false,
    }

    global.readBody.mockResolvedValue(requestBody)

    const event = {
      context: { user: { id: 1 } },
    } as any

    await expect(categoriesHandler(event)).rejects.toThrow('Données invalides')
  })

  it("devrait rejeter si isOrganizer n'est pas un boolean", async () => {
    const requestBody = {
      isVolunteer: false,
      isArtist: false,
      isOrganizer: 'invalid',
    }

    global.readBody.mockResolvedValue(requestBody)

    const event = {
      context: { user: { id: 1 } },
    } as any

    await expect(categoriesHandler(event)).rejects.toThrow('Données invalides')
  })

  it('devrait rejeter si une catégorie est manquante', async () => {
    const requestBody = {
      isVolunteer: false,
      isArtist: false,
      // isOrganizer manquant
    }

    global.readBody.mockResolvedValue(requestBody)

    const event = {
      context: { user: { id: 1 } },
    } as any

    await expect(categoriesHandler(event)).rejects.toThrow()
  })
})
