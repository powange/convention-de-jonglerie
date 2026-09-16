import { describe, it, expect } from 'vitest'

import {
  corpsDuRetrait,
  urlDuRetrait,
  type DroitAuRepas,
} from '../../../../../layers/meals/app/utils/retrait-de-repas'

const droit = (
  source: DroitAuRepas['source'],
  mealId: number,
  roleId: number,
  selectionId: number | null
): DroitAuRepas => ({ source, mealId, userId: 7, roleId, selectionId })

describe('retrait de repas : où l’on tape', () => {
  it('vise la candidature pour un bénévole', () => {
    expect(urlDuRetrait(21, [droit('volunteer', 7, 30, 500)])).toBe(
      '/api/editions/21/volunteers/30/meals'
    )
  })

  it('vise la fiche d’édition pour un artiste', () => {
    expect(urlDuRetrait(21, [droit('artist', 7, 40, 900)])).toBe(
      '/api/editions/21/artists/40/meals'
    )
  })

  it('vise la ligne d’édition pour un organisateur', () => {
    expect(urlDuRetrait(21, [droit('organizer', 7, 60, null)])).toBe(
      '/api/editions/21/organizers/edition-organizers/60/meals'
    )
  })

  it('ne fabrique pas d’adresse sans droit à retirer', () => {
    expect(urlDuRetrait(21, [])).toBe('')
  })
})

describe('retrait de repas : ce qu’on envoie', () => {
  /**
   * LE défaut trouvé en cliquant, et la raison d'être de ce fichier.
   *
   * `setVolunteerMeals` ouvre sur `if (!selection.mealId) return`. Un corps réduit à
   * `{ selectionId, accepted: false }` était donc **ignoré en silence** : le point d'API répondait
   * 200 avec la liste inchangée, l'écran affichait « Droit au repas retiré », et le repas du
   * vendredi soir restait attribué. Les tests du service passaient tous `mealId` — le garde-fou
   * n'avait jamais été éprouvé sans.
   */
  it('porte TOUJOURS le mealId, sans quoi le serveur ignore la ligne en silence', () => {
    const corps = corpsDuRetrait([droit('volunteer', 7, 30, 500)])

    expect(corps.selections[0]).toMatchObject({ mealId: 7 })
  })

  it('joint le selectionId quand le droit en a un', () => {
    expect(corpsDuRetrait([droit('volunteer', 7, 30, 500)])).toEqual({
      selections: [{ mealId: 7, selectionId: 500, accepted: false }],
    })
    expect(corpsDuRetrait([droit('artist', 7, 40, 900)])).toEqual({
      selections: [{ mealId: 7, selectionId: 900, accepted: false }],
    })
  })

  /**
   * L'organisateur n'a pas de ligne à modifier tant qu'il n'a rien refusé : envoyer
   * `selectionId: null` ne désignerait rien. Son point d'API l'écarterait de toute façon — zod
   * retire les clés inconnues sans rien dire — mais mieux vaut ne pas l'envoyer que compter
   * dessus.
   */
  it('n’invente pas de selectionId pour un organisateur', () => {
    const corps = corpsDuRetrait([droit('organizer', 7, 60, null)])

    expect(corps).toEqual({ selections: [{ mealId: 7, accepted: false }] })
    expect(corps.selections[0]).not.toHaveProperty('selectionId')
  })

  it('ne demande jamais que le contraire : accepted vaut toujours false', () => {
    const corps = corpsDuRetrait([
      droit('volunteer', 7, 30, 500),
      droit('volunteer', 8, 30, 501),
      droit('volunteer', 9, 30, 502),
    ])

    expect(corps.selections.map((s) => s.accepted)).toEqual([false, false, false])
    expect(corps.selections.map((s) => s.mealId)).toEqual([7, 8, 9])
  })
})
