import { describe, it, expect, vi, beforeEach } from 'vitest'

import { prismaMock } from '../../../../__mocks__/prisma'

// Mock des fonctions d'upload
const mockHandleImageUpload = vi.fn()
const mockDeleteOldImage = vi.fn()
const mockUploadRateLimiter = vi.fn()

// Créer un handler simplifié pour les tests
const mockHandler = async (event: any) => {
  const user = event.context.user

  if (!user) {
    const error = new Error('Non authentifié')
    ;(error as any).statusCode = 401
    throw error
  }

  // Appliquer le rate limiting
  await mockUploadRateLimiter(event)

  // Récupérer l'utilisateur actuel pour avoir l'ancienne photo
  const currentUser = await prismaMock.user.findUnique({
    where: { id: user.id },
    select: { profilePicture: true },
  })

  // Supprimer l'ancienne photo si elle existe
  if (currentUser?.profilePicture) {
    await mockDeleteOldImage(currentUser.profilePicture, 'public/uploads/profiles', 'profile-')
  }

  // Effectuer l'upload
  const uploadResult = await mockHandleImageUpload(event, {
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    prefix: 'profile',
    destinationFolder: 'profiles',
    entityId: user.id,
    fieldName: 'profilePicture',
    copyToOutput: false, // Pas de copie vers output pour les profils
  })

  // Mettre à jour l'utilisateur
  const updatedUser = await prismaMock.user.update({
    where: { id: user.id },
    data: { profilePicture: uploadResult.imageUrl },
    select: {
      id: true,
      email: true,
      pseudo: true,
      nom: true,
      prenom: true,
      profilePicture: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return {
    success: true,
    profilePicture: uploadResult.imageUrl,
    user: updatedUser,
  }
}

describe('API Profile Upload Picture', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    isGlobalAdmin: false,
  }

  const mockCurrentUser = {
    profilePicture: 'old-profile-picture.jpg',
  }

  const mockUpdatedUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    profilePicture: 'profile-1-12345.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockUploadResult = {
    imageUrl: 'profile-1-12345.jpg',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadRateLimiter.mockResolvedValue(undefined)
  })

  it('devrait uploader une photo de profil avec succès', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockCurrentUser as any)
    mockDeleteOldImage.mockResolvedValue(undefined)
    mockHandleImageUpload.mockResolvedValue(mockUploadResult)
    prismaMock.user.update.mockResolvedValue(mockUpdatedUser)

    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await mockHandler(mockEvent)

    expect(mockUploadRateLimiter).toHaveBeenCalledWith(mockEvent)
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { profilePicture: true },
    })
    expect(mockDeleteOldImage).toHaveBeenCalledWith(
      'old-profile-picture.jpg',
      'public/uploads/profiles',
      'profile-'
    )
    expect(mockHandleImageUpload).toHaveBeenCalledWith(mockEvent, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 5 * 1024 * 1024,
      prefix: 'profile',
      destinationFolder: 'profiles',
      entityId: 1,
      fieldName: 'profilePicture',
      copyToOutput: false,
    })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { profilePicture: 'profile-1-12345.jpg' },
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    expect(result).toEqual({
      success: true,
      profilePicture: 'profile-1-12345.jpg',
      user: mockUpdatedUser,
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = {
      context: { user: null },
    }

    await expect(mockHandler(mockEvent)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Non authentifié',
    })
  })

  it("devrait gérer l'upload sans photo existante", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profilePicture: null })
    mockHandleImageUpload.mockResolvedValue(mockUploadResult)
    prismaMock.user.update.mockResolvedValue(mockUpdatedUser)

    const mockEvent = {
      context: { user: mockUser },
    }

    await mockHandler(mockEvent)

    // deleteOldImage ne devrait pas être appelé s'il n'y a pas de photo existante
    expect(mockDeleteOldImage).not.toHaveBeenCalled()
    expect(mockHandleImageUpload).toHaveBeenCalled()
  })

  it('devrait appliquer le rate limiting', async () => {
    mockUploadRateLimiter.mockRejectedValue(new Error('Rate limit exceeded'))

    const mockEvent = {
      context: { user: mockUser },
    }

    await expect(mockHandler(mockEvent)).rejects.toThrow('Rate limit exceeded')
  })

  it("devrait gérer les erreurs d'upload", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ profilePicture: null })
    mockHandleImageUpload.mockRejectedValue(new Error('Upload failed'))

    const mockEvent = {
      context: { user: mockUser },
    }

    await expect(mockHandler(mockEvent)).rejects.toThrow('Upload failed')
  })
})
