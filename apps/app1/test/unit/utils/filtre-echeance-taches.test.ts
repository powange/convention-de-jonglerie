import { describe, expect, it } from 'vitest'

import {
  correspondAuFiltreEcheance,
  filtrerParEcheance,
  type FiltreEcheance,
} from '../../../shared/utils/filtre-echeance-taches'

/**
 * Les filtres d'échéance des tâches, découpés à l'heure de l'édition — constat B4.
 *
 * ## ⚠️ CE QUI REND CES CAS NON CREUX : DEUX FUSEAUX, ET UN INSTANT CHOISI
 *
 * Un filtre de dates est vert par accident la plupart du temps. Pour que la mesure distingue
 * « découpé sur place » de « découpé chez le lecteur », il faut un instant où les deux découpages
 * ne tombent PAS le même jour — sans quoi le test resterait vert avec l'ancien code.
 *
 * L'instant de référence est donc `2026-10-11T22:30:00Z` :
 *
 * | fuseau | date et heure sur place | journée |
 * | --- | --- | --- |
 * | `Europe/Paris` (UTC+2) | 12 oct. à 00 h 30 | **12 octobre** |
 * | `Pacific/Honolulu` (UTC−10) | 11 oct. à 12 h 30 | **11 octobre** |
 *
 * Un jour entier d'écart, à la même seconde. Chaque cas est joué dans les DEUX fuseaux, et c'est
 * l'écart entre les deux réponses qui porte la preuve — pas la réponse elle-même.
 *
 * 📍 Et l'heure de la MACHINE n'intervient jamais : `maintenant` est un paramètre. C'est la seule
 * forme qui se mesure, le défaut d'origine étant précisément de lire une pendule locale.
 */
const PARIS = 'Europe/Paris'
const HONOLULU = 'Pacific/Honolulu'
const MAINTENANT = new Date('2026-10-11T22:30:00Z')

const tache = (deadline: string | null, status = 'TODO') => ({ deadline, status })

const passe = (
  deadline: string | null,
  filtre: FiltreEcheance,
  fuseau: string | null,
  status = 'TODO'
) => correspondAuFiltreEcheance(tache(deadline, status), filtre, MAINTENANT, fuseau)

