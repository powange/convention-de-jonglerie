import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resoudreLesValidateurs } from '../../../../server/utils/ticketing/nom-du-validateur'

/**
 * La règle « qui a validé cette entrée », désormais écrite une fois.
 *
 * Elle l'était neuf fois, sous trois formes, et elle a produit le même défaut deux fois : la
 * branche billet de `verify` ne renvoyait pas l'auteur (constat B2), puis celle de `search` non
 * plus. Ces tests couvrent ce que les neuf copies faisaient différemment — le nombre de requêtes,
 * le traitement des identifiants absents, et le cas d'un compte disparu.
 */
const chercherDesUtilisateurs = vi.fn()

vi.stubGlobal('prisma', { user: { findMany: chercherDesUtilisateurs } })

describe('resoudreLesValidateurs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chercherDesUtilisateurs.mockResolvedValue([
      { id: 77, prenom: 'Grace', nom: 'Hopper' },
      { id: 78, prenom: 'Alan', nom: 'Turing' },
    ])
  })

  it('rend le nom sous la forme que les quatre populations sérialisent', async () => {
    const nom = await resoudreLesValidateurs([77])

    expect(nom(77)).toEqual({ firstName: 'Grace', lastName: 'Hopper' })
  })

  it('ne fait QU’UNE requête, quel que soit le nombre de personnes', async () => {
    // Une commande peut porter dix billets validés par des personnes différentes : c'est
    // exactement le cas où les trois `findUnique` de `verify` coûtaient dix allers-retours.
    const nom = await resoudreLesValidateurs([77, 78, 77, 78, 77, null, 78])

    expect(chercherDesUtilisateurs).toHaveBeenCalledTimes(1)
    expect(chercherDesUtilisateurs.mock.calls[0][0].where.id.in.sort()).toEqual([77, 78])
    expect(nom(78)).toEqual({ firstName: 'Alan', lastName: 'Turing' })
  })

  it("n'interroge pas la base quand personne n'a validé", async () => {
    const nom = await resoudreLesValidateurs([null, undefined])

    // Le cas le plus fréquent à la porte : une file d'entrées pas encore validées. Une requête
    // avec une liste vide serait un aller-retour pour rien, répété à chaque scan.
    expect(chercherDesUtilisateurs).not.toHaveBeenCalled()
    expect(nom(null)).toBeNull()
  })

  it('rend null pour un identifiant absent comme pour un compte disparu', async () => {
    chercherDesUtilisateurs.mockResolvedValue([])

    const nom = await resoudreLesValidateurs([99])

    // Un compte supprimé et une entrée jamais validée se disent de la même façon : rien ne doit
    // faire échouer l'affichage d'une fiche parce que l'auteur n'existe plus.
    expect(nom(99)).toBeNull()
    expect(nom(null)).toBeNull()
    expect(nom(undefined)).toBeNull()
  })

  it('ne demande que le prénom et le nom', async () => {
    await resoudreLesValidateurs([77])

    // La dixième lecture, dans `recent-validations.get.ts`, charge sept colonnes pour une
    // vignette. L'y ramener ferait payer ce coût aux neuf appelants qui veulent une étiquette.
    expect(chercherDesUtilisateurs.mock.calls[0][0].select).toEqual({
      id: true,
      prenom: true,
      nom: true,
    })
  })
})
