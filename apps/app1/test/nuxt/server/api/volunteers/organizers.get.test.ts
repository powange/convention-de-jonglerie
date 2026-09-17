import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

const mockPeutGererBenevoles = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/organizer-management', () => ({
  canManageEditionVolunteers: mockPeutGererBenevoles,
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/organizers.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 42 } } }

const organisateur = (
  id: number,
  prenom: string | null,
  nom: string | null,
  pseudo: string | null,
  equipes: Array<{ id: string; name: string; isLeader?: boolean }> = []
) => ({
  id,
  organizer: { user: { id: id * 10, pseudo, prenom, nom } },
  teamAssignments: equipes.map((equipe) => ({
    isLeader: equipe.isLeader ?? false,
    team: { id: equipe.id, name: equipe.name, color: '#123456' },
  })),
})

/**
 * Les organisateurs d'une édition, rendus au gestionnaire des BÉNÉVOLES.
 *
 * Rattacher un organisateur à une équipe est une décision de bénévolat — l'écriture l'exige
 * depuis toujours — mais le seul écran qui l'offrait vivait sur la page des organisateurs,
 * fermée à ce droit. Ce point d'API existe pour que l'écran puisse déménager là où la décision
 * se prend.
 */
describe('GET /api/editions/[id]/volunteers/organizers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPeutGererBenevoles.mockResolvedValue(true)
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
  })

  it('exige le droit de gérer les BÉNÉVOLES, et non celui des organisateurs', async () => {
    mockPeutGererBenevoles.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.editionOrganizer.findMany).not.toHaveBeenCalled()
  })

  it('rend chaque organisateur avec ses équipes', async () => {
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      organisateur(1, 'Claire', 'Bernard', 'clairb', [
        { id: 'bar', name: 'Bar', isLeader: true },
        { id: 'accueil', name: 'Accueil' },
      ]),
    ])

    const resultat = await handler(evenement as any)

    expect(resultat).toHaveLength(1)
    expect(resultat[0].teams).toEqual([
      { id: 'bar', name: 'Bar', color: '#123456', isLeader: true },
      { id: 'accueil', name: 'Accueil', color: '#123456', isLeader: false },
    ])
  })

  it('ne rend NI adresse, NI téléphone, NI droit', async () => {
    // La sélection est la garde : un droit de bénévolat ne doit pas devenir une fenêtre sur les
    // données personnelles des organisateurs. Assertion sur la réponse entière, pour attraper un
    // champ qu'on ajouterait un jour sans y penser.
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      organisateur(1, 'Claire', 'Bernard', 'clairb'),
    ])

    const serialise = JSON.stringify(await handler(evenement as any))

    for (const interdit of ['email', 'phone', 'canManage', 'rights']) {
      expect(serialise).not.toContain(interdit)
    }
  })

  it('ne demande à la base que ce qu’il rend', async () => {
    // C'est la REQUÊTE qu'il faut tenir : un mock rendrait de toute façon ce qu'on lui dit, et
    // une sélection trop large ferait transiter des données que la réponse ne montre pas.
    await handler(evenement as any)

    const appel = prismaMock.editionOrganizer.findMany.mock.calls[0][0]
    expect(appel.where).toEqual({ editionId: 22 })
    expect(appel.select.organizer.select.user.select).toEqual({
      id: true,
      pseudo: true,
      prenom: true,
      nom: true,
    })
  })

  it('trie par le nom tel qu’il est affiché', async () => {
    // L'écran affiche « prénom nom », ou le pseudo à défaut : trier autrement donnerait une liste
    // qui paraît désordonnée à celui qui la lit.
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      organisateur(1, 'Zoé', 'Alard', 'zoe'),
      organisateur(2, null, null, 'amandine'),
      organisateur(3, 'Marc', 'Blin', 'marcb'),
    ])

    const noms = (await handler(evenement as any)).map(
      (o: any) => [o.user.prenom, o.user.nom].filter(Boolean).join(' ') || o.user.pseudo
    )

    expect(noms).toEqual(['amandine', 'Marc Blin', 'Zoé Alard'])
  })
})
