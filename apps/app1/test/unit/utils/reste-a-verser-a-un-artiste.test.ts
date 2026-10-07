import { describe, expect, it } from 'vitest'

import {
  detteDUnArtiste,
  drapeauxDeSolde,
  resteAPayer,
  resteAVerserEnTout,
} from '~~/shared/utils/reste-a-verser-a-un-artiste'

/**
 * Ce qu'il reste à verser aux artistes.
 *
 * Trois dettes indépendantes, chacune avec son drapeau : le cachet se règle souvent avant
 * l'événement, les frais de trajet après, sur présentation des billets.
 */
describe('detteDUnArtiste', () => {
  it('additionne les trois dettes non versées', () => {
    const dette = detteDUnArtiste({
      payment: 600,
      reimbursementActual: 120,
      consumablesActual: 45,
    })

    expect(dette).toEqual({ cachet: 600, defraiement: 120, consommables: 45, total: 765 })
  })

  it('⚠️ ignore une dette marquée versée, quel que soit son montant', () => {
    // C'est le DRAPEAU qui tranche, pas la présence d'une somme. Compter un cachet déjà réglé
    // ferait réclamer deux fois le même argent.
    const dette = detteDUnArtiste({
      payment: 600,
      paymentPaid: true,
      reimbursementActual: 120,
      consumablesActual: 45,
    })

    expect(dette.cachet).toBe(0)
    expect(dette.total).toBe(165)
  })

  it('⚠️ ne compte QUE le réel, jamais le plafond', () => {
    // Le plafond est une enveloppe annoncée, pas une somme promise. L'artiste ci-dessous avait
    // droit à 300 € de trajet et n'en a dépensé que 120 : on ne lui doit que 120.
    const dette = detteDUnArtiste({
      reimbursementActual: 120,
      // Le plafond n'est même pas dans le type : le confondre avec le réel est la faute qu'on
      // veut rendre impossible, pas seulement détecter.
      consumablesActual: null,
    } as never)

    expect(dette.defraiement).toBe(120)
    expect(dette.consommables).toBe(0)
  })

  it('traite les décimaux rendus en chaînes par Prisma', () => {
    // `'150.00' + '12.50'` concatène. Le reste de cet écran prend la même précaution.
    const dette = detteDUnArtiste({ payment: '150.00', reimbursementActual: '12.50' })

    expect(dette.total).toBe(162.5)
  })

  it('ne doit rien pour un artiste sans aucun montant', () => {
    expect(detteDUnArtiste({}).total).toBe(0)
    expect(detteDUnArtiste(null).total).toBe(0)
    expect(detteDUnArtiste(undefined).total).toBe(0)
  })

  it('ramène un montant négatif ou illisible à zéro', () => {
    // Un négatif ne décrit rien de réel, et le laisser passer le retrancherait des autres dettes.
    expect(detteDUnArtiste({ payment: -50, reimbursementActual: 120 }).total).toBe(120)
    expect(detteDUnArtiste({ payment: 'bonjour' }).total).toBe(0)
  })
})

describe('resteAPayer', () => {
  it('distingue « on lui doit » de « tout est réglé »', () => {
    expect(resteAPayer({ payment: 600 })).toBe(true)
    expect(resteAPayer({ payment: 600, paymentPaid: true })).toBe(false)
    expect(resteAPayer({})).toBe(false)
  })

  it('reste vrai dès qu’UNE des trois dettes est due', () => {
    expect(resteAPayer({ payment: 600, paymentPaid: true, consumablesActual: 10 })).toBe(true)
  })
})

describe('resteAVerserEnTout', () => {
  it('somme la dette de chacun', () => {
    const total = resteAVerserEnTout([
      { payment: 600 },
      { payment: 400, paymentPaid: true, reimbursementActual: 50 },
      { consumablesActual: 25 },
      {},
    ])

    expect(total).toBe(675)
  })

  it('rend zéro sur une liste vide', () => {
    expect(resteAVerserEnTout([])).toBe(0)
  })
})

describe('drapeauxDeSolde', () => {
  it('ne pose QUE les drapeaux des dettes réellement dues', () => {
    /*
     * ⚠️ LE POINT DÉLICAT. Poser `consumablesActualPaid` sur un artiste sans consommables
     * écrirait « remboursé » sur une somme qui n'existe pas : sa fiche annoncerait un
     * remboursement jamais fait, et rien ne distinguerait plus ce cas d'un vrai.
     */
    expect(drapeauxDeSolde({ payment: 600, reimbursementActual: 120 })).toEqual({
      paymentPaid: true,
      reimbursementActualPaid: true,
    })
  })

  it('ne repose pas un drapeau déjà posé', () => {
    expect(drapeauxDeSolde({ payment: 600, paymentPaid: true, consumablesActual: 25 })).toEqual({
      consumablesActualPaid: true,
    })
  })

  it('rend un objet vide quand il n’y a rien à solder', () => {
    // L'appelant peut alors s'abstenir d'appeler : un enregistrement sans contenu ne ferait que
    // toucher `updatedAt`.
    expect(drapeauxDeSolde({ payment: 600, paymentPaid: true })).toEqual({})
    expect(drapeauxDeSolde({})).toEqual({})
  })
})
