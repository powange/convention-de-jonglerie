import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../__mocks__/prisma'

describe('Collaborateurs de convention', () => {
  const mockUser = {
    id: 1,
    email: 'admin@example.com',
    pseudo: 'admin',
    nom: 'Admin',
    prenom: 'User'
  }

  const mockCollaborator = {
    id: 2,
    email: 'collaborator@example.com',
    pseudo: 'collaborator',
    nom: 'Collaborator',
    prenom: 'User'
  }

  const mockConvention = {
    id: 1,
    name: 'Convention Test',
    authorId: 1,
    collaborators: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Ajout de collaborateurs', () => {
    it('devrait permettre à l\'auteur d\'ajouter un collaborateur', async () => {
      const collaboratorData = {
        email: 'new@example.com',
        role: 'MODERATOR'
      }

      const existingUser = {
        id: 3,
        email: 'new@example.com',
        pseudo: 'newuser'
      }

      const createdCollaborator = {
        id: 1,
        conventionId: 1,
        userId: 3,
        role: 'MODERATOR',
        addedById: 1,
        user: existingUser
      }

      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        collaborators: [{ userId: 1, role: 'ADMINISTRATOR' }]
      })
      prismaMock.user.findUnique.mockResolvedValue(existingUser)
      prismaMock.conventionCollaborator.create.mockResolvedValue(createdCollaborator)

      // Simuler l'appel API d'ajout de collaborateur
      const addCollaborator = async (conventionId: number, data: typeof collaboratorData, userId: number) => {
        // Vérifier permissions
        const convention = await prismaMock.convention.findUnique({
          where: { id: conventionId },
          include: {
            collaborators: {
              where: { userId, role: 'ADMINISTRATOR' }
            }
          }
        })

        if (!convention || (convention.authorId !== userId && convention.collaborators.length === 0)) {
          throw new Error('Unauthorized')
        }

        // Trouver l'utilisateur
        const user = await prismaMock.user.findUnique({
          where: { email: data.email }
        })

        if (!user) {
          throw new Error('User not found')
        }

        // Créer le collaborateur
        return await prismaMock.conventionCollaborator.create({
          data: {
            conventionId,
            userId: user.id,
            role: data.role as any,
            addedById: userId
          },
          include: { user: true }
        })
      }

      const result = await addCollaborator(1, collaboratorData, 1)

      expect(result.role).toBe('MODERATOR')
      expect(result.user.email).toBe('new@example.com')
      expect(prismaMock.conventionCollaborator.create).toHaveBeenCalledWith({
        data: {
          conventionId: 1,
          userId: 3,
          role: 'MODERATOR',
          addedById: 1
        },
        include: { user: true }
      })
    })

    it('devrait rejeter si l\'utilisateur n\'a pas les droits', async () => {
      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        authorId: 2, // Différent utilisateur
        collaborators: []
      })

      const addCollaborator = async (conventionId: number, data: any, userId: number) => {
        const convention = await prismaMock.convention.findUnique({
          where: { id: conventionId },
          include: {
            collaborators: {
              where: { userId, role: 'ADMINISTRATOR' }
            }
          }
        })

        if (!convention || (convention.authorId !== userId && convention.collaborators.length === 0)) {
          throw new Error('Unauthorized')
        }

        return null
      }

      await expect(addCollaborator(1, { email: 'test@example.com', role: 'MODERATOR' }, 1))
        .rejects.toThrow('Unauthorized')
    })

    it('devrait rejeter si l\'utilisateur à ajouter n\'existe pas', async () => {
      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        collaborators: [{ userId: 1, role: 'ADMINISTRATOR' }]
      })
      prismaMock.user.findUnique.mockResolvedValue(null)

      const addCollaborator = async (conventionId: number, data: any, userId: number) => {
        await prismaMock.convention.findUnique({
          where: { id: conventionId },
          include: {
            collaborators: {
              where: { userId, role: 'ADMINISTRATOR' }
            }
          }
        })

        const user = await prismaMock.user.findUnique({
          where: { email: data.email }
        })

        if (!user) {
          throw new Error('User not found')
        }

        return null
      }

      await expect(addCollaborator(1, { email: 'nonexistent@example.com', role: 'MODERATOR' }, 1))
        .rejects.toThrow('User not found')
    })

    it('devrait empêcher l\'ajout du même utilisateur deux fois', async () => {
      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        collaborators: [
          { userId: 1, role: 'ADMINISTRATOR' },
          { userId: 2, role: 'MODERATOR' }
        ]
      })
      prismaMock.user.findUnique.mockResolvedValue(mockCollaborator)
      prismaMock.conventionCollaborator.findFirst.mockResolvedValue({
        id: 1,
        userId: 2,
        conventionId: 1
      })

      const addCollaborator = async (conventionId: number, data: any, userId: number) => {
        const user = await prismaMock.user.findUnique({
          where: { email: data.email }
        })

        const existing = await prismaMock.conventionCollaborator.findFirst({
          where: {
            conventionId,
            userId: user!.id
          }
        })

        if (existing) {
          throw new Error('User already collaborator')
        }

        return null
      }

      await expect(addCollaborator(1, { email: 'collaborator@example.com', role: 'MODERATOR' }, 1))
        .rejects.toThrow('User already collaborator')
    })
  })

  describe('Modification de collaborateurs', () => {
    it('devrait permettre de changer le rôle d\'un collaborateur', async () => {
      const existingCollaborator = {
        id: 1,
        conventionId: 1,
        userId: 2,
        role: 'MODERATOR'
      }

      const updatedCollaborator = {
        ...existingCollaborator,
        role: 'ADMINISTRATOR'
      }

      prismaMock.conventionCollaborator.findUnique.mockResolvedValue(existingCollaborator)
      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        collaborators: [{ userId: 1, role: 'ADMINISTRATOR' }]
      })
      prismaMock.conventionCollaborator.update.mockResolvedValue(updatedCollaborator)

      const updateCollaborator = async (collaboratorId: number, newRole: string, userId: number) => {
        const collaborator = await prismaMock.conventionCollaborator.findUnique({
          where: { id: collaboratorId }
        })

        if (!collaborator) {
          throw new Error('Collaborator not found')
        }

        const convention = await prismaMock.convention.findUnique({
          where: { id: collaborator.conventionId },
          include: {
            collaborators: {
              where: { userId, role: 'ADMINISTRATOR' }
            }
          }
        })

        if (!convention || (convention.authorId !== userId && convention.collaborators.length === 0)) {
          throw new Error('Unauthorized')
        }

        return await prismaMock.conventionCollaborator.update({
          where: { id: collaboratorId },
          data: { role: newRole }
        })
      }

      const result = await updateCollaborator(1, 'ADMINISTRATOR', 1)

      expect(result.role).toBe('ADMINISTRATOR')
      expect(prismaMock.conventionCollaborator.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { role: 'ADMINISTRATOR' }
      })
    })

    it('devrait empêcher de rétrograder le dernier administrateur', async () => {
      const existingCollaborator = {
        id: 1,
        conventionId: 1,
        userId: 1,
        role: 'ADMINISTRATOR'
      }

      prismaMock.conventionCollaborator.findUnique.mockResolvedValue(existingCollaborator)
      prismaMock.conventionCollaborator.count.mockResolvedValue(1) // Seul admin

      const updateCollaborator = async (collaboratorId: number, newRole: string) => {
        const collaborator = await prismaMock.conventionCollaborator.findUnique({
          where: { id: collaboratorId }
        })

        if (collaborator!.role === 'ADMINISTRATOR' && newRole !== 'ADMINISTRATOR') {
          const adminCount = await prismaMock.conventionCollaborator.count({
            where: {
              conventionId: collaborator!.conventionId,
              role: 'ADMINISTRATOR'
            }
          })

          if (adminCount <= 1) {
            throw new Error('Cannot remove last administrator')
          }
        }

        return null
      }

      await expect(updateCollaborator(1, 'MODERATOR'))
        .rejects.toThrow('Cannot remove last administrator')
    })
  })

  describe('Suppression de collaborateurs', () => {
    it('devrait permettre de supprimer un collaborateur', async () => {
      const existingCollaborator = {
        id: 1,
        conventionId: 1,
        userId: 2,
        role: 'MODERATOR'
      }

      prismaMock.conventionCollaborator.findUnique.mockResolvedValue(existingCollaborator)
      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        collaborators: [{ userId: 1, role: 'ADMINISTRATOR' }]
      })
      prismaMock.conventionCollaborator.delete.mockResolvedValue(existingCollaborator)

      const removeCollaborator = async (collaboratorId: number, userId: number) => {
        const collaborator = await prismaMock.conventionCollaborator.findUnique({
          where: { id: collaboratorId }
        })

        if (!collaborator) {
          throw new Error('Collaborator not found')
        }

        const convention = await prismaMock.convention.findUnique({
          where: { id: collaborator.conventionId },
          include: {
            collaborators: {
              where: { userId, role: 'ADMINISTRATOR' }
            }
          }
        })

        if (!convention || (convention.authorId !== userId && convention.collaborators.length === 0)) {
          throw new Error('Unauthorized')
        }

        return await prismaMock.conventionCollaborator.delete({
          where: { id: collaboratorId }
        })
      }

      const result = await removeCollaborator(1, 1)

      expect(result.id).toBe(1)
      expect(prismaMock.conventionCollaborator.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      })
    })

    it('devrait empêcher un collaborateur de se supprimer lui-même', async () => {
      const existingCollaborator = {
        id: 1,
        conventionId: 1,
        userId: 2,
        role: 'MODERATOR'
      }

      prismaMock.conventionCollaborator.findUnique.mockResolvedValue(existingCollaborator)

      const removeCollaborator = async (collaboratorId: number, userId: number) => {
        const collaborator = await prismaMock.conventionCollaborator.findUnique({
          where: { id: collaboratorId }
        })

        if (collaborator!.userId === userId) {
          throw new Error('Cannot remove yourself')
        }

        return null
      }

      await expect(removeCollaborator(1, 2))
        .rejects.toThrow('Cannot remove yourself')
    })

    it('devrait empêcher de supprimer le dernier administrateur', async () => {
      const existingCollaborator = {
        id: 1,
        conventionId: 1,
        userId: 1,
        role: 'ADMINISTRATOR'
      }

      prismaMock.conventionCollaborator.findUnique.mockResolvedValue(existingCollaborator)
      prismaMock.conventionCollaborator.count.mockResolvedValue(1)

      const removeCollaborator = async (collaboratorId: number, userId: number) => {
        const collaborator = await prismaMock.conventionCollaborator.findUnique({
          where: { id: collaboratorId }
        })

        if (collaborator!.role === 'ADMINISTRATOR') {
          const adminCount = await prismaMock.conventionCollaborator.count({
            where: {
              conventionId: collaborator!.conventionId,
              role: 'ADMINISTRATOR'
            }
          })

          if (adminCount <= 1) {
            throw new Error('Cannot remove last administrator')
          }
        }

        return null
      }

      await expect(removeCollaborator(1, 2))
        .rejects.toThrow('Cannot remove last administrator')
    })
  })

  describe('Récupération des collaborateurs', () => {
    it('devrait lister tous les collaborateurs d\'une convention', async () => {
      const collaborators = [
        {
          id: 1,
          conventionId: 1,
          userId: 1,
          role: 'ADMINISTRATOR',
          user: {
            id: 1,
            pseudo: 'admin',
            email: 'admin@example.com',
            profilePicture: null
          },
          addedBy: {
            id: 1,
            pseudo: 'admin'
          }
        },
        {
          id: 2,
          conventionId: 1,
          userId: 2,
          role: 'MODERATOR',
          user: {
            id: 2,
            pseudo: 'moderator',
            email: 'moderator@example.com',
            profilePicture: null
          },
          addedBy: {
            id: 1,
            pseudo: 'admin'
          }
        }
      ]

      prismaMock.conventionCollaborator.findMany.mockResolvedValue(collaborators)

      const getCollaborators = async (conventionId: number) => {
        return await prismaMock.conventionCollaborator.findMany({
          where: { conventionId },
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                email: true,
                profilePicture: true
              }
            },
            addedBy: {
              select: {
                id: true,
                pseudo: true
              }
            }
          }
        })
      }

      const result = await getCollaborators(1)

      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('ADMINISTRATOR')
      expect(result[1].role).toBe('MODERATOR')
      expect(result[0].user.pseudo).toBe('admin')
      expect(result[1].user.pseudo).toBe('moderator')
    })

    it('devrait filtrer les collaborateurs par rôle', async () => {
      const allCollaborators = [
        { id: 1, role: 'ADMINISTRATOR', user: { pseudo: 'admin1' } },
        { id: 2, role: 'MODERATOR', user: { pseudo: 'mod1' } },
        { id: 3, role: 'ADMINISTRATOR', user: { pseudo: 'admin2' } },
        { id: 4, role: 'MODERATOR', user: { pseudo: 'mod2' } }
      ]

      const admins = allCollaborators.filter(c => c.role === 'ADMINISTRATOR')
      const moderators = allCollaborators.filter(c => c.role === 'MODERATOR')

      expect(admins).toHaveLength(2)
      expect(moderators).toHaveLength(2)
      expect(admins[0].user.pseudo).toBe('admin1')
      expect(moderators[0].user.pseudo).toBe('mod1')
    })
  })

  describe('Permissions et rôles', () => {
    it('devrait définir les permissions par rôle', () => {
      const permissions = {
        ADMINISTRATOR: [
          'manage_collaborators',
          'edit_convention',
          'delete_convention',
          'manage_editions'
        ],
        MODERATOR: [
          'edit_convention',
          'manage_editions'
        ],
        VIEWER: [
          'view_convention'
        ]
      }

      const hasPermission = (role: string, permission: string) => {
        return permissions[role as keyof typeof permissions]?.includes(permission) || false
      }

      expect(hasPermission('ADMINISTRATOR', 'manage_collaborators')).toBe(true)
      expect(hasPermission('MODERATOR', 'manage_collaborators')).toBe(false)
      expect(hasPermission('MODERATOR', 'edit_convention')).toBe(true)
      expect(hasPermission('VIEWER', 'edit_convention')).toBe(false)
    })

    it('devrait vérifier les permissions avant les actions', () => {
      const userRole = 'MODERATOR'
      
      const canManageCollaborators = userRole === 'ADMINISTRATOR'
      const canEditConvention = ['ADMINISTRATOR', 'MODERATOR'].includes(userRole)
      const canViewConvention = ['ADMINISTRATOR', 'MODERATOR', 'VIEWER'].includes(userRole)

      expect(canManageCollaborators).toBe(false)
      expect(canEditConvention).toBe(true)
      expect(canViewConvention).toBe(true)
    })
  })

  describe('Notifications et historique', () => {
    it('devrait enregistrer l\'historique des ajouts de collaborateurs', () => {
      const history: Array<{
        action: string,
        collaboratorId: number,
        addedBy: number,
        timestamp: Date
      }> = []

      const logCollaboratorAction = (action: string, collaboratorId: number, addedBy: number) => {
        history.push({
          action,
          collaboratorId,
          addedBy,
          timestamp: new Date()
        })
      }

      logCollaboratorAction('ADDED', 1, 1)
      logCollaboratorAction('ROLE_CHANGED', 1, 1)
      logCollaboratorAction('REMOVED', 1, 1)

      expect(history).toHaveLength(3)
      expect(history[0].action).toBe('ADDED')
      expect(history[1].action).toBe('ROLE_CHANGED')
      expect(history[2].action).toBe('REMOVED')
    })

    it('devrait notifier les collaborateurs des changements', () => {
      const notifications: Array<{
        userId: number,
        message: string,
        type: string
      }> = []

      const notifyCollaboratorChange = (userId: number, action: string, conventionName: string) => {
        const messages = {
          ADDED: `Vous avez été ajouté comme collaborateur à ${conventionName}`,
          ROLE_CHANGED: `Votre rôle a été modifié dans ${conventionName}`,
          REMOVED: `Vous avez été retiré de ${conventionName}`
        }

        notifications.push({
          userId,
          message: messages[action as keyof typeof messages],
          type: 'COLLABORATOR_UPDATE'
        })
      }

      notifyCollaboratorChange(2, 'ADDED', 'Convention Test')
      notifyCollaboratorChange(2, 'ROLE_CHANGED', 'Convention Test')

      expect(notifications).toHaveLength(2)
      expect(notifications[0].message).toContain('ajouté comme collaborateur')
      expect(notifications[1].message).toContain('rôle a été modifié')
    })
  })

  describe('Validation et sécurité', () => {
    it('devrait valider les rôles autorisés', () => {
      const validRoles = ['ADMINISTRATOR', 'MODERATOR', 'VIEWER']
      const invalidRole = 'SUPER_ADMIN'

      const isValidRole = (role: string) => {
        return validRoles.includes(role)
      }

      expect(isValidRole('ADMINISTRATOR')).toBe(true)
      expect(isValidRole('MODERATOR')).toBe(true)
      expect(isValidRole(invalidRole)).toBe(false)
    })

    it('devrait limiter le nombre de collaborateurs par convention', () => {
      const maxCollaborators = 50
      const currentCollaborators = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }))

      const canAddMoreCollaborators = currentCollaborators.length < maxCollaborators

      expect(canAddMoreCollaborators).toBe(false)
    })

    it('devrait empêcher l\'ajout de collaborateurs avec des emails invalides', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user name@domain.com'
      ]

      const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
      }

      invalidEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(false)
      })

      expect(isValidEmail('valid@example.com')).toBe(true)
    })
  })
})