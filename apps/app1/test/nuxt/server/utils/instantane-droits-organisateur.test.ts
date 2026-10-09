import { describe, it, expect, beforeEach, vi } from 'vitest'

import { deleteConventionOrganizer } from '../../../../server/utils/organizer-management'
import { CONVENTION_RIGHTS } from '../../../../shared/utils/organizer-rights'

const prismaMock = (globalThis as any).prisma

/** `canEditConvention` à partir de `editConvention`. */
const colonne = (droit: string) => `can${droit[0]!.toUpperCase()}${droit.slice(1)}`

/**
 * L'historique des permissions doit enregistrer les QUINZE droits, pas les sept premiers.
 *
 * ## ⚠️ Le défaut, et pourquoi il répondait faux sans rien signaler
 *
 * Les deux écritures d'historique — `CREATED` et `REMOVED` — énuméraient les droits à la main et
 * s'arrêtaient toutes deux aux **sept premiers** : convention, organisateurs, éditions, bénévoles.
 * Les **huit droits par module** manquaient : artistes, repas, billetterie, tâches, stock,
 * ateliers, FAQ, trésorerie.
 *
 * Retirer quelqu'un qui gérait la billetterie et la trésorerie laissait donc un historique
 * affirmant qu'il n'avait aucun de ces droits — alors que cet historique existe précisément pour
 * répondre à « qui avait accès à quoi, et quand ».
 *
 * 📍 Ce qui rendait le défaut discret : les deux **écritures** de droits, dans le MÊME fichier,
 * portent bien les quinze. Seuls les instantanés étaient courts, et une lecture en diagonale donne
 * l'impression que tout est complet.
 *
 * ## Ce que ce test vérifie, et ce qu'un test plus simple aurait manqué
 *
 * Il ne compte pas les clés : il vérifie que **chaque droit à `true` ressort à `true`**. Un test
 * qui n'aurait regardé que le NOMBRE de clés serait passé au vert sur un instantané complet mais
 * rempli de `false` — exactement ce que produit une lecture de colonne non sélectionnée.
 */
describe('historique des permissions — l’instantané porte les quinze droits', () => {
  /** Un organisateur qui a TOUS les droits : c'est le seul cas qui distingue 7 de 15. */
  const organisateurComplet = {
    id: 2,
    conventionId: 1,
    userId: 42,
    title: 'Responsable général',
    user: { pseudo: 'pierre' },
    ...Object.fromEntries(CONVENTION_RIGHTS.map((d) => [colonne(d), true])),
  }

  const transactionMock = {
    organizerPermissionHistory: { create: vi.fn() },
    conventionOrganizer: { delete: vi.fn() },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // `canManageOrganizers` vit dans le même module : on satisfait sa requête plutôt que de la
    // mocker — l'utilisateur 3 est l'auteur de la convention, ce qui l'autorise.
    prismaMock.convention.findUnique.mockResolvedValue({ authorId: 3, organizers: [] })
    prismaMock.user.findUnique.mockResolvedValue({ id: 3, isGlobalAdmin: false })
    prismaMock.conventionOrganizer.findUnique.mockResolvedValue(organisateurComplet)
    transactionMock.organizerPermissionHistory.create.mockResolvedValue({ id: 1 })
    transactionMock.conventionOrganizer.delete.mockResolvedValue({ id: 2 })
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(transactionMock))
  })

  const retirer = () => deleteConventionOrganizer(1, 2, 3)

  it('la liste de référence porte bien quinze droits', () => {
    // La garde de la garde : si `CONVENTION_RIGHTS` se vidait, les tests ci-dessous passeraient
    // au vert en ne vérifiant rien.
    expect(CONVENTION_RIGHTS.length).toBe(15)
  })

  it('enregistre les quinze droits au retrait, pas seulement les sept premiers', async () => {
    await retirer()

    const { data } = transactionMock.organizerPermissionHistory.create.mock.calls[0]![0]
    expect(data.changeType).toBe('REMOVED')

    const enregistres = Object.keys(data.before.rights)
    expect(enregistres.sort()).toEqual(CONVENTION_RIGHTS.map(colonne).sort())
  })

  it('reporte la VALEUR de chaque droit, et non une coquille de `false`', async () => {
    /*
     * Le cœur du test. Un instantané construit depuis un objet dont les colonnes n'ont pas été
     * sélectionnées aurait les quinze clés — toutes à `false`. Le compte serait juste et la
     * réponse fausse ; c'est le piège d'une lecture orpheline, où `undefined` se lit comme
     * « pas de droit ».
     */
    await retirer()

    const { data } = transactionMock.organizerPermissionHistory.create.mock.calls[0]![0]
    for (const droit of CONVENTION_RIGHTS) {
      expect(data.before.rights[colonne(droit)], `${colonne(droit)} valait true`).toBe(true)
    }
  })

  it('distingue un droit absent d’un droit refusé', async () => {
    // Les huit droits par module à `false`, les sept autres à `true` : l'instantané doit rendre
    // exactement ce partage, et non « tout vrai » ni « tout faux ».
    const partiels = CONVENTION_RIGHTS.slice(0, 7)
    prismaMock.conventionOrganizer.findUnique.mockResolvedValue({
      ...organisateurComplet,
      ...Object.fromEntries(CONVENTION_RIGHTS.map((d) => [colonne(d), partiels.includes(d)])),
    })

    await retirer()

    const { rights } =
      transactionMock.organizerPermissionHistory.create.mock.calls[0]![0].data.before
    for (const droit of CONVENTION_RIGHTS) {
      expect(rights[colonne(droit)], colonne(droit)).toBe(partiels.includes(droit))
    }
  })

  it('historise AVANT de supprimer la ligne', async () => {
    // L'ordre n'est pas cosmétique : la suppression emporte la ligne dont l'instantané est tiré.
    await retirer()

    const ordreHistorique =
      transactionMock.organizerPermissionHistory.create.mock.invocationCallOrder[0]!
    const ordreSuppression = transactionMock.conventionOrganizer.delete.mock.invocationCallOrder[0]!
    expect(ordreHistorique).toBeLessThan(ordreSuppression)
  })
})
