import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/volunteers/settings.patch'
import { prismaMock } from '../../../../../__mocks__/prisma'

// Mock de la fonction de permissions
vi.mock('../../../../../../server/utils/collaborator-management', () => ({
  canManageEditionVolunteers: vi.fn().mockResolvedValue(true),
}))

describe.skip('/api/editions/[id]/volunteers/settings PATCH', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
  }

  // Créer des dates futures pour les tests
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)

  const mockEdition = {
    id: 1,
    name: 'Edition Test',
    conventionId: 1,
    convention: {
      id: 1,
      authorId: 1,
      collaborators: [],
    },
    volunteersMode: 'INTERNAL',
    volunteersDescription: 'Description initiale',
    volunteersExternalUrl: null,
    askSetup: true,
    askTeardown: true,
    volunteersSetupStartDate: tomorrow,
    volunteersSetupEndDate: nextWeek,
    askDiet: false,
    askAllergies: false,
    askPets: false,
    askMinors: false,
    askVehicle: false,
    askTimePreferences: false,
    askTeamPreferences: false,
    askCompanion: false,
    askAvoidList: false,
    askSkills: false,
    askExperience: false,
    teams: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  describe.skip('Mode de gestion des bénévoles', () => {
    it('devrait permettre de passer en mode interne', async () => {
      const updateData = {
        mode: 'INTERNAL',
        description: 'Gestion interne des bénévoles',
        askSetup: true,
        askTeardown: true,
        setupStartDate: tomorrow.toISOString(),
        setupEndDate: nextWeek.toISOString(),
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      // L'API retourne seulement les champs sélectionnés
      prismaMock.edition.update.mockResolvedValue({
        volunteersMode: 'INTERNAL',
        volunteersDescription: updateData.description,
        volunteersOpen: true,
        volunteersExternalUrl: null,
        volunteersAskDiet: false,
        volunteersAskAllergies: false,
        volunteersAskTimePreferences: false,
        volunteersAskTeamPreferences: false,
        volunteersAskPets: false,
        volunteersAskMinors: false,
        volunteersAskVehicle: false,
        volunteersAskCompanion: false,
        volunteersAskAvoidList: false,
        volunteersAskSkills: false,
        volunteersAskExperience: false,
        volunteersSetupStartDate: new Date(tomorrow.toISOString()),
        volunteersSetupEndDate: new Date(nextWeek.toISOString()),
        askSetup: true,
        askTeardown: true,
      } as any)

      global.readBody.mockResolvedValue(updateData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.settings.volunteersMode).toBe('INTERNAL')
      expect(result.settings.volunteersDescription).toBe(updateData.description)
      expect(prismaMock.edition.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          volunteersMode: 'INTERNAL',
          volunteersDescription: updateData.description,
          volunteersAskSetup: true,
          volunteersAskTeardown: true,
          volunteersSetupStartDate: new Date(tomorrow.toISOString()),
          volunteersTeardownEndDate: new Date(nextWeek.toISOString()),
        }),
        select: expect.any(Object),
      })
    })

    it('devrait permettre de passer en mode externe', async () => {
      const updateData = {
        mode: 'EXTERNAL',
        externalUrl: 'https://external-volunteers.example.com',
        description: 'Géré via plateforme externe',
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.edition.update.mockResolvedValue({
        ...mockEdition,
        volunteersMode: 'EXTERNAL',
        volunteersExternalUrl: updateData.externalUrl,
      })

      global.readBody.mockResolvedValue(updateData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.settings.volunteersMode).toBe('EXTERNAL')
      expect(result.settings.volunteersExternalUrl).toBe(updateData.externalUrl)

      expect(prismaMock.edition.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          volunteersMode: 'EXTERNAL',
          volunteersExternalUrl: updateData.externalUrl,
          volunteersDescription: updateData.description,
        }),
        select: expect.any(Object),
      })
    })
  })

  describe.skip('Validation des données', () => {
    it('devrait valider les URLs externes', async () => {
      const invalidUrls = [
        'not-a-url',
        'http://',
        'https://',
        'ftp://invalid.com',
        '',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
      ]

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      for (const invalidUrl of invalidUrls) {
        const updateData = {
          mode: 'EXTERNAL',
          externalUrl: invalidUrl,
        }

        global.readBody.mockResolvedValue(updateData)
        const mockEvent = { context: { user: mockUser } }

        // La validation Zod doit rejeter ces URLs invalides ou dangereuses
        await expect(handler(mockEvent as any)).rejects.toThrow()
      }
    })

    it('devrait accepter les URLs externes valides', async () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://sub.example.com/path?param=value',
        'http://localhost:3000/form',
        'https://forms.google.com/d/e/1FAIpQLSe_example/viewform',
      ]

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      for (const validUrl of validUrls) {
        const updateData = {
          mode: 'EXTERNAL',
          externalUrl: validUrl,
        }

        prismaMock.edition.update.mockResolvedValue({
          ...mockEdition,
          volunteersMode: 'EXTERNAL',
          volunteersExternalUrl: validUrl,
        })

        global.readBody.mockResolvedValue(updateData)
        const mockEvent = { context: { user: mockUser } }

        // Les URLs valides doivent être acceptées
        const result = await handler(mockEvent as any)
        expect(result.success).toBe(true)
        expect(result.settings.volunteersMode).toBe('EXTERNAL')
        expect(result.settings.volunteersExternalUrl).toBe(validUrl)
      }
    })

    it('devrait valider les dates de montage/démontage', async () => {
      const invalidDateCases = [
        {
          setupStartDate: '2024-06-10T00:00:00.000Z',
          setupEndDate: '2024-06-05T23:59:59.999Z',
          description: 'date de fin avant date de début',
        },
        {
          setupStartDate: '2020-01-01T00:00:00.000Z',
          setupEndDate: '2020-01-02T00:00:00.000Z',
          description: 'dates dans le passé',
        },
        {
          setupStartDate: 'invalid-date',
          setupEndDate: '2024-06-05T00:00:00.000Z',
          description: 'format de date invalide',
        },
        {
          setupStartDate: '2024-06-05',
          setupEndDate: '2024-06-06',
          description: 'format sans heure (pas ISO 8601)',
        },
      ]

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      for (const testCase of invalidDateCases) {
        const updateData = {
          mode: 'INTERNAL',
          askSetup: true,
          setupStartDate: testCase.setupStartDate,
          setupEndDate: testCase.setupEndDate,
        }

        global.readBody.mockResolvedValue(updateData)
        const mockEvent = { context: { user: mockUser } }

        // La validation doit échouer pour : ${testCase.description}
        await expect(handler(mockEvent as any)).rejects.toThrow()
      }
    })

    it('devrait accepter les dates de montage/démontage valides', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dayAfter = new Date()
      dayAfter.setDate(dayAfter.getDate() + 2)

      const validDateCases = [
        {
          setupStartDate: tomorrow.toISOString(),
          setupEndDate: dayAfter.toISOString(),
          description: 'dates futures correctes',
        },
        {
          setupStartDate: tomorrow.toISOString(),
          setupEndDate: tomorrow.toISOString(), // Même date OK
          description: 'même date de début et fin',
        },
      ]

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      for (const testCase of validDateCases) {
        const updateData = {
          mode: 'INTERNAL',
          askSetup: true,
          setupStartDate: testCase.setupStartDate,
          setupEndDate: testCase.setupEndDate,
        }

        prismaMock.edition.update.mockResolvedValue({
          ...mockEdition,
          volunteersAskSetup: true,
          volunteersSetupStartDate: new Date(testCase.setupStartDate),
          volunteersTeardownEndDate: new Date(testCase.setupEndDate),
        })

        global.readBody.mockResolvedValue(updateData)
        const mockEvent = { context: { user: mockUser } }

        // Les dates valides doivent être acceptées
        const result = await handler(mockEvent as any)
        expect(result.success).toBe(true)
        expect(result.settings.volunteersAskSetup).toBe(true)
      }
    })

    it('devrait valider la longueur de la description', async () => {
      const longDescription = 'a'.repeat(5001) // Dépasse la limite de 5000

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      const updateData = {
        mode: 'INTERNAL',
        description: longDescription,
      }

      global.readBody.mockResolvedValue(updateData)
      const mockEvent = { context: { user: mockUser } }

      // Doit rejeter les descriptions trop longues
      await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
    })

    it('devrait accepter les descriptions de longueur valide', async () => {
      const validDescriptions = [
        'Description courte',
        'a'.repeat(5000), // Exactement 5000 caractères (limite)
        'a'.repeat(2500), // Longueur moyenne
        '', // Description vide
        null, // Description null
      ]

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      for (const description of validDescriptions) {
        const updateData = {
          mode: 'INTERNAL',
          description: description,
        }

        prismaMock.edition.update.mockResolvedValue({
          ...mockEdition,
          volunteersMode: 'INTERNAL',
          volunteersDescription: description,
        })

        global.readBody.mockResolvedValue(updateData)
        const mockEvent = { context: { user: mockUser } }

        // Les descriptions valides doivent être acceptées
        const result = await handler(mockEvent as any)
        expect(result.success).toBe(true)
        expect(result.settings.volunteersDescription).toBe(description)
      }
    })

    it('devrait valider les noms des équipes', async () => {
      const invalidTeams = [
        [{ name: '', slots: 5 }], // Nom vide
        [{ name: 'a'.repeat(101), slots: 5 }], // Nom trop long
        [{ name: 'Équipe 1', slots: -1 }], // Slots négatifs
        [{ name: 'Équipe 1', slots: 1001 }], // Trop de slots
      ]

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      for (const teams of invalidTeams) {
        const updateData = {
          mode: 'INTERNAL',
          teams,
        }

        global.readBody.mockResolvedValue(updateData)
        const mockEvent = { context: { user: mockUser } }

        await expect(handler(mockEvent as any)).rejects.toThrow()
      }
    })
  })

  describe.skip('Options de candidature', () => {
    it('devrait configurer toutes les options de candidature', async () => {
      const fullOptions = {
        mode: 'INTERNAL',
        askDiet: true,
        askAllergies: true,
        askPets: true,
        askMinors: true,
        askVehicle: true,
        askTimePreferences: true,
        askTeamPreferences: true,
        askCompanion: true,
        askAvoidList: true,
        askSkills: true,
        askExperience: true,
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.edition.update.mockResolvedValue({ ...mockEdition, ...fullOptions })

      global.readBody.mockResolvedValue(fullOptions)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.edition.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          volunteersAskDiet: true,
          volunteersAskAllergies: true,
          volunteersAskPets: true,
          volunteersAskMinors: true,
          volunteersAskVehicle: true,
          volunteersAskTimePreferences: true,
          volunteersAskTeamPreferences: true,
          volunteersAskCompanion: true,
          volunteersAskAvoidList: true,
          volunteersAskSkills: true,
          volunteersAskExperience: true,
        }),
        select: expect.any(Object),
      })
    })

    it('devrait désactiver toutes les options', async () => {
      const noOptions = {
        mode: 'INTERNAL',
        askDiet: false,
        askAllergies: false,
        askPets: false,
        askMinors: false,
        askVehicle: false,
        askTimePreferences: false,
        askTeamPreferences: false,
        askCompanion: false,
        askAvoidList: false,
        askSkills: false,
        askExperience: false,
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.edition.update.mockResolvedValue({ ...mockEdition, ...noOptions })

      global.readBody.mockResolvedValue(noOptions)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.edition.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          volunteersAskDiet: false,
          volunteersAskAllergies: false,
          volunteersAskPets: false,
          volunteersAskMinors: false,
          volunteersAskVehicle: false,
          volunteersAskTimePreferences: false,
          volunteersAskTeamPreferences: false,
          volunteersAskCompanion: false,
          volunteersAskAvoidList: false,
          volunteersAskSkills: false,
          volunteersAskExperience: false,
        }),
        select: expect.any(Object),
      })
    })
  })

  // Section "Gestion des équipes" supprimée
  // Les équipes sont maintenant gérées via le système VolunteerTeam
  // et non plus via l'API settings.patch.ts

  describe.skip('Permissions', () => {
    it("devrait permettre au créateur de l'édition", async () => {
      const updateData = { mode: 'INTERNAL' }

      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        creatorId: mockUser.id,
      })
      prismaMock.edition.update.mockResolvedValue(mockEdition)

      global.readBody.mockResolvedValue(updateData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)
      expect(result).toBeDefined()
    })

    it('devrait permettre au créateur de la convention', async () => {
      const updateData = { mode: 'INTERNAL' }

      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        creatorId: 999, // Différent créateur d'édition
        convention: {
          ...mockEdition.convention,
          authorId: mockUser.id, // Créateur de convention
        },
      })
      prismaMock.edition.update.mockResolvedValue(mockEdition)

      global.readBody.mockResolvedValue(updateData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)
      expect(result).toBeDefined()
    })

    it('devrait permettre aux collaborateurs autorisés', async () => {
      const collaboratorUser = { ...mockUser, id: 2 }
      const updateData = { mode: 'INTERNAL' }

      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        creatorId: 999,
        convention: {
          ...mockEdition.convention,
          authorId: 999,
          collaborators: [
            {
              userId: collaboratorUser.id,
              canManageVolunteers: true,
            },
          ],
        },
      })
      prismaMock.edition.update.mockResolvedValue(mockEdition)

      global.readBody.mockResolvedValue(updateData)
      const mockEvent = { context: { user: collaboratorUser } }

      const result = await handler(mockEvent as any)
      expect(result).toBeDefined()
    })

    it('devrait rejeter les utilisateurs non autorisés', async () => {
      const { canManageEditionVolunteers } = await import(
        '../../../../../../server/utils/collaborator-management'
      )
      vi.mocked(canManageEditionVolunteers).mockResolvedValueOnce(false)

      const unauthorizedUser = { ...mockUser, id: 3 }
      const updateData = { mode: 'INTERNAL' }

      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        creatorId: 999,
        convention: {
          ...mockEdition.convention,
          authorId: 999,
          collaborators: [],
        },
      })

      global.readBody.mockResolvedValue(updateData)
      const mockEvent = { context: { user: unauthorizedUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(
        'Droits insuffisants pour gérer les bénévoles'
      )
    })

    it('devrait rejeter les utilisateurs non connectés', async () => {
      const updateData = { mode: 'INTERNAL' }

      global.readBody.mockResolvedValue(updateData)
      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Non authentifié')
    })
  })

  describe.skip('Cas limites et erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)

      global.readBody.mockResolvedValue({ mode: 'INTERNAL' })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Edition introuvable')
    })

    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.edition.update.mockRejectedValue(new Error('DB Error'))

      global.readBody.mockResolvedValue({ mode: 'INTERNAL' })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('DB Error')
    })

    it('devrait ignorer les champs non reconnus', async () => {
      const updateData = {
        mode: 'INTERNAL',
        unknownField: 'should be ignored',
        anotherUnknown: 123,
        askDiet: true,
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.edition.update.mockResolvedValue(mockEdition)

      global.readBody.mockResolvedValue(updateData)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      const updateCall = prismaMock.edition.update.mock.calls[0][0]
      expect(updateCall.data.unknownField).toBeUndefined()
      expect(updateCall.data.anotherUnknown).toBeUndefined()
      expect(updateCall.data.volunteersAskDiet).toBe(true)
    })

    it('devrait préserver les données existantes non modifiées', async () => {
      const partialUpdate = {
        askDiet: true,
        // Ne modifie que askDiet, le reste devrait être préservé
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.edition.update.mockResolvedValue({ ...mockEdition, askDiet: true })

      global.readBody.mockResolvedValue(partialUpdate)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      const updateCall = prismaMock.edition.update.mock.calls[0][0]
      // Vérifier que seuls les champs explicitement fournis sont dans l'update
      expect(updateCall.data.volunteersAskDiet).toBe(true)
      // Les autres champs ne doivent pas être remis à false
      expect(updateCall.data.volunteersAskAllergies).toBeUndefined()
      expect(updateCall.data.volunteersMode).toBeUndefined()
    })
  })
})
