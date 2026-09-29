import { describe, expect, it } from 'vitest'

import {
  MARGE_RETARD_MS,
  RETARD_MINUTES_MAX,
  RETARD_MINUTES_MIN,
  retardAccepte,
} from '../../../shared/utils/bornes-retard-creneau'

/**
 * Les bornes du retard d'un créneau, et la marge qu'elles imposent à la tâche de rappel.
 *
 * ⚠️ L'INVARIANT QUI COMPTE ICI N'EST PAS LA VALEUR DES BORNES, c'est leur ACCORD avec la marge de
 * la requête. La tâche de rappel cherche les créneaux qui commencent dans 28 à 32 minutes, mais le
 * retard décale ce début : elle élargit donc sa fenêtre de `MARGE_RETARD_MS`. Si cette marge était
 * plus étroite que le retard qu'on accepte d'enregistrer, les créneaux les plus décalés ne seraient
 * jamais chargés — leurs bénévoles ne recevraient AUCUN rappel, et rien n'apparaîtrait dans les
 * journaux : la tâche aurait tourné, et n'aurait rien trouvé.
 *
 * C'est pourquoi `MARGE_RETARD_MS` est dérivée des bornes dans le code, et pourquoi ce test le
 * vérifie plutôt que de recopier 43 200 000.
 */
describe('bornes du retard', () => {
  it('accepte un retard comme une avance', () => {
    // Les deux sens ont un usage : « on commence plus tard, le camion est en retard », mais aussi
    // « on ouvre plus tôt ». Une borne basse à zéro aurait supprimé le second.
    expect(RETARD_MINUTES_MIN).toBeLessThan(0)
    expect(RETARD_MINUTES_MAX).toBeGreaterThan(0)
  })

  it('impose à la tâche de rappel une marge au moins égale au plus grand décalage', () => {
    // LE test de ce fichier. Si quelqu'un élargit les bornes sans toucher à la marge, il tombe.
    const plusGrandDecalageMs =
      Math.max(Math.abs(RETARD_MINUTES_MIN), Math.abs(RETARD_MINUTES_MAX)) * 60 * 1000

    expect(MARGE_RETARD_MS).toBeGreaterThanOrEqual(plusGrandDecalageMs)
  })
})

describe('retardAccepte', () => {
  it('accepte les deux bornes elles-mêmes', () => {
    // Bornes INCLUSES : un refus à la valeur exacte est le classique décalage d'un cran, et il se
    // manifesterait par un 400 incompréhensible sur une saisie que l'interface propose.
    expect(retardAccepte(RETARD_MINUTES_MIN)).toBe(true)
    expect(retardAccepte(RETARD_MINUTES_MAX)).toBe(true)
  })

  it('refuse juste au-delà, dans les deux sens', () => {
    expect(retardAccepte(RETARD_MINUTES_MIN - 1)).toBe(false)
    expect(retardAccepte(RETARD_MINUTES_MAX + 1)).toBe(false)
  })

  it('accepte l’absence de retard', () => {
    // La colonne est nullable, et `null` veut dire « pas de décalage ». Le refuser empêcherait de
    // RETIRER un retard déjà posé — le cas le plus courant après une fausse manœuvre.
    expect(retardAccepte(null)).toBe(true)
    expect(retardAccepte(undefined)).toBe(true)
    expect(retardAccepte(0)).toBe(true)
  })

  it('refuse une fraction de minute', () => {
    // Un `0.5` traverserait ensuite tous les calculs de millisecondes sans qu'on le remarque, et
    // ressortirait en horaires à la seconde près dans les rappels.
    expect(retardAccepte(30.5)).toBe(false)
    expect(retardAccepte(-0.1)).toBe(false)
  })
})
