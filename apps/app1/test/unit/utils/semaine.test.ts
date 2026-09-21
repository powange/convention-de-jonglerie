import { describe, expect, it } from 'vitest'

import { LUNDI, premierJourDeSemaine } from '../../../shared/utils/semaine'

/**
 * Les calendriers démarraient tous le dimanche — le défaut de la bibliothèque — alors qu'en
 * France la semaine commence le lundi.
 *
 * La valeur est dérivée de la langue et non figée : le projet en sert treize, et deux d'entre
 * elles commencent bien la semaine le dimanche. Coder « lundi » en dur aurait corrigé le français
 * en cassant l'anglais.
 */
describe('premierJourDeSemaine', () => {
  it('rend lundi pour le français', () => {
    expect(premierJourDeSemaine('fr')).toBe(1)
  })

  it('rend dimanche pour l’anglais américain', () => {
    // 0 dans la numérotation de `UCalendar`. C'est la raison pour laquelle on ne fige pas lundi.
    expect(premierJourDeSemaine('en-US')).toBe(0)
  })

  it('distingue deux variantes d’une même langue', () => {
    // L'anglais britannique commence le lundi, l'américain le dimanche.
    expect(premierJourDeSemaine('en-GB')).toBe(1)
    expect(premierJourDeSemaine('en-US')).toBe(0)
  })

  it('couvre les treize langues du projet sans jamais rendre de valeur hors bornes', () => {
    const langues = ['cs', 'da', 'de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sv', 'uk']

    for (const langue of langues) {
      const jour = premierJourDeSemaine(langue)
      expect(jour, langue).toBeGreaterThanOrEqual(0)
      expect(jour, langue).toBeLessThanOrEqual(6)
    }
  })

  it('retombe sur lundi plutôt que sur le dimanche de la bibliothèque', () => {
    // Le repli compte : c'est le dimanche par défaut qu'on cherche à corriger, et retomber
    // dessus ramènerait exactement le défaut signalé.
    expect(LUNDI).toBe(1)
    expect(premierJourDeSemaine(null)).toBe(LUNDI)
    expect(premierJourDeSemaine(undefined)).toBe(LUNDI)
    expect(premierJourDeSemaine('')).toBe(LUNDI)
  })

  it('ne casse pas sur une étiquette de langue illisible', () => {
    // `new Intl.Locale('n’importe quoi')` lève : un calendrier ne doit pas disparaître pour ça.
    expect(premierJourDeSemaine('n’importe quoi')).toBe(LUNDI)
    expect(premierJourDeSemaine('----')).toBe(LUNDI)
  })
})
