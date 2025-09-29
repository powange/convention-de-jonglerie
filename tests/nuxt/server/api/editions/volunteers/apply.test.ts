import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/volunteers/apply.post'
import { prismaMock } from '../../../../../__mocks__/prisma'

describe('/api/editions/[id]/volunteers/apply POST', () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const dayAfterTomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    phone: '+33123456789',
  }

  const mockEdition = {
    volunteersOpen: true,
    volunteersAskDiet: true,
    volunteersAskAllergies: true,
    volunteersAskEmergencyContact: false,
    volunteersAskTimePreferences: true,
    volunteersAskTeamPreferences: true,
    volunteersAskPets: true,
    volunteersAskMinors: true,
    volunteersAskVehicle: true,
    volunteersAskCompanion: true,
    volunteersAskAvoidList: true,
    volunteersAskSkills: true,
    volunteersAskExperience: true,
  }

  const mockApplication = {
    id: 1,
    editionId: 1,
    userId: 1,
    status: 'PENDING',
    motivation: 'Je veux aider',
    phone: '+33123456789',
    prenom: 'User',
    nom: 'Test',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Mock des équipes VolunteerTeam pour les tests de validation
  const mockVolunteerTeams = [
    { id: 'team1', name: 'Accueil' },
    { id: 'team2', name: 'Technique' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    // Mock par défaut des équipes VolunteerTeam
    prismaMock.volunteerTeam.findMany.mockResolvedValue(mockVolunteerTeams)
  })

  describe('Candidature basique', () => {
    it('devrait créer une candidature simple avec succès', async () => {
      const applicationData = {
        motivation: 'Je souhaite aider pour cette magnifique convention',
        setupAvailability: true,
        teardownAvailability: false,
        eventAvailability: true,
        arrivalDateTime: '2024-05-30_morning',
        departureDateTime: '2024-06-05_evening',
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null) // Pas de candidature existante
      prismaMock.user.findUnique.mockResolvedValue(mockUser) // Mock de l'utilisateur
      prismaMock.editionVolunteerApplication.create.mockResolvedValue({
        ...mockApplication,
        setupAvailability: true,
        teardownAvailability: false,
        eventAvailability: true,
        arrivalDateTime: applicationData.arrivalDateTime,
        departureDateTime: applicationData.departureDateTime,
      })

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.application).toBeDefined()
      expect(result.application.setupAvailability).toBe(true)
      expect(result.application.teardownAvailability).toBe(false)
      expect(result.application.eventAvailability).toBe(true)

      expect(prismaMock.editionVolunteerApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          editionId: 1,
          userId: mockUser.id,
          motivation: applicationData.motivation,
          userSnapshotPhone: mockUser.phone,
          setupAvailability: true,
          teardownAvailability: null,
          eventAvailability: true,
          arrivalDateTime: applicationData.arrivalDateTime,
          departureDateTime: applicationData.departureDateTime,
          dietaryPreference: 'NONE',
        }),
        select: expect.objectContaining({
          id: true,
          status: true,
          setupAvailability: true,
        }),
      })
    })

    it('devrait compléter les informations personnelles manquantes', async () => {
      const userWithoutInfo = {
        ...mockUser,
        nom: null,
        prenom: null,
        phone: null,
      }

      const applicationData = {
        motivation: 'Je veux aider',
        nom: 'Nouveau Nom',
        prenom: 'Nouveau Prenom',
        phone: '+33987654321',
        setupAvailability: true,
        arrivalDateTime: '2024-06-01_morning',
        departureDateTime: dayAfterTomorrow.toISOString(),
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(userWithoutInfo)
      prismaMock.editionVolunteerApplication.create.mockResolvedValue(mockApplication)

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: userWithoutInfo } }

      await handler(mockEvent as any)

      expect(prismaMock.editionVolunteerApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userSnapshotPhone: '+33987654321',
          motivation: applicationData.motivation,
        }),
        select: expect.any(Object),
      })
    })

    it('devrait utiliser les informations existantes du profil si disponibles', async () => {
      const applicationData = {
        motivation: 'Je veux aider',
        setupAvailability: true,
        arrivalDateTime: '2024-06-01_morning',
        departureDateTime: dayAfterTomorrow.toISOString(),
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.editionVolunteerApplication.create.mockResolvedValue(mockApplication)

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.editionVolunteerApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userSnapshotPhone: mockUser.phone,
          motivation: applicationData.motivation,
        }),
        select: expect.any(Object),
      })
    })
  })

  describe('Options avancées de candidature', () => {
    it('devrait sauvegarder toutes les options avancées', async () => {
      const completeApplication = {
        motivation: 'Candidature complète',
        setupAvailability: true,
        teardownAvailability: true,
        eventAvailability: false,
        arrivalDateTime: '2024-05-30_morning',
        departureDateTime: '2024-06-05_evening',
        dietaryPreference: 'VEGETARIAN',
        allergies: 'Arachides, gluten',
        allergySeverity: 'SEVERE',
        emergencyContactName: 'Marie Urgence',
        emergencyContactPhone: '+33987654321',
        timePreferences: ['morning', 'evening'],
        teamPreferences: ['team1', 'team2'], // IDs des équipes VolunteerTeam
        hasPets: true,
        petsDetails: 'Chien de 5kg, très gentil',
        hasMinors: true,
        minorsDetails: 'Enfant de 8 ans, autonome',
        hasVehicle: true,
        vehicleDetails: 'Camionnette 9 places',
        companionName: 'Marie Dupont, Jean Martin',
        avoidList: 'Pierre Durant (conflit personnel)',
        skills: 'PSC1, électricien, éclairagiste',
        hasExperience: true,
        experienceDetails: 'Bénévole depuis 5 ans dans diverses associations',
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.editionVolunteerApplication.create.mockResolvedValue({
        ...mockApplication,
        ...completeApplication,
      })

      global.readBody.mockResolvedValue(completeApplication)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(prismaMock.editionVolunteerApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          motivation: completeApplication.motivation,
          setupAvailability: true,
          teardownAvailability: true,
          eventAvailability: null,
          arrivalDateTime: completeApplication.arrivalDateTime,
          departureDateTime: completeApplication.departureDateTime,
          dietaryPreference: 'VEGETARIAN',
          allergies: completeApplication.allergies,
          allergySeverity: completeApplication.allergySeverity,
          emergencyContactName: completeApplication.emergencyContactName,
          emergencyContactPhone: completeApplication.emergencyContactPhone,
          timePreferences: completeApplication.timePreferences,
          teamPreferences: completeApplication.teamPreferences,
          hasPets: true,
          petsDetails: completeApplication.petsDetails,
          hasMinors: true,
          minorsDetails: completeApplication.minorsDetails,
          hasVehicle: true,
          vehicleDetails: completeApplication.vehicleDetails,
          companionName: completeApplication.companionName,
          avoidList: completeApplication.avoidList,
          skills: completeApplication.skills,
          hasExperience: true,
          experienceDetails: completeApplication.experienceDetails,
        }),
        select: expect.any(Object),
      })
    })

    it("devrait ignorer les options non demandées par l'édition", async () => {
      const editionWithLimitedOptions = {
        volunteersOpen: true,
        volunteersAskDiet: false,
        volunteersAskAllergies: false,
        volunteersAskEmergencyContact: false,
        volunteersAskPets: false,
        volunteersAskMinors: false,
        volunteersAskVehicle: false,
        volunteersAskTimePreferences: false,
        volunteersAskTeamPreferences: false,
        volunteersAskCompanion: false,
        volunteersAskAvoidList: false,
        volunteersAskSkills: false,
        volunteersAskExperience: false,
      }

      const applicationWithUnwantedOptions = {
        motivation: 'Simple candidature',
        setupAvailability: true,
        arrivalDateTime: '2024-06-01_morning',
        departureDateTime: dayAfterTomorrow.toISOString(),
        // Ces options ne devraient pas être sauvegardées
        dietaryPreference: 'VEGAN',
        allergies: 'Aucune',
        emergencyContactName: 'Contact Non Demandé',
        emergencyContactPhone: '+33111111111',
        timePreferences: ['morning'],
        teamPreferences: ['team1'], // ID équipe VolunteerTeam
        skills: 'Beaucoup de compétences',
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithLimitedOptions)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.editionVolunteerApplication.create.mockResolvedValue(mockApplication)

      global.readBody.mockResolvedValue(applicationWithUnwantedOptions)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      const createCall = prismaMock.editionVolunteerApplication.create.mock.calls[0][0]
      expect(createCall.data.dietaryPreference).toBe('NONE') // Valeur par défaut
      expect(createCall.data.allergies).toBeNull()
      expect(createCall.data.emergencyContactName).toBeNull()
      expect(createCall.data.emergencyContactPhone).toBeNull()
      expect(createCall.data.timePreferences).toBeNull()
      expect(createCall.data.teamPreferences).toBeNull()
      expect(createCall.data.skills).toBeNull()
      expect(createCall.data.motivation).toBe('Simple candidature')
    })
  })

  describe('Validation des données', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
    })

    it('devrait valider les champs requis', async () => {
      const requiredFieldsCases = [
        {
          field: 'motivation',
          value: 'a'.repeat(2001),
          expectedError: /String must contain at most 2000 character/,
        },
        { field: 'phone', value: 'abc', expectedError: /Téléphone trop court/ },
        {
          field: 'phone',
          value: 'invalid-phone-format',
          expectedError: /Format de téléphone invalide/,
        },
      ]

      for (const testCase of requiredFieldsCases) {
        const testData = {
          motivation: 'Je veux aider',
          setupAvailability: true,
          arrivalDateTime: tomorrow.toISOString(),
          departureDateTime: dayAfterTomorrow.toISOString(),
          [testCase.field]: testCase.value,
        }

        prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
        prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
        prismaMock.user.findUnique.mockResolvedValue(mockUser)

        global.readBody.mockResolvedValue(testData)
        const mockEvent = { context: { user: mockUser } } // Utiliser toujours mockUser ici car c'est l'ID qui compte

        await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
      }
    })

    it('devrait valider les préférences alimentaires', async () => {
      const invalidDietCases = ['INVALID', 'omnivore', 'flexitarian', '']

      for (const invalidDiet of invalidDietCases) {
        const applicationData = {
          setupAvailability: true,
          dietaryPreference: invalidDiet,
        }

        global.readBody.mockResolvedValue(applicationData)
        const mockEvent = { context: { user: mockUser } }

        await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
      }
    })

    it('devrait valider les préférences horaires', async () => {
      const invalidTimePreferences = [
        {
          value: ['invalid_time'],
          description: 'créneau invalide',
        },
        {
          value: ['morning', 'invalid'],
          description: 'créneau partiellement invalide',
        },
        {
          value: 'not_an_array',
          description: 'pas un tableau',
        },
        {
          value: ['morning', 'morning'],
          description: 'doublons',
        },
        {
          value: [
            'morning',
            'early_morning',
            'evening',
            'night',
            'early_afternoon',
            'late_afternoon',
            'late_evening',
            'extra_slot',
            'another_extra',
          ],
          description: 'plus de 8 créneaux',
        },
      ]

      for (const testCase of invalidTimePreferences) {
        const applicationData = {
          setupAvailability: true,
          arrivalDateTime: tomorrow.toISOString(),
          timePreferences: testCase.value,
        }

        global.readBody.mockResolvedValue(applicationData)
        const mockEvent = { context: { user: mockUser } }

        // Doit échouer pour : ${testCase.description}
        await expect(handler(mockEvent as any)).rejects.toThrow()
      }
    })

    it('devrait accepter les préférences horaires valides', async () => {
      const validTimePreferences = [
        ['morning'],
        ['morning', 'evening'],
        ['early_morning', 'morning', 'early_afternoon', 'late_afternoon', 'evening'],
        [], // Tableau vide
      ]

      for (const validTimes of validTimePreferences) {
        const applicationData = {
          setupAvailability: true,
          arrivalDateTime: tomorrow.toISOString(),
          timePreferences: validTimes,
        }

        prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
        prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
        prismaMock.user.findUnique.mockResolvedValue(mockUser)
        prismaMock.editionVolunteerApplication.create.mockResolvedValue({
          ...mockApplication,
          timePreferences: validTimes,
        })

        global.readBody.mockResolvedValue(applicationData)
        const mockEvent = { context: { user: mockUser } }

        // Les préférences horaires valides doivent être acceptées
        const result = await handler(mockEvent as any)
        expect(result.application.timePreferences).toEqual(validTimes)
      }
    })

    it("devrait valider les préférences d'équipe", async () => {
      // Cas 1: Format invalide (string au lieu d'array) - erreur Zod
      const zodErrorData = {
        setupAvailability: true,
        arrivalDateTime: tomorrow.toISOString(),
        teamPreferences: 'not_an_array',
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)

      global.readBody.mockResolvedValue(zodErrorData)
      const mockEvent1 = { context: { user: mockUser } }

      await expect(handler(mockEvent1 as any)).rejects.toThrow()

      // Cas 2: Équipes inexistantes - erreur métier
      const invalidTeamIds = [['team_inexistant'], ['team1', 'team_bidon']]

      for (const invalidTeams of invalidTeamIds) {
        const applicationData = {
          setupAvailability: true,
          arrivalDateTime: tomorrow.toISOString(),
          teamPreferences: invalidTeams,
        }

        prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
        prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
        prismaMock.user.findUnique.mockResolvedValue(mockUser)

        global.readBody.mockResolvedValue(applicationData)
        const mockEvent = { context: { user: mockUser } }

        await expect(handler(mockEvent as any)).rejects.toThrow(/équipes.*invalides/i)
      }
    })

    it("devrait accepter les préférences d'équipe valides", async () => {
      const validTeamPreferences = [
        [], // Tableau vide
        ['team1'], // Une équipe valide
        ['team1', 'team2'], // Plusieurs équipes valides
      ]

      for (const validTeams of validTeamPreferences) {
        const applicationData = {
          setupAvailability: true,
          arrivalDateTime: tomorrow.toISOString(),
          teamPreferences: validTeams,
        }

        prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
        prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
        prismaMock.user.findUnique.mockResolvedValue(mockUser)
        prismaMock.editionVolunteerApplication.create.mockResolvedValue({
          ...mockApplication,
          teamPreferences: validTeams,
        })

        global.readBody.mockResolvedValue(applicationData)
        const mockEvent = { context: { user: mockUser } }

        const result = await handler(mockEvent as any)
        expect(result.application.teamPreferences).toEqual(validTeams)
      }
    })

    it('devrait valider les longueurs de texte', async () => {
      const textFieldsCases = [
        { field: 'allergies', maxLength: 500 }, // Corrigé selon le schéma
        { field: 'petsDetails', maxLength: 200 },
        { field: 'minorsDetails', maxLength: 200 },
        { field: 'vehicleDetails', maxLength: 200 },
        { field: 'companionName', maxLength: 300 },
        { field: 'avoidList', maxLength: 500 },
        { field: 'skills', maxLength: 1000 },
        { field: 'experienceDetails', maxLength: 500 },
      ]

      for (const testCase of textFieldsCases) {
        const applicationData = {
          setupAvailability: true,
          arrivalDateTime: tomorrow.toISOString(),
          [testCase.field]: 'a'.repeat(testCase.maxLength + 1),
        }

        global.readBody.mockResolvedValue(applicationData)
        const mockEvent = { context: { user: mockUser } }

        await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
      }
    })

    it("devrait valider les dates d'arrivée et de départ", async () => {
      // Test: Date d'arrivée manquante
      const missingArrival = {
        setupAvailability: true,
        departureDateTime: dayAfterTomorrow.toISOString(),
        // arrivalDateTime manquant
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)

      global.readBody.mockResolvedValue(missingArrival)
      let mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow("Date d'arrivée requise")

      // Test: Date de départ manquante
      const missingDeparture = {
        eventAvailability: true,
        arrivalDateTime: '2024-06-01_morning',
        // departureDateTime manquant
      }

      global.readBody.mockResolvedValue(missingDeparture)
      mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Date de départ requise')
    })

    it('devrait exiger au moins une disponibilité', async () => {
      const applicationData = {
        motivation: 'Je veux aider',
        setupAvailability: false,
        teardownAvailability: false,
        eventAvailability: false,
      }

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(
        'Au moins une disponibilité est requise'
      )
    })
  })

  describe('Gestion des candidatures existantes', () => {
    it('devrait rejeter une nouvelle candidature si une existe déjà', async () => {
      const existingApplication = {
        ...mockApplication,
        status: 'PENDING',
      }

      const applicationData = {
        motivation: 'Nouvelle candidature',
        setupAvailability: true,
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(existingApplication)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Déjà candidat')
    })

    it('devrait empêcher de recandidater après un rejet (comportement actuel)', async () => {
      // Note: Le comportement actuel empêche toute recandidature.
      // Ce test documente ce comportement, même si on pourrait vouloir le changer à l'avenir.
      const rejectedApplication = {
        ...mockApplication,
        status: 'REJECTED',
      }

      const newApplication = {
        motivation: 'Nouvelle candidature après rejet',
        setupAvailability: true,
        arrivalDateTime: '2024-06-01_morning',
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(rejectedApplication)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)

      global.readBody.mockResolvedValue(newApplication)
      const mockEvent = { context: { user: mockUser } }

      // L'API actuelle rejette toute candidature existante, même rejetée
      await expect(handler(mockEvent as any)).rejects.toThrow('Déjà candidat')
    })

    it('devrait empêcher de recandidater après acceptation', async () => {
      const acceptedApplication = {
        ...mockApplication,
        status: 'ACCEPTED',
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(acceptedApplication)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)

      global.readBody.mockResolvedValue({
        motivation: 'Tentative de candidature multiple',
        setupAvailability: true,
      })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Déjà candidat')
    })
  })

  describe('Modes de candidature', () => {
    it('devrait rejeter si les candidatures sont fermées', async () => {
      const closedEdition = {
        ...mockEdition,
        volunteersOpen: false, // Fermé
      }

      prismaMock.edition.findUnique.mockResolvedValue(closedEdition)

      global.readBody.mockResolvedValue({
        motivation: 'Candidature sur édition fermée',
        setupAvailability: true,
      })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Recrutement fermé')
    })
  })

  describe('Validation des disponibilités', () => {
    it('devrait respecter la sélection manuelle si montage ou démontage coché', async () => {
      const applicationData = {
        motivation: 'Je veux aider pour montage et événement',
        setupAvailability: true,
        teardownAvailability: false,
        eventAvailability: false, // Choix explicite
        arrivalDateTime: '2024-06-01_morning',
        departureDateTime: dayAfterTomorrow.toISOString(),
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.editionVolunteerApplication.create.mockResolvedValue(mockApplication)

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.editionVolunteerApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          setupAvailability: true,
          teardownAvailability: null,
          eventAvailability: null, // Plus de logique d'auto-sélection
        }),
        select: expect.any(Object),
      })
    })
  })

  describe('Permissions et authentification', () => {
    it('devrait rejeter les utilisateurs non connectés', async () => {
      global.readBody.mockResolvedValue({
        motivation: 'Candidature anonyme',
        setupAvailability: true,
      })
      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Non authentifié')
    })

    it('devrait fonctionner avec des utilisateurs authentifiés', async () => {
      const applicationData = {
        motivation: 'Candidature utilisateur connecté',
        setupAvailability: true,
        arrivalDateTime: '2024-06-01_morning',
        departureDateTime: dayAfterTomorrow.toISOString(),
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.editionVolunteerApplication.create.mockResolvedValue(mockApplication)

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result).toBeDefined()
      expect(result.application.userId).toBe(mockUser.id)
    })
  })

  describe('Gestion des erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)

      global.readBody.mockResolvedValue({
        motivation: 'Candidature sur édition inexistante',
        setupAvailability: true,
      })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Edition introuvable')
    })

    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.editionVolunteerApplication.create.mockRejectedValue(
        new Error('Database connection failed')
      )

      global.readBody.mockResolvedValue({
        motivation: 'Candidature avec erreur DB',
        setupAvailability: true,
        arrivalDateTime: '2024-06-01_morning',
        departureDateTime: dayAfterTomorrow.toISOString(),
      })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
    })
  })

  describe("Validation du contact d'urgence", () => {
    beforeEach(() => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
    })

    it("devrait accepter une candidature avec contact d'urgence quand demandé", async () => {
      const editionWithEmergencyContact = {
        ...mockEdition,
        volunteersAskEmergencyContact: true,
      }

      const applicationData = {
        motivation: "Candidature avec contact d'urgence",
        setupAvailability: true,
        eventAvailability: true,
        arrivalDateTime: tomorrow.toISOString(),
        departureDateTime: dayAfterTomorrow.toISOString(),
        emergencyContactName: 'Marie Dupont',
        emergencyContactPhone: '+33987654321',
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithEmergencyContact)
      prismaMock.editionVolunteerApplication.create.mockResolvedValue({
        ...mockApplication,
        ...applicationData,
      })

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.editionVolunteerApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          emergencyContactName: 'Marie Dupont',
          emergencyContactPhone: '+33987654321',
        }),
        select: expect.any(Object),
      })
    })

    it("devrait exiger le contact d'urgence si allergies renseignées", async () => {
      const editionWithAllergiesOnly = {
        ...mockEdition,
        volunteersAskEmergencyContact: false,
        volunteersAskAllergies: true,
      }

      // Candidature avec allergies mais sans contact d'urgence
      const applicationWithAllergiesNoContact = {
        motivation: 'Candidature avec allergies',
        setupAvailability: true,
        eventAvailability: true,
        arrivalDateTime: tomorrow.toISOString(),
        departureDateTime: dayAfterTomorrow.toISOString(),
        allergies: 'Allergie aux arachides',
        allergySeverity: 'SEVERE',
        // Pas de contact d'urgence
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithAllergiesOnly)
      global.readBody.mockResolvedValue(applicationWithAllergiesNoContact)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/contact.*urgence/i)
    })

    it("devrait accepter une candidature avec allergies ET contact d'urgence", async () => {
      const editionWithAllergiesOnly = {
        ...mockEdition,
        volunteersAskEmergencyContact: false,
        volunteersAskAllergies: true,
      }

      const applicationWithAllergiesAndContact = {
        motivation: 'Candidature avec allergies et contact',
        setupAvailability: true,
        eventAvailability: true,
        arrivalDateTime: tomorrow.toISOString(),
        departureDateTime: dayAfterTomorrow.toISOString(),
        allergies: 'Allergie aux arachides',
        allergySeverity: 'SEVERE',
        emergencyContactName: 'Contact Urgence',
        emergencyContactPhone: '+33123456789',
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithAllergiesOnly)
      prismaMock.editionVolunteerApplication.create.mockResolvedValue({
        ...mockApplication,
        ...applicationWithAllergiesAndContact,
      })

      global.readBody.mockResolvedValue(applicationWithAllergiesAndContact)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.editionVolunteerApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          allergies: 'Allergie aux arachides',
          allergySeverity: 'SEVERE',
          emergencyContactName: 'Contact Urgence',
          emergencyContactPhone: '+33123456789',
        }),
        select: expect.any(Object),
      })
    })

    it("devrait accepter une candidature sans allergies ni contact d'urgence", async () => {
      const editionWithAllergiesOnly = {
        ...mockEdition,
        volunteersAskEmergencyContact: false,
        volunteersAskAllergies: true,
      }

      const applicationWithoutAllergies = {
        motivation: 'Candidature sans allergies',
        setupAvailability: true,
        eventAvailability: true,
        arrivalDateTime: tomorrow.toISOString(),
        departureDateTime: dayAfterTomorrow.toISOString(),
        // Pas d'allergies ni de contact d'urgence
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithAllergiesOnly)
      prismaMock.editionVolunteerApplication.create.mockResolvedValue({
        ...mockApplication,
        ...applicationWithoutAllergies,
      })

      global.readBody.mockResolvedValue(applicationWithoutAllergies)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.editionVolunteerApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          allergies: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
        }),
        select: expect.any(Object),
      })
    })

    it("devrait valider le format du téléphone de contact d'urgence", async () => {
      const editionWithEmergencyContact = {
        ...mockEdition,
        volunteersAskEmergencyContact: true,
      }

      const applicationDataWithInvalidPhone = {
        motivation: 'Test téléphone invalide',
        setupAvailability: true,
        eventAvailability: true,
        arrivalDateTime: tomorrow.toISOString(),
        departureDateTime: dayAfterTomorrow.toISOString(),
        emergencyContactName: 'Marie Dupont',
        emergencyContactPhone: 'abc123', // Format invalide
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithEmergencyContact)
      global.readBody.mockResolvedValue(applicationDataWithInvalidPhone)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
    })

    it("devrait valider la longueur du nom de contact d'urgence", async () => {
      const editionWithEmergencyContact = {
        ...mockEdition,
        volunteersAskEmergencyContact: true,
      }

      const applicationDataWithLongName = {
        motivation: 'Test nom trop long',
        setupAvailability: true,
        eventAvailability: true,
        arrivalDateTime: tomorrow.toISOString(),
        departureDateTime: dayAfterTomorrow.toISOString(),
        emergencyContactName: 'a'.repeat(101), // Plus de 100 caractères
        emergencyContactPhone: '+33123456789',
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithEmergencyContact)
      global.readBody.mockResolvedValue(applicationDataWithLongName)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
    })
  })
})
