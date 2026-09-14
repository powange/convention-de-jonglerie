import { describe, expect, it } from 'vitest'

import { benevolesAffectables } from '../../../../../layers/volunteers/app/utils/benevoles-affectables'

/**
 * Qui proposer pour tenir un créneau.
 *
 * La modale ne montrait que les membres de l'équipe, ce qui rendait impossible le geste même pour
 * lequel les volants existent : renforcer une équipe à laquelle on n'appartient pas. Ces tests
 * fixent les deux listes, et surtout ce qui va dans l'une plutôt que dans l'autre.
 */
const benevole = (userId: number, assignedTeams: string[] = [], estVolant = false) => ({
  userId,
  assignedTeams,
  estVolant,
})

const pose = (id: number) => ({ user: { id } })

describe('benevolesAffectables', () => {
  it('propose les membres de l’équipe du créneau', () => {
    const { membres, renforts } = benevolesAffectables(
      [benevole(1, ['cuisine']), benevole(2, ['bar'])],
      [],
      'cuisine'
    )

    expect(membres.map((b) => b.userId)).toEqual([1])
    expect(renforts).toEqual([])
  })

  it('propose les volants en RENFORT, sur une équipe qui n’est pas la leur', () => {
    // Le défaut corrigé : ce bénévole n'apparaissait nulle part, alors que c'est exactement la
    // personne qu'on veut appeler quand la cuisine déborde.
    const { membres, renforts } = benevolesAffectables(
      [benevole(1, ['cuisine']), benevole(2, ['volants'], true)],
      [],
      'cuisine'
    )

    expect(membres.map((b) => b.userId)).toEqual([1])
    expect(renforts.map((b) => b.userId)).toEqual([2])
  })

  it('range un volant dans les MEMBRES sur un créneau de SON équipe', () => {
    // Le cas réel : une équipe volante peut avoir ses propres créneaux — une permanence. Sur
    // ceux-là, le volant n'est pas un renfort venu d'ailleurs : il est chez lui. L'appartenance
    // prime donc sur le statut.
    const { membres, renforts } = benevolesAffectables(
      [benevole(1, ['volants'], true)],
      [],
      'volants'
    )

    expect(membres.map((b) => b.userId)).toEqual([1])
    expect(renforts).toEqual([])
  })

  it('ne traite pas en renfort quelqu’un qui a aussi une équipe ordinaire', () => {
    // Dans deux équipes, il n'est pas volant au sens de la règle : il reste un membre ordinaire
    // de sa cuisine, et n'est proposé nulle part ailleurs.
    const { membres, renforts } = benevolesAffectables(
      [benevole(1, ['cuisine', 'volants'], false)],
      [],
      'bar'
    )

    expect(membres).toEqual([])
    expect(renforts).toEqual([])
  })

  it('ne propose pas en renfort un bénévole ordinaire d’une autre équipe', () => {
    // La règle d'origine tient toujours : l'équipe du créneau garde son sens.
    const { membres, renforts } = benevolesAffectables([benevole(1, ['bar'])], [], 'cuisine')

    expect(membres).toEqual([])
    expect(renforts).toEqual([])
  })

  it('propose tout le monde, sans renforts, sur un créneau sans équipe', () => {
    // Distinguer un « renfort » n'aurait aucun sens : il n'y a pas d'équipe à renforcer.
    const { membres, renforts } = benevolesAffectables(
      [benevole(1, ['cuisine']), benevole(2, ['volants'], true), benevole(3)],
      [],
      null
    )

    expect(membres.map((b) => b.userId)).toEqual([1, 2, 3])
    expect(renforts).toEqual([])
  })

  it('traite « unassigned » comme une absence d’équipe', () => {
    // C'est la valeur que le planning donne à la colonne « Non assigné ».
    const { membres } = benevolesAffectables([benevole(1, ['bar'])], [], 'unassigned')

    expect(membres.map((b) => b.userId)).toEqual([1])
  })

  it('retire des DEUX listes ceux qui sont déjà posés', () => {
    const { membres, renforts } = benevolesAffectables(
      [benevole(1, ['cuisine']), benevole(2, ['volants'], true), benevole(3, ['cuisine'])],
      [pose(1), pose(2)],
      'cuisine'
    )

    expect(membres.map((b) => b.userId)).toEqual([3])
    expect(renforts).toEqual([])
  })

  it('survit à un bénévole sans liste d’équipes', () => {
    const { membres, renforts } = benevolesAffectables(
      [{ userId: 1 }, { userId: 2, estVolant: true }],
      [],
      'cuisine'
    )

    expect(membres).toEqual([])
    expect(renforts.map((b) => b.userId)).toEqual([2])
  })

  it('rend deux listes vides sans candidats', () => {
    expect(benevolesAffectables([], [], 'cuisine')).toEqual({ membres: [], renforts: [] })
  })
})
