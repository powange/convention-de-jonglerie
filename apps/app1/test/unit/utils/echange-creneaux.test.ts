import { describe, expect, it } from 'vitest'

import {
  creneauxProposables,
  demandeExpiree,
  echangePossiblePourLaCible,
  effectifApresEchange,
  seChevauchent,
  type AffectationCandidate,
} from '../../../../../layers/volunteers/server/utils/echange-creneaux'

/**
 * Règles de l'échange de créneaux entre bénévoles.
 *
 * Ce que ces tests protègent tient en une phrase : ne jamais proposer un échange impossible. Un
 * bénévole ne peut pas être à deux postes en même temps, et laisser la liste afficher un créneau
 * qu'il ne pourra pas prendre reporte le refus après deux accords et une notification.
 *
 * Le cas le plus subtil est le créneau OFFERT : il se libère par l'échange, donc le chevaucher
 * est non seulement permis, c'est le cas courant — on échange souvent un créneau contre un autre
 * du même moment.
 */
const h = (heure: number) => new Date(2026, 8, 10, heure, 0, 0).toISOString()

const aff = (id: string, userId: number, debut: number, fin: number): AffectationCandidate => ({
  id,
  userId,
  timeSlot: { id: `slot-${id}`, startDateTime: h(debut), endDateTime: h(fin) },
})

describe('seChevauchent', () => {
  it('reconnaît un vrai recouvrement', () => {
    expect(seChevauchent(aff('a', 1, 10, 14).timeSlot, aff('b', 2, 12, 16).timeSlot)).toBe(true)
  })

  it('laisse passer une relève — bornes exclusives', () => {
    // 14 h → 14 h : on enchaîne, on ne se chevauche pas. Interdire cela bloquerait les relèves,
    // qui sont la norme sur un planning de convention.
    expect(seChevauchent(aff('a', 1, 10, 14).timeSlot, aff('b', 2, 14, 18).timeSlot)).toBe(false)
  })
})

describe('creneauxProposables', () => {
  // Le demandeur (1) tient deux créneaux : 10-14 qu'il offre, et 16-18 qu'il garde.
  const OFFERT = aff('offert', 1, 10, 14)
  const GARDE = aff('garde', 1, 16, 18)

  it('exclut ses propres affectations', () => {
    const resultat = creneauxProposables(1, 'offert', [OFFERT, GARDE, aff('x', 2, 20, 22)])
    expect(resultat.map((a) => a.id)).toEqual(['x'])
  })

  it('exclut ce qui chevauche un créneau qu’il GARDE', () => {
    const conflit = aff('conflit', 2, 17, 19)
    const resultat = creneauxProposables(1, 'offert', [OFFERT, GARDE, conflit])
    expect(resultat.map((a) => a.id)).toEqual([])
  })

  it('accepte ce qui chevauche le créneau qu’il OFFRE', () => {
    // Il s'en défait : le conflit disparaît avec l'échange. C'est le cas le plus courant.
    const memeMoment = aff('meme-moment', 2, 10, 14)
    const resultat = creneauxProposables(1, 'offert', [OFFERT, GARDE, memeMoment])
    expect(resultat.map((a) => a.id)).toEqual(['meme-moment'])
  })
})

describe('echangePossiblePourLaCible', () => {
  it('refuse si le créneau reçu chevauche ce que la cible garde', () => {
    const cible = [aff('cede', 2, 10, 14), aff('autre', 2, 15, 19)]
    const recu = aff('recu', 1, 16, 18).timeSlot

    expect(echangePossiblePourLaCible(2, 'cede', recu, cible)).toBe(false)
  })

  it('accepte quand le seul recouvrement porte sur le créneau qu’elle cède', () => {
    const cible = [aff('cede', 2, 10, 14)]
    const recu = aff('recu', 1, 11, 13).timeSlot

    expect(echangePossiblePourLaCible(2, 'cede', recu, cible)).toBe(true)
  })
})

describe('demandeExpiree', () => {
  const MAINTENANT = new Date(2026, 8, 10, 15, 0, 0).getTime()

  it('expire dès que le PREMIER des deux créneaux est passé', () => {
    const passe = aff('a', 1, 10, 14).timeSlot
    const futur = aff('b', 2, 20, 22).timeSlot

    expect(demandeExpiree(passe, futur, MAINTENANT)).toBe(true)
    // Peu importe lequel des deux : l'ordre ne doit rien changer.
    expect(demandeExpiree(futur, passe, MAINTENANT)).toBe(true)
  })

  it('reste valable tant que les deux sont à venir', () => {
    expect(
      demandeExpiree(aff('a', 1, 16, 18).timeSlot, aff('b', 2, 20, 22).timeSlot, MAINTENANT)
    ).toBe(false)
  })
})

/**
 * L'effectif d'un créneau après l'échange, tel que l'organisateur le voit pour décider.
 *
 * Demandé explicitement : deux noms et deux horaires ne disent pas ce que l'échange produit sur
 * le terrain. Le cas qui compte est celui du créneau à PLUSIEURS places, où l'entrant peut déjà
 * y figurer — l'afficher deux fois donnerait une image fausse de l'effectif.
 */
describe('effectifApresEchange', () => {
  const alice = { id: 1, pseudo: 'alice' }
  const bob = { id: 2, pseudo: 'bob' }
  const carole = { id: 3, pseudo: 'carole', avoidList: 'éviter bob' }

  it('retire le partant et marque l’arrivant', () => {
    const resultat = effectifApresEchange([alice, carole], 1, bob)

    expect(resultat.map((m) => m.pseudo)).toEqual(['carole', 'bob'])
    expect(resultat.find((m) => m.pseudo === 'bob')?.arrivant).toBe(true)
    expect(resultat.find((m) => m.pseudo === 'carole')?.arrivant).toBeUndefined()
  })

  it('conserve la mention « à éviter » de ceux qui restent', () => {
    const resultat = effectifApresEchange([alice, carole], 1, bob)

    expect(resultat.find((m) => m.pseudo === 'carole')?.avoidList).toBe('éviter bob')
  })

  it('n’ajoute pas deux fois quelqu’un qui tient déjà le créneau', () => {
    // Possible sur un créneau à plusieurs places : l'entrant y était déjà.
    const resultat = effectifApresEchange([alice, bob], 1, bob)

    expect(resultat.map((m) => m.pseudo)).toEqual(['bob'])
  })

  it('rend l’effectif diminué quand aucun entrant n’est connu', () => {
    const resultat = effectifApresEchange([alice, carole], 1, null)

    expect(resultat.map((m) => m.pseudo)).toEqual(['carole'])
  })
})
