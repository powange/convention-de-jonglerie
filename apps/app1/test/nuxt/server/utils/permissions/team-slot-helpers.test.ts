import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  isActiveInTeamSlot,
  getActiveTeamSlot,
} from '../../../../../server/utils/permissions/team-slot-helpers'

const prismaMock = (globalThis as any).prisma

/**
 * Ce que ces tests assurent, c'est la REQUÊTE envoyée à Prisma, jamais ce que le mock a bien
 * voulu rendre. Une garde d'autorisation se juge à ce qu'elle demande à la base : une assertion
 * sur la valeur de retour passerait au vert avec un `where` qui ne filtre rien.
 */
describe('team-slot-helpers — une affectation n’ouvre un droit que si la candidature est acceptée', () => {
  const equipeControleAcces = { isAccessControlTeam: true }

  /** Un créneau en cours, pour que seule la garde décide du résultat. */
  const creneauEnCours = () => {
    const maintenant = Date.now()
    return {
      timeSlot: {
        id: 'slot-1',
        teamId: 'team-1',
        team: { id: 'team-1', name: 'Entrée' },
        title: 'Accueil',
        startDateTime: new Date(maintenant - 60_000),
        endDateTime: new Date(maintenant + 60_000),
        delayMinutes: 0,
      },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([creneauEnCours()])
  })

  for (const [nom, appeler] of [
    ['isActiveInTeamSlot', () => isActiveInTeamSlot(7, 42, equipeControleAcces)],
    ['getActiveTeamSlot', () => getActiveTeamSlot(7, 42, equipeControleAcces)],
  ] as const) {
    it(`${nom} exige une candidature ACCEPTED sur cette édition`, async () => {
      await appeler()

      // Le constat ne nommait qu'`isActiveInTeamSlot` ; les deux fonctions avaient le trou, et
      // c'est `getActiveTeamSlot` qui alimente l'écran. Les deux sont donc couvertes.
      const critere = prismaMock.volunteerAssignment.findMany.mock.calls[0][0].where
      expect(critere.user).toEqual({
        volunteerApplications: {
          some: { eventId: 42, status: 'ACCEPTED' },
        },
      })
    })

    it(`${nom} n'abandonne pas le filtre d'équipe en chemin`, async () => {
      await appeler()

      // La garde ajoutée ne doit pas se substituer à celle qui existait : une candidature
      // acceptée sur une équipe de cuisine n'ouvre pas la porte.
      const critere = prismaMock.volunteerAssignment.findMany.mock.calls[0][0].where
      expect(critere.userId).toBe(7)
      expect(critere.timeSlot).toEqual({ eventId: 42, team: equipeControleAcces })
    })
  }

  it('la base ne rendant rien, personne n’est en créneau actif', async () => {
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])

    // C'est ce que produit une candidature refusée maintenant que le filtre est dans le `where` :
    // la requête ne la remonte plus, et le droit tombe.
    expect(await isActiveInTeamSlot(7, 42, equipeControleAcces)).toBe(false)
    expect(await getActiveTeamSlot(7, 42, equipeControleAcces)).toBeNull()
  })

  it('un créneau terminé depuis plus de quinze minutes ne vaut plus', async () => {
    const maintenant = Date.now()
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([
      {
        timeSlot: {
          ...creneauEnCours().timeSlot,
          startDateTime: new Date(maintenant - 3 * 3600_000),
          endDateTime: new Date(maintenant - 2 * 3600_000),
        },
      },
    ])

    // Garde-fou : la tolérance de ±15 minutes ne doit pas devenir une porte ouverte.
    expect(await isActiveInTeamSlot(7, 42, equipeControleAcces)).toBe(false)
  })
})
