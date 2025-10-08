import { describe, it, expect, beforeEach } from 'vitest'

import { getEmailHash } from '../../../../../server/utils/email-hash'
import { prismaMock } from '../../../../__mocks__/prisma'
import handler from '../../../../server/api/carpool-requests/[id]/comments.get'

// Import du mock après la déclaration

// Mock du module getEmailHash
vi.mock('../../../../server/utils/email-hash', () => ({
  getEmailHash: vi.fn(),
}))

const mockEvent = {
  context: {
    params: { id: '1' },
  },
}
const mockGetEmailHash = getEmailHash as ReturnType<typeof vi.fn>

describe('/api/carpool-requests/[id]/comments GET', () => {
  beforeEach(() => {
    prismaMock.carpoolRequestComment.findMany.mockReset()
    mockGetEmailHash.mockReset()
  })

  it('devrait retourner les commentaires avec emails masqués', async () => {
    const mockComments = [
      {
        id: 1,
        carpoolRequestId: 1,
        userId: 1,
        content: 'Je peux te prendre !',
        createdAt: new Date('2024-01-01'),
        user: {
          id: 1,
          pseudo: 'driver1',
          email: 'driver1@test.com',
          profilePicture: null,
          updatedAt: new Date('2024-01-01'),
        },
      },
      {
        id: 2,
        carpoolRequestId: 1,
        userId: 2,
        content: 'Merci beaucoup !',
        createdAt: new Date('2024-01-02'),
        user: {
          id: 2,
          pseudo: 'passenger1',
          email: 'passenger1@test.com',
          profilePicture: 'avatar.jpg',
          updatedAt: new Date('2024-01-02'),
        },
      },
    ]

    mockGetEmailHash.mockReturnValueOnce('hash1').mockReturnValueOnce('hash2')

    prismaMock.carpoolRequestComment.findMany.mockResolvedValue(mockComments)

    const result = await handler(mockEvent as any)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 1,
      carpoolRequestId: 1,
      userId: 1,
      content: 'Je peux te prendre !',
      createdAt: new Date('2024-01-01'),
      user: {
        id: 1,
        pseudo: 'driver1',
        emailHash: 'hash1',
        profilePicture: null,
        updatedAt: new Date('2024-01-01'),
      },
    })

    expect(result[1]).toEqual({
      id: 2,
      carpoolRequestId: 1,
      userId: 2,
      content: 'Merci beaucoup !',
      createdAt: new Date('2024-01-02'),
      user: {
        id: 2,
        pseudo: 'passenger1',
        emailHash: 'hash2',
        profilePicture: 'avatar.jpg',
        updatedAt: new Date('2024-01-02'),
      },
    })

    expect(prismaMock.carpoolRequestComment.findMany).toHaveBeenCalledWith({
      where: { carpoolRequestId: 1 },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })

    expect(mockGetEmailHash).toHaveBeenCalledTimes(2)
    expect(mockGetEmailHash).toHaveBeenNthCalledWith(1, 'driver1@test.com')
    expect(mockGetEmailHash).toHaveBeenNthCalledWith(2, 'passenger1@test.com')
  })

  it('devrait rejeter un ID de demande invalide', async () => {
    const eventWithBadId = {
      context: {
        params: { id: 'invalid' },
      },
    }

    await expect(handler(eventWithBadId as any)).rejects.toThrow('ID de la demande invalide')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.carpoolRequestComment.findMany.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it("devrait retourner un tableau vide s'il n'y a pas de commentaires", async () => {
    prismaMock.carpoolRequestComment.findMany.mockResolvedValue([])

    const result = await handler(mockEvent as any)

    expect(result).toEqual([])
    expect(prismaMock.carpoolRequestComment.findMany).toHaveBeenCalledWith({
      where: { carpoolRequestId: 1 },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })
  })

  it('devrait trier les commentaires par date de création croissante', async () => {
    const mockComments = [
      {
        id: 2,
        content: 'Deuxième commentaire (plus récent)',
        createdAt: new Date('2024-01-02'),
        user: {
          id: 2,
          pseudo: 'user2',
          email: 'user2@test.com',
          profilePicture: null,
          updatedAt: new Date(),
        },
      },
      {
        id: 1,
        content: 'Premier commentaire (plus ancien)',
        createdAt: new Date('2024-01-01'),
        user: {
          id: 1,
          pseudo: 'user1',
          email: 'user1@test.com',
          profilePicture: null,
          updatedAt: new Date(),
        },
      },
    ]

    mockGetEmailHash.mockReturnValue('hash')
    prismaMock.carpoolRequestComment.findMany.mockResolvedValue(mockComments)

    await handler(mockEvent as any)

    expect(prismaMock.carpoolRequestComment.findMany).toHaveBeenCalledWith({
      where: { carpoolRequestId: 1 },
      include: { user: true },
      orderBy: { createdAt: 'asc' }, // Vérification du tri
    })
  })

  it('devrait gérer les utilisateurs sans profilePicture', async () => {
    const mockComments = [
      {
        id: 1,
        carpoolRequestId: 1,
        userId: 1,
        content: 'Commentaire',
        createdAt: new Date(),
        user: {
          id: 1,
          pseudo: 'user1',
          email: 'user1@test.com',
          profilePicture: null, // Pas de photo de profil
          updatedAt: new Date(),
        },
      },
    ]

    mockGetEmailHash.mockReturnValue('hash1')
    prismaMock.carpoolRequestComment.findMany.mockResolvedValue(mockComments)

    const result = await handler(mockEvent as any)

    expect(result[0].user.profilePicture).toBeNull()
  })

  it("devrait traiter correctement l'ID numérique", async () => {
    const eventWithStringId = {
      context: {
        params: { id: '456' },
      },
    }

    prismaMock.carpoolRequestComment.findMany.mockResolvedValue([])

    await handler(eventWithStringId as any)

    expect(prismaMock.carpoolRequestComment.findMany).toHaveBeenCalledWith({
      where: { carpoolRequestId: 456 }, // Converti en nombre
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })
  })
})
