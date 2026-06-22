import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/settings.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/volunteers/settings GET', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
  }

  // Étape 0bis : config bénévole portée par EventVolunteerSettings (noms sans préfixe volunteers)
  const baseSettings = {
    eventId: 1,
    enabled: true,
    open: true,
    pagePublic: false,
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
    askCompanion: true,
    askAvoidList: true,
    askSkills: true,
    askExperience: true,
    askEmergencyContact: false,
    setupStartDate: new Date('2024-05-30'),
    teardownEndDate: new Date('2024-06-05'),
    askSetup: true,
    askTeardown: true,
    updatedAt: null,
  }

  // Construit l'objet retourné par prisma.event.findUnique
  const makeEvent = (
    settingsOverrides: Record<string, unknown> = {},
    applications: any[] = []
  ) => ({
    volunteerSettings: { ...baseSettings, ...settingsOverrides },
    volunteerApplications: applications,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  describe('Mode INTERNAL', () => {
    it('devrait retourner toutes les informations pour le mode interne', async () => {
      prismaMock.event.findUnique.mockResolvedValue(makeEvent())

      const result = await handler({ context: { user: null } } as any)

      expect(result).toEqual({
        pagePublic: false,
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
        setupStartDate: baseSettings.setupStartDate,
        teardownEndDate: baseSettings.teardownEndDate,
        askSetup: true,
        askTeardown: true,
        counts: { total: 0, PENDING: 0, ACCEPTED: 0, REJECTED: 0 },
        updatedAt: null,
      })
    })

    it('devrait gérer les options désactivées', async () => {
      prismaMock.event.findUnique.mockResolvedValue(
        makeEvent({
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
        })
      )

      const result = await handler({ context: { user: null } } as any)

      expect(result.askDiet).toBe(false)
      expect(result.askAllergies).toBe(false)
      expect(result.askExperience).toBe(false)
    })

    it('devrait gérer les dates nulles de montage/démontage', async () => {
      prismaMock.event.findUnique.mockResolvedValue(
        makeEvent({ setupStartDate: null, teardownEndDate: null })
      )

      const result = await handler({ context: { user: null } } as any)

      expect(result.setupStartDate).toBeNull()
      expect(result.teardownEndDate).toBeNull()
    })

    it('renvoie les valeurs par défaut si aucune config (settings null)', async () => {
      prismaMock.event.findUnique.mockResolvedValue({
        volunteerSettings: null,
        volunteerApplications: [],
      })

      const result = await handler({ context: { user: null } } as any)

      expect(result.open).toBe(false)
      expect(result.mode).toBe('INTERNAL')
      expect(result.description).toBeNull()
    })
  })

  describe('Mode EXTERNAL', () => {
    it('devrait retourner les informations pour le mode externe', async () => {
      prismaMock.event.findUnique.mockResolvedValue(
        makeEvent({
          mode: 'EXTERNAL',
          externalUrl: 'https://external-volunteers.example.com',
          description: 'Candidatures gérées via notre plateforme externe',
        })
      )

      const result = await handler({ context: { user: null } } as any)

      expect(result.mode).toBe('EXTERNAL')
      expect(result.externalUrl).toBe('https://external-volunteers.example.com')
      expect(result.description).toBe('Candidatures gérées via notre plateforme externe')
    })
  })

  describe('Comptage des candidatures', () => {
    it('devrait compter les candidatures par statut', async () => {
      prismaMock.event.findUnique.mockResolvedValue(
        makeEvent({}, [
          { id: 1, status: 'PENDING', userId: 10 },
          { id: 2, status: 'ACCEPTED', userId: 11 },
          { id: 3, status: 'ACCEPTED', userId: 12 },
        ])
      )

      const result = await handler({ context: { user: null } } as any)

      expect(result.counts).toEqual({ total: 3, PENDING: 1, ACCEPTED: 2, REJECTED: 0 })
    })
  })

  describe('Cas limites et erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.event.findUnique.mockResolvedValue(null)

      await expect(handler({ context: { user: null } } as any)).rejects.toThrow(
        'Édition introuvable'
      )
    })

    it("devrait gérer les IDs d'édition invalides", async () => {
      global.getRouterParam = vi.fn().mockReturnValue('invalid-id')

      await expect(handler({ context: { user: null } } as any)).rejects.toThrow(
        "ID d'édition invalide"
      )
    })

    it('devrait fonctionner même avec des utilisateurs connectés', async () => {
      prismaMock.event.findUnique.mockResolvedValue(makeEvent())

      const result = await handler({ context: { user: mockUser } } as any)

      expect(result.mode).toBe('INTERNAL')
    })
  })

  describe('Sécurité et forme de la réponse', () => {
    it('devrait retourner seulement les champs attendus', async () => {
      prismaMock.event.findUnique.mockResolvedValue(makeEvent())

      const result = await handler({ context: { user: null } } as any)

      const expectedFields = [
        'open',
        'pagePublic',
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

      expectedFields.forEach((field) => expect(result).toHaveProperty(field))
      const unexpectedFields = Object.keys(result).filter((f) => !expectedFields.includes(f))
      expect(unexpectedFields).toEqual([])
    })
  })
})
