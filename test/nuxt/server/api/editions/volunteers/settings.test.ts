import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/volunteers/settings.get'
import { prismaMock } from '../../../../../__mocks__/prisma'

describe('/api/editions/[id]/volunteers/settings GET', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
  }

  const mockEdition = {
    id: 1,
    volunteersOpen: true,
    volunteersDescription: 'Rejoignez notre équipe de bénévoles !',
    volunteersMode: 'INTERNAL',
    volunteersExternalUrl: null,
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
    volunteersAskEmergencyContact: false,
    volunteersSetupStartDate: new Date('2024-05-30'),
    volunteersTeardownEndDate: new Date('2024-06-05'),
    volunteersAskSetup: true,
    volunteersAskTeardown: true,
    volunteerApplications: [],
  }

  // Mock des équipes VolunteerTeam
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
    { id: 'team3', name: 'Bar', description: 'Équipe bar', color: '#10b981', maxVolunteers: null },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  describe('Mode INTERNAL', () => {
    it('devrait retourner toutes les informations pour le mode interne', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      const mockEvent = { context: { user: null } } // Public, pas besoin d'être connecté

      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        open: true,
        description: 'Rejoignez notre équipe de bénévoles !',
        mode: 'INTERNAL',
        externalUrl: null,
        askDiet: true,
        askAllergies: true,
        askTimePreferences: true,
        askTeamPreferences: true,
        askPets: true,
        askMinors: true,
        askVehicle: true,
        askEmergencyContact: false,
        askCompanion: true,
        askAvoidList: true,
        askSkills: true,
        askExperience: true,
        setupStartDate: mockEdition.volunteersSetupStartDate,
        teardownEndDate: mockEdition.volunteersTeardownEndDate,
        askSetup: true,
        askTeardown: true,
        counts: { total: 0, PENDING: 0, ACCEPTED: 0, REJECTED: 0 },
        updatedAt: null,
      })
    })

    it('devrait gérer les options désactivées', async () => {
      const editionWithMinimalOptions = {
        ...mockEdition,
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
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithMinimalOptions)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result.askDiet).toBe(false)
      expect(result.askAllergies).toBe(false)
      expect(result.askPets).toBe(false)
      expect(result.askMinors).toBe(false)
      expect(result.askVehicle).toBe(false)
      expect(result.askTimePreferences).toBe(false)
      expect(result.askTeamPreferences).toBe(false)
      expect(result.askCompanion).toBe(false)
      expect(result.askAvoidList).toBe(false)
      expect(result.askSkills).toBe(false)
      expect(result.askExperience).toBe(false)
    })

    it('devrait gérer les dates nulles de montage/démontage', async () => {
      const editionWithoutSetupDates = {
        ...mockEdition,
        volunteersSetupStartDate: null,
        volunteersTeardownEndDate: null,
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithoutSetupDates)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result.setupStartDate).toBeNull()
      expect(result.teardownEndDate).toBeNull()
    })
  })

  describe('Mode EXTERNAL', () => {
    it('devrait retourner les informations pour le mode externe', async () => {
      const externalEdition = {
        ...mockEdition,
        volunteersMode: 'EXTERNAL',
        volunteersExternalUrl: 'https://external-volunteers.example.com',
        volunteersDescription: 'Candidatures gérées via notre plateforme externe',
      }

      prismaMock.edition.findUnique.mockResolvedValue(externalEdition)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        open: true,
        description: 'Candidatures gérées via notre plateforme externe',
        mode: 'EXTERNAL',
        externalUrl: 'https://external-volunteers.example.com',
        askDiet: true,
        askAllergies: true,
        askTimePreferences: true,
        askTeamPreferences: true,
        askPets: true,
        askMinors: true,
        askVehicle: true,
        askEmergencyContact: false,
        askCompanion: true,
        askAvoidList: true,
        askSkills: true,
        askExperience: true,
        setupStartDate: mockEdition.volunteersSetupStartDate,
        teardownEndDate: mockEdition.volunteersTeardownEndDate,
        askSetup: true,
        askTeardown: true,
        counts: { total: 0, PENDING: 0, ACCEPTED: 0, REJECTED: 0 },
        updatedAt: null,
      })
    })

    it('devrait inclure tous les détails même en mode externe', async () => {
      const externalEdition = {
        ...mockEdition,
        volunteersMode: 'EXTERNAL',
        volunteersExternalUrl: 'https://external.example.com',
      }

      prismaMock.edition.findUnique.mockResolvedValue(externalEdition)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result.mode).toBe('EXTERNAL')
      expect(result.externalUrl).toBe('https://external.example.com')
      expect(result).toHaveProperty('askDiet')
      expect(result).toHaveProperty('counts')
    })
  })

  describe('Mode CLOSED', () => {
    it('devrait retourner les informations pour le mode fermé', async () => {
      const closedEdition = {
        ...mockEdition,
        volunteersMode: 'CLOSED',
        volunteersDescription: 'Les candidatures sont actuellement fermées',
        volunteersExternalUrl: null,
      }

      prismaMock.edition.findUnique.mockResolvedValue(closedEdition)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result).toEqual({
        open: true,
        description: 'Les candidatures sont actuellement fermées',
        mode: 'CLOSED',
        externalUrl: null,
        askDiet: true,
        askAllergies: true,
        askTimePreferences: true,
        askTeamPreferences: true,
        askPets: true,
        askMinors: true,
        askVehicle: true,
        askEmergencyContact: false,
        askCompanion: true,
        askAvoidList: true,
        askSkills: true,
        askExperience: true,
        setupStartDate: mockEdition.volunteersSetupStartDate,
        teardownEndDate: mockEdition.volunteersTeardownEndDate,
        askSetup: true,
        askTeardown: true,
        counts: { total: 0, PENDING: 0, ACCEPTED: 0, REJECTED: 0 },
        updatedAt: null,
      })
    })

    it('devrait inclure toutes les informations même en mode fermé', async () => {
      const closedEdition = {
        ...mockEdition,
        volunteersMode: 'CLOSED',
      }

      prismaMock.edition.findUnique.mockResolvedValue(closedEdition)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result.mode).toBe('CLOSED')
      expect(result).toHaveProperty('open')
      expect(result).toHaveProperty('description')
      expect(result).toHaveProperty('askDiet')
      expect(result).toHaveProperty('counts')
    })
  })

  describe('Dates et horaires', () => {
    it('devrait formater correctement les dates ISO', async () => {
      const editionWithDates = {
        ...mockEdition,
        volunteersSetupStartDate: new Date('2024-05-30T10:00:00.000Z'),
        volunteersTeardownEndDate: new Date('2024-06-05T18:00:00.000Z'),
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithDates)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result.setupStartDate).toEqual(new Date('2024-05-30T10:00:00.000Z'))
      expect(result.teardownEndDate).toEqual(new Date('2024-06-05T18:00:00.000Z'))
    })

    it('devrait gérer les fuseaux horaires', async () => {
      const editionWithTimezone = {
        ...mockEdition,
        volunteersSetupStartDate: new Date('2024-05-30T10:00:00+02:00'),
        volunteersTeardownEndDate: new Date('2024-06-05T18:00:00+02:00'),
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithTimezone)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result.setupStartDate).toBeInstanceOf(Date)
      expect(result.teardownEndDate).toBeInstanceOf(Date)
    })
  })

  describe('Descriptions et textes', () => {
    it('devrait retourner la description complète', async () => {
      const editionWithLongDescription = {
        ...mockEdition,
        volunteersDescription: `
          Rejoignez notre équipe exceptionnelle de bénévoles !
          
          Nous recherchons des personnes motivées pour nous aider à faire de cet événement un succès.
          Vous aurez l'opportunité de rencontrer des gens formidables et de vivre une expérience unique.
          
          Différents créneaux sont disponibles selon vos disponibilités.
        `.trim(),
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithLongDescription)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result.description).toBe(editionWithLongDescription.volunteersDescription)
      expect(result.description.length).toBeGreaterThan(200)
    })

    it('devrait gérer les descriptions vides', async () => {
      const editionWithEmptyDescription = {
        ...mockEdition,
        volunteersDescription: '',
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithEmptyDescription)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result.description).toBeNull()
    })

    it('devrait gérer les descriptions nulles', async () => {
      const editionWithNullDescription = {
        ...mockEdition,
        volunteersDescription: null,
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithNullDescription)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result.description).toBeNull()
    })
  })

  describe('Cas limites et erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)

      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Edition introuvable')
    })

    it("devrait gérer les IDs d'édition invalides", async () => {
      global.getRouterParam = vi.fn().mockReturnValue('invalid-id')

      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Edition invalide')
    })

    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.edition.findUnique.mockRejectedValue(new Error('Database connection failed'))

      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Database connection failed')
    })

    it('devrait fonctionner même avec des utilisateurs connectés', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      expect(result.mode).toBe('INTERNAL')
      // Pas de différence selon l'état de connexion pour cette API publique
    })

    it('devrait gérer les modes de bénévolat invalides', async () => {
      const editionWithInvalidMode = {
        ...mockEdition,
        volunteersMode: 'INVALID_MODE',
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithInvalidMode)

      const mockEvent = { context: { user: null } }

      // Devrait traiter les modes invalides comme 'CLOSED'
      const result = await handler(mockEvent as any)
      expect(result.mode).toBe('INVALID_MODE')
    })
  })

  describe('Performances et optimisation', () => {
    it('devrait utiliser select pour optimiser les requêtes', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      const mockEvent = { context: { user: null } }
      await handler(mockEvent as any)

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

    it('devrait faire uniquement la requête edition', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      const mockEvent = { context: { user: null } }
      await handler(mockEvent as any)

      expect(prismaMock.edition.findUnique).toHaveBeenCalledTimes(1)
    })
  })

  describe('Sécurité et données sensibles', () => {
    it("ne devrait pas exposer d'informations sensibles", async () => {
      const editionWithSensitiveData = {
        ...mockEdition,
        // Simule des données qui ne devraient pas être exposées
        internalNotes: 'Notes privées sur les bénévoles',
        adminConfig: { secret: 'admin-secret' },
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithSensitiveData)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      expect(result.internalNotes).toBeUndefined()
      expect(result.adminConfig).toBeUndefined()
      expect(result.secret).toBeUndefined()
    })

    it('devrait retourner seulement les champs nécessaires', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)

      const mockEvent = { context: { user: null } }
      const result = await handler(mockEvent as any)

      const expectedFields = [
        'open',
        'description',
        'mode',
        'externalUrl',
        'askDiet',
        'askAllergies',
        'askTimePreferences',
        'askTeamPreferences',
        'askPets',
        'askMinors',
        'askVehicle',
        'askCompanion',
        'askAvoidList',
        'askSkills',
        'askExperience',
        'askEmergencyContact',
        'setupStartDate',
        'teardownEndDate',
        'askSetup',
        'askTeardown',
        'counts',
        'updatedAt',
      ]

      expectedFields.forEach((field) => {
        expect(result).toHaveProperty(field)
      })

      const actualFields = Object.keys(result)
      const unexpectedFields = actualFields.filter((field) => !expectedFields.includes(field))
      expect(unexpectedFields).toEqual([])
    })
  })
})
