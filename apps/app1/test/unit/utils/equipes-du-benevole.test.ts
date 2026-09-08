import { describe, it, expect } from 'vitest'

import {
  basculerEquipe,
  effectifParEquipe,
  equipesDuBenevole,
  grouperParPreference,
} from '../../../../../layers/volunteers/app/utils/equipes-du-benevole'

/**
 * La modale de répartition ouvre les équipes du bénévole déjà cochées, laisse cocher et
 * décocher, et range le tout en deux groupes. Ces trois règles se sont trompées à l'écran avant
 * d'être sorties du composant.
 */

describe('equipesDuBenevole', () => {
  it('relève les équipes du bénévole', () => {
    const benevole = { teamAssignments: [{ teamId: 'accueil' }, { teamId: 'bar' }] }
    expect(equipesDuBenevole(benevole)).toEqual(['accueil', 'bar'])
  })

  it('rend une liste vide pour un bénévole sans équipe', () => {
    expect(equipesDuBenevole({ teamAssignments: [] })).toEqual([])
    expect(equipesDuBenevole({})).toEqual([])
  })

  it("tolère l'absence de bénévole", () => {
    // La modale se referme en remettant le bénévole à `null`, et tout se recalcule dans la
    // foulée : c'est exactement ce qui levait une erreur à la fermeture.
    expect(equipesDuBenevole(null)).toEqual([])
    expect(equipesDuBenevole(undefined)).toEqual([])
  })
})

describe('basculerEquipe', () => {
  it('ajoute une équipe cochée', () => {
    expect(basculerEquipe(['accueil'], 'bar', true)).toEqual(['accueil', 'bar'])
  })

  it('retire une équipe décochée', () => {
    expect(basculerEquipe(['accueil', 'bar'], 'accueil', false)).toEqual(['bar'])
  })

  it('ne double pas une équipe déjà cochée', () => {
    expect(basculerEquipe(['accueil'], 'accueil', true)).toEqual(['accueil'])
  })

  it("ne retire rien d'absent", () => {
    expect(basculerEquipe(['accueil'], 'bar', false)).toEqual(['accueil'])
  })

  it('rend une nouvelle liste plutôt que de modifier la précédente', () => {
    // La liaison passe par `:model-value` et un événement : muter le tableau en place ne
    // déclencherait pas le rendu.
    const depart = ['accueil']
    const apres = basculerEquipe(depart, 'bar', true)

    expect(depart).toEqual(['accueil'])
    expect(apres).not.toBe(depart)
  })
})

describe('grouperParPreference', () => {
  const EQUIPES = [{ id: 'accueil' }, { id: 'bar' }, { id: 'cuisine' }]
  const preferees = (ids: string[]) => (equipe: { id: string }) => ids.includes(equipe.id)

  it('range les équipes souhaitées avant les autres', () => {
    const groupes = grouperParPreference(EQUIPES, preferees(['bar']))

    expect(groupes.map((g) => g.cle)).toEqual(['preferees', 'autres'])
    expect(groupes[0]!.equipes.map((e) => e.id)).toEqual(['bar'])
    expect(groupes[1]!.equipes.map((e) => e.id)).toEqual(['accueil', 'cuisine'])
  })

  it("n'affiche pas un groupe vide", () => {
    // Un intitulé sans rien dessous ferait croire à une liste tronquée.
    const groupes = grouperParPreference(EQUIPES, preferees([]))

    expect(groupes).toHaveLength(1)
    expect(groupes[0]!.cle).toBe('autres')
  })

  it('rend un seul groupe quand tout est souhaité', () => {
    const groupes = grouperParPreference(EQUIPES, preferees(['accueil', 'bar', 'cuisine']))

    expect(groupes).toHaveLength(1)
    expect(groupes[0]!.cle).toBe('preferees')
  })

  it('rend une liste vide sans équipe', () => {
    expect(grouperParPreference([], () => true)).toEqual([])
  })
})

/**
 * L'effectif annoncé à côté de chaque équipe, au moment de choisir. Un organisateur y compte
 * comme un bénévole : c'est la règle des créneaux, et elle vaut aussi pour une équipe.
 */
describe('effectifParEquipe', () => {
  it('compte les bénévoles de chaque équipe', () => {
    const candidatures = [
      { teamAssignments: [{ teamId: 'accueil' }, { teamId: 'bar' }] },
      { teamAssignments: [{ teamId: 'accueil' }] },
    ]

    expect(effectifParEquipe(candidatures)).toEqual({ accueil: 2, bar: 1 })
  })

  it('ajoute les organisateurs rattachés', () => {
    const candidatures = [{ teamAssignments: [{ teamId: 'accueil' }] }]
    const organisateurs = [{ teamIds: ['accueil', 'bar'] }]

    expect(effectifParEquipe(candidatures, organisateurs)).toEqual({ accueil: 2, bar: 1 })
  })

  it('compte une équipe tenue par les seuls organisateurs', () => {
    expect(effectifParEquipe([], [{ teamIds: ['cuisine'] }])).toEqual({ cuisine: 1 })
  })

  it('ignore les candidatures sans équipe', () => {
    expect(effectifParEquipe([{ teamAssignments: [] }, {}])).toEqual({})
  })

  it('rend un relevé vide sans personne', () => {
    expect(effectifParEquipe([])).toEqual({})
  })
})
