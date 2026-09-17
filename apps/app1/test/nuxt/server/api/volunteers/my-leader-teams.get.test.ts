import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
}))

const mockEquipesResponsable = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/editions/volunteers/responsables-equipe', () => ({
  equipesDontIlEstResponsable: mockEquipesResponsable,
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/my-leader-teams.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 42 } } }

/**
 * Ce point d'API a renvoyé un 500 en production pendant tout le temps où personne ne l'appelait.
 *
 * Il demandait à Prisma un compteur sur `assignments`, relation qui n'existe pas : le schéma la
 * nomme `assignedApplications`. Prisma refuse alors la requête ENTIÈRE — ce n'est pas un compteur
 * qui manque, c'est la page des bénévoles qui perd sa liste d'équipes.
 *
 * Rien ne pouvait le voir : ni le lint, ni le typage (le `select` d'un `_count` se rédige librement),
 * ni la CI, faute d'appelant. Le défaut s'est réveillé le jour où l'écran s'est mis à l'appeler,
 * et il s'est tu aussitôt — la page attrape l'erreur et traite le responsable comme un simple
 * bénévole, sans rien afficher.
 *
 * D'où le deuxième test : il ne regarde pas ce que le mock rend, il confronte les relations
 * demandées à celles que le schéma déclare.
 */
describe('GET /api/editions/[id]/volunteers/my-leader-teams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEquipesResponsable.mockResolvedValue(['accueil'])
    prismaMock.volunteerTeam.findMany.mockResolvedValue([
      { id: 'accueil', name: 'Accueil', _count: { assignedApplications: 3 } },
    ])
    prismaMock.organizerTeamAssignment.groupBy.mockResolvedValue([
      { teamId: 'accueil', _count: { teamId: 2 } },
    ])
  })

  it("n'interroge pas la base quand la personne n'est responsable de rien", async () => {
    mockEquipesResponsable.mockResolvedValue([])

    await expect(handler(evenement as any)).resolves.toEqual([])
    expect(prismaMock.volunteerTeam.findMany).not.toHaveBeenCalled()
  })

  it('ne compte que sur des relations que le schéma déclare vraiment', async () => {
    await handler(evenement as any)

    const requete = prismaMock.volunteerTeam.findMany.mock.calls[0][0]
    const comptees = Object.keys(requete.select._count.select)
    expect(comptees.length).toBeGreaterThan(0)

    // Les relations de `VolunteerTeam`, lues dans le schéma : « nom Type[] », liste ou non.
    // Tout le dossier, et non `volunteer.prisma` nommé en dur : le schéma est découpé en
    // fichiers, et déplacer un modèle de l'un à l'autre ne doit pas casser ce test sur un ENOENT.
    // Résolu depuis la racine du projet Vitest (`apps/app1`) : dans l'environnement Nuxt,
    // `import.meta.url` n'est pas une URL de fichier.
    const dossier = resolve(process.cwd(), 'prisma/schema')
    const schema = readdirSync(dossier)
      .filter((nom) => nom.endsWith('.prisma'))
      .map((nom) => readFileSync(resolve(dossier, nom), 'utf-8'))
      .join('\n')
    const modele = schema.match(/^model VolunteerTeam \{$([\s\S]*?)^\}$/m)?.[1] ?? ''
    const relations = [...modele.matchAll(/^\s{2}(\w+)\s+\w+\[\]/gm)].map(
      (correspondance) => correspondance[1]
    )
    expect(relations).toContain('assignedApplications')

    for (const relation of comptees) expect(relations).toContain(relation)
  })

  it("additionne les bénévoles acceptés et les organisateurs dans l'effectif", async () => {
    const [equipe] = await handler(evenement as any)

    expect(equipe.assignedVolunteersCount).toBe(3)
    expect(equipe.assignedOrganizersCount).toBe(2)
  })

  it('ne compte que les candidatures ACCEPTÉES', async () => {
    // C'est la REQUÊTE qui porte la règle : le mock rendrait de toute façon ce qu'on lui dit.
    await handler(evenement as any)

    const requete = prismaMock.volunteerTeam.findMany.mock.calls[0][0]
    expect(requete.select._count.select.assignedApplications.where).toEqual({
      application: { status: 'ACCEPTED' },
    })
  })
})
