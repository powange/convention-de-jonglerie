import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

// Le point d'API enrichit chaque candidature avec l'affichage de son événement, via un port qui
// interroge la base. Hors sujet ici : on le neutralise pour ne garder que la résolution du profil.
vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({
    eventScope: { getEventDisplayData: vi.fn().mockResolvedValue({}) },
  }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/user/volunteer-applications.get'

const prismaMock = (globalThis as any).prisma

/**
 * « Mes candidatures » doit dire la même chose que la page de l'édition.
 *
 * Ce point d'API diffusait les champs bruts de la candidature (`...appRest`) sans résoudre le
 * profil. La même personne voyait donc son profil sur la page de l'édition et la copie figée de
 * sa candidature sur cette page-ci — deux valeurs pour la même information selon l'écran.
 *
 * Défaut trouvé en vérifiant, avant suppression des colonnes, qu'elles n'étaient plus lues :
 * c'est le balayage qui l'a révélé, pas la relecture fichier par fichier.
 */

const candidature = (surcharges: Record<string, unknown> = {}) => ({
  id: 1,
  eventId: 10,
  status: 'ACCEPTED',
  motivation: null,
  createdAt: new Date(),
  timePreferences: [],
  teamPreferences: [],
  acceptanceNote: null,
  teamAssignments: [],
  user: {
    dietaryPreference: 'VEGAN',
    allergies: 'Arachides',
    allergySeverity: 'SEVERE',
    emergencyContactName: 'Camille',
    emergencyContactPhone: '+33622222222',
  },
  event: { name: 'Édition', startDate: new Date(), endDate: new Date(), volunteerSettings: null },
  ...surcharges,
})

const appeler = async (rows: unknown[]) => {
  prismaMock.editionVolunteerApplication.findMany.mockResolvedValue(rows)
  return (await handler({ context: { user: { id: 1 } } } as any)) as any[]
}

describe('GET /api/user/volunteer-applications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.editionVolunteerApplication.findMany.mockReset()
    prismaMock.volunteerTeam.findMany.mockResolvedValue([])
    prismaMock.volunteerAssignment.findMany?.mockResolvedValue([])
  })

  it('rend les informations du profil', async () => {
    const [resultat] = await appeler([candidature()])

    expect(resultat).toMatchObject({
      dietaryPreference: 'VEGAN',
      allergies: 'Arachides',
      allergySeverity: 'SEVERE',
      emergencyContactName: 'Camille',
      emergencyContactPhone: '+33622222222',
    })
  })

  it('ne laisse pas fuiter le profil brut dans la réponse', async () => {
    // `user` ne sert qu'à résoudre : le laisser passer exposerait une seconde source de vérité
    // au client, qui pourrait s'en servir et rendre la résolution inutile.
    const [resultat] = await appeler([candidature()])
    expect(resultat).not.toHaveProperty('user')
  })
})
