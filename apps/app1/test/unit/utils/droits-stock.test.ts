import { describe, expect, it } from 'vitest'

import {
  peutGererLeStock,
  type EditionPourDroitsStock,
} from '../../../../../layers/stock/app/utils/droits-stock'

/**
 * Les droits de gestion du stock, tels que l'ÉCRAN les lit.
 *
 * Cette règle était recopiée à l'identique dans trois pages avant d'être extraite ici. Ces tests
 * sont ce qui permettra de la corriger à un seul endroit — et de savoir que les trois pages
 * suivent.
 *
 * Ils ne prouvent rien sur la sécurité : le serveur décide seul. Ils prouvent que l'écran ne
 * montre pas des boutons qui rendraient une 403.
 */
const edition = (champs: Partial<EditionPourDroitsStock> = {}): EditionPourDroitsStock => ({
  id: 1,
  creatorId: 99,
  convention: { authorId: 98, organizers: [] },
  ...champs,
})

describe('peutGererLeStock', () => {
  it('refuse quand l’édition n’est pas chargée', () => {
    // Le premier rendu se fait avant la réponse de l'API : ouvrir par défaut ferait clignoter des
    // boutons interdits, et pire, laisserait cliquer pendant ce clignotement.
    expect(peutGererLeStock(null, 10)).toBe(false)
    expect(peutGererLeStock(undefined, 10)).toBe(false)
  })

  it('refuse un visiteur non connecté', () => {
    expect(peutGererLeStock(edition(), null)).toBe(false)
    expect(peutGererLeStock(edition(), undefined)).toBe(false)
  })

  it('accepte en mode administrateur', () => {
    expect(peutGererLeStock(edition(), 10, true)).toBe(true)
  })

  it('accepte le créateur de l’édition', () => {
    expect(peutGererLeStock(edition({ creatorId: 10 }), 10)).toBe(true)
  })

  it('accepte l’auteur de la convention', () => {
    expect(peutGererLeStock(edition({ convention: { authorId: 10, organizers: [] } }), 10)).toBe(
      true
    )
  })

  it('accepte un collaborateur qui gère le stock', () => {
    const e = edition({
      convention: {
        authorId: 98,
        organizers: [{ user: { id: 10 }, rights: { manageStock: true } }],
      },
    })

    expect(peutGererLeStock(e, 10)).toBe(true)
  })

  it('accepte qui peut modifier la convention', () => {
    // Qui peut tout modifier peut modifier le stock : lui refuser cet écran-là serait incohérent.
    const e = edition({
      convention: {
        authorId: 98,
        organizers: [{ user: { id: 10 }, rights: { editConvention: true } }],
      },
    })

    expect(peutGererLeStock(e, 10)).toBe(true)
  })

  it('accepte un droit accordé pour CETTE édition', () => {
    const e = edition({
      convention: {
        authorId: 98,
        organizers: [
          {
            user: { id: 10 },
            rights: {},
            perEditionRights: [{ editionId: 1, canManageStock: true }],
          },
        ],
      },
    })

    expect(peutGererLeStock(e, 10)).toBe(true)
  })

  it('refuse un droit accordé pour une AUTRE édition', () => {
    // Le point le plus facile à perdre en refactorisant : le droit par édition est filtré sur
    // l'identifiant de l'édition courante, sans quoi gérer le stock d'une édition les ouvrirait
    // toutes.
    const e = edition({
      convention: {
        authorId: 98,
        organizers: [
          {
            user: { id: 10 },
            rights: {},
            perEditionRights: [{ editionId: 2, canManageStock: true }],
          },
        ],
      },
    })

    expect(peutGererLeStock(e, 10)).toBe(false)
  })

  it('refuse un collaborateur sans droit sur le stock', () => {
    const e = edition({
      convention: {
        authorId: 98,
        organizers: [{ user: { id: 10 }, rights: { manageStock: false } }],
      },
    })

    expect(peutGererLeStock(e, 10)).toBe(false)
  })

  it('ne confond pas deux collaborateurs', () => {
    const e = edition({
      convention: {
        authorId: 98,
        organizers: [
          { user: { id: 11 }, rights: { manageStock: true } },
          { user: { id: 10 }, rights: {} },
        ],
      },
    })

    expect(peutGererLeStock(e, 10)).toBe(false)
  })

  it('survit à une convention absente ou sans collaborateurs', () => {
    expect(peutGererLeStock(edition({ convention: null }), 10)).toBe(false)
    expect(peutGererLeStock(edition({ convention: { authorId: 98, organizers: null } }), 10)).toBe(
      false
    )
  })
})
