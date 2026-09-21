import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createPaginatedResponse: (items: unknown[], total: number) => ({
    success: true,
    data: items,
    pagination: { total },
  }),
  createSuccessResponse: (data: unknown) => ({ success: true, data }),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
  validatePagination: () => ({ page: 1 }),
}))

const mockPeutGerer = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/organizer-management', () => ({
  canManageEditionVolunteers: mockPeutGerer,
}))

vi.mock('#server/utils/infos-personnelles', () => ({
  infosPersonnelles: (app: any) => app,
  infosPersonnellesSelect: {},
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ eventScope: { getRelatedEventIds: async () => [1] } }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/applications.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '1' }, user: { id: 10 } } }

/**
 * Ce que l'export attend du point d'API.
 *
 * Il rendait lui-même le CSV, avec vingt-six en-têtes et toutes ses valeurs figées en français —
 * sur un site traduit en treize langues. Le fichier s'écrit désormais dans le navigateur, qui a
 * `t()` ; ce qui se vérifie ici est donc ce qui RESTE la responsabilité du serveur, et c'est le
 * point qui justifiait qu'il s'en mêle : **l'export ignore la pagination**. La liste n'affiche
 * qu'une page ; le fichier doit porter tout ce que les filtres laissent passer.
 *
 * Les propriétés du CSV lui-même — marque d'ordre des octets, échappement, injection de formule —
 * sont éprouvées là où le fichier s'écrit maintenant : `export-candidatures` et `csv`.
 */
describe("GET .../volunteers/applications — l'export", () => {
  const candidature = (id: number, prenom = 'Alice') => ({
    id,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    status: 'ACCEPTED',
    motivation: 'Bonjour',
    user: { pseudo: 'alice', prenom, nom: 'Martin', email: 'a@x.fr', phone: '+33612345678' },
    teamPreferences: [],
    timePreferences: [],
    assignedTeams: [],
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockPeutGerer.mockResolvedValue(true)
    prismaMock.event.findUnique.mockResolvedValue({ id: 1 })
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([candidature(1)])
    prismaMock.editionVolunteerApplication.count.mockResolvedValue(1)
    global.getQuery = vi.fn(() => ({ export: 'true' }))
    global.setHeader = vi.fn()
  })

  it("refuse l'export sans droits", async () => {
    mockPeutGerer.mockResolvedValue(false)
    await expect(handler(evenement as any)).rejects.toThrow(/Droits insuffisants/)
  })

  it('rend les candidatures, et non un fichier', async () => {
    const reponse: any = await handler(evenement as any)
    expect(typeof reponse).not.toBe('string')
    expect(reponse.data.applications).toHaveLength(1)
    expect(reponse.data.applications[0].user.pseudo).toBe('alice')
  })

  it('n’annonce plus une pièce jointe : le navigateur nomme le fichier', async () => {
    await handler(evenement as any)
    expect(global.setHeader).not.toHaveBeenCalled()
  })

  it('NE PAGINE PAS : c’est la raison d’être du passage par le serveur', async () => {
    // La liste montre une page ; le fichier doit porter tout ce que les filtres laissent passer.
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue(
      Array.from({ length: 120 }, (_, i) => candidature(i + 1))
    )
    const reponse: any = await handler(evenement as any)
    expect(reponse.data.applications).toHaveLength(120)
  })

  it('ne demande ni `skip` ni `take` à la base quand on exporte', async () => {
    // La pagination doit être absente de la REQUÊTE, pas seulement du résultat : la retirer après
    // coup ramènerait quand même une seule page depuis la base.
    await handler(evenement as any)
    const requete = prismaMock.editionVolunteerApplication.findMany.mock.calls[0]?.[0]
    expect(requete).not.toHaveProperty('skip')
    expect(requete).not.toHaveProperty('take')
  })

  it('pagine en revanche la liste ordinaire', async () => {
    // Le témoin négatif : sans lui, un point d'API qui ne paginerait jamais passerait aussi.
    global.getQuery = vi.fn(() => ({}))
    await handler(evenement as any)
    const requete = prismaMock.editionVolunteerApplication.findMany.mock.calls[0]?.[0]
    expect(requete).toHaveProperty('take')
  })
})
