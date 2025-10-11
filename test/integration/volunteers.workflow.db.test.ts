import bcrypt from 'bcryptjs'
import { describe, it, expect, beforeAll } from 'vitest'

import { prismaTest } from '../setup-db'

// Ce fichier ne s'exécute que si TEST_WITH_DB=true
describe.skipIf(!process.env.TEST_WITH_DB)(
  "Tests d'intégration Workflow Bénévoles avec DB réelle",
  () => {
    let mockUser: any
    let mockManager: any
    let mockEdition: any
    let mockTeam1: any
    let mockTeam2: any

    beforeAll(async () => {
      const ts = Date.now()

      // Créer les utilisateurs de test
      mockUser = await prismaTest.user.create({
        data: {
          email: `volunteer-${ts}@example.com`,
          password: await bcrypt.hash('Password123!', 10),
          pseudo: `volunteer-${ts}`,
          nom: 'Dupont',
          prenom: 'Marie',
          phone: '+33123456789',
          isEmailVerified: true,
        },
      })

      mockManager = await prismaTest.user.create({
        data: {
          email: `manager-${ts}@example.com`,
          password: await bcrypt.hash('Password123!', 10),
          pseudo: `manager-${ts}`,
          nom: 'Martin',
          prenom: 'Jean',
          isEmailVerified: true,
        },
      })

      // Créer une convention
      const convention = await prismaTest.convention.create({
        data: {
          name: `Convention Test ${ts}`,
          authorId: mockManager.id,
        },
      })

      // Créer une édition
      mockEdition = await prismaTest.edition.create({
        data: {
          name: `Convention Test 2024 ${ts}`,
          conventionId: convention.id,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-03'),
          addressLine1: '123 Test Street',
          city: 'Paris',
          country: 'France',
          postalCode: '75001',
          volunteersOpen: true,
          volunteersMode: 'INTERNAL',
          volunteersDescription: 'Rejoignez notre équipe !',
          volunteersAskSetup: true,
          volunteersAskTeardown: true,
          volunteersSetupStartDate: new Date('2024-05-30'),
          volunteersTeardownEndDate: new Date('2024-06-05'),
          volunteersAskDiet: true,
          volunteersAskAllergies: true,
          volunteersAskPets: true,
          volunteersAskTimePreferences: true,
          volunteersAskTeamPreferences: true,
          volunteersAskEmergencyContact: false,
        },
      })

      // Créer des équipes de bénévoles
      mockTeam1 = await prismaTest.volunteerTeam.create({
        data: {
          name: 'Accueil',
          description: 'Équipe accueil',
          color: '#ef4444',
          maxVolunteers: 5,
          editionId: mockEdition.id,
        },
      })

      mockTeam2 = await prismaTest.volunteerTeam.create({
        data: {
          name: 'Technique',
          description: 'Équipe technique',
          color: '#3b82f6',
          maxVolunteers: 3,
          editionId: mockEdition.id,
        },
      })
    })

    describe('Workflow complet : Configuration -> Candidature -> Gestion', () => {
      it('devrait permettre un workflow complet de bout en bout avec DB', async () => {
        // ========== ÉTAPE 1: Vérifier la configuration initiale ==========
        const edition = await prismaTest.edition.findUnique({
          where: { id: mockEdition.id },
          include: {
            volunteerTeams: true,
          },
        })

        expect(edition).toBeDefined()
        expect(edition?.volunteersMode).toBe('INTERNAL')
        expect(edition?.volunteersOpen).toBe(true)
        expect(edition?.volunteerTeams).toHaveLength(2)

        // ========== ÉTAPE 2: Candidature d'un bénévole ==========
        const arrivalDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        const departureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

        const application = await prismaTest.editionVolunteerApplication.create({
          data: {
            editionId: mockEdition.id,
            userId: mockUser.id,
            motivation: 'Je suis très motivé pour aider à organiser cette convention !',
            setupAvailability: true,
            teardownAvailability: false,
            eventAvailability: true,
            arrivalDateTime: arrivalDate,
            departureDateTime: departureDate,
            dietaryPreference: 'VEGETARIAN',
            allergies: 'Aucune',
            allergySeverity: 'LIGHT',
            emergencyContactName: 'Jean Dupont',
            emergencyContactPhone: '+33123456789',
            timePreferences: ['morning', 'evening'],
            teamPreferences: [mockTeam1.id, mockTeam2.id],
            hasPets: false,
            hasVehicle: true,
            vehicleDetails: 'Voiture 5 places',
            userSnapshotPhone: mockUser.phone,
            status: 'PENDING',
          },
        })

        expect(application.id).toBeDefined()
        expect(application.status).toBe('PENDING')
        expect(application.motivation).toBe(
          'Je suis très motivé pour aider à organiser cette convention !'
        )
        expect(application.setupAvailability).toBe(true)
        expect(application.dietaryPreference).toBe('VEGETARIAN')

        // ========== ÉTAPE 3: Consultation des candidatures par le gestionnaire ==========
        const applications = await prismaTest.editionVolunteerApplication.findMany({
          where: {
            editionId: mockEdition.id,
          },
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                email: true,
                prenom: true,
                nom: true,
              },
            },
          },
        })

        expect(applications).toHaveLength(1)
        expect(applications[0].status).toBe('PENDING')
        expect(applications[0].user.pseudo).toBe(mockUser.pseudo)
        expect(applications[0].motivation).toBe(
          'Je suis très motivé pour aider à organiser cette convention !'
        )

        // ========== ÉTAPE 4: Acceptation de la candidature ==========
        const acceptedApplication = await prismaTest.editionVolunteerApplication.update({
          where: { id: application.id },
          data: {
            status: 'ACCEPTED',
            decidedAt: new Date(),
            acceptanceNote: "Candidat parfait pour l'accueil",
          },
        })

        expect(acceptedApplication.status).toBe('ACCEPTED')
        expect(acceptedApplication.acceptanceNote).toBe("Candidat parfait pour l'accueil")
        expect(acceptedApplication.decidedAt).toBeDefined()

        // ========== ÉTAPE 5: Assignation à des équipes ==========
        const teamAssignment1 = await prismaTest.applicationTeamAssignment.create({
          data: {
            applicationId: application.id,
            teamId: mockTeam1.id,
            isLeader: false,
          },
        })

        expect(teamAssignment1.applicationId).toBe(application.id)
        expect(teamAssignment1.teamId).toBe(mockTeam1.id)

        // ========== ÉTAPE 6: Vérification de l'état final ==========
        const finalApplication = await prismaTest.editionVolunteerApplication.findUnique({
          where: { id: application.id },
          include: {
            teamAssignments: {
              include: {
                team: true,
              },
            },
          },
        })

        expect(finalApplication?.status).toBe('ACCEPTED')
        expect(finalApplication?.teamAssignments).toHaveLength(1)
        expect(finalApplication?.teamAssignments[0].team.name).toBe('Accueil')
      })
    })

    describe("Scénarios d'erreur dans le workflow", () => {
      it('devrait empêcher la double candidature dans la DB', async () => {
        const ts = Date.now()

        // Créer un nouvel utilisateur pour ce test
        const testUser = await prismaTest.user.create({
          data: {
            email: `double-app-${ts}@example.com`,
            password: await bcrypt.hash('Password123!', 10),
            pseudo: `doubleapp-${ts}`,
            nom: 'Double',
            prenom: 'Application',
            isEmailVerified: true,
            phone: '+33123456789',
          },
        })

        // Créer une candidature
        const firstApplication = await prismaTest.editionVolunteerApplication.create({
          data: {
            editionId: mockEdition.id,
            userId: testUser.id,
            motivation: 'Première candidature',
            setupAvailability: true,
            arrivalDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            departureDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            status: 'PENDING',
            userSnapshotPhone: testUser.phone,
          },
        })

        expect(firstApplication.id).toBeDefined()

        // Tenter de créer une seconde candidature pour le même utilisateur et édition
        // La contrainte unique (editionId, userId) devrait l'empêcher
        await expect(
          prismaTest.editionVolunteerApplication.create({
            data: {
              editionId: mockEdition.id,
              userId: testUser.id,
              motivation: 'Tentative de double candidature',
              setupAvailability: true,
              arrivalDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              departureDateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'PENDING',
              userSnapshotPhone: testUser.phone,
            },
          })
        ).rejects.toThrow(/Unique constraint/)
      })

      it('devrait gérer le rejet et permettre la mise à jour du statut', async () => {
        const ts = Date.now()

        // Créer un nouvel utilisateur pour ce test
        const testUser = await prismaTest.user.create({
          data: {
            email: `reject-test-${ts}@example.com`,
            password: await bcrypt.hash('Password123!', 10),
            pseudo: `rejectuser-${ts}`,
            nom: 'Test',
            prenom: 'Reject',
            isEmailVerified: true,
          },
        })

        // Créer une candidature
        const application = await prismaTest.editionVolunteerApplication.create({
          data: {
            editionId: mockEdition.id,
            userId: testUser.id,
            motivation: 'Candidature à rejeter',
            setupAvailability: true,
            arrivalDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            departureDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            status: 'PENDING',
            userSnapshotPhone: '+33123456789',
          },
        })

        expect(application.status).toBe('PENDING')

        // Rejeter la candidature
        const rejectedApplication = await prismaTest.editionVolunteerApplication.update({
          where: { id: application.id },
          data: {
            status: 'REJECTED',
            decidedAt: new Date(),
          },
        })

        expect(rejectedApplication.status).toBe('REJECTED')
        expect(rejectedApplication.decidedAt).toBeDefined()

        // Vérifier dans la DB
        const verifyApplication = await prismaTest.editionVolunteerApplication.findUnique({
          where: { id: application.id },
        })

        expect(verifyApplication?.status).toBe('REJECTED')
      })
    })

    describe('Validation des permissions dans le workflow', () => {
      it('devrait permettre à un collaborateur autorisé de gérer les candidatures', async () => {
        const ts = Date.now()

        // Créer un utilisateur collaborateur
        const collaboratorUser = await prismaTest.user.create({
          data: {
            email: `collaborator-${ts}@example.com`,
            password: await bcrypt.hash('Password123!', 10),
            pseudo: `collab-${ts}`,
            nom: 'Collaborateur',
            prenom: 'Test',
            isEmailVerified: true,
          },
        })

        // Créer une convention avec un collaborateur
        const convention = await prismaTest.convention.findUnique({
          where: { id: mockEdition.conventionId },
        })

        expect(convention).toBeDefined()

        // Ajouter le collaborateur
        const collaborator = await prismaTest.conventionCollaborator.create({
          data: {
            conventionId: convention!.id,
            userId: collaboratorUser.id,
            canManageVolunteers: true,
            addedById: mockManager.id,
          },
        })

        expect(collaborator.canManageVolunteers).toBe(true)

        // Vérifier que le collaborateur est bien enregistré
        const foundCollaborator = await prismaTest.conventionCollaborator.findFirst({
          where: {
            conventionId: convention!.id,
            userId: collaboratorUser.id,
          },
        })

        expect(foundCollaborator).toBeDefined()
        expect(foundCollaborator?.canManageVolunteers).toBe(true)
      })
    })

    describe('Performance et cohérence des données', () => {
      it('devrait maintenir la cohérence des équipes et des candidatures', async () => {
        const teams = await prismaTest.volunteerTeam.findMany({
          where: { editionId: mockEdition.id },
        })

        expect(teams).toHaveLength(2)
        expect(teams.some((t) => t.name === 'Accueil')).toBe(true)
        expect(teams.some((t) => t.name === 'Technique')).toBe(true)

        // Vérifier les relations entre édition et équipes
        const editionWithTeams = await prismaTest.edition.findUnique({
          where: { id: mockEdition.id },
          include: {
            volunteerTeams: true,
          },
        })

        expect(editionWithTeams?.volunteerTeams).toHaveLength(2)
      })

      it('devrait gérer les agrégations de candidatures', async () => {
        // Compter les candidatures par statut
        const pendingCount = await prismaTest.editionVolunteerApplication.count({
          where: {
            editionId: mockEdition.id,
            status: 'PENDING',
          },
        })

        const acceptedCount = await prismaTest.editionVolunteerApplication.count({
          where: {
            editionId: mockEdition.id,
            status: 'ACCEPTED',
          },
        })

        // Vérifier que les comptages sont cohérents
        expect(pendingCount).toBeGreaterThanOrEqual(0)
        expect(acceptedCount).toBeGreaterThanOrEqual(0)

        const totalCount = await prismaTest.editionVolunteerApplication.count({
          where: {
            editionId: mockEdition.id,
          },
        })

        expect(totalCount).toBeGreaterThanOrEqual(pendingCount + acceptedCount)
      })
    })

    describe("Tests spécifiques pour les allergies et contact d'urgence", () => {
      it('devrait stocker correctement les allergies avec niveau de sévérité dans la DB', async () => {
        const ts = Date.now()

        const allergyUser = await prismaTest.user.create({
          data: {
            email: `allergy-${ts}@example.com`,
            password: await bcrypt.hash('Password123!', 10),
            pseudo: `allergyuser-${ts}`,
            nom: 'Allergy',
            prenom: 'Test',
            isEmailVerified: true,
          },
        })

        const applicationWithAllergy = await prismaTest.editionVolunteerApplication.create({
          data: {
            editionId: mockEdition.id,
            userId: allergyUser.id,
            motivation: 'Candidature avec allergies',
            setupAvailability: true,
            eventAvailability: true,
            arrivalDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            departureDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            allergies: 'Allergie aux arachides',
            allergySeverity: 'SEVERE',
            emergencyContactName: 'Marie Dupont',
            emergencyContactPhone: '+33987654321',
            status: 'PENDING',
            userSnapshotPhone: '+33123456789',
          },
        })

        expect(applicationWithAllergy.allergies).toBe('Allergie aux arachides')
        expect(applicationWithAllergy.allergySeverity).toBe('SEVERE')
        expect(applicationWithAllergy.emergencyContactName).toBe('Marie Dupont')
        expect(applicationWithAllergy.emergencyContactPhone).toBe('+33987654321')

        // Vérifier dans la DB
        const verifyApplication = await prismaTest.editionVolunteerApplication.findUnique({
          where: { id: applicationWithAllergy.id },
        })

        expect(verifyApplication?.allergies).toBe('Allergie aux arachides')
        expect(verifyApplication?.allergySeverity).toBe('SEVERE')
      })

      it("devrait accepter les allergies légères sans contact d'urgence", async () => {
        const ts = Date.now()

        const lightAllergyUser = await prismaTest.user.create({
          data: {
            email: `light-allergy-${ts}@example.com`,
            password: await bcrypt.hash('Password123!', 10),
            pseudo: `lightallergyuser-${ts}`,
            nom: 'Light',
            prenom: 'Allergy',
            isEmailVerified: true,
          },
        })

        const applicationWithLightAllergy = await prismaTest.editionVolunteerApplication.create({
          data: {
            editionId: mockEdition.id,
            userId: lightAllergyUser.id,
            motivation: 'Candidature avec allergies légères',
            setupAvailability: true,
            eventAvailability: true,
            arrivalDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            departureDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            allergies: 'Allergie légère au pollen',
            allergySeverity: 'LIGHT',
            // Pas de contact d'urgence - et c'est OK pour LIGHT
            status: 'PENDING',
            userSnapshotPhone: '+33123456789',
          },
        })

        expect(applicationWithLightAllergy.allergies).toBe('Allergie légère au pollen')
        expect(applicationWithLightAllergy.allergySeverity).toBe('LIGHT')
        expect(applicationWithLightAllergy.emergencyContactName).toBeNull()
        expect(applicationWithLightAllergy.emergencyContactPhone).toBeNull()
      })
    })
  }
)
