import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/lost-found/[itemId]/return.patch'
import { hasEditionEditPermission } from '../../../../../../server/utils/permissions/permissions'
import { prismaMock } from '../../../../../__mocks__/prisma'

vi.mock('#imports', async () => {
  const actual = await vi.importActual<any>('#imports')
  return { ...actual, requireUserSession: vi.fn(async () => ({ user: { id: 1 } })) }
})
import { requireUserSession } from '#imports'

// Mock des utilitaires
vi.mock('../../../../../server/utils/permissions', () => ({
  hasEditionEditPermission: vi.fn(),
}))

const mockEvent = {}

const mockLostFoundItem = {
  id: 1,
  editionId: 1,
  userId: 2,
  description: 'Gants noirs trouvés',
  status: 'LOST',
  createdAt: new Date('2024-01-04T10:00:00Z'),
  updatedAt: new Date('2024-01-04T10:00:00Z'),
}

const mockUpdatedItem = {
  ...mockLostFoundItem,
  status: 'RETURNED',
  updatedAt: new Date('2024-01-04T12:00:00Z'),
  user: {
    id: 2,
    pseudo: 'finder',
    prenom: 'John',
    nom: 'Doe',
    profilePicture: null,
  },
  comments: [],
}

const mockHasPermission = hasEditionEditPermission as ReturnType<typeof vi.fn>
let mockRequireUserSession: ReturnType<typeof vi.fn>

describe('/api/editions/[id]/lost-found/[itemId]/return PATCH', () => {
  beforeEach(async () => {
    mockHasPermission.mockReset()
    const importsMod: any = await import('#imports')
    mockRequireUserSession = importsMod.requireUserSession as ReturnType<typeof vi.fn>
    mockRequireUserSession.mockReset?.()
    prismaMock.lostFoundItem.findFirst.mockReset()
    prismaMock.lostFoundItem.update.mockReset()
    global.getRouterParam = vi
      .fn()
      .mockReturnValueOnce('1') // editionId
      .mockReturnValueOnce('1') // itemId
  })

  it('devrait marquer un objet comme rendu', async () => {
    ;(mockRequireUserSession as any).mockResolvedValue({ user: { id: 1 } })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.update.mockResolvedValue(mockUpdatedItem)

    const result = await handler(mockEvent as any)

    expect(result).toEqual(
      expect.objectContaining({
        id: mockUpdatedItem.id,
        status: 'RETURNED',
        user: expect.objectContaining({ id: mockUpdatedItem.user.id }),
      })
    )
    expect(prismaMock.lostFoundItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        editionId: 1,
      },
    })
    expect(prismaMock.lostFoundItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'RETURNED', updatedAt: expect.any(Date) }),
        include: expect.objectContaining({
          user: expect.any(Object),
          comments: expect.any(Object),
        }),
      })
    )
  })

  it('devrait basculer le statut de RETURNED vers LOST', async () => {
    const returnedItem = { ...mockLostFoundItem, status: 'RETURNED' }
    const toggledItem = { ...mockUpdatedItem, status: 'LOST' }

    ;(mockRequireUserSession as any).mockResolvedValue({ user: { id: 1 } })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(returnedItem)
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.update.mockResolvedValue(toggledItem)

    const result = await handler(mockEvent as any)

    expect(prismaMock.lostFoundItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'LOST', updatedAt: expect.any(Date) }),
      })
    )
  })

  it("devrait rejeter si ID d'édition invalide", async () => {
    global.getRouterParam = vi.fn().mockReturnValueOnce('invalid').mockReturnValueOnce('1')

    await expect(handler(mockEvent as any)).rejects.toThrow('ID invalide')
  })

  it("devrait rejeter si ID d'objet invalide", async () => {
    global.getRouterParam = vi.fn().mockReturnValueOnce('1').mockReturnValueOnce('invalid')

    await expect(handler(mockEvent as any)).rejects.toThrow('ID invalide')
  })

  it('devrait rejeter si non authentifié (pas de session)', async () => {
    ;(mockRequireUserSession as any).mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    )

    await expect(handler(mockEvent as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter si objet trouvé non trouvé', async () => {
    ;(mockRequireUserSession as any).mockResolvedValueOnce({ user: { id: 1 } })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Objet trouvé non trouvé')
  })

  it("devrait vérifier que l'objet appartient à l'édition", async () => {
    global.getRouterParam = vi
      .fn()
      .mockReturnValueOnce('2') // editionId différent
      .mockReturnValueOnce('1') // itemId
    ;(mockRequireUserSession as any).mockResolvedValueOnce({ user: { id: 1 } })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(null) // Pas trouvé car mauvaise édition

    await expect(handler(mockEvent as any)).rejects.toThrow('Objet trouvé non trouvé')

    expect(prismaMock.lostFoundItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        editionId: 2,
      },
    })
  })

  it("devrait rejeter si utilisateur n'est pas collaborateur", async () => {
    ;(mockRequireUserSession as any).mockResolvedValueOnce({ user: { id: 1 } })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)
    mockHasPermission.mockResolvedValue(false)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous devez être collaborateur pour modifier le statut d'un objet trouvé"
    )
  })

  it('devrait inclure les détails utilisateur et commentaires', async () => {
    ;(mockRequireUserSession as any).mockResolvedValueOnce({ user: { id: 1 } })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.update.mockResolvedValue(mockUpdatedItem)

    const result = await handler(mockEvent as any)

    expect(prismaMock.lostFoundItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        include: expect.objectContaining({
          comments: expect.any(Object),
          user: expect.any(Object),
        }),
      })
    )
  })

  it('devrait mettre à jour la date de modification', async () => {
    const originalDate = new Date('2024-01-04T10:00:00Z')
    const testItem = { ...mockLostFoundItem, updatedAt: originalDate }

    ;(mockRequireUserSession as any).mockResolvedValue({ user: { id: 1 } })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(testItem)
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.update.mockResolvedValue(mockUpdatedItem)

    await handler(mockEvent as any)

    expect(prismaMock.lostFoundItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'RETURNED', updatedAt: expect.any(Date) }),
      })
    )

    // Vérifier que la nouvelle date est différente de l'originale
    const updateCall = prismaMock.lostFoundItem.update.mock.calls[0][0]
    expect(updateCall.data.updatedAt).not.toEqual(originalDate)
  })

  it('devrait gérer les erreurs de base de données', async () => {
    ;(mockRequireUserSession as any).mockResolvedValue({ user: { id: 1 } })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.update.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur interne du serveur')
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Access denied',
    }

    ;(mockRequireUserSession as any).mockResolvedValue({ user: { id: 1 } })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(mockLostFoundItem)
    mockHasPermission.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it('devrait traiter correctement les IDs numériques', async () => {
    global.getRouterParam = vi.fn().mockReturnValueOnce('123').mockReturnValueOnce('456')
    ;(mockRequireUserSession as any).mockResolvedValue({ user: { id: 1 } })
    prismaMock.lostFoundItem.findFirst.mockResolvedValue({
      ...mockLostFoundItem,
      id: 456,
      editionId: 123,
    })
    mockHasPermission.mockResolvedValue(true)
    prismaMock.lostFoundItem.update.mockResolvedValue(mockUpdatedItem)

    await handler(mockEvent as any)

    expect(prismaMock.lostFoundItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 456,
        editionId: 123,
      },
    })
    expect(mockHasPermission).toHaveBeenCalledWith(1, 123)
    expect(prismaMock.lostFoundItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 456 } })
    )
  })
})
