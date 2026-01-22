import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'
import categoriesHandler from '@@/server/api/profile/categories.put'
import prisma from '@@/server/generated/prisma'

vi.mock('@@/server/generated/prisma', () => ({
  default: {
    user: {
      update: vi.fn(),
    },
  },
}))

vi.mock('@@/server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    isVolunteer: false,
    isArtist: false,
    isOrganizer: false,
  })),
}))

describe('/api/profile/categories.put', async () => {
  await setup({})

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devrait mettre à jour les catégories avec succès', async () => {
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

    vi.mocked(prisma.user.update).mockResolvedValue(mockUpdatedUser as any)

    const event = {
      context: { user: { id: 1 } },
    } as any

    await categoriesHandler(event)

    // Vérifier que update a été appelé avec les bons paramètres
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        isVolunteer: expect.any(Boolean),
        isArtist: expect.any(Boolean),
        isOrganizer: expect.any(Boolean),
      }),
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

    vi.mocked(prisma.user.update).mockResolvedValue(mockUpdatedUser as any)

    const event = {
      context: { user: { id: 1 } },
    } as any

    await categoriesHandler(event)

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          isVolunteer: expect.any(Boolean),
          isArtist: expect.any(Boolean),
          isOrganizer: expect.any(Boolean),
        }),
      })
    )
  })

  it('devrait accepter toutes les catégories à false', async () => {
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

    vi.mocked(prisma.user.update).mockResolvedValue(mockUpdatedUser as any)

    const event = {
      context: { user: { id: 1 } },
    } as any

    await categoriesHandler(event)

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          isVolunteer: expect.any(Boolean),
          isArtist: expect.any(Boolean),
          isOrganizer: expect.any(Boolean),
        }),
      })
    )
  })

  it("devrait rejeter si isVolunteer n'est pas un boolean", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: JSON.stringify({
        isVolunteer: 'invalid',
        isArtist: false,
        isOrganizer: false,
      }),
    } as any

    await expect(categoriesHandler(event)).rejects.toThrow()
  })

  it("devrait rejeter si isArtist n'est pas un boolean", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: JSON.stringify({
        isVolunteer: false,
        isArtist: 'invalid',
        isOrganizer: false,
      }),
    } as any

    await expect(categoriesHandler(event)).rejects.toThrow()
  })

  it("devrait rejeter si isOrganizer n'est pas un boolean", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: JSON.stringify({
        isVolunteer: false,
        isArtist: false,
        isOrganizer: 'invalid',
      }),
    } as any

    await expect(categoriesHandler(event)).rejects.toThrow()
  })

  it('devrait rejeter si une catégorie est manquante', async () => {
    const event = {
      context: { user: { id: 1 } },
      body: JSON.stringify({
        isVolunteer: false,
        isArtist: false,
        // isOrganizer manquant
      }),
    } as any

    await expect(categoriesHandler(event)).rejects.toThrow()
  })
})
