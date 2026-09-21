import { describe, it, expect } from 'vitest'

import { lirePresenceArtiste } from '../../../shared/utils/presence-artiste'

/**
 * Le défaut d'origine : le filtre des repas des artistes avait été recopié de celui des
 * bénévoles, qui enregistrent leur présence en texte (`AAAA-MM-JJ_moment`). Un artiste, lui,
 * porte un vrai `DateTime`. Le code appelait donc `.split('_')` sur un objet `Date`, et rendait
 * un 500 pour tout artiste ayant des dates de présence — relevé en production.
 *
 * Ces tests verrouillent la traduction, et surtout le fait qu'elle se lise sur place.
 */
describe('lirePresenceArtiste', () => {
  const PARIS = 'Europe/Paris'

  describe('le moment de la journée se déduit de l’heure', () => {
    it.each([
      ['2026-09-28T09:30:00', 'morning'],
      ['2026-09-28T10:59:00', 'morning'],
      ['2026-09-28T11:00:00', 'noon'],
      ['2026-09-28T12:15:00', 'noon'],
      ['2026-09-28T14:00:00', 'afternoon'],
      ['2026-09-28T16:00:00', 'afternoon'],
      ['2026-09-28T18:00:00', 'evening'],
      ['2026-09-28T20:45:00', 'evening'],
    ])('%s → %s', (local, attendu) => {
      // L'instant est construit à l'heure de Paris, puisque c'est ainsi qu'il sera relu.
      const instant = new Date(`${local}+02:00`)
      expect(lirePresenceArtiste(instant, PARIS)?.moment).toBe(attendu)
    })
  })

  describe('la journée se découpe dans le fuseau de l’édition', () => {
    it('garde le jour qu’il est sur place pour une arrivée tardive', () => {
      // 23 h 30 à Paris, soit 21 h 30 UTC le même jour : la journée reste le 28.
      const instant = new Date('2026-09-28T23:30:00+02:00')
      expect(lirePresenceArtiste(instant, PARIS)?.journee).toBe('2026-09-28')
    })

    it('ne bascule pas au lendemain quand le fuseau est plus à l’est', () => {
      // Même instant, édition à Tokyo : il y est déjà le 29 — c'est la date sur place qui
      // compte, et non celle du serveur.
      const instant = new Date('2026-09-28T23:30:00+02:00')
      expect(lirePresenceArtiste(instant, 'Asia/Tokyo')?.journee).toBe('2026-09-29')
    })

    it('change aussi le moment de la journée selon le fuseau', () => {
      // 8 h à Paris, c'est 15 h à Tokyo : matin d'un côté, après-midi de l'autre.
      const instant = new Date('2026-09-28T08:00:00+02:00')
      expect(lirePresenceArtiste(instant, PARIS)?.moment).toBe('morning')
      expect(lirePresenceArtiste(instant, 'Asia/Tokyo')?.moment).toBe('afternoon')
    })
  })

  describe('les absences et les valeurs illisibles', () => {
    it.each([[null], [undefined], ['']])('rend null pour %s', (valeur) => {
      expect(lirePresenceArtiste(valeur as never, PARIS)).toBeNull()
    })

    it('rend null sur une date invalide plutôt que de filtrer sur une journée vide', () => {
      expect(lirePresenceArtiste(new Date('pas une date'), PARIS)).toBeNull()
      expect(lirePresenceArtiste('n’importe quoi', PARIS)).toBeNull()
    })

    it('fonctionne sans fuseau renseigné', () => {
      // Toutes les éditions n'en ont pas : le helper doit alors retomber sur un comportement
      // par défaut plutôt que de rendre null, sans quoi les dates cesseraient de filtrer.
      const resultat = lirePresenceArtiste(new Date('2026-09-28T09:00:00Z'), null)
      expect(resultat).not.toBeNull()
      expect(resultat!.journee).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  it('accepte une date déjà sous forme de chaîne', () => {
    // Prisma rend un objet Date, mais une réponse d'API sérialisée rend une chaîne ISO.
    const resultat = lirePresenceArtiste('2026-09-28T09:30:00+02:00', PARIS)
    expect(resultat).toEqual({ journee: '2026-09-28', moment: 'morning' })
  })
})
