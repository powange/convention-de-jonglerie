import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanAccessStock = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
}))

vi.mock('#server/utils/stock-helpers', () => ({
  canAccessStock: mockCanAccessStock,
  stockItemLocationInclude: {},
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../../../layers/stock/server/api/editions/[id]/stock-groups/index.get'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

describe('GET /api/editions/[id]/stock-groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanAccessStock.mockResolvedValue(true)
    prismaMock.stockGroup.findMany.mockReset()
    prismaMock.stockGroup.findMany.mockResolvedValue([])
  })

  it('retourne la liste des groupes avec items', async () => {
    prismaMock.stockGroup.findMany.mockResolvedValue([
      { id: 1, name: 'Éclairage', items: [{ id: 10, _count: { reservations: 2 } }] },
    ])
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(result.data.groups).toHaveLength(1)
    expect(prismaMock.stockGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: 1 },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      })
    )
  })

  it('rejette 404 si édition introuvable', async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('rejette 403 sans canAccessStock', async () => {
    mockCanAccessStock.mockResolvedValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it('🔬 demande le PRÉNOM et le NOM du responsable, pas seulement son pseudo', async () => {
    /*
     * ⚠️ IL NE DEMANDAIT QUE LE PSEUDO (`userWithProfileAndGravatarSelect`), et l'écran ne pouvait
     * donc afficher que lui — « difficile de différencier qui est qui quand on ne connaît pas tout
     * le monde sur l'événement », demande de l'utilisateur.
     *
     * 🔬 ON MESURE LA FORME DU `select`, et c'est la SEULE assertion qui mord ici : le mock de
     * Prisma l'ignore, donc un test qui lirait les personnes rendues resterait vert avec l'ancien
     * helper — c'est le mock qui décide des champs présents, pas la requête.
     *
     * 📍 Et un helper DÉDIÉ, pas l'ancien enrichi : `userWithProfileAndGravatarSelect` est employé
     * par une vingtaine de fichiers, le covoiturage surtout. Y ajouter prénom et nom aurait exposé
     * l'état civil sur des écrans où personne ne l'a demandé.
     */
    await handler(baseEvent as any)

    const call = prismaMock.stockGroup.findMany.mock.calls[0][0]
    for (const champ of ['pickupResponsible', 'returnResponsible'] as const) {
      const select = call.include.items.include[champ].select
      expect(select.prenom, `${champ}.prenom`).toBe(true)
      expect(select.nom, `${champ}.nom`).toBe(true)
      // L'avatar reste demandé : la liste montre le visage devant le nom.
      expect(select.pseudo, `${champ}.pseudo`).toBe(true)
      expect(select.profilePicture, `${champ}.profilePicture`).toBe(true)
    }
  })

  it('inclut les RESERVED non terminées ET les PICKED_UP avec leur emplacement', async () => {
    await handler(baseEvent as any)
    const call = prismaMock.stockGroup.findMany.mock.calls[0][0]
    const resInclude = call.include.items.include.reservations
    expect(resInclude.where.OR).toEqual([
      expect.objectContaining({ status: 'RESERVED', endsAt: { gt: expect.any(Date) } }),
      { status: 'PICKED_UP' },
    ])
    expect(resInclude.orderBy).toEqual({ startsAt: 'asc' })
    // Borne raisonnable pour éviter le sur-fetch sur des items avec un
    // long historique de PICKED_UP, tout en couvrant la colonne "Emplacement
    // actuel" et l'aperçu "prochaine réservation".
    expect(resInclude.take).toBe(20)
    expect(resInclude.select).toMatchObject({
      location: true,
      zone: expect.any(Object),
      marker: expect.any(Object),
    })
    // user.pseudo retiré du select (non utilisé côté UI)
    expect(resInclude.select).not.toHaveProperty('user')
  })
})
