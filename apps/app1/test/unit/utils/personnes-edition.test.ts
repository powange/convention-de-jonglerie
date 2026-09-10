import { describe, expect, it } from 'vitest'

import { attachesALEdition, LIMITE_RESULTATS } from '../../../server/utils/personnes-edition'

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
