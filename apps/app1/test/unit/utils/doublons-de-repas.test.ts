import { describe, it, expect } from 'vitest'

import {
  droitsDeLaSource,
  personnesEnDoublon,
  type DroitAuRepas,
} from '../../../../../layers/meals/server/utils/doublons-de-repas'

/** Un droit, écrit court : seuls la source, le repas et la personne comptent pour le regroupement. */
const droit = (
  source: DroitAuRepas['source'],
  mealId: number,
  userId: number,
  reste: Partial<DroitAuRepas> = {}
): DroitAuRepas => ({
  source,
  mealId,
  userId,
  roleId: reste.roleId ?? 100 + userId,
  selectionId: reste.selectionId ?? (source === 'organizer' ? null : 1000 + mealId),
})

describe('doublons de repas : qui mange deux fois', () => {
  it('ignore une personne qui ne touche chaque repas qu’à un seul titre', () => {
    const droits = [droit('volunteer', 1, 7), droit('volunteer', 2, 7)]

    expect(personnesEnDoublon(droits, [1, 2])).toEqual([])
  })

  it('retient un repas ouvert par deux titres différents', () => {
    const droits = [droit('volunteer', 1, 7), droit('organizer', 1, 7)]

    const personnes = personnesEnDoublon(droits, [1])

    expect(personnes).toHaveLength(1)
    expect(personnes[0]!.userId).toBe(7)
    expect(personnes[0]!.repas).toHaveLength(1)
    expect(personnes[0]!.repas[0]!.droits.map((d) => d.source)).toEqual(['organizer', 'volunteer'])
  })

  /**
   * Le cœur de la règle : le doublon se joue sur UN repas, pas sur un cumul de rôles.
   *
   * Quelqu'un peut être bénévole le vendredi et artiste le samedi sans jamais manger deux fois.
   * Regrouper par personne seulement le ferait apparaître ici, et on irait retirer un repas
   * auquel il a droit une seule fois.
   */
  it('ne retient pas deux titres portant sur des repas différents', () => {
    const droits = [droit('volunteer', 1, 7), droit('artist', 2, 7)]

    expect(personnesEnDoublon(droits, [1, 2])).toEqual([])
  })

  it('retient les trois titres quand ils se superposent', () => {
    const droits = [droit('volunteer', 1, 7), droit('artist', 1, 7), droit('organizer', 1, 7)]

    const personnes = personnesEnDoublon(droits, [1])

    expect(personnes[0]!.sources).toEqual(['organizer', 'volunteer', 'artist'])
    expect(personnes[0]!.repas[0]!.droits).toHaveLength(3)
  })

  /**
   * Deux lignes d'une même source sur un même repas ne sont pas un doublon.
   *
   * Une contrainte d'unicité l'interdit sur les trois modèles, mais ce que l'écran donne à
   * arbitrer est un cumul de RÔLES : compter deux sélections bénévoles comme un doublon
   * enverrait retirer un droit qui n'a pas de concurrent.
   */
  it('ne compte pas deux droits de la même source comme un doublon', () => {
    const droits = [
      droit('volunteer', 1, 7, { selectionId: 1 }),
      droit('volunteer', 1, 7, { selectionId: 2 }),
    ]

    expect(personnesEnDoublon(droits, [1])).toEqual([])
  })

  /**
   * Les repas suivent l'ordre donné, pas leurs identifiants.
   *
   * Trier sur `mealId` s'en approcherait le plus souvent — les repas sont créés dans l'ordre des
   * dates — mais un repas ajouté après coup se rangerait au bout alors qu'il tombe le vendredi.
   */
  it('range les repas dans l’ordre demandé, pas dans celui des identifiants', () => {
    const droits = [
      droit('volunteer', 9, 7),
      droit('organizer', 9, 7),
      droit('volunteer', 3, 7),
      droit('organizer', 3, 7),
    ]

    const personnes = personnesEnDoublon(droits, [9, 3])

    expect(personnes[0]!.repas.map((r) => r.mealId)).toEqual([9, 3])
  })

  it('range en dernier un repas absent de l’ordre plutôt que de le perdre', () => {
    const droits = [
      droit('volunteer', 42, 7),
      droit('organizer', 42, 7),
      droit('volunteer', 1, 7),
      droit('organizer', 1, 7),
    ]

    const personnes = personnesEnDoublon(droits, [1])

    expect(personnes[0]!.repas.map((r) => r.mealId)).toEqual([1, 42])
  })

  it('sépare deux personnes qui partagent le même repas', () => {
    const droits = [
      droit('volunteer', 1, 7),
      droit('organizer', 1, 7),
      droit('volunteer', 1, 8),
      droit('artist', 1, 8),
    ]

    const personnes = personnesEnDoublon(droits, [1])

    expect(personnes.map((p) => p.userId).sort()).toEqual([7, 8])
  })
})

describe('droitsDeLaSource : la matière du retrait en masse', () => {
  it('rassemble tous les repas en doublon d’une même source', () => {
    const droits = [
      droit('volunteer', 1, 7, { selectionId: 11 }),
      droit('organizer', 1, 7),
      droit('volunteer', 2, 7, { selectionId: 22 }),
      droit('organizer', 2, 7),
    ]

    const personne = personnesEnDoublon(droits, [1, 2])[0]!

    expect(droitsDeLaSource(personne, 'volunteer').map((d) => d.selectionId)).toEqual([11, 22])
    expect(droitsDeLaSource(personne, 'organizer')).toHaveLength(2)
  })

  it('ne rend rien pour une source que la personne ne cumule pas', () => {
    const droits = [droit('volunteer', 1, 7), droit('organizer', 1, 7)]

    const personne = personnesEnDoublon(droits, [1])[0]!

    expect(droitsDeLaSource(personne, 'artist')).toEqual([])
  })
})
