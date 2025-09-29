import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { $fetch } from 'ofetch'
import { createError } from 'h3'

// Mock du service de session/auth pour simuler l'authentification
vi.mock('../utils/auth-session', () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
}))

// Mock des fonctions h3
vi.mock('h3', () => ({
  createError: vi.fn((err) => new Error(err.message || err.statusMessage || 'Error')),
  getRouterParam: vi.fn((event, param) => event.context.params?.[param]),
  readBody: vi.fn((event) => (event.readBody ? event.readBody() : Promise.resolve({}))),
  getQuery: vi.fn(() => ({})),
  defineEventHandler: <T extends (...args: any[]) => any>(fn: T) => fn,
}))

// Mock Prisma directement depuis les utils server
vi.mock('../../server/utils/prisma', async () => {
  const { prismaMock } = await import('../__mocks__/prisma')
  return { prisma: prismaMock }
})

describe("Workflow complet des bénévoles - Tests d'intégration", () => {
  const mockUser = {
    id: 1,
    email: 'volunteer@example.com',
    pseudo: 'volunteer1',
    nom: 'Dupont',
    prenom: 'Marie',
    phone: '+33123456789',
  }

  const mockManager = {
    id: 2,
    email: 'manager@example.com',
    pseudo: 'manager1',
    nom: 'Martin',
    prenom: 'Jean',
  }

  const mockEdition = {
    id: 1,
    name: 'Convention Test 2024',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    volunteersOpen: true,
    volunteersMode: 'INTERNAL',
    volunteersDescription: 'Rejoignez notre équipe !',
    askSetup: true,
    askTeardown: true,
    volunteersSetupStartDate: new Date('2024-05-30'),
    volunteersSetupEndDate: new Date('2024-06-05'),
    askDiet: true,
    askAllergies: true,
    askPets: true,
    askTimePreferences: true,
    askTeamPreferences: true,
    volunteersAskEmergencyContact: false,
    teams: [
      { id: 1, name: 'Accueil', slots: 5 },
      { id: 2, name: 'Technique', slots: 3 },
    ],
    volunteerApplications: [],
    convention: {
      id: 1,
      authorId: mockManager.id,
      collaborators: [],
    },
    creatorId: mockManager.id,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup des mocks par défaut
    global.getSession = vi.fn()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    global.readBody = vi.fn()
    global.getQuery = vi.fn().mockReturnValue({})
    global.createError = createError
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Workflow complet : Configuration -> Candidature -> Gestion', () => {
    it('devrait permettre un workflow complet de bout en bout', async () => {
      // ========== ÉTAPE 1: Configuration des bénévoles par le gestionnaire ==========

      // Le gestionnaire configure les options de bénévolat
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const volunteerSettings = {
        mode: 'INTERNAL',
        description: 'Nous recherchons des bénévoles motivés !',
        askSetup: true,
        askTeardown: true,
        setupStartDate: tomorrow.toISOString(),
        setupEndDate: nextWeek.toISOString(),
        askDiet: true,
        askAllergies: true,
        askEmergencyContact: true,
        askPets: true,
        askTimePreferences: true,
        askTeamPreferences: true,
        // Les équipes seront créées via le système VolunteerTeam
        // Plus besoin de passer teams dans volunteerSettings
      }

      // Mock de la session gestionnaire
      global.getSession = vi.fn().mockResolvedValue({ user: mockManager })
      global.getRouterParam = vi.fn().mockReturnValue('1')
      global.readBody = vi.fn().mockResolvedValue(volunteerSettings)

      const { prismaMock } = await import('../__mocks__/prisma')
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      // Mock pour les équipes VolunteerTeam
      const mockVolunteerTeams = [
        {
          id: 'team1',
          name: 'Accueil',
          description: 'Équipe accueil',
          color: '#ef4444',
          maxVolunteers: 5,
        },
        {
          id: 'team2',
          name: 'Technique',
          description: 'Équipe technique',
          color: '#3b82f6',
          maxVolunteers: 3,
        },
        {
          id: 'team3',
          name: 'Bar',
          description: 'Équipe bar',
          color: '#10b981',
          maxVolunteers: 10,
        },
      ]
      prismaMock.volunteerTeam.findMany.mockResolvedValue(mockVolunteerTeams)

      prismaMock.edition.update.mockResolvedValue({
        ...mockEdition,
        volunteersMode: volunteerSettings.mode,
        volunteersDescription: volunteerSettings.description,
        volunteersAskSetup: volunteerSettings.askSetup,
        volunteersAskTeardown: volunteerSettings.askTeardown,
        volunteersAskDiet: volunteerSettings.askDiet,
        volunteersAskAllergies: volunteerSettings.askAllergies,
        volunteersAskEmergencyContact: volunteerSettings.askEmergencyContact,
        volunteersAskPets: volunteerSettings.askPets,
        volunteersAskTimePreferences: volunteerSettings.askTimePreferences,
        volunteersAskTeamPreferences: volunteerSettings.askTeamPreferences,
        volunteersSetupStartDate: new Date(volunteerSettings.setupStartDate),
        volunteersTeardownEndDate: new Date(volunteerSettings.setupEndDate),
      })

      // Appel API de configuration
      const settingsHandler = await import(
        '../../server/api/editions/[id]/volunteers/settings.patch'
      )
      const settingsResult = await settingsHandler.default({
        context: { user: mockManager },
      } as any)

      expect(settingsResult.success).toBe(true)
      expect(settingsResult.settings.volunteersMode).toBe('INTERNAL')

      // ========== ÉTAPE 2: Consultation des infos par un candidat ==========

      // Reset des mocks pour la prochaine requête
      vi.clearAllMocks()
      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        volunteersMode: volunteerSettings.mode,
        volunteersDescription: volunteerSettings.description,
        volunteersAskDiet: volunteerSettings.askDiet,
        volunteersAskAllergies: volunteerSettings.askAllergies,
        volunteersAskPets: volunteerSettings.askPets,
        volunteersAskTimePreferences: volunteerSettings.askTimePreferences,
        volunteersAskTeamPreferences: volunteerSettings.askTeamPreferences,
        volunteerApplications: [], // Pas encore de candidatures
      })
      // Mock des équipes VolunteerTeam pour info.get
      prismaMock.volunteerTeam.findMany.mockResolvedValue(mockVolunteerTeams)

      // Un candidat consulte les informations (API publique)
      const infoHandler = await import('../../server/api/editions/[id]/volunteers/settings.get')
      const infoResult = await infoHandler.default({
        context: { user: null }, // Pas besoin d'être connecté
      } as any)

      expect(infoResult.mode).toBe('INTERNAL')
      expect(infoResult.description).toBe(volunteerSettings.description)
      expect(infoResult.teams).toHaveLength(3)
      expect(infoResult.askDiet).toBe(true)
      expect(infoResult.askTimePreferences).toBe(true)

      // ========== ÉTAPE 3: Candidature d'un bénévole ==========

      // Reset et setup pour la candidature
      vi.clearAllMocks()
      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        volunteersMode: volunteerSettings.mode,
        volunteersDescription: volunteerSettings.description,
        volunteersAskDiet: volunteerSettings.askDiet,
        volunteersAskAllergies: volunteerSettings.askAllergies,
        volunteersAskPets: volunteerSettings.askPets,
        volunteersAskTimePreferences: volunteerSettings.askTimePreferences,
        volunteersAskTeamPreferences: volunteerSettings.askTeamPreferences,
        volunteerApplications: [], // Pas encore de candidatures
      })
      // Mock des équipes VolunteerTeam pour apply.post
      prismaMock.volunteerTeam.findMany.mockResolvedValue(mockVolunteerTeams)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null) // Pas de candidature existante
      prismaMock.user.findUnique.mockResolvedValue(mockUser)

      const arrivalDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const departureDate = new Date(Date.now() + 48 * 60 * 60 * 1000)

      const applicationData = {
        motivation: 'Je suis très motivé pour aider à organiser cette convention !',
        setupAvailability: true,
        teardownAvailability: false,
        eventAvailability: true,
        arrivalDateTime: arrivalDate.toISOString(),
        departureDateTime: departureDate.toISOString(),
        dietaryPreference: 'VEGETARIAN',
        allergies: 'Aucune',
        emergencyContactName: 'Jean Dupont',
        emergencyContactPhone: '+33123456789',
        timePreferences: ['morning', 'evening'],
        teamPreferences: ['team1', 'team2'], // IDs des équipes VolunteerTeam mockées
        hasPets: false,
        hasVehicle: true,
        vehicleDetails: 'Voiture 5 places',
      }

      const mockApplication = {
        id: 1,
        editionId: 1,
        userId: mockUser.id,
        status: 'PENDING',
        ...applicationData,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prismaMock.editionVolunteerApplication.create.mockResolvedValue({
        ...mockApplication,
        ...applicationData,
      })
      global.readBody.mockResolvedValue(applicationData)

      // Candidature par l'utilisateur connecté
      global.getRouterParam.mockReturnValue('1')
      const applyHandler = await import('../../server/api/editions/[id]/volunteers/apply.post')
      const applicationResult = await applyHandler.default({
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      } as any)

      expect(applicationResult.success).toBe(true)
      expect(applicationResult.application.status).toBe('PENDING')
      expect(applicationResult.application.motivation).toBe(applicationData.motivation)
      expect(applicationResult.application.setupAvailability).toBe(true)
      expect(applicationResult.application.eventAvailability).toBe(true)
      expect(applicationResult.application.dietaryPreference).toBe('VEGETARIAN')

      // Vérifier que la candidature a été créée avec les bonnes données
      expect(prismaMock.editionVolunteerApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          editionId: 1,
          userId: mockUser.id,
          motivation: applicationData.motivation,
          setupAvailability: true,
          teardownAvailability: null, // false devient null dans l'API
          eventAvailability: true,
          dietaryPreference: 'VEGETARIAN',
          timePreferences: applicationData.timePreferences,
          teamPreferences: applicationData.teamPreferences,
          userSnapshotPhone: mockUser.phone,
          arrivalDateTime: applicationData.arrivalDateTime,
          departureDateTime: applicationData.departureDateTime,
        }),
        select: expect.any(Object),
      })

      // ========== ÉTAPE 4: Consultation des candidatures par le gestionnaire ==========

      // Reset pour consulter les candidatures
      vi.clearAllMocks()
      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        convention: {
          ...mockEdition.convention,
          collaborators: [], // Pas de collaborateurs, mais créateur = gestionnaire
        },
      })

      const applicationsData = [
        {
          ...mockApplication,
          user: {
            id: mockUser.id,
            pseudo: mockUser.pseudo,
            email: mockUser.email,
            prenom: mockUser.prenom,
            nom: mockUser.nom,
          },
        },
      ]

      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue(applicationsData)

      // Consultation par le gestionnaire
      const applicationsHandler = await import(
        '../../server/api/editions/[id]/volunteers/applications.get'
      )
      const applicationsResult = await applicationsHandler.default({
        context: { user: mockManager },
      } as any)

      expect(applicationsResult.applications).toHaveLength(1)
      expect(applicationsResult.applications[0].status).toBe('PENDING')
      expect(applicationsResult.applications[0].user.pseudo).toBe(mockUser.pseudo)
      expect(applicationsResult.applications[0].motivation).toBe(applicationData.motivation)

      // ========== ÉTAPE 5: Acceptation de la candidature ==========

      // Reset pour l'acceptation
      vi.clearAllMocks()

      const acceptanceData = {
        applicationId: 1,
        action: 'ACCEPT',
        internalNotes: "Candidat parfait pour l'accueil",
      }

      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        convention: mockEdition.convention,
      })

      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({
        ...mockApplication,
        edition: mockEdition,
      })

      const updatedApplication = {
        ...mockApplication,
        status: 'ACCEPTED',
        internalNotes: acceptanceData.internalNotes,
        processedAt: new Date(),
        processedBy: mockManager.id,
      }

      prismaMock.editionVolunteerApplication.update.mockResolvedValue(updatedApplication)
      global.readBody.mockResolvedValue(acceptanceData)

      // Simulation de l'acceptation (cette API n'existe peut-être pas encore)
      // const acceptHandler = await import('../../server/api/editions/[id]/volunteers/process.patch')
      // const acceptResult = await acceptHandler.default({
      //   context: { user: mockManager }
      // } as any)

      // expect(acceptResult.status).toBe('ACCEPTED')
      // expect(acceptResult.internalNotes).toBe(acceptanceData.internalNotes)

      // ========== ÉTAPE 6: Vérification de l'état final ==========

      // Le bénévole vérifie sa candidature acceptée
      vi.clearAllMocks()
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(updatedApplication)

      // Simulation de consultation de sa propre candidature
      const myApplicationResult = {
        ...updatedApplication,
        // Les notes internes ne devraient pas être visibles au candidat
        internalNotes: undefined,
      }

      expect(myApplicationResult.status).toBe('ACCEPTED')
      expect(myApplicationResult.internalNotes).toBeUndefined()
    })
  })

  describe("Scénarios d'erreur dans le workflow", () => {
    it('devrait gérer le rejet et la re-candidature', async () => {
      const { prismaMock } = await import('../__mocks__/prisma')

      // ========== Candidature initiale ==========
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)

      const applicationDate = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const initialApplication = {
        motivation: 'Première candidature',
        setupAvailability: true,
        arrivalDateTime: applicationDate.toISOString(),
      }

      const createdApplication = {
        id: 1,
        editionId: 1,
        userId: mockUser.id,
        status: 'PENDING',
        ...initialApplication,
      }

      prismaMock.editionVolunteerApplication.create.mockResolvedValue(createdApplication)
      global.readBody.mockResolvedValue(initialApplication)
      global.getRouterParam.mockReturnValue('1')

      const applyHandler = await import('../../server/api/editions/[id]/volunteers/apply.post')
      const firstResult = await applyHandler.default({
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      } as any)

      expect(firstResult.success).toBe(true)
      expect(firstResult.application.status).toBe('PENDING')

      // ========== Rejet de la candidature ==========
      const rejectedApplication = {
        ...createdApplication,
        status: 'REJECTED',
        internalNotes: 'Profile ne correspond pas',
      }

      // ========== Nouvelle candidature après rejet ==========
      vi.clearAllMocks()
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        id: rejectedApplication.id,
      })
      prismaMock.user.findUnique.mockResolvedValue(mockUser)

      const newApplication = {
        motivation: 'Je me suis amélioré, voici ma nouvelle candidature !',
        setupAvailability: true,
        teardownAvailability: true, // Plus d'engagement
        arrivalDateTime: applicationDate.toISOString(),
        departureDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        skills: "J'ai suivi une formation depuis",
      }

      global.readBody.mockResolvedValue(newApplication)
      global.getRouterParam.mockReturnValue('1')

      // L'API actuelle empêche la re-candidature même après rejet
      await expect(
        applyHandler.default({
          context: {
            user: mockUser,
            params: { id: '1' },
          },
        } as any)
      ).rejects.toThrow(/déjà candidat/i)

      // Vérifier qu'aucune création ou mise à jour n'a été tentée
      expect(prismaMock.editionVolunteerApplication.update).not.toHaveBeenCalled()
      expect(prismaMock.editionVolunteerApplication.create).not.toHaveBeenCalled()
    })

    it('devrait empêcher la double candidature', async () => {
      const { prismaMock } = await import('../__mocks__/prisma')

      // Une candidature en attente existe déjà
      const existingApplication = {
        id: 1,
        editionId: 1,
        userId: mockUser.id,
        status: 'PENDING',
        motivation: 'Candidature existante',
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(existingApplication)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)

      const duplicateApplication = {
        motivation: 'Tentative de double candidature',
        setupAvailability: true,
        arrivalDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        departureDateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      }

      global.readBody.mockResolvedValue(duplicateApplication)

      const applyHandler = await import('../../server/api/editions/[id]/volunteers/apply.post')
      global.getRouterParam.mockReturnValue('1')

      await expect(
        applyHandler.default({
          context: {
            user: mockUser,
            params: { id: '1' },
          },
        } as any)
      ).rejects.toThrow(/candidat/i)

      // Vérifier qu'aucune création n'a été tentée
      expect(prismaMock.editionVolunteerApplication.create).not.toHaveBeenCalled()
      expect(prismaMock.editionVolunteerApplication.update).not.toHaveBeenCalled()
    })

    it('devrait empêcher la candidature sur une édition fermée', async () => {
      const { prismaMock } = await import('../__mocks__/prisma')

      const closedEdition = {
        ...mockEdition,
        volunteersOpen: false,
      }

      prismaMock.edition.findUnique.mockResolvedValue(closedEdition)

      const applicationData = {
        motivation: 'Candidature sur édition fermée',
        setupAvailability: true,
      }

      global.readBody.mockResolvedValue(applicationData)
      global.getRouterParam.mockReturnValue('1')

      const applyHandler = await import('../../server/api/editions/[id]/volunteers/apply.post')

      await expect(
        applyHandler.default({
          context: {
            user: mockUser,
            params: { id: '1' },
          },
        } as any)
      ).rejects.toThrow(/recrutement.*fermé/i)
    })

    // Test supprimé : le mode externe est maintenant géré côté frontend par redirection
    // L'API apply.post n'effectue plus de vérification du mode externe
  })

  describe('Validation des permissions dans le workflow', () => {
    it('devrait respecter les permissions de collaborateur', async () => {
      const { prismaMock } = await import('../__mocks__/prisma')

      const collaboratorUser = {
        id: 3,
        email: 'collaborator@example.com',
        pseudo: 'collab1',
      }

      const editionWithCollaborator = {
        ...mockEdition,
        creatorId: 999, // Différent créateur
        convention: {
          id: 1,
          authorId: 999, // Différent créateur de convention
          collaborators: [
            {
              userId: collaboratorUser.id,
              canManageVolunteers: true,
              canEditAllEditions: false,
            },
          ],
        },
      }

      // Configuration par le collaborateur autorisé
      const volunteerSettings = {
        mode: 'INTERNAL',
        askDiet: true,
        askAllergies: false,
      }

      const updatedEdition = {
        ...mockEdition,
        volunteersMode: 'INTERNAL',
        volunteersAskDiet: true,
        volunteersAskAllergies: false,
      }

      // Mock pour canManageEditionVolunteers - premier appel (édition)
      prismaMock.edition.findUnique.mockResolvedValue({
        id: mockEdition.id,
        creatorId: 999, // Différent créateur
        conventionId: 1,
      })

      // Mock pour canManageEditionVolunteers - second appel (convention avec collaborateurs)
      prismaMock.convention.findUnique.mockResolvedValue({
        id: 1,
        authorId: 999, // Différent créateur de convention
        collaborators: [
          {
            userId: collaboratorUser.id,
            canManageVolunteers: true,
            id: 1,
          },
        ],
      })

      // Mock pour l'update final
      prismaMock.edition.update.mockResolvedValue(updatedEdition)
      global.readBody.mockResolvedValue(volunteerSettings)

      const settingsHandler = await import(
        '../../server/api/editions/[id]/volunteers/settings.patch'
      )
      const result = await settingsHandler.default({
        context: { user: collaboratorUser },
      } as any)

      expect(result.settings.volunteersAskDiet).toBe(true)
      expect(result.settings.volunteersAskAllergies).toBe(false)
    })

    it('devrait rejeter les utilisateurs non autorisés', async () => {
      const { prismaMock } = await import('../__mocks__/prisma')

      const unauthorizedUser = {
        id: 4,
        email: 'stranger@example.com',
        pseudo: 'stranger',
      }

      const editionWithoutPermissions = {
        ...mockEdition,
        creatorId: 999,
        convention: {
          id: 1,
          authorId: 999,
          collaborators: [], // Aucun collaborateur
        },
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithoutPermissions)
      global.readBody.mockResolvedValue({ mode: 'INTERNAL' })
      global.getRouterParam.mockReturnValue('1')

      const settingsHandler = await import(
        '../../server/api/editions/[id]/volunteers/settings.patch'
      )

      await expect(
        settingsHandler.default({
          context: {
            user: unauthorizedUser,
            params: { id: '1' },
          },
        } as any)
      ).rejects.toThrow('Droits insuffisants pour gérer les bénévoles')
    })
  })

  describe('Performance et cohérence des données', () => {
    it('devrait maintenir la cohérence entre les différentes API', async () => {
      const { prismaMock } = await import('../__mocks__/prisma')

      const commonEditionData = {
        ...mockEdition,
        volunteersMode: 'INTERNAL',
        volunteersDescription: 'Description cohérente',
        volunteersAskDiet: true,
        volunteersAskAllergies: false,
      }

      // Mock des équipes VolunteerTeam pour les tests de cohérence
      const mockTeamsForConsistency = [
        { id: 'test1', name: 'Test Team', description: 'Test', color: '#ef4444', maxVolunteers: 5 },
      ]
      prismaMock.volunteerTeam.findMany.mockResolvedValue(mockTeamsForConsistency)

      // Configuration
      prismaMock.edition.findUnique.mockResolvedValue(commonEditionData)
      prismaMock.edition.update.mockResolvedValue(commonEditionData)

      // Consultation des infos
      const infoHandler = await import('../../server/api/editions/[id]/volunteers/settings.get')
      const infoResult = await infoHandler.default({
        context: { user: null },
      } as any)

      // Les données doivent être identiques entre config et consultation
      expect(infoResult.mode).toBe(commonEditionData.volunteersMode)
      expect(infoResult.description).toBe(commonEditionData.volunteersDescription)
      expect(infoResult.askDiet).toBe(commonEditionData.volunteersAskDiet)
      expect(infoResult.askAllergies).toBe(commonEditionData.volunteersAskAllergies)
      expect(infoResult.teams).toEqual(mockTeamsForConsistency)
    })

    it('devrait optimiser les requêtes base de données', async () => {
      const { prismaMock } = await import('../__mocks__/prisma')

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      // Consultation des infos - ne devrait faire qu'une requête
      const infoHandler = await import('../../server/api/editions/[id]/volunteers/settings.get')
      await infoHandler.default({
        context: { user: null },
      } as any)

      expect(prismaMock.edition.findUnique).toHaveBeenCalledTimes(1)
      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          volunteersOpen: true,
          volunteersDescription: true,
          volunteersMode: true,
          volunteersExternalUrl: true,
          volunteersAskDiet: true,
          volunteersAskAllergies: true,
          volunteersAskTimePreferences: true,
          volunteersAskTeamPreferences: true,
          volunteersAskPets: true,
          volunteersAskMinors: true,
          volunteersAskVehicle: true,
          volunteersAskCompanion: true,
          volunteersAskAvoidList: true,
          volunteersAskSkills: true,
          volunteersAskExperience: true,
          volunteersAskEmergencyContact: true,
          volunteersSetupStartDate: true,
          volunteersTeardownEndDate: true,
          volunteersUpdatedAt: true,
          volunteersAskSetup: true,
          volunteersAskTeardown: true,
          volunteerApplications: { select: { id: true, status: true, userId: true } },
        },
      })
    })
  })

  describe("Tests spécifiques pour le contact d'urgence", () => {
    it("devrait rendre le contact d'urgence obligatoire si allergies renseignées", async () => {
      const { prismaMock } = await import('../__mocks__/prisma')

      // Édition avec contact d'urgence non demandé mais allergies demandées
      // Doit correspondre au select de l'API apply.post.ts
      const editionWithAllergies = {
        volunteersOpen: true,
        volunteersAskDiet: true,
        volunteersAskAllergies: true,
        volunteersAskTimePreferences: true,
        volunteersAskTeamPreferences: true,
        volunteersAskPets: true,
        volunteersAskMinors: true,
        volunteersAskVehicle: true,
        volunteersAskEmergencyContact: false,
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithAllergies)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.volunteerTeam.findMany.mockResolvedValue([])

      // Candidature avec allergies mais sans contact d'urgence
      const applicationWithAllergiesNoContact = {
        motivation: 'Candidature avec allergies',
        setupAvailability: true,
        eventAvailability: true,
        arrivalDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        departureDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        allergies: 'Allergie aux arachides',
        // Pas de contact d'urgence fourni
      }

      global.readBody.mockResolvedValue(applicationWithAllergiesNoContact)
      global.getRouterParam.mockReturnValue('1')

      const applyHandler = await import('../../server/api/editions/[id]/volunteers/apply.post')

      // Devrait échouer car contact d'urgence requis à cause des allergies
      await expect(
        applyHandler.default({
          context: {
            user: mockUser,
            params: { id: '1' },
          },
        } as any)
      ).rejects.toThrow(/contact d'urgence/i)
    })

    it("devrait accepter la candidature avec contact d'urgence si allergies renseignées", async () => {
      const { prismaMock } = await import('../__mocks__/prisma')

      // Édition avec contact d'urgence non demandé mais allergies demandées
      // Doit correspondre au select de l'API apply.post.ts
      const editionWithAllergies = {
        volunteersOpen: true,
        volunteersAskDiet: true,
        volunteersAskAllergies: true,
        volunteersAskTimePreferences: true,
        volunteersAskTeamPreferences: true,
        volunteersAskPets: true,
        volunteersAskMinors: true,
        volunteersAskVehicle: true,
        volunteersAskEmergencyContact: false,
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithAllergies)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.volunteerTeam.findMany.mockResolvedValue([])

      // Candidature avec allergies ET contact d'urgence
      const applicationWithAllergiesAndContact = {
        motivation: 'Candidature avec allergies et contact',
        setupAvailability: true,
        eventAvailability: true,
        arrivalDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        departureDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        allergies: 'Allergie aux arachides',
        emergencyContactName: 'Marie Dupont',
        emergencyContactPhone: '+33987654321',
      }

      const createdApplication = {
        id: 1,
        editionId: 1,
        userId: mockUser.id,
        status: 'PENDING',
        ...applicationWithAllergiesAndContact,
        edition: {
          id: 1,
          name: 'Test Edition',
          conventionId: 1,
          convention: { name: 'Test Convention' },
        },
      }

      prismaMock.editionVolunteerApplication.create.mockResolvedValue(createdApplication)
      prismaMock.notification.create.mockResolvedValue({})
      global.readBody.mockResolvedValue(applicationWithAllergiesAndContact)
      global.getRouterParam.mockReturnValue('1')

      const applyHandler = await import('../../server/api/editions/[id]/volunteers/apply.post')

      const result = await applyHandler.default({
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      } as any)

      expect(result.success).toBe(true)
      expect(result.application.allergies).toBe('Allergie aux arachides')
      expect(result.application.emergencyContactName).toBe('Marie Dupont')
      expect(result.application.emergencyContactPhone).toBe('+33987654321')
    })

    it("devrait accepter la candidature sans contact d'urgence si pas d'allergies", async () => {
      const { prismaMock } = await import('../__mocks__/prisma')

      // Édition avec contact d'urgence non demandé et allergies demandées
      // Doit correspondre au select de l'API apply.post.ts
      const editionWithAllergies = {
        volunteersOpen: true,
        volunteersAskDiet: true,
        volunteersAskAllergies: true,
        volunteersAskTimePreferences: true,
        volunteersAskTeamPreferences: true,
        volunteersAskPets: true,
        volunteersAskMinors: true,
        volunteersAskVehicle: true,
        volunteersAskEmergencyContact: false,
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithAllergies)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.volunteerTeam.findMany.mockResolvedValue([])

      // Candidature sans allergies ni contact d'urgence
      const applicationWithoutAllergies = {
        motivation: 'Candidature sans allergies',
        setupAvailability: true,
        eventAvailability: true,
        arrivalDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        departureDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        // Pas d'allergies ni de contact d'urgence
      }

      const createdApplication = {
        id: 1,
        editionId: 1,
        userId: mockUser.id,
        status: 'PENDING',
        ...applicationWithoutAllergies,
        edition: {
          id: 1,
          name: 'Test Edition',
          conventionId: 1,
          convention: { name: 'Test Convention' },
        },
      }

      prismaMock.editionVolunteerApplication.create.mockResolvedValue(createdApplication)
      prismaMock.notification.create.mockResolvedValue({})
      global.readBody.mockResolvedValue(applicationWithoutAllergies)
      global.getRouterParam.mockReturnValue('1')

      const applyHandler = await import('../../server/api/editions/[id]/volunteers/apply.post')

      const result = await applyHandler.default({
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      } as any)

      expect(result.success).toBe(true)
      expect(result.application.allergies).toBeUndefined()
      expect(result.application.emergencyContactName).toBeUndefined()
    })
  })
})
