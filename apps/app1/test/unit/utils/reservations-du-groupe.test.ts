import { describe, expect, it } from 'vitest'

import {
  fermetureBloqueePar,
  RESERVATIONS_FERMEES,
  reservationsOuvertesSur,
} from '../../../../../layers/stock/app/utils/reservations-du-groupe'

/**
 * Tout le matériel ne se réserve pas : un groupe « consommables » n'a que faire d'un calendrier et
 * de quantités par période. D'où un réglage par groupe.
 *
 * La décision tient en une ligne ; ce sont ses bords qui comptent, et notamment le défaut en
 * l'absence de réglage — où se joue la différence entre « on a oublié de configurer » et « c'est
 * ouvert à tout le monde ».
 */
describe('reservationsOuvertesSur', () => {
  it('ouvre quand le groupe le dit', () => {
    expect(reservationsOuvertesSur({ reservationsEnabled: true })).toBe(true)
  })

  it('ferme par défaut quand le groupe n’a rien configuré', () => {
    // Le point le plus important du fichier. Le défaut du schéma est `false`, et une règle qui
    // s'ouvre en cas de donnée manquante est une règle qui ne protège pas.
    for (const absence of [undefined, null, false])
      expect(reservationsOuvertesSur({ reservationsEnabled: absence })).toBe(false)

    expect(reservationsOuvertesSur(null)).toBe(false)
    expect(reservationsOuvertesSur(undefined)).toBe(false)
    expect(reservationsOuvertesSur({})).toBe(false)
  })

  it('n’accepte que le booléen vrai, pas ce qui lui ressemble', () => {
    // La valeur vient de la base ou d'une réponse d'API ; une valeur « à peu près vraie » — la
    // chaîne `"false"`, par exemple — ne doit pas ouvrir les réservations.
    for (const valeur of ['true', 'false', 1, 0, '', {}] as unknown[])
      expect(reservationsOuvertesSur({ reservationsEnabled: valeur as boolean })).toBe(false)
  })
})

describe('fermetureBloqueePar', () => {
  it('refuse de fermer tant qu’il reste des réservations', () => {
    // Décidé : on ne masque pas des réservations en les gardant en base. Des gens compteraient sur
    // du matériel réservé qui ne s'affiche plus nulle part, sans que rien ne le signale.
    expect(fermetureBloqueePar(1)).toBe(true)
    expect(fermetureBloqueePar(37)).toBe(true)
  })

  it('laisse fermer un groupe qui n’en a plus', () => {
    expect(fermetureBloqueePar(0)).toBe(false)
  })
})

describe('RESERVATIONS_FERMEES', () => {
  it('est un code stable, que l’écran peut reconnaître', () => {
    // Comme `SWAPS_DISABLED` pour les échanges : l'écran doit distinguer « rien à afficher » de
    // « pas de réservation sur ce groupe », sans comparer des messages traduits.
    expect(RESERVATIONS_FERMEES).toBe('GROUP_RESERVATIONS_DISABLED')
  })
})
