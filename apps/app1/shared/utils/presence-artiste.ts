import { journeeDans, versChampLocal } from './fuseau-edition'

/**
 * Traduire la présence d'un artiste dans le vocabulaire des repas.
 *
 * Les bénévoles enregistrent leur présence en texte, au format `AAAA-MM-JJ_moment` — le moment
 * valant `morning`, `noon`, `afternoon` ou `evening`. Les artistes, eux, ont une vraie date avec
 * une heure : `EditionArtist.arrivalDateTime` est un `DateTime`, écrit par un `z.coerce.date()`.
 *
 * Le filtre des repas des artistes avait été recopié de celui des bénévoles sans cette
 * différence, et appelait donc `.split('_')` sur un objet `Date`. Résultat : un 500 sur
 * `/api/editions/:id/artists/:artistId/meals` pour tout artiste ayant une date de présence —
 * relevé en production le 21 septembre 2026, six fois en dix minutes.
 *
 * Ce module fait la traduction, une fois, à un seul endroit.
 */

export type MomentDeLaJournee = 'morning' | 'noon' | 'afternoon' | 'evening'

export interface PresenceLue {
  /** Journée `AAAA-MM-JJ`, découpée dans le fuseau de l'édition. */
  journee: string
  moment: MomentDeLaJournee
}

/**
 * Bornes horaires du découpage.
 *
 * Rien dans le dépôt ne les fixait : les bénévoles choisissent leur moment dans une liste, ils
 * n'en déduisent aucun d'une heure. Elles sont donc un choix, arrêté avec l'utilisateur, et non
 * une règle retrouvée quelque part — d'où le fait de les nommer ici plutôt que de les enfouir
 * dans une suite de comparaisons.
 */
const BORNES: { avant: number; moment: MomentDeLaJournee }[] = [
  { avant: 11, moment: 'morning' },
  { avant: 14, moment: 'noon' },
  { avant: 18, moment: 'afternoon' },
]
const MOMENT_PAR_DEFAUT: MomentDeLaJournee = 'evening'

/**
 * Lit une date de présence d'artiste dans le fuseau de l'édition.
 *
 * Le fuseau n'est pas un détail : une arrivée à 23 h 30 appartient au jour qu'il est **sur
 * place**, et découper ailleurs la ferait basculer au lendemain. C'est déjà la règle de
 * l'affichage, qui passe par `formaterDateHeure(…, fuseauEdition, …)`.
 *
 * Rend `null` quand la date est absente ou illisible, pour que l'appelant traite ce cas comme
 * une absence de contrainte plutôt que de filtrer sur une journée vide.
 */
export function lirePresenceArtiste(
  instant: Date | string | null | undefined,
  fuseau?: string | null
): PresenceLue | null {
  if (!instant) return null

  const journee = journeeDans(instant, fuseau)
  const local = versChampLocal(instant, fuseau)
  if (!journee || !local) return null

  const heure = Number(local.slice(11, 13))
  if (!Number.isFinite(heure)) return null

  const trouvee = BORNES.find((borne) => heure < borne.avant)
  return { journee, moment: trouvee?.moment ?? MOMENT_PAR_DEFAUT }
}
