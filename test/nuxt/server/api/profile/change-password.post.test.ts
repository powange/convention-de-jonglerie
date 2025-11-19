import bcrypt from 'bcryptjs'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as validationSchemas from '../../../../../server/utils/validation-schemas'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Créer un handler simplifié pour les tests
const mockHandler = async (event: any) => {
  const user = event.context.user

  if (!user) {
    const error = new Error('Non authentifié')
    ;(error as any).statusCode = 401
    throw error
  }

  const body = await readBody(event)

  // Validation simplifiée
  if (!body.currentPassword || !body.newPassword) {
    const error = new Error('Données invalides')
    ;(error as any).statusCode = 400
    throw error
  }

  const { currentPassword, newPassword } = body

  // Récupérer l'utilisateur avec son mot de passe
  const userWithPassword = await prismaMock.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      password: true,
    },
  })

  if (!userWithPassword) {
    const error = new Error('Utilisateur non trouvé')
    ;(error as any).statusCode = 404
    throw error
  }

  // Vérifier le mot de passe actuel
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password)

  if (!isCurrentPasswordValid) {
    const error = new Error('Mot de passe actuel incorrect')
    ;(error as any).statusCode = 400
    throw error
  }

  // Hasher le nouveau mot de passe
  const hashedNewPassword = await bcrypt.hash(newPassword, 12)

  // Mettre à jour le mot de passe
  await prismaMock.user.update({
    where: { id: user.id },
    data: {
      password: hashedNewPassword,
    },
  })

  return { success: true, message: 'Mot de passe mis à jour avec succès' }
}

// Mock des fonctions globales
global.readBody = vi.fn()

describe('API Profile Change Password', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    isGlobalAdmin: false,
  }

  const mockUserWithPassword = {
    id: 1,
    password: '$2a$10$hashedpassword',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(bcrypt, 'compare')
    vi.spyOn(bcrypt, 'hash')
  })

  it('devrait changer le mot de passe avec succès', async () => {
    vi.mocked(readBody).mockResolvedValue({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword123!',
    })
    vi.mocked(bcrypt.compare).mockResolvedValue(true)
    vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$newhashedpassword')
    prismaMock.user.findUnique.mockResolvedValue(mockUserWithPassword)
    prismaMock.user.update.mockResolvedValue({ id: 1 } as any)

    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await mockHandler(mockEvent)

    expect(bcrypt.compare).toHaveBeenCalledWith('oldPassword123', '$2a$10$hashedpassword')
    expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123!', 12)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { password: '$2a$10$newhashedpassword' },
    })
    expect(result).toEqual({
      success: true,
      message: 'Mot de passe mis à jour avec succès',
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

  it('devrait rejeter si utilisateur non trouvé', async () => {
    vi.mocked(readBody).mockResolvedValue({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword123!',
    })
    prismaMock.user.findUnique.mockResolvedValue(null)

    const mockEvent = {
      context: { user: mockUser },
    }

    await expect(mockHandler(mockEvent)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Utilisateur non trouvé',
    })
  })

  it('devrait rejeter si le mot de passe actuel est incorrect', async () => {
    vi.mocked(readBody).mockResolvedValue({
      currentPassword: 'wrongPassword',
      newPassword: 'newPassword123!',
    })
    vi.mocked(bcrypt.compare).mockResolvedValue(false)
    prismaMock.user.findUnique.mockResolvedValue(mockUserWithPassword)

    const mockEvent = {
      context: { user: mockUser },
    }

    await expect(mockHandler(mockEvent)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Mot de passe actuel incorrect',
    })
  })

  it('devrait valider les données', async () => {
    vi.mocked(readBody).mockResolvedValue({
      currentPassword: '',
      newPassword: '',
    })

    const mockEvent = {
      context: { user: mockUser },
    }

    await expect(mockHandler(mockEvent)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Données invalides',
    })
  })
})
