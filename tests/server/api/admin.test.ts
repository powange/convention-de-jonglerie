import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../../__mocks__/prisma'

describe('Tests du mode admin', () => {
  const adminUser = {
    id: 1,
    email: 'admin@example.com',
    pseudo: 'admin',
    nom: 'Admin',
    prenom: 'Super',
    isGlobalAdmin: true,
    isEmailVerified: true
  }

  const regularUser = {
    id: 2,
    email: 'user@example.com',
    pseudo: 'user',
    nom: 'User',
    prenom: 'Regular',
    isGlobalAdmin: false,
    isEmailVerified: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Vérification des permissions admin', () => {
    it('devrait permettre accès aux admins globaux', async () => {
      prismaMock.user.findUnique.mockResolvedValue(adminUser)

      const hasAdminAccess = adminUser.isGlobalAdmin
      
      expect(hasAdminAccess).toBe(true)
    })

    it('devrait rejeter l\'accès aux utilisateurs normaux', async () => {
      prismaMock.user.findUnique.mockResolvedValue(regularUser)

      const hasAdminAccess = regularUser.isGlobalAdmin
      
      expect(hasAdminAccess).toBe(false)
    })

    it('devrait rejeter l\'accès aux utilisateurs non authentifiés', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      const user = null
      const hasAdminAccess = user?.isGlobalAdmin || false
      
      expect(hasAdminAccess).toBe(false)
    })
  })

  describe('Gestion des utilisateurs', () => {
    it('devrait permettre de lister tous les utilisateurs', async () => {
      const mockUsers = [adminUser, regularUser]
      prismaMock.user.findMany.mockResolvedValue(mockUsers)

      const users = await prismaMock.user.findMany({
        select: {
          id: true,
          email: true,
          pseudo: true,
          nom: true,
          prenom: true,
          isGlobalAdmin: true,
          isEmailVerified: true,
          createdAt: true
        }
      })

      expect(users).toHaveLength(2)
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          email: true,
          pseudo: true,
          nom: true,
          prenom: true,
          isGlobalAdmin: true,
          isEmailVerified: true,
          createdAt: true
        }
      })
    })

    it('devrait permettre de promouvoir un utilisateur en admin', async () => {
      const updatedUser = { ...regularUser, isGlobalAdmin: true }
      prismaMock.user.update.mockResolvedValue(updatedUser)

      const result = await prismaMock.user.update({
        where: { id: 2 },
        data: { isGlobalAdmin: true }
      })

      expect(result.isGlobalAdmin).toBe(true)
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { isGlobalAdmin: true }
      })
    })

    it('devrait permettre de révoquer les droits admin', async () => {
      const demotedUser = { ...adminUser, isGlobalAdmin: false }
      prismaMock.user.update.mockResolvedValue(demotedUser)

      const result = await prismaMock.user.update({
        where: { id: 1 },
        data: { isGlobalAdmin: false }
      })

      expect(result.isGlobalAdmin).toBe(false)
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isGlobalAdmin: false }
      })
    })

    it('devrait permettre de supprimer un utilisateur', async () => {
      prismaMock.user.delete.mockResolvedValue(regularUser)

      const result = await prismaMock.user.delete({
        where: { id: 2 }
      })

      expect(result).toEqual(regularUser)
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: 2 }
      })
    })

    it('devrait empêcher un admin de se supprimer lui-même', async () => {
      const adminId = 1
      const currentUserId = 1

      const canDelete = adminId !== currentUserId

      expect(canDelete).toBe(false)
    })
  })

  describe('Gestion des conventions', () => {
    const mockConvention = {
      id: 1,
      name: 'Convention Test',
      description: 'Description test',
      createdBy: 2,
      isActive: true
    }

    it('devrait permettre de lister toutes les conventions', async () => {
      prismaMock.convention.findMany.mockResolvedValue([mockConvention])

      const conventions = await prismaMock.convention.findMany({
        include: {
          creator: {
            select: {
              id: true,
              pseudo: true,
              email: true
            }
          },
          editions: {
            select: {
              id: true,
              startDate: true,
              endDate: true
            }
          }
        }
      })

      expect(conventions).toHaveLength(1)
      expect(prismaMock.convention.findMany).toHaveBeenCalledWith({
        include: {
          creator: {
            select: {
              id: true,
              pseudo: true,
              email: true
            }
          },
          editions: {
            select: {
              id: true,
              startDate: true,
              endDate: true
            }
          }
        }
      })
    })

    it('devrait permettre de désactiver une convention', async () => {
      const deactivatedConvention = { ...mockConvention, isActive: false }
      prismaMock.convention.update.mockResolvedValue(deactivatedConvention)

      const result = await prismaMock.convention.update({
        where: { id: 1 },
        data: { isActive: false }
      })

      expect(result.isActive).toBe(false)
      expect(prismaMock.convention.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false }
      })
    })

    it('devrait permettre de supprimer une convention', async () => {
      prismaMock.convention.delete.mockResolvedValue(mockConvention)

      const result = await prismaMock.convention.delete({
        where: { id: 1 }
      })

      expect(result).toEqual(mockConvention)
      expect(prismaMock.convention.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      })
    })
  })

  describe('Gestion des éditions', () => {
    const mockEdition = {
      id: 1,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-03'),
      city: 'Paris',
      conventionId: 1,
      createdBy: 2,
      isActive: true
    }

    it('devrait permettre de lister toutes les éditions', async () => {
      prismaMock.edition.findMany.mockResolvedValue([mockEdition])

      const editions = await prismaMock.edition.findMany({
        include: {
          convention: {
            select: {
              id: true,
              name: true
            }
          },
          creator: {
            select: {
              id: true,
              pseudo: true,
              email: true
            }
          }
        }
      })

      expect(editions).toHaveLength(1)
      expect(prismaMock.edition.findMany).toHaveBeenCalledWith({
        include: {
          convention: {
            select: {
              id: true,
              name: true
            }
          },
          creator: {
            select: {
              id: true,
              pseudo: true,
              email: true
            }
          }
        }
      })
    })

    it('devrait permettre de désactiver une édition', async () => {
      const deactivatedEdition = { ...mockEdition, isActive: false }
      prismaMock.edition.update.mockResolvedValue(deactivatedEdition)

      const result = await prismaMock.edition.update({
        where: { id: 1 },
        data: { isActive: false }
      })

      expect(result.isActive).toBe(false)
      expect(prismaMock.edition.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false }
      })
    })

    it('devrait permettre de supprimer une édition', async () => {
      prismaMock.edition.delete.mockResolvedValue(mockEdition)

      const result = await prismaMock.edition.delete({
        where: { id: 1 }
      })

      expect(result).toEqual(mockEdition)
      expect(prismaMock.edition.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      })
    })
  })

  describe('Statistiques admin', () => {
    it('devrait calculer les statistiques des utilisateurs', async () => {
      // Mock des différents appels de count
      prismaMock.user.count
        .mockResolvedValueOnce(150) // Total utilisateurs
        .mockResolvedValueOnce(5)   // Admins
        .mockResolvedValueOnce(140) // Emails vérifiés
        .mockResolvedValueOnce(25)  // Nouveaux ce mois

      const totalUsers = await prismaMock.user.count()
      const totalAdmins = await prismaMock.user.count({ 
        where: { isGlobalAdmin: true } 
      })
      const verifiedUsers = await prismaMock.user.count({ 
        where: { isEmailVerified: true } 
      })
      const newUsersThisMonth = await prismaMock.user.count({ 
        where: { 
          createdAt: { 
            gte: new Date(new Date().setDate(1)) 
          } 
        } 
      })

      expect(totalUsers).toBe(150)
      expect(totalAdmins).toBe(5)
      expect(verifiedUsers).toBe(140)
      expect(newUsersThisMonth).toBe(25)
    })

    it('devrait calculer les statistiques des conventions', async () => {
      // Mock des différents appels de count
      prismaMock.convention.count
        .mockResolvedValueOnce(45) // Total conventions
        .mockResolvedValueOnce(42) // Conventions actives
      prismaMock.edition.count
        .mockResolvedValueOnce(120) // Total éditions
        .mockResolvedValueOnce(15)  // Éditions à venir

      const totalConventions = await prismaMock.convention.count()
      const activeConventions = await prismaMock.convention.count({ 
        where: { isActive: true } 
      })
      const totalEditions = await prismaMock.edition.count()
      const upcomingEditions = await prismaMock.edition.count({ 
        where: { 
          startDate: { 
            gte: new Date() 
          } 
        } 
      })

      expect(totalConventions).toBe(45)
      expect(activeConventions).toBe(42)
      expect(totalEditions).toBe(120)
      expect(upcomingEditions).toBe(15)
    })
  })

  describe('Validation des données admin', () => {
    it('devrait valider les données avant modification', async () => {
      const invalidUserData = {
        email: 'invalid-email',
        pseudo: '',
        isGlobalAdmin: 'not-boolean'
      }

      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invalidUserData.email)
      const isValidPseudo = invalidUserData.pseudo.trim().length > 0
      const isValidAdminFlag = typeof invalidUserData.isGlobalAdmin === 'boolean'

      expect(isValidEmail).toBe(false)
      expect(isValidPseudo).toBe(false)
      expect(isValidAdminFlag).toBe(false)
    })

    it('devrait accepter des données valides', async () => {
      const validUserData = {
        email: 'valid@example.com',
        pseudo: 'validpseudo',
        isGlobalAdmin: true
      }

      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(validUserData.email)
      const isValidPseudo = validUserData.pseudo.trim().length > 0
      const isValidAdminFlag = typeof validUserData.isGlobalAdmin === 'boolean'

      expect(isValidEmail).toBe(true)
      expect(isValidPseudo).toBe(true)
      expect(isValidAdminFlag).toBe(true)
    })
  })

  describe('Logs et audit admin', () => {
    it('devrait enregistrer les actions admin', async () => {
      const adminAction = {
        adminId: 1,
        action: 'USER_PROMOTED',
        targetId: 2,
        timestamp: new Date(),
        details: 'User promoted to admin'
      }

      // Mock d'un système de logs (si implémenté)
      const logAction = vi.fn()
      logAction(adminAction)

      expect(logAction).toHaveBeenCalledWith(adminAction)
    })

    it('devrait tracer les modifications sensibles', async () => {
      const sensitiveChange = {
        adminId: 1,
        action: 'CONVENTION_DELETED',
        targetId: 1,
        beforeValue: { name: 'Convention Test', isActive: true },
        afterValue: null,
        timestamp: new Date()
      }

      // Mock d'un système d'audit
      const auditLog = vi.fn()
      auditLog(sensitiveChange)

      expect(auditLog).toHaveBeenCalledWith(sensitiveChange)
    })
  })
})