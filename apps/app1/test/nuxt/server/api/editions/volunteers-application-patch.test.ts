import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({
    organizers: { canManage: mockCanManage },
    notifications: { notify: vi.fn() },
    meals: { deleteVolunteerMealSelections: vi.fn() },
  }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/applications/[applicationId].patch'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Modifier sa propre candidature répondait 403.
 *
 * Le contrôle d'accès n'admettait que les organisateurs, alors que la page publique offre le
 * bouton « Modifier la candidature » au bénévole. L'intention était pourtant écrite dans le
 * fichier — la notification s'abstient « si la modification est faite par le bénévole
 * lui-même » — mais ce cas ne pouvait jamais se produire.
 *
 * Second défaut mis au jour au même endroit : le profil rechargé s'appelait `user` et masquait
 * l'utilisateur authentifié. `isOwnApplication` comparait alors un identifiant à `undefined`,
 * et à `null` dès que le téléphone n'était pas modifié — une requête vouée à échouer.
 */

const BENEVOLE = 7
const ORGANISATEUR = 9

const candidature = {
  id: 129,
  eventId: 17,
  userId: BENEVOLE,
  status: 'PENDING',
  userSnapshotPhone: '+33612345678',
  setupAvailability: false,
  teardownAvailability: false,
  eventAvailability: true,
  arrivalDateTime: null,
  departureDateTime: null,
  teamPreferences: [],
  timePreferences: [],
  companionName: null,
  avoidList: null,
  dietaryPreference: 'NONE',
  allergies: null,
  allergySeverity: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  hasPets: false,
  petsDetails: null,
  hasMinors: false,
  minorsDetails: null,
  hasVehicle: false,
  vehicleDetails: null,
  skills: null,
  hasExperience: false,
  experienceDetails: null,
  motivation: null,
  user: { id: BENEVOLE, pseudo: 'benevole' },
  event: { name: 'Édition de test' },
}

const evenement = (userId: number, body: Record<string, unknown>) => ({
  context: { user: { id: userId }, params: { id: '17', applicationId: '129' } },
  __body: body,
})

const appeler = async (userId: number, body: Record<string, unknown>) => {
  global.readBody = vi.fn().mockResolvedValue(body)
  return handler(evenement(userId, body) as any)
}

/** Le port organisateurs répond selon l'identité passée. */
const autoriserGestion = (ids: number[]) => {
  mockCanManage.mockImplementation(async (_editionId: number, userId: number) =>
    ids.includes(userId)
  )
}

describe('PATCH /api/editions/[id]/volunteers/applications/[applicationId]', () => {
  beforeEach(() => {
    prismaMock.editionVolunteerApplication.findUnique.mockReset()
    prismaMock.editionVolunteerApplication.update.mockReset()
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.update.mockReset()

    prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(candidature)
    prismaMock.editionVolunteerApplication.update.mockResolvedValue({
      ...candidature,
      motivation: 'Nouvelle motivation',
    })
    prismaMock.user.findUnique.mockResolvedValue({
      phone: '+33612345678',
      nom: 'Nom',
      prenom: 'Prenom',
    })
    autoriserGestion([ORGANISATEUR])
  })

  it('laisse le bénévole reprendre sa propre candidature', async () => {
    await expect(appeler(BENEVOLE, { motivation: 'Nouvelle motivation' })).resolves.toBeTruthy()
    expect(prismaMock.editionVolunteerApplication.update).toHaveBeenCalled()
  })

  it("refuse un tiers qui n'est ni organisateur ni l'intéressé", async () => {
    await expect(appeler(1234, { motivation: 'Intrusion' })).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  // Le message est asserté, pas seulement le code : un 403 « vous n'êtes pas organisateur »
  // et un 403 « ce champ vous est interdit » se ressemblent, et confondre les deux ferait
  // passer ces tests alors même que le bénévole serait à nouveau exclu de sa propre
  // candidature. Constaté en cassant volontairement le contrôle d'accès.
  it("interdit au bénévole de s'accepter lui-même", async () => {
    await expect(appeler(BENEVOLE, { status: 'ACCEPTED' })).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('réservés aux organisateurs'),
    })
  })

  it("interdit au bénévole de s'affecter des équipes ou d'ajouter une note", async () => {
    await expect(appeler(BENEVOLE, { teams: ['1'] })).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('réservés aux organisateurs'),
    })
    await expect(appeler(BENEVOLE, { note: 'Bienvenue' })).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('réservés aux organisateurs'),
    })
  })

  it("laisse l'organisateur modifier la candidature d'autrui", async () => {
    await expect(appeler(ORGANISATEUR, { motivation: 'Ajustée' })).resolves.toBeTruthy()
  })

  it("n'échoue pas quand le téléphone n'est pas modifié", async () => {
    // Le profil n'est alors pas rechargé : c'est le cas où la variable masquée valait `null`.
    await expect(appeler(ORGANISATEUR, { motivation: 'Sans téléphone' })).resolves.toBeTruthy()
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('accepte la charge utile réelle du formulaire, champs vides compris', async () => {
    // Le test qui manquait. Les précédents n'envoyaient qu'un champ à la fois, alors que le
    // formulaire envoie TOUT son état : `modificationNote` part en chaîne vide même chez un
    // bénévole, à qui la section organisateur n'est pas affichée. Le filtre des champs
    // réservés s'en offusquait et le 403 revenait — signalé depuis l'application.
    await expect(
      appeler(BENEVOLE, {
        motivation: 'Toujours motivé',
        modificationNote: '',
        emergencyContactPhone: '',
        teamPreferences: [],
        companionName: '',
      })
    ).resolves.toBeTruthy()
  })

  it('refuse en revanche une note de modification réellement écrite', async () => {
    await expect(
      appeler(BENEVOLE, { modificationNote: 'Je me note quelque chose' })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('réservés aux organisateurs'),
    })
  })

  it("accepte un contact d'urgence laissé vide", async () => {
    // Le formulaire envoie ses champs tels quels lors d'une modification : un contact non
    // renseigné part en chaîne vide. La refuser bloquerait la modification de la plupart des
    // candidatures — régression relevée en relecture, pas en production.
    await expect(
      appeler(BENEVOLE, { motivation: 'Ajustée', emergencyContactPhone: '' })
    ).resolves.toBeTruthy()
  })

  it("rejette un contact d'urgence renseigné mais invalide", async () => {
    await expect(appeler(BENEVOLE, { emergencyContactPhone: '+3312345678' })).rejects.toMatchObject(
      { statusCode: 400 }
    )
  })

  it('un organisateur ne réécrit pas le profil du bénévole, il le complète', async () => {
    // L'organisateur corrige la candidature de quelqu'un d'autre : il n'a pas à écraser ce que
    // cette personne a mis dans son propre profil. Il ne comble que les vides.
    prismaMock.user.findUnique.mockResolvedValue({
      phone: '+33612345678',
      nom: 'Nom',
      prenom: 'Prenom',
      dietaryPreference: 'VEGETARIAN',
      allergies: 'Gluten',
      allergySeverity: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
    })

    await appeler(ORGANISATEUR, {
      dietaryPreference: 'VEGAN',
      // La gravité accompagne l'allergie : le point d'API l'exige dès qu'une allergie est
      // décrite, indépendamment de ce qu'on éprouve ici.
      allergies: 'Arachides',
      allergySeverity: 'LIGHT',
      emergencyContactName: 'Camille',
    })

    const ecriture = prismaMock.user.update.mock.calls.at(-1)?.[0]?.data ?? {}
    expect(ecriture).not.toHaveProperty('dietaryPreference')
    expect(ecriture).not.toHaveProperty('allergies')
    expect(ecriture).toMatchObject({ emergencyContactName: 'Camille' })
  })

  it('le bénévole, lui, porte ses corrections à son profil', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      phone: '+33612345678',
      nom: 'Nom',
      prenom: 'Prenom',
      dietaryPreference: 'VEGETARIAN',
      allergies: 'Gluten',
      allergySeverity: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
    })

    await appeler(BENEVOLE, { allergies: 'Arachides', allergySeverity: 'LIGHT' })

    expect(prismaMock.user.update.mock.calls.at(-1)?.[0]?.data).toMatchObject({
      allergies: 'Arachides',
    })
  })

  it('rejette un numéro de téléphone qui ne correspond à aucun numéro réel', async () => {
    // Huit chiffres en France : la forme était acceptée, le numéro n'existe pas.
    await expect(appeler(BENEVOLE, { phone: '+3312345678' })).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})
