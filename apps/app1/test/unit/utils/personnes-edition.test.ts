import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  assertResponsablesDeLEdition,
  attachesALEdition,
  LIMITE_RESULTATS,
} from '../../../server/utils/personnes-edition'

/**
 * C'est une règle de confidentialité, pas un détail de requête : elle décide qui la recherche par
 * pseudo peut révéler. L'élargir d'une ligne ouvrirait l'annuaire des comptes à qui gère un stock,
 * et rien à l'écran ne le montrerait.
 *
 * Le filtre est éprouvé sur sa forme, faute de pouvoir l'être sur la base : les tests d'intégration
 * ne tournent pas ici, et cette règle ne doit pas attendre pour autant.
 */
const EDITION = 22
const CONVENTION = 7

const attaches = () => attachesALEdition(EDITION, CONVENTION) ?? []

describe('attachesALEdition', () => {
  it('retient les quatre façons d’être de l’édition', () => {
    // Aucune ne suffit seule : l'auteur de la convention et le créateur de l'édition ne figurent
    // pas toujours parmi les organisateurs, et un bénévole n'y figure jamais.
    expect(attaches()).toHaveLength(4)
  })

  it('retient les organisateurs de la convention', () => {
    expect(attaches()).toContainEqual({ organizations: { some: { conventionId: CONVENTION } } })
  })

  it('ne retient que les bénévoles acceptés', () => {
    // Une candidature en attente n'est pas une venue décidée : proposer ces personnes reviendrait
    // à leur confier du matériel avant même de savoir si elles seront là.
    expect(attaches()).toContainEqual({
      volunteerApplications: { some: { eventId: EDITION, status: 'ACCEPTED' } },
    })
  })

  it('retient le créateur de l’édition et l’auteur de la convention', () => {
    expect(attaches()).toContainEqual({ createdEditions: { some: { id: EDITION } } })
    expect(attaches()).toContainEqual({ createdConventions: { some: { id: CONVENTION } } })
  })

  it('vise bien l’édition et la convention demandées', () => {
    // Une inversion des deux identifiants passerait inaperçue à l'écran : la liste serait
    // simplement vide, ou pire, celle d'une autre édition.
    const autre = attachesALEdition(1, 2) ?? []

    expect(autre).toContainEqual({ createdEditions: { some: { id: 1 } } })
    expect(autre).toContainEqual({ createdConventions: { some: { id: 2 } } })
  })
})

describe('LIMITE_RESULTATS', () => {
  it('borne la liste proposée', () => {
    // Sans borne, un pseudo courant déroulait toute l'édition dans un menu déroulant.
    expect(LIMITE_RESULTATS).toBeGreaterThan(0)
    expect(LIMITE_RESULTATS).toBeLessThanOrEqual(50)
  })
})

/**
 * Le garde-fou qui referme le constat S1 : sans lui, le champ « qui s'en occupe » acceptait
 * n'importe quel identifiant de compte, et la fiche renvoyait ensuite le pseudo et l'avatar de la
 * personne — de quoi parcourir l'annuaire en balayant les identifiants.
 */
describe('assertResponsablesDeLEdition', () => {
  const findMany = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('prisma', { user: { findMany } })
    vi.stubGlobal('createError', (options: { status: number; message: string }) => {
      const erreur = new Error(options.message) as Error & { status: number }
      erreur.status = options.status
      return erreur
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('laisse passer un responsable de l’édition', async () => {
    findMany.mockResolvedValue([{ id: 12 }])

    await expect(assertResponsablesDeLEdition(EDITION, CONVENTION, [12])).resolves.toBeUndefined()
  })

  it('refuse un compte étranger à l’édition', async () => {
    // Le cas du constat S1 : un identifiant pris au hasard, qui existe mais n'a rien à voir.
    findMany.mockResolvedValue([])

    await expect(assertResponsablesDeLEdition(EDITION, CONVENTION, [9999])).rejects.toThrow(
      /ne fait pas partie/
    )
  })

  it('refuse dès qu’un seul des deux est étranger', async () => {
    // Récupération et retour partent ensemble : accepter la moitié écrirait quand même l'autre.
    findMany.mockResolvedValue([{ id: 12 }])

    await expect(assertResponsablesDeLEdition(EDITION, CONVENTION, [12, 9999])).rejects.toThrow(
      /ne fait pas partie/
    )
  })

  it('cherche bien dans le périmètre de l’édition', async () => {
    findMany.mockResolvedValue([{ id: 12 }])
    await assertResponsablesDeLEdition(EDITION, CONVENTION, [12])

    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: [12] }, OR: attachesALEdition(EDITION, CONVENTION) },
      select: { id: true },
    })
  })

  it('n’interroge pas la base quand il n’y a personne à vérifier', async () => {
    // Le cas courant : une modification qui ne touche pas au responsable. `null` veut dire
    // « retirer », ce qui n'a personne à valider.
    await assertResponsablesDeLEdition(EDITION, CONVENTION, [undefined, null])

    expect(findMany).not.toHaveBeenCalled()
  })

  it('ne compte qu’une fois la même personne des deux côtés', async () => {
    // Confier la récupération et le retour à la même personne est courant : la base ne rendra
    // qu'une ligne, et un décompte naïf y verrait un intrus.
    findMany.mockResolvedValue([{ id: 12 }])

    await expect(
      assertResponsablesDeLEdition(EDITION, CONVENTION, [12, 12])
    ).resolves.toBeUndefined()
  })
})
