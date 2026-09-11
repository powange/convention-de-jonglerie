import { describe, expect, it } from 'vitest'

import {
  compterCandidaturesEnAttente,
  compterEchangesATrancher,
} from '../../../../../layers/volunteers/app/utils/compteurs-benevoles'

/**
 * Deux choses attendent une décision d'organisateur et n'en donnent aucun signe tant qu'on n'ouvre
 * pas l'écran : les candidatures en attente, et les échanges que les deux bénévoles ont acceptés.
 * Les deux sont des gens qui patientent, et le silence coûte plus cher qu'ailleurs — un candidat
 * sans réponse ne repostule pas l'année suivante.
 */
describe('compterCandidaturesEnAttente', () => {
  it('lit le total dans la pagination', () => {
    // L'API est interrogée avec la plus petite page possible : seul le total compte.
    expect(compterCandidaturesEnAttente({ pagination: { totalCount: 7 } })).toBe(7)
  })

  it('rend zéro quand il n’y a rien en attente', () => {
    expect(compterCandidaturesEnAttente({ pagination: { totalCount: 0 } })).toBe(0)
  })

  it('rend null plutôt que zéro devant une réponse inexploitable', () => {
    // `null` veut dire « on ne sait pas » et n'affiche aucune pastille. Zéro affirmerait qu'il n'y
    // a rien en attente — une information qu'une réponse malformée ne permet pas de donner.
    expect(compterCandidaturesEnAttente(null)).toBeNull()
    expect(compterCandidaturesEnAttente(undefined)).toBeNull()
    expect(compterCandidaturesEnAttente({})).toBeNull()
    expect(compterCandidaturesEnAttente({ pagination: null })).toBeNull()
    expect(compterCandidaturesEnAttente({ pagination: { totalCount: null } })).toBeNull()
  })

  it('ne prend pas un total textuel pour un nombre', () => {
    expect(compterCandidaturesEnAttente({ pagination: { totalCount: '3' as never } })).toBeNull()
  })
})

describe('compterEchangesATrancher', () => {
  const demande = (status: string) => ({ status })

  it('ne compte que ce qui attend un organisateur', () => {
    // Une demande encore en attente de la réponse du bénévole visé n'appelle aucune action de
    // l'organisateur : la compter lui ferait ouvrir l'écran pour rien.
    const demandes = [
      demande('PENDING_MANAGER'),
      demande('PENDING_PEER'),
      demande('PENDING_MANAGER'),
      demande('ACCEPTED'),
      demande('REFUSED'),
      demande('CANCELLED'),
      demande('EXPIRED'),
    ]

    expect(compterEchangesATrancher(demandes)).toBe(2)
  })

  it('rend zéro sur une liste vide ou absente', () => {
    expect(compterEchangesATrancher([])).toBe(0)
    expect(compterEchangesATrancher(null)).toBe(0)
    expect(compterEchangesATrancher(undefined)).toBe(0)
  })

  it('tolère une entrée de forme inattendue', () => {
    expect(compterEchangesATrancher([{}, { status: null }, demande('PENDING_MANAGER')])).toBe(1)
  })

  it('refait le tri même si l’endpoint est censé l’avoir fait', () => {
    // C'est la pastille qui décide de ce qu'elle annonce : elle ne doit pas se mettre à compter
    // autre chose le jour où cet endpoint élargit ce qu'il renvoie.
    expect(compterEchangesATrancher([demande('PENDING_PEER'), demande('ACCEPTED')])).toBe(0)
  })
})
