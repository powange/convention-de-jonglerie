import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le mock doit précéder l'import du handler.
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canEditEditionById: vi.fn(),
}))

import { canEditEditionById } from '#server/utils/permissions/edition-permissions'

import handler from '../../../../../../../layers/lost-found/server/api/editions/[id]/lost-found/[itemId]/index.delete'

/**
 * Suppression d'un objet trouvé.
 *
 * Le module permettait de créer, commenter et marquer restitué — jamais de supprimer. Une entrée
 * déposée par erreur restait affichée indéfiniment, sans recours pour personne.
 *
 * Deux profils y ont droit, et le second n'est pas redondant : l'auteur retire sa propre erreur,
 * mais s'il a quitté l'équipe entre-temps son objet deviendrait indélébile — d'où les
 * organisateurs. Le test qui compte est celui du tiers : ni auteur, ni organisateur.
 */

const prismaMock = (globalThis as any).prisma
const mockCanEdit = canEditEditionById as ReturnType<typeof vi.fn>

const AUTEUR = 7
const ORGANISATEUR = 8
const TIERS = 9

const evenement = (userId: number) => ({
  context: { params: { id: '1', itemId: '42' }, user: { id: userId } },
})

const appeler = (userId: number) => (handler as any)(evenement(userId))

describe('DELETE objet trouvé', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.lostFoundItem.findFirst.mockResolvedValue({ id: 42, userId: AUTEUR })
    prismaMock.lostFoundItem.delete.mockResolvedValue({ id: 42 })
    mockCanEdit.mockResolvedValue(false)
  })

  it("laisse l'auteur retirer son propre objet", async () => {
    await expect(appeler(AUTEUR)).resolves.toBeTruthy()

    expect(prismaMock.lostFoundItem.delete).toHaveBeenCalledWith({ where: { id: 42 } })
    // L'auteur ne doit pas coûter une vérification de permissions.
    expect(mockCanEdit).not.toHaveBeenCalled()
  })

  it('laisse un organisateur supprimer l’objet de quelqu’un d’autre', async () => {
    mockCanEdit.mockResolvedValue(true)

    await expect(appeler(ORGANISATEUR)).resolves.toBeTruthy()
    expect(prismaMock.lostFoundItem.delete).toHaveBeenCalled()
  })

  it('refuse un tiers, et ne supprime rien', async () => {
    await expect(appeler(TIERS)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.lostFoundItem.delete).not.toHaveBeenCalled()
  })

  it("refuse un objet qui n'appartient pas à l'édition, sans consulter les permissions", async () => {
    // `findFirst` filtre sur (id, editionId) : viser l'objet d'une autre édition ne rend rien.
    prismaMock.lostFoundItem.findFirst.mockResolvedValue(null)

    await expect(appeler(AUTEUR)).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.lostFoundItem.delete).not.toHaveBeenCalled()
    expect(mockCanEdit).not.toHaveBeenCalled()
  })
})
