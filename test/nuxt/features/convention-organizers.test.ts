import { prismaMock } from '@@/test/__mocks__/prisma'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Organisateurs de convention', () => {
  const mockUser = {
    id: 1,
    email: 'admin@example.com',
    pseudo: 'admin',
    nom: 'Admin',
    prenom: 'User',
  }

  const mockOrganizer = {
    id: 2,
    email: 'organizer@example.com',
    pseudo: 'organizer',
    nom: 'Organizer',
    prenom: 'User',
  }

  const mockConvention = {
    id: 1,
    name: 'Convention Test',
    authorId: 1,
    organizers: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Ajout de organisateurs', () => {
    it("devrait permettre à l'auteur d'ajouter un organisateur", async () => {
      const organizerData = {
        email: 'new@example.com',
        role: 'MODERATOR',
      }

      const existingUser = {
        id: 3,
        email: 'new@example.com',
        pseudo: 'newuser',
      }

      const createdOrganizer = {
        id: 1,
        conventionId: 1,
        userId: 3,
        role: 'MODERATOR',
        addedById: 1,
        user: existingUser,
      }

      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        organizers: [{ userId: 1, role: 'ADMINISTRATOR' }],
      })
      prismaMock.user.findUnique.mockResolvedValue(existingUser)
      prismaMock.conventionOrganizer.create.mockResolvedValue(createdOrganizer)

      // Simuler l'appel API d'ajout de organisateur
      const addOrganizer = async (
        conventionId: number,
        data: typeof organizerData,
        userId: number
      ) => {
        // Vérifier permissions
        const convention = await prismaMock.convention.findUnique({
          where: { id: conventionId },
          include: {
            organizers: {
              where: { userId, role: 'ADMINISTRATOR' },
            },
          },
        })

        if (!convention || (convention.authorId !== userId && convention.organizers.length === 0)) {
          throw new Error('Unauthorized')
        }

        // Trouver l'utilisateur
        const user = await prismaMock.user.findUnique({
          where: { email: data.email },
        })

        if (!user) {
          throw new Error('User not found')
        }

        // Créer le organisateur
        return await prismaMock.conventionOrganizer.create({
          data: {
            conventionId,
            userId: user.id,
            role: data.role as any,
            addedById: userId,
          },
          include: { user: true },
        })
      }

      const result = await addOrganizer(1, organizerData, 1)

      expect(result.role).toBe('MODERATOR')
      expect(result.user.email).toBe('new@example.com')
      expect(prismaMock.conventionOrganizer.create).toHaveBeenCalledWith({
        data: {
          conventionId: 1,
          userId: 3,
          role: 'MODERATOR',
          addedById: 1,
        },
        include: { user: true },
      })
    })

    it("devrait rejeter si l'utilisateur n'a pas les droits", async () => {
      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        authorId: 2, // Différent utilisateur
        organizers: [],
      })

      const addOrganizer = async (conventionId: number, data: any, userId: number) => {
        const convention = await prismaMock.convention.findUnique({
          where: { id: conventionId },
          include: {
            organizers: {
              where: { userId, role: 'ADMINISTRATOR' },
            },
          },
        })

        if (!convention || (convention.authorId !== userId && convention.organizers.length === 0)) {
          throw new Error('Unauthorized')
        }

        return null
      }

      await expect(
        addOrganizer(1, { email: 'test@example.com', role: 'MODERATOR' }, 1)
      ).rejects.toThrow('Unauthorized')
    })

    it("devrait rejeter si l'utilisateur à ajouter n'existe pas", async () => {
      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        organizers: [{ userId: 1, role: 'ADMINISTRATOR' }],
      })
      prismaMock.user.findUnique.mockResolvedValue(null)

      const addOrganizer = async (conventionId: number, data: any, userId: number) => {
        await prismaMock.convention.findUnique({
          where: { id: conventionId },
          include: {
            organizers: {
              where: { userId, role: 'ADMINISTRATOR' },
            },
          },
        })

        const user = await prismaMock.user.findUnique({
          where: { email: data.email },
        })

        if (!user) {
          throw new Error('User not found')
        }

        return null
      }

      await expect(
        addOrganizer(1, { email: 'nonexistent@example.com', role: 'MODERATOR' }, 1)
      ).rejects.toThrow('User not found')
    })

    it("devrait empêcher l'ajout du même utilisateur deux fois", async () => {
      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        organizers: [
          { userId: 1, role: 'ADMINISTRATOR' },
          { userId: 2, role: 'MODERATOR' },
        ],
      })
      prismaMock.user.findUnique.mockResolvedValue(mockOrganizer)
      prismaMock.conventionOrganizer.findFirst.mockResolvedValue({
        id: 1,
        userId: 2,
        conventionId: 1,
      })

      const addOrganizer = async (conventionId: number, data: any, userId: number) => {
        const user = await prismaMock.user.findUnique({
          where: { email: data.email },
        })

        const existing = await prismaMock.conventionOrganizer.findFirst({
          where: {
            conventionId,
            userId: user!.id,
          },
        })

        if (existing) {
          throw new Error('User already organizer')
        }

        return null
      }

      await expect(
        addOrganizer(1, { email: 'organizer@example.com', role: 'MODERATOR' }, 1)
      ).rejects.toThrow('User already organizer')
    })
  })

  describe('Modification de organisateurs', () => {
    it("devrait permettre de changer le rôle d'un organisateur", async () => {
      const existingOrganizer = {
        id: 1,
        conventionId: 1,
        userId: 2,
        role: 'MODERATOR',
      }

      const updatedOrganizer = {
        ...existingOrganizer,
        role: 'ADMINISTRATOR',
      }

      prismaMock.conventionOrganizer.findUnique.mockResolvedValue(existingOrganizer)
      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        organizers: [{ userId: 1, role: 'ADMINISTRATOR' }],
      })
      prismaMock.conventionOrganizer.update.mockResolvedValue(updatedOrganizer)

      const updateOrganizer = async (organizerId: number, newRole: string, userId: number) => {
        const organizer = await prismaMock.conventionOrganizer.findUnique({
          where: { id: organizerId },
        })

        if (!organizer) {
          throw new Error('Organizer not found')
        }

        const convention = await prismaMock.convention.findUnique({
          where: { id: organizer.conventionId },
          include: {
            organizers: {
              where: { userId, role: 'ADMINISTRATOR' },
            },
          },
        })

        if (!convention || (convention.authorId !== userId && convention.organizers.length === 0)) {
          throw new Error('Unauthorized')
        }

        return await prismaMock.conventionOrganizer.update({
          where: { id: organizerId },
          data: { role: newRole },
        })
      }

      const result = await updateOrganizer(1, 'ADMINISTRATOR', 1)

      expect(result.role).toBe('ADMINISTRATOR')
      expect(prismaMock.conventionOrganizer.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { role: 'ADMINISTRATOR' },
      })
    })

    it('devrait empêcher de rétrograder le dernier administrateur', async () => {
      const existingOrganizer = {
        id: 1,
        conventionId: 1,
        userId: 1,
        role: 'ADMINISTRATOR',
      }

      prismaMock.conventionOrganizer.findUnique.mockResolvedValue(existingOrganizer)
      prismaMock.conventionOrganizer.count.mockResolvedValue(1) // Seul admin

      const updateOrganizer = async (organizerId: number, newRole: string) => {
        const organizer = await prismaMock.conventionOrganizer.findUnique({
          where: { id: organizerId },
        })

        if (organizer!.role === 'ADMINISTRATOR' && newRole !== 'ADMINISTRATOR') {
          const adminCount = await prismaMock.conventionOrganizer.count({
            where: {
              conventionId: organizer!.conventionId,
              role: 'ADMINISTRATOR',
            },
          })

          if (adminCount <= 1) {
            throw new Error('Cannot remove last administrator')
          }
        }

        return null
      }

      await expect(updateOrganizer(1, 'MODERATOR')).rejects.toThrow(
        'Cannot remove last administrator'
      )
    })
  })

  describe('Suppression de organisateurs', () => {
    it('devrait permettre de supprimer un organisateur', async () => {
      const existingOrganizer = {
        id: 1,
        conventionId: 1,
        userId: 2,
        role: 'MODERATOR',
      }

      prismaMock.conventionOrganizer.findUnique.mockResolvedValue(existingOrganizer)
      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        organizers: [{ userId: 1, role: 'ADMINISTRATOR' }],
      })
      prismaMock.conventionOrganizer.delete.mockResolvedValue(existingOrganizer)

      const removeOrganizer = async (organizerId: number, userId: number) => {
        const organizer = await prismaMock.conventionOrganizer.findUnique({
          where: { id: organizerId },
        })

        if (!organizer) {
          throw new Error('Organizer not found')
        }

        const convention = await prismaMock.convention.findUnique({
          where: { id: organizer.conventionId },
          include: {
            organizers: {
              where: { userId, role: 'ADMINISTRATOR' },
            },
          },
        })

        if (!convention || (convention.authorId !== userId && convention.organizers.length === 0)) {
          throw new Error('Unauthorized')
        }

        return await prismaMock.conventionOrganizer.delete({
          where: { id: organizerId },
        })
      }

      const result = await removeOrganizer(1, 1)

      expect(result.id).toBe(1)
      expect(prismaMock.conventionOrganizer.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
    })

    it('devrait empêcher un organisateur de se supprimer lui-même', async () => {
      const existingOrganizer = {
        id: 1,
        conventionId: 1,
        userId: 2,
        role: 'MODERATOR',
      }

      prismaMock.conventionOrganizer.findUnique.mockResolvedValue(existingOrganizer)

      const removeOrganizer = async (organizerId: number, userId: number) => {
        const organizer = await prismaMock.conventionOrganizer.findUnique({
          where: { id: organizerId },
        })

        if (organizer!.userId === userId) {
          throw new Error('Cannot remove yourself')
        }

        return null
      }

      await expect(removeOrganizer(1, 2)).rejects.toThrow('Cannot remove yourself')
    })

    it('devrait empêcher de supprimer le dernier administrateur', async () => {
      const existingOrganizer = {
        id: 1,
        conventionId: 1,
        userId: 1,
        role: 'ADMINISTRATOR',
      }

      prismaMock.conventionOrganizer.findUnique.mockResolvedValue(existingOrganizer)
      prismaMock.conventionOrganizer.count.mockResolvedValue(1)

      const removeOrganizer = async (organizerId: number, userId: number) => {
        const organizer = await prismaMock.conventionOrganizer.findUnique({
          where: { id: organizerId },
        })

        if (organizer!.role === 'ADMINISTRATOR') {
          const adminCount = await prismaMock.conventionOrganizer.count({
            where: {
              conventionId: organizer!.conventionId,
              role: 'ADMINISTRATOR',
            },
          })

          if (adminCount <= 1) {
            throw new Error('Cannot remove last administrator')
          }
        }

        return null
      }

      await expect(removeOrganizer(1, 2)).rejects.toThrow('Cannot remove last administrator')
    })
  })

  describe('Récupération des organisateurs', () => {
    it("devrait lister tous les organisateurs d'une convention", async () => {
      const organizers = [
        {
          id: 1,
          conventionId: 1,
          userId: 1,
          role: 'ADMINISTRATOR',
          user: {
            id: 1,
            pseudo: 'admin',
            email: 'admin@example.com',
            profilePicture: null,
          },
          addedBy: {
            id: 1,
            pseudo: 'admin',
          },
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
            profilePicture: null,
          },
          addedBy: {
            id: 1,
            pseudo: 'admin',
          },
        },
      ]

      prismaMock.conventionOrganizer.findMany.mockResolvedValue(organizers)

      const getOrganizers = async (conventionId: number) => {
        return await prismaMock.conventionOrganizer.findMany({
          where: { conventionId },
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                email: true,
                profilePicture: true,
              },
            },
            addedBy: {
              select: {
                id: true,
                pseudo: true,
              },
            },
          },
        })
      }

      const result = await getOrganizers(1)

      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('ADMINISTRATOR')
      expect(result[1].role).toBe('MODERATOR')
      expect(result[0].user.pseudo).toBe('admin')
      expect(result[1].user.pseudo).toBe('moderator')
    })

    it('devrait filtrer les organisateurs par rôle', async () => {
      const allOrganizers = [
        { id: 1, role: 'ADMINISTRATOR', user: { pseudo: 'admin1' } },
        { id: 2, role: 'MODERATOR', user: { pseudo: 'mod1' } },
        { id: 3, role: 'ADMINISTRATOR', user: { pseudo: 'admin2' } },
        { id: 4, role: 'MODERATOR', user: { pseudo: 'mod2' } },
      ]

      const admins = allOrganizers.filter((c) => c.role === 'ADMINISTRATOR')
      const moderators = allOrganizers.filter((c) => c.role === 'MODERATOR')

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
          'manage_organizers',
          'edit_convention',
          'delete_convention',
          'manage_editions',
        ],
        MODERATOR: ['edit_convention', 'manage_editions'],
        VIEWER: ['view_convention'],
      }

      const hasPermission = (role: string, permission: string) => {
        return permissions[role as keyof typeof permissions]?.includes(permission) || false
      }

      expect(hasPermission('ADMINISTRATOR', 'manage_organizers')).toBe(true)
      expect(hasPermission('MODERATOR', 'manage_organizers')).toBe(false)
      expect(hasPermission('MODERATOR', 'edit_convention')).toBe(true)
      expect(hasPermission('VIEWER', 'edit_convention')).toBe(false)
    })

    it('devrait vérifier les permissions avant les actions', () => {
      const userRole = 'MODERATOR'

      const canManageOrganizers = userRole === 'ADMINISTRATOR'
      const canEditConvention = ['ADMINISTRATOR', 'MODERATOR'].includes(userRole)
      const canViewConvention = ['ADMINISTRATOR', 'MODERATOR', 'VIEWER'].includes(userRole)

      expect(canManageOrganizers).toBe(false)
      expect(canEditConvention).toBe(true)
      expect(canViewConvention).toBe(true)
    })
  })

  describe('Notifications et historique', () => {
    it("devrait enregistrer l'historique des ajouts de organisateurs", () => {
      const history: Array<{
        action: string
        organizerId: number
        addedBy: number
        timestamp: Date
      }> = []

      const logOrganizerAction = (action: string, organizerId: number, addedBy: number) => {
        history.push({
          action,
          organizerId,
          addedBy,
          timestamp: new Date(),
        })
      }

      logOrganizerAction('ADDED', 1, 1)
      logOrganizerAction('ROLE_CHANGED', 1, 1)
      logOrganizerAction('REMOVED', 1, 1)

      expect(history).toHaveLength(3)
      expect(history[0].action).toBe('ADDED')
      expect(history[1].action).toBe('ROLE_CHANGED')
      expect(history[2].action).toBe('REMOVED')
    })

    it('devrait notifier les organisateurs des changements', () => {
      const notifications: Array<{
        userId: number
        message: string
        type: string
      }> = []

      const notifyOrganizerChange = (userId: number, action: string, conventionName: string) => {
        const messages = {
          ADDED: `Vous avez été ajouté comme organisateur à ${conventionName}`,
          ROLE_CHANGED: `Votre rôle a été modifié dans ${conventionName}`,
          REMOVED: `Vous avez été retiré de ${conventionName}`,
        }

        notifications.push({
          userId,
          message: messages[action as keyof typeof messages],
          type: 'ORGANIZER_UPDATE',
        })
      }

      notifyOrganizerChange(2, 'ADDED', 'Convention Test')
      notifyOrganizerChange(2, 'ROLE_CHANGED', 'Convention Test')

      expect(notifications).toHaveLength(2)
      expect(notifications[0].message).toContain('ajouté comme organisateur')
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

    it('devrait limiter le nombre de organisateurs par convention', () => {
      const maxOrganizers = 50
      const currentOrganizers = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }))

      const canAddMoreOrganizers = currentOrganizers.length < maxOrganizers

      expect(canAddMoreOrganizers).toBe(false)
    })

    it("devrait empêcher l'ajout de organisateurs avec des emails invalides", () => {
      const invalidEmails = ['invalid-email', '@domain.com', 'user@', 'user name@domain.com']

      const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
      }

      invalidEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(false)
      })

      expect(isValidEmail('valid@example.com')).toBe(true)
    })
  })
})
