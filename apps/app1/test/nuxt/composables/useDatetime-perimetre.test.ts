import { describe, it, expect } from 'vitest'

import { useDatetime } from '../../../app/composables/useDatetime'

/**
 * `useDatetime` a longtemps ressemblé à une seconde bibliothèque de fuseaux horaires.
 *
 * Il exposait `formatInTimezone`, `formatDateInTimezone`, `formatTimeInTimezone`,
 * `getTimezoneAbbreviation` et `formatWithTimezone` — cinq fonctions qu'AUCUN appelant
 * n'utilisait. Elles ne concurrençaient donc rien ; elles attendaient d'être trouvées, et de
 * faire écrire un écran de plus contre le fuseau de la machine plutôt que celui de l'édition.
 *
 * Il portait aussi `toDatetimeLocal` / `fromDatetimeLocal`, qui ancraient un champ
 * `datetime-local` au fuseau du NAVIGATEUR : le défaut exact qui faisait enregistrer une heure
 * fausse à qui saisissait un créneau depuis ailleurs.
 *
 * Ce test n'éprouve pas un comportement, il tient une FRONTIÈRE. Sans lui, rien n'empêche qu'un
 * jour on rajoute ici la fonction qui paraîtra commode, et le partage recommence.
 */
const INTERDITES = [
  'formatInTimezone',
  'formatDateInTimezone',
  'formatTimeInTimezone',
  'getTimezoneAbbreviation',
  'formatWithTimezone',
  'toDatetimeLocal',
  'fromDatetimeLocal',
]

describe('useDatetime — ce qu’il ne doit plus savoir faire', () => {
  it('n’expose aucune fonction de fuseau horaire', () => {
    // Le fuseau, c'est `~~/shared/utils/fuseau-edition` : testé, documenté, et il dit pourquoi
    // celui de la machine ne convient jamais.
    const exposees = Object.keys(useDatetime())

    expect(exposees.filter((nom) => INTERDITES.includes(nom))).toEqual([])
  })

  it('n’expose plus que l’aller-retour avec l’API et un affichage simple', () => {
    // La liste est volontairement exhaustive : y ajouter quelque chose doit être un geste
    // délibéré, pas un ajout qui passe inaperçu.
    expect(Object.keys(useDatetime()).sort()).toEqual([
      'formatForDisplay',
      'fromApiFormat',
      'toApiFormat',
    ])
  })
})
