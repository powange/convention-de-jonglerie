import { describe, it, expect, beforeEach, vi } from 'vitest'

import { updateOrganizerRights } from '../../../../server/utils/organizer-management'

const prismaMock = (globalThis as any).prisma

/**
 * Quand les permissions par édition d'un organisateur sont remplacées — et quand elles ne le sont pas.
 *
 * `updateOrganizerRights` SUPPRIME toutes les `EditionOrganizerPermission` de l'organisateur avant
 * de les recréer depuis le tableau reçu. C'est voulu : c'est ainsi qu'on retire un droit. Mais la
 * garde qui protège ce geste — ne rien remplacer si le tableau n'est pas fourni — se joue sur
 * `if (perEdition)`, et `[]` est VRAI en JavaScript. « Mes conventions » envoyait
 * `perEdition: … || []` : la garde ne jouait donc jamais, et un enregistrement portant seulement un
 * titre effaçait tout.
 *
 * Ces tests fixent les trois cas, parce que la nuance entre « absent », « vide » et « fourni » est
 * exactement ce qui a coûté des droits à des organisateurs.
 */
describe('updateOrganizerRights — remplacement des permissions par édition', () => {
  const transactionMock = {
    conventionOrganizer: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    editionOrganizerPermission: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  }

  const appel = (perEdition?: unknown) =>
    updateOrganizerRights({
      conventionId: 1,
      organizerId: 2,
      userId: 3,
      title: 'Responsable',
      perEdition: perEdition as never,
    })

  beforeEach(() => {
    vi.clearAllMocks()
    /*
     * `canManageOrganizers` vit dans le MÊME module que la fonction testée : la mocker depuis
     * l'extérieur n'a aucun effet. On satisfait donc sa requête — l'utilisateur 3 est l'auteur de la
     * convention, ce qui suffit à l'autoriser.
     */
    prismaMock.convention.findUnique.mockResolvedValue({ authorId: 3, organizers: [] })
    prismaMock.conventionOrganizer.findUnique.mockResolvedValue({ id: 2, conventionId: 1 })
    transactionMock.conventionOrganizer.update.mockResolvedValue({ id: 2 })
    transactionMock.conventionOrganizer.findUnique.mockResolvedValue({ id: 2 })
    transactionMock.editionOrganizerPermission.deleteMany.mockResolvedValue({ count: 0 })
    transactionMock.editionOrganizerPermission.createMany.mockResolvedValue({ count: 0 })
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(transactionMock))
  })

  it('ne touche PAS aux permissions quand `perEdition` n’est pas fourni', async () => {
    // Le cas d'un enregistrement qui ne change que le titre : il ne doit rien coûter à personne.
    await appel(undefined)

    expect(transactionMock.editionOrganizerPermission.deleteMany).not.toHaveBeenCalled()
    expect(transactionMock.editionOrganizerPermission.createMany).not.toHaveBeenCalled()
  })

  it('efface tout quand `perEdition` est un tableau VIDE', async () => {
    /*
     * Ce comportement est conservé, et il est correct : un tableau vide dit « plus aucun droit par
     * édition ». C'est l'appelant qui avait tort de l'envoyer par défaut — « Mes conventions » ne le
     * fait plus. Le fixer ici évite de croire que la garde protège de ce cas.
     */
    await appel([])

    expect(transactionMock.editionOrganizerPermission.deleteMany).toHaveBeenCalledWith({
      where: { organizerId: 2 },
    })
    expect(transactionMock.editionOrganizerPermission.createMany).not.toHaveBeenCalled()
  })

  it('recrée les droits fournis, les onze compris', async () => {
    await appel([
      {
        editionId: 42,
        canEdit: true,
        canManageTicketing: true,
        canManageTreasury: true,
      },
    ])

    expect(transactionMock.editionOrganizerPermission.deleteMany).toHaveBeenCalled()
    const appelCreation = transactionMock.editionOrganizerPermission.createMany.mock.calls[0]
    expect(appelCreation, 'createMany n’a pas été appelé').toBeDefined()
    const donnees = appelCreation![0].data[0]
    expect(donnees).toMatchObject({
      organizerId: 2,
      editionId: 42,
      canEdit: true,
      canManageTicketing: true,
      canManageTreasury: true,
      // Les droits non fournis descendent à `false` : c'est le sens de « voici la liste complète ».
      canManageMeals: false,
    })
  })

  it('écarte une entrée qui n’accorde rien', async () => {
    // Sans ce filtre, une ligne de permission vide serait créée pour chaque édition affichée.
    await appel([{ editionId: 42 }])

    expect(transactionMock.editionOrganizerPermission.deleteMany).toHaveBeenCalled()
    expect(transactionMock.editionOrganizerPermission.createMany).not.toHaveBeenCalled()
  })
})
