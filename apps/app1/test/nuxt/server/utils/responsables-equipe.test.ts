import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  equipesDontIlEstResponsable,
  utilisateursResponsablesDeLEquipe,
} from '../../../../server/utils/editions/volunteers/responsables-equipe'

/**
 * Le statut de responsable d'équipe n'est pas qu'une étiquette : plusieurs endpoints
 * l'acceptent en lieu et place du droit « gestion des bénévoles ». Il vivait dans la seule
 * table des candidatures, si bien qu'un organisateur nommé responsable n'en obtenait rien.
 *
 * Ces deux fonctions sont le point de passage unique. Sept endroits les appellent : une requête
 * qui repartirait sur `applicationTeamAssignment` seul rouvrirait l'angle mort sans que rien ne
 * le signale.
 */

const prismaMock = (globalThis as any).prisma

describe('equipesDontIlEstResponsable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([{ teamId: 'accueil' }])
    prismaMock.organizerTeamAssignment.findMany.mockResolvedValue([{ teamId: 'bar' }])
  })

  it('réunit les équipes dirigées comme bénévole et comme organisateur', async () => {
    await expect(equipesDontIlEstResponsable(22, 1)).resolves.toEqual(['accueil', 'bar'])
  })

  it('ne compte qu’une fois une équipe dirigée aux deux titres', async () => {
    // Une même personne peut être bénévole acceptée et organisatrice de l'édition.
    prismaMock.organizerTeamAssignment.findMany.mockResolvedValue([{ teamId: 'accueil' }])

    await expect(equipesDontIlEstResponsable(22, 1)).resolves.toEqual(['accueil'])
  })

  it('rend une liste vide quand la personne ne dirige rien', async () => {
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([])
    prismaMock.organizerTeamAssignment.findMany.mockResolvedValue([])

    await expect(equipesDontIlEstResponsable(22, 1)).resolves.toEqual([])
  })

  it("n'accepte du côté bénévole que les candidatures acceptées", async () => {
    // Une candidature refusée ou en attente ne donne aucun droit, responsable ou non.
    await equipesDontIlEstResponsable(22, 1)

    expect(prismaMock.applicationTeamAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isLeader: true,
          application: { userId: 1, eventId: 22, status: 'ACCEPTED' },
        }),
      })
    )
  })

  it('ne lit du côté organisateur que les rattachements de cette édition', async () => {
    // Sans ce cloisonnement, diriger une équipe ailleurs ouvrirait des droits ici.
    await equipesDontIlEstResponsable(22, 1)

    expect(prismaMock.organizerTeamAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isLeader: true,
          team: { eventId: 22 },
          editionOrganizer: { editionId: 22, organizer: { userId: 1 } },
        }),
      })
    )
  })

  it('interroge la transaction quand on lui en passe une', async () => {
    // Sans ça, la lecture manquerait les lignes que la transaction vient d'écrire.
    const tx = {
      applicationTeamAssignment: { findMany: vi.fn().mockResolvedValue([]) },
      organizerTeamAssignment: { findMany: vi.fn().mockResolvedValue([{ teamId: 'cuisine' }]) },
    }

    await expect(equipesDontIlEstResponsable(22, 1, tx as never)).resolves.toEqual(['cuisine'])
    expect(prismaMock.organizerTeamAssignment.findMany).not.toHaveBeenCalled()
  })
})

describe('utilisateursResponsablesDeLEquipe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      { application: { userId: 10 } },
    ])
    prismaMock.organizerTeamAssignment.findMany.mockResolvedValue([
      { editionOrganizer: { organizer: { userId: 20 } } },
    ])
  })

  it('réunit les responsables des deux tables', async () => {
    await expect(utilisateursResponsablesDeLEquipe(22, 'accueil')).resolves.toEqual([10, 20])
  })

  it('ne rend qu’une fois quelqu’un responsable aux deux titres', async () => {
    prismaMock.organizerTeamAssignment.findMany.mockResolvedValue([
      { editionOrganizer: { organizer: { userId: 10 } } },
    ])

    await expect(utilisateursResponsablesDeLEquipe(22, 'accueil')).resolves.toEqual([10])
  })

  it('rend une liste vide pour une équipe sans responsable', async () => {
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([])
    prismaMock.organizerTeamAssignment.findMany.mockResolvedValue([])

    await expect(utilisateursResponsablesDeLEquipe(22, 'accueil')).resolves.toEqual([])
  })
})
