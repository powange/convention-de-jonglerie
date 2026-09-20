import { describe, expect, it } from 'vitest'

import {
  alignerSurAxe,
  axeCommun,
  libelleDuRepere,
  repereDepuisOuverture,
} from '../../../shared/utils/recalage-editions'

/**
 * Le recalage de deux éditions l'une sur l'autre.
 *
 * Ce que ces tests protègent est une lecture : on regarde ces courbes pour décider combien de
 * billets commander et quand ouvrir la vente. Deux erreurs coûtent, et toutes deux sont
 * silencieuses — un décalage d'un jour, qui fait conclure que la vente démarre plus tôt qu'elle
 * ne le fait, et un trou rempli de zéros, qui fait lire « personne n'a acheté » là où il fallait
 * lire « cette édition n'existait pas encore ».
 */

const OUVERTURE = '2026-05-15T00:00:00Z'

describe('repereDepuisOuverture', () => {
  it('place le jour de l’ouverture en J1, pas en J0', () => {
    expect(repereDepuisOuverture('2026-05-15T10:00:00Z', OUVERTURE)).toBe(1)
  })

  it('place la veille en J-1, et il n’y a pas de J0 entre les deux', () => {
    // La frontière où ce genre de calcul se trompe d'un jour. Un décalage naïf donnerait 0 la
    // veille et 0 le jour même, écrasant deux journées l'une sur l'autre.
    expect(repereDepuisOuverture('2026-05-14T23:00:00Z', OUVERTURE)).toBe(-1)
    expect(repereDepuisOuverture('2026-05-13T00:00:00Z', OUVERTURE)).toBe(-2)
  })

  it('compte les jours suivants à partir de J2', () => {
    expect(repereDepuisOuverture('2026-05-16T00:00:00Z', OUVERTURE)).toBe(2)
    expect(repereDepuisOuverture('2026-05-17T23:59:00Z', OUVERTURE)).toBe(3)
  })

  it('ne rend jamais zéro, quel que soit l’écart', () => {
    // L'invariant qui fait tenir l'axe : un J0 n'aurait aucun sens à l'affichage, et le lecteur
    // ne saurait pas s'il désigne la veille ou le jour même.
    for (let jours = -120; jours <= 120; jours++) {
      const quand = new Date(Date.parse(OUVERTURE) + jours * 24 * 3600 * 1000)
      expect(repereDepuisOuverture(quand, OUVERTURE)).not.toBe(0)
    }
  })

  it('reste continu de part et d’autre de l’ouverture', () => {
    // -2, -1 puis 1, 2 : la suite ne doit ni sauter ni se répéter.
    const suite = [-3, -2, -1, 0, 1, 2].map((jours) =>
      repereDepuisOuverture(new Date(Date.parse(OUVERTURE) + jours * 24 * 3600 * 1000), OUVERTURE)
    )
    expect(suite).toEqual([-3, -2, -1, 1, 2, 3])
  })

  it('regroupe une journée entière sous le même repère', () => {
    // Une vente à 1 h et une vente à 23 h appartiennent au même jour : c'est ce qui permet de
    // comparer deux éditions jour à jour plutôt qu'heure à heure.
    expect(repereDepuisOuverture('2026-05-16T00:00:01Z', OUVERTURE)).toBe(2)
    expect(repereDepuisOuverture('2026-05-16T23:59:59Z', OUVERTURE)).toBe(2)
  })

  it('compte les jours dans le fuseau du LIEU', () => {
    // 22 h à Paris le 15 mai, c'est 20 h UTC le même jour : les deux tombent sur J1. Mais 1 h à
    // Paris le 16 est encore 23 h UTC le 15 — et c'est le jour vécu sur place qui fait foi.
    expect(repereDepuisOuverture('2026-05-15T23:00:00Z', OUVERTURE, 'Europe/Paris')).toBe(2)
    expect(repereDepuisOuverture('2026-05-15T23:00:00Z', OUVERTURE, 'UTC')).toBe(1)
  })

  it('rend null plutôt qu’un point placé au hasard', () => {
    expect(repereDepuisOuverture(null, OUVERTURE)).toBeNull()
    expect(repereDepuisOuverture('2026-05-15', null)).toBeNull()
    expect(repereDepuisOuverture('pas une date', OUVERTURE)).toBeNull()
    expect(repereDepuisOuverture('', OUVERTURE)).toBeNull()
  })
})

