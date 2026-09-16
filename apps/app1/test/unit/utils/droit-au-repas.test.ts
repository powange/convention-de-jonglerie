import { describe, expect, it } from 'vitest'

import { donneDroitAuRepas } from '../../../shared/utils/droit-au-repas'

/**
 * Qui a droit à un repas.
 *
 * Le défaut signalé : une artiste n'ayant que le vendredi soir ressortait dans la recherche du
 * samedi midi, et le repas lui était validé. Les écrans de validation ignoraient `accepted` pour
 * les bénévoles et les artistes, alors que les ORGANISATEURS y étaient déjà filtrés dans les mêmes
 * points d'API.
 */
describe('donneDroitAuRepas', () => {
  it('donne droit sur une sélection acceptée', () => {
    expect(donneDroitAuRepas({ accepted: true })).toBe(true)
  })

  it('REFUSE sur un refus explicite', () => {
    // Le cœur du correctif : cette personne a dit qu'elle ne prenait pas ce repas.
    expect(donneDroitAuRepas({ accepted: false })).toBe(false)
  })

  it('donne droit quand le champ est absent', () => {
    // Le défaut du schéma est `true`. Une donnée manquante ne doit pas priver quelqu'un de son
    // repas devant la porte — le refus doit être explicite pour compter.
    expect(donneDroitAuRepas({})).toBe(true)
    expect(donneDroitAuRepas({ accepted: null })).toBe(true)
  })

  it('refuse une sélection inexistante', () => {
    // Un identifiant qui ne correspond à rien ne donne droit à rien.
    expect(donneDroitAuRepas(null)).toBe(false)
    expect(donneDroitAuRepas(undefined)).toBe(false)
  })
})