describe('filtre d’échéance des tâches', () => {
  describe('« aujourd’hui » suit le lieu, pas le lecteur', () => {
    it('⚠️ LA MÊME ÉCHÉANCE EST « AUJOURD’HUI » À PARIS ET PAS À HONOLULU', async () => {
      // 12 oct. 22 h à Paris (donc « aujourd'hui », le 12) ; 12 oct. 10 h à Honolulu, où l'on est
      // encore le 11 : la même échéance y est DEMAIN.
      const echeance = '2026-10-12T20:00:00Z'

      expect(passe(echeance, 'today', PARIS)).toBe(true)
      expect(passe(echeance, 'today', HONOLULU)).toBe(false)
    })

    it('et réciproquement : « aujourd’hui » à Honolulu, HIER à Paris', () => {
      /*
       * LE TÉMOIN SYMÉTRIQUE. Sans lui, une fonction qui répondrait TOUJOURS « oui à Paris, non à
       * Honolulu » — par exemple en comparant au mauvais jour — satisferait le cas précédent.
       */
      const echeance = '2026-10-11T20:00:00Z' // 11 oct. 10 h à Honolulu, 11 oct. 22 h à Paris

      expect(passe(echeance, 'today', HONOLULU)).toBe(true)
      expect(passe(echeance, 'today', PARIS)).toBe(false)
    })

    it('la frontière est bien MINUIT SUR PLACE, à la minute', () => {
      /*
       * 📍 C'est ici que j'avais pris mon propre raisonnement à l'envers, et le test l'a dit : à
       * l'instant de référence il est 00 h 30 à Paris, donc « aujourd'hui » y est DÉJÀ le 12. Les
       * échéances « du jour » à Paris commencent à 22 h UTC la veille — ce qui ne ressemble à rien
       * tant qu'on ne l'écrit pas.
       */
      expect(passe('2026-10-11T21:59:00Z', 'today', PARIS)).toBe(false) // 11 oct. 23 h 59 à Paris
      expect(passe('2026-10-11T22:01:00Z', 'today', PARIS)).toBe(true) // 12 oct. 00 h 01 à Paris
    })

    it('sans fuseau, retombe sur le découpage d’avant — celui de la machine', () => {
      /*
       * 📍 Une édition peut n'annoncer AUCUN fuseau (import, saisie ancienne). `journeeDans` lit
       * alors la zone locale, c'est-à-dire exactement le comportement d'avant ce lot. Ne pas
       * inventer un fuseau par défaut : ce serait affirmer un lieu qu'on ignore.
       */
      const journeeLocale = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(MAINTENANT)
      const echeance = new Date(`${journeeLocale}T12:00:00`).toISOString()

      expect(passe(echeance, 'today', null)).toBe(true)
    })
  })

  describe('« 7 prochains jours » et « 30 prochains jours »', () => {
    it('⚠️ LA BORNE SE DÉPLACE AVEC LE LIEU', async () => {
      /*
       * À Paris on est le 12 : la fenêtre va jusqu'au 19 inclus. À Honolulu on est le 11 : elle
       * s'arrête au 18. Une échéance du 19 départage les deux découpages.
       */
      const echeance = '2026-10-19T12:00:00Z'

      expect(passe(echeance, 'next7', PARIS)).toBe(true)
      expect(passe(echeance, 'next7', HONOLULU)).toBe(false)
    })

    it('couvre huit journées depuis aujourd’hui, bornes comprises', () => {
      /*
       * Comportement d'AVANT ce lot, conservé tel quel et figé ici pour qu'on ne le change pas
       * sans le vouloir : la fenêtre part du début d'aujourd'hui et court jusqu'à la fin du
       * septième jour — donc huit journées calendaires, non sept.
       */
      expect(passe('2026-10-12T06:00:00Z', 'next7', PARIS)).toBe(true) // aujourd'hui
      expect(passe('2026-10-19T21:00:00Z', 'next7', PARIS)).toBe(true) // +7, dernier jour
      expect(passe('2026-10-20T06:00:00Z', 'next7', PARIS)).toBe(false) // +8
    })

    it('franchit un changement de mois sans se tromper d’un jour', () => {
      // +30 jours après le 12 octobre : le 11 novembre. Le mois change, et octobre a 31 jours.
      expect(passe('2026-11-11T12:00:00Z', 'next30', PARIS)).toBe(true)
      expect(passe('2026-11-12T12:00:00Z', 'next30', PARIS)).toBe(false)
    })

    it('⚠️ une échéance DÉJÀ PASSÉE ce matin reste dans la fenêtre', () => {
      /*
       * Également le comportement d'avant, et il surprend : la fenêtre commence au DÉBUT
       * d'aujourd'hui. Une tâche due ce matin à 9 h figure donc dans « 7 prochains jours ». Figé
       * ici parce que le corriger est un choix de produit, pas un effet de bord à glisser dans un
       * lot qui parle de fuseaux.
       */
      expect(passe('2026-10-12T00:45:00Z', 'next7', PARIS)).toBe(true)
    })
  })

  describe('« en retard » ne se découpe pas en journées', () => {
    it('compare des instants, donc répond pareil dans les deux fuseaux', () => {
      /*
       * ⚠️ DÉCISION, ET ELLE EST FIGÉE ICI : « ce moment est-il passé ? » se tranche entre deux
       * instants, sans qu'aucun fuseau n'intervienne. Le ramener au jour rendrait « en retard »
       * une tâche due ce soir à 23 h.
       */
      const passee = '2026-10-11T22:00:00Z'
      const aVenir = '2026-10-11T23:00:00Z'

      for (const fuseau of [PARIS, HONOLULU, null]) {
        expect(passe(passee, 'overdue', fuseau)).toBe(true)
        expect(passe(aVenir, 'overdue', fuseau)).toBe(false)
      }
    })

    it('une tâche close n’est jamais en retard', () => {
      const passee = '2026-10-11T22:00:00Z'
      expect(passe(passee, 'overdue', PARIS, 'DONE')).toBe(false)
      expect(passe(passee, 'overdue', PARIS, 'CANCELLED')).toBe(false)
      expect(passe(passee, 'overdue', PARIS, 'IN_PROGRESS')).toBe(true)
    })
  })

  describe('les cas qui ne dépendent d’aucun fuseau', () => {
    it('« sans échéance » ne retient que celles-là', () => {
      expect(passe(null, 'none', PARIS)).toBe(true)
      expect(passe('2026-10-12T08:00:00Z', 'none', PARIS)).toBe(false)
    })

    it('une tâche sans échéance ne passe aucune fenêtre', () => {
      for (const filtre of ['today', 'next7', 'next30', 'overdue'] as FiltreEcheance[]) {
        expect(passe(null, filtre, PARIS), filtre).toBe(false)
      }
    })

    it('une date illisible n’entre dans aucune fenêtre', () => {
      // Mieux vaut l'absence qu'une tâche rangée au hasard dans « aujourd'hui ».
      expect(passe('pas une date', 'today', PARIS)).toBe(false)
      expect(passe('pas une date', 'next7', PARIS)).toBe(false)
    })

    it('« all » ne filtre rien, et rend la liste TELLE QUELLE', () => {
      /*
       * L'identité de l'objet compte : la liste traverse la fonction sans copie, ce qui évite un
       * rendu de plus sur un écran qui n'a rien filtré.
       */
      const liste = [tache(null), tache('2026-10-12T08:00:00Z')]
      expect(filtrerParEcheance(liste, 'all', MAINTENANT, PARIS)).toBe(liste)
    })

    it('conserve l’ordre d’origine', () => {
      const liste = [
        tache('2026-10-19T12:00:00Z'),
        tache('2026-10-12T08:00:00Z'),
        tache('2026-10-15T08:00:00Z'),
      ]
      const retenues = filtrerParEcheance(liste, 'next7', MAINTENANT, PARIS)
      expect(retenues.map((t) => t.deadline)).toEqual([
        '2026-10-19T12:00:00Z',
        '2026-10-12T08:00:00Z',
        '2026-10-15T08:00:00Z',
      ])
    })
  })
})