describe('libelleDuRepere', () => {
  it('écrit J1, J2 et J-1', () => {
    expect(libelleDuRepere(1)).toBe('J1')
    expect(libelleDuRepere(2)).toBe('J2')
    expect(libelleDuRepere(-1)).toBe('J-1')
    expect(libelleDuRepere(-30)).toBe('J-30')
  })

  it('n’écrit rien pour un repère absent ou nul', () => {
    expect(libelleDuRepere(null)).toBe('')
    expect(libelleDuRepere(0)).toBe('')
    expect(libelleDuRepere(Number.NaN)).toBe('')
  })
})

describe('axeCommun', () => {
  it('prend l’UNION des deux séries, pas leur intersection', () => {
    // Le point de tout l'exercice : si l'édition passée a vendu dès J-90 et la courante
    // seulement à partir de J-30, on veut VOIR que l'une a démarré plus tôt. Une intersection
    // effacerait exactement ce qu'on cherchait à comparer.
    expect(axeCommun([-2, -1, 1], [-90, -1, 1, 2])).toEqual([-90, -2, -1, 1, 2])
  })

  it('trie du plus ancien au plus récent', () => {
    expect(axeCommun([3, -1, 2], [1, -5])).toEqual([-5, -1, 1, 2, 3])
  })

  it('ne garde qu’une fois un repère présent des deux côtés', () => {
    expect(axeCommun([1, 2], [1, 2])).toEqual([1, 2])
  })

  it('GARDE le zéro, qui désigne un créneau réel', () => {
    // Il n'y a pas de J0 parmi les repères de jour, mais le créneau 0 est la première tranche du
    // jour d'ouverture. L'écarter effaçait cette tranche et décalait toute la journée.
    expect(axeCommun([0, 1], [0, -1])).toEqual([-1, 0, 1])
  })

  it('accepte une série vide', () => {
    expect(axeCommun([], [1, 2])).toEqual([1, 2])
    expect(axeCommun([], [])).toEqual([])
  })
})

describe('alignerSurAxe', () => {
  it('laisse un TROU là où la série n’a rien, jamais un zéro', () => {
    // La distinction décide de la lecture : un zéro affirme « rien vendu ce jour-là », un trou
    // dit « cette édition n'existait pas encore à ce stade ».
    const axe = [-2, -1, 1, 2]
    expect(alignerSurAxe(axe, [-1, 1], [5, 9])).toEqual([null, 5, 9, null])
  })

  it('distingue un vrai zéro d’une absence', () => {
    // Un jour sans vente EXISTE et vaut zéro ; un jour hors de la série n'existe pas.
    const axe = [-1, 1]
    expect(alignerSurAxe(axe, [-1], [0])).toEqual([0, null])
  })

  it('additionne deux valeurs tombées sur le même repère', () => {
    // Deux tranches horaires du même jour se replient sur un seul point.
    expect(alignerSurAxe([1], [1, 1], [3, 4])).toEqual([7])
  })

  it('ignore un repère absent ou une valeur illisible', () => {
    expect(alignerSurAxe([1, 2], [null, 2], [99, 4])).toEqual([null, 4])
    expect(alignerSurAxe([1], [1], [Number.NaN])).toEqual([null])
  })

  it('rend un tableau de la LONGUEUR de l’axe', () => {
    // Une série plus courte que l'axe décalerait tous les points du graphique.
    const axe = [-3, -2, -1, 1, 2, 3]
    expect(alignerSurAxe(axe, [1], [10])).toHaveLength(axe.length)
  })

  it('aligne deux éditions sur le même axe, bout à bout', () => {
    // Le cas complet : deux éditions dont l'une a commencé à vendre plus tôt.
    const passee = [-90, -60, -1, 1]
    const courante = [-30, -1, 1]
    const axe = axeCommun(passee, courante)

    const serieA = alignerSurAxe(axe, passee, [2, 8, 40, 120])
    const serieB = alignerSurAxe(axe, courante, [15, 55, 140])

    expect(axe).toEqual([-90, -60, -30, -1, 1])
    expect(serieA).toEqual([2, 8, null, 40, 120])
    expect(serieB).toEqual([null, null, 15, 55, 140])
    expect(serieA).toHaveLength(axe.length)
    expect(serieB).toHaveLength(axe.length)
  })
})
