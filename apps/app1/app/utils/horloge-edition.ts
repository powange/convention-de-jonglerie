import { versChampLocal, versInstant } from '~~/shared/utils/fuseau-edition'

/**
 * Le pont entre un couple « calendrier + heure » et l'instant qu'on enregistre.
 *
 * Deux écrans saisissent les dates d'une édition — le formulaire de création et la page
 * « Informations générales » de la gestion — et tous deux construisaient
 * `new Date(année, mois, jour, heures, minutes)`, c'est-à-dire une heure du fuseau de la MACHINE,
 * avant d'en faire un instant UTC. Un organisateur français qui créait une édition à Montréal
 * enregistrait donc un instant décalé de six heures, et le champ « fuseau horaire » rempli dans le
 * MÊME formulaire n'y changeait rien. La relecture souffrait du défaut inverse : `getHours()` lit
 * dans le fuseau de la machine, si bien qu'ouvrir le formulaire depuis un autre pays affichait une
 * autre heure que celle saisie — et un simple enregistrement la gravait.
 *
 * ⚠️ POURQUOI UN FICHIER PLUTÔT QUE DEUX COPIES. Les deux écrans avaient déjà les quatre mêmes
 * fonctions recopiées, et c'est ce qui a permis au défaut d'être identique des deux côtés. Ce
 * chantier a payé ce motif assez de fois — « qui gère les bénévoles ? », « cette candidature est-elle
 * modifiable ? » — pour ne pas le reproduire ici.
 *
 * 📍 Ces fonctions ne connaissent pas `CalendarDate` : elles acceptent n'importe quoi qui porte
 * `year`, `month` et `day`. C'est voulu — le type vient de `@internationalized/date`, qu'un test
 * unitaire n'a pas à charger, et le typage structurel suffit.
 */
export interface JourCivil {
  year: number
  month: number
  day: number
}

/**
 * L'horloge murale `AAAA-MM-JJTHH:MM` d'un jour et d'une heure, SANS fuseau.
 *
 * C'est la forme intermédiaire qui rend le reste possible : tant que la saisie reste une heure sans
 * fuseau, elle n'est ancrée nulle part, et un seul endroit décide où.
 */
export const horlogeMurale = (jour: JourCivil | null, heure: string | null): string | null => {
  if (!jour || !heure) return null
  const [h = '00', m = '00'] = heure.split(':')
  const mm = String(jour.month).padStart(2, '0')
  const jj = String(jour.day).padStart(2, '0')
  return `${jour.year}-${mm}-${jj}T${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

/**
 * L'instant correspondant à une horloge murale, dans le fuseau de l'édition.
 *
 * ⚠️ `versInstant` rend une chaîne VIDE plutôt qu'un instant inventé quand le fuseau annoncé est
 * inconnu — un cas réel, les fuseaux venant parfois d'un import. On ne fabrique pas pour autant une
 * `Date` invalide : elle partirait à l'API en `null` et EFFACERAIT la date sans que personne l'ait
 * demandé. `null` laisse la validation du formulaire faire son travail.
 *
 * Un fuseau ABSENT, lui, est légitime : plus de la moitié des éditions existantes n'en déclarent
 * pas, et la machine fait alors office de repère — exactement comme avant ce changement.
 */
export const ancrerHorloge = (mur: string | null, fuseau?: string | null): Date | null => {
  if (!mur) return null
  const instant = versInstant(mur, fuseau)
  return instant ? new Date(instant) : null
}

/** Ce qu'un instant donne à relire dans un calendrier et un champ d'heure. */
export interface HorlogeRelue {
  jour: JourCivil
  heure: string
}

/**
 * L'opération inverse : ce que le formulaire doit réafficher pour un instant déjà enregistré.
 *
 * Rendre les composantes plutôt qu'un objet de calendrier laisse chaque écran construire le type
 * qu'attend son composant, sans que ce fichier dépende de la bibliothèque de dates.
 */
export const relireHorloge = (
  instant: Date | string | null,
  fuseau?: string | null
): HorlogeRelue | null => {
  if (!instant) return null
  const mur = versChampLocal(instant, fuseau)
  if (!mur) return null
  const [datePart = '', heure = ''] = mur.split('T')
  const [annee, mois, jour] = datePart.split('-').map(Number)
  if (!annee || !mois || !jour || !heure) return null
  return { jour: { year: annee, month: mois, day: jour }, heure }
}
