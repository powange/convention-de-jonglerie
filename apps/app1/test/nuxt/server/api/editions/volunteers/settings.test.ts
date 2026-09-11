import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ organizers: { canManage: mockCanManage } }),
}))

import handler from '../../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/settings.get'
import { global } from '../../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

/**
 * Cet endpoint n'avait aucun contrôle : il rendait la configuration complète *et* le décompte des
 * candidatures à tout compte connecté, y compris sur une édition dont la page de bénévolat n'est
 * pas publique. La page, elle, était bien gardée — la porte était sur l'écran, pas sur la donnée.
 *
 * Ces tests décrivent donc d'abord qui voit quoi. Les anciens, qui appelaient le handler avec
 * `user: null` sur une édition fermée et attendaient tout en retour, décrivaient le défaut.
 */
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

  const makeEvent = (settingsOverrides: Record<string, unknown> = {}) => ({
    volunteerSettings: { ...baseSettings, ...settingsOverrides },
  })

  /** Le décompte tel que `groupBy` le rend : une ligne par statut présent. */
  const groupes = (parStatut: Record<string, number>) =>
    Object.entries(parStatut).map(([status, nombre]) => ({ status, _count: { _all: nombre } }))

  /** Un appel par un gestionnaire, le cas où tout est lisible. */
  const appelGestionnaire = () => {
    mockCanManage.mockResolvedValue(true)
    return handler({ context: { user: mockUser } } as any)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    // Par défaut : ni gestionnaire, ni candidat. Chaque test ouvre ce dont il a besoin.
    mockCanManage.mockResolvedValue(false)
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)
    prismaMock.editionVolunteerApplication.groupBy.mockResolvedValue([])
    prismaMock.event.findUnique.mockResolvedValue(makeEvent())
  })

  describe('Qui a le droit de lire', () => {
    it('cache tout à un curieux sur une édition dont la page n’est pas publique', async () => {
      // 404 et non 403 : un 403 confirmerait qu'il y a quelque chose à voir.
      await expect(handler({ context: { user: mockUser } } as any)).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('cache tout à un visiteur sans session', async () => {
      await expect(handler({ context: { user: null } } as any)).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('ouvre les réglages à tous quand la page est publique', async () => {
      prismaMock.event.findUnique.mockResolvedValue(makeEvent({ pagePublic: true }))

      const result = await handler({ context: { user: mockUser } } as any)

      expect(result.mode).toBe('INTERNAL')
    })

    it('ouvre les réglages à qui a déposé une candidature, page fermée comprise', async () => {
      // Quel que soit son statut : sans les questions posées, l'écran « mes candidatures » ne
      // sait plus afficher les réponses que la personne a elle-même données.
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 7 })

      const result = await handler({ context: { user: mockUser } } as any)

      expect(result.askDiet).toBe(true)
    })

    it('ouvre tout au gestionnaire', async () => {
      const result = await appelGestionnaire()

      expect(result.mode).toBe('INTERNAL')
      expect(result).toHaveProperty('counts')
    })
  })

  describe('Les compteurs relèvent de la gestion', () => {
    it('ne les rend pas à qui ne gère pas, page publique comprise', async () => {
      // Rendre la page visible n'est pas publier ses statistiques de recrutement.
      prismaMock.event.findUnique.mockResolvedValue(makeEvent({ pagePublic: true }))

      const result = await handler({ context: { user: mockUser } } as any)

      expect(result).not.toHaveProperty('counts')
    })

    it('ne les rend pas non plus à un candidat', async () => {
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 7 })

      const result = await handler({ context: { user: mockUser } } as any)

      expect(result).not.toHaveProperty('counts')
    })

    it('omet la clé plutôt que de la remplir de zéros', async () => {
      // Un zéro se lirait « personne n'a postulé », ce qui est une information en soi.
      prismaMock.event.findUnique.mockResolvedValue(makeEvent({ pagePublic: true }))

      const result = await handler({ context: { user: mockUser } } as any)

      expect(Object.keys(result)).not.toContain('counts')
    })

    it('ne compte même pas en base quand personne n’a le droit de lire', async () => {
      prismaMock.event.findUnique.mockResolvedValue(makeEvent({ pagePublic: true }))

      await handler({ context: { user: mockUser } } as any)

      expect(prismaMock.editionVolunteerApplication.groupBy).not.toHaveBeenCalled()
    })

    it('compte les candidatures par statut pour un gestionnaire', async () => {
      prismaMock.editionVolunteerApplication.groupBy.mockResolvedValue(
        groupes({ PENDING: 1, ACCEPTED: 2 })
      )

      const result = await appelGestionnaire()

      expect(result.counts).toEqual({ total: 3, PENDING: 1, ACCEPTED: 2, REJECTED: 0 })
    })

    it('garde les quatre clés à zéro quand aucune candidature n’existe', async () => {
      // Un statut absent de la réponse casserait l'affichage, là où un zéro est juste — la règle
      // est l'inverse de celle qui vaut pour la clé `counts` elle-même.
      const result = await appelGestionnaire()

      expect(result.counts).toEqual({ total: 0, PENDING: 0, ACCEPTED: 0, REJECTED: 0 })
    })
  })

  describe('Mode INTERNAL', () => {
    it('devrait retourner toutes les informations pour le mode interne', async () => {
      const result = await appelGestionnaire()

      expect(result).toEqual({
        pagePublic: false,
        open: true,
        description: 'Rejoignez notre équipe de bénévoles !',
        mode: 'INTERNAL',
        // Les échanges de créneaux sont ouverts par défaut : une édition qui n'a jamais touché
        // au réglage se comporte comme avant son arrivée.
        swapsEnabled: true,
        // À l'inverse, rattacher des organisateurs aux équipes est fermé par défaut : c'est
        // une possibilité qu'on ouvre, pas un comportement que les éditions attendaient.
        organizersInTeams: false,
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

      const result = await appelGestionnaire()

      expect(result.askDiet).toBe(false)
      expect(result.askAllergies).toBe(false)
      expect(result.askExperience).toBe(false)
    })

    it('devrait gérer les dates nulles de montage/démontage', async () => {
      prismaMock.event.findUnique.mockResolvedValue(
        makeEvent({ setupStartDate: null, teardownEndDate: null })
      )

      const result = await appelGestionnaire()

      expect(result.setupStartDate).toBeNull()
      expect(result.teardownEndDate).toBeNull()
    })

    it('renvoie les valeurs par défaut si aucune config (settings null)', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ volunteerSettings: null })

      const result = await appelGestionnaire()

      expect(result.open).toBe(false)
      expect(result.mode).toBe('INTERNAL')
      expect(result.description).toBeNull()
    })

    it('traite une config absente comme une page non publique', async () => {
      // Sans réglages, `pagePublic` vaut faux : l'édition n'a rien ouvert, et un curieux ne doit
      // pas profiter de ce silence.
      prismaMock.event.findUnique.mockResolvedValue({ volunteerSettings: null })

      await expect(handler({ context: { user: mockUser } } as any)).rejects.toMatchObject({
        statusCode: 404,
      })
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

      const result = await appelGestionnaire()

      expect(result.mode).toBe('EXTERNAL')
      expect(result.externalUrl).toBe('https://external-volunteers.example.com')
      expect(result.description).toBe('Candidatures gérées via notre plateforme externe')
    })
  })

  describe('Cas limites et erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.event.findUnique.mockResolvedValue(null)

      await expect(appelGestionnaire()).rejects.toThrow('Édition introuvable')
    })

    it("devrait gérer les IDs d'édition invalides", async () => {
      global.getRouterParam = vi.fn().mockReturnValue('invalid-id')

      await expect(appelGestionnaire()).rejects.toThrow("ID d'édition invalide")
    })
  })

  describe('Forme de la réponse', () => {
    it('devrait retourner seulement les champs attendus', async () => {
      const result = await appelGestionnaire()

      const expectedFields = [
        'open',
        'pagePublic',
        'description',
        'mode',
        'swapsEnabled',
        'organizersInTeams',
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
