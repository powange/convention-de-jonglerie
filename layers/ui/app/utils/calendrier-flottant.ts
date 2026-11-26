/**
 * Les dates d'EventCalendar à l'heure du LIEU de l'édition.
 *
 * ## Le problème
 *
 * FullCalendar acceptait un fuseau NOMMÉ (« Europe/Paris », par son greffon luxon). EventCalendar
 * n'accepte que `local`, `UTC` ou un décalage FIXE (« +02:00 ») — or un décalage fixe se trompe
 * d'une heure dès que la période chevauche un changement d'heure, et le fuseau du navigateur se
 * trompe pour qui regarde depuis ailleurs.
 *
 * ## La solution : des dates « flottantes »
 *
 * EventCalendar affiche telle quelle une date SANS décalage (« 2027-07-10T18:00 ») : c'est une
 * heure murale. On lui remet donc chaque instant déjà converti en heure du lieu
 * (`versChampLocal`, changements d'heure compris), et l'on reconvertit en instant à l'aller
 * retour (`versInstant`) ce que l'utilisateur glisse, étire ou sélectionne.
 *
 * Reste l'instant présent, que le calendrier place lui-même (barre de l'heure actuelle, bouton
 * « Aujourd'hui ») : il le lit dans son option `timeZone`, qu'on règle sur le décalage ACTUEL du
 * lieu. C'est le seul usage du décalage fixe, et il est exact par construction — il vaut pour
 * maintenant.
 */
import { DateTime } from 'luxon'

/** Options d'EventCalendar : un objet libre, ses clés sont décrites par la bibliothèque. */
export type OptionsCalendrier = Record<string, any>

/**
 * Le décalage actuel du lieu, au format qu'attend `timeZone` (« +02:00 »), ou `'local'` sans
 * fuseau utilisable.
 */
export function decalageDuFuseau(fuseau?: string | null): string {
  if (!fuseau) return 'local'
  const maintenant = DateTime.now().setZone(fuseau)
  return maintenant.isValid ? maintenant.toFormat('ZZ') : 'local'
}

/**
 * L'heure murale d'une date rendue par EventCalendar, `AAAA-MM-JJTHH:MM:SS`.
 *
 * Les rappels du calendrier (sélection, glisser, étirer) rendent des `Date` JavaScript dont les
 * champs LOCAUX portent l'heure affichée — celle du lieu, puisque les créneaux lui ont été
 * remis en heures murales. On relit donc ces champs, et non l'instant (`toISOString`), qui
 * dépendrait du fuseau du navigateur.
 */
export function heureMurale(date: Date): string {
  const deux = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}` +
    `T${deux(date.getHours())}:${deux(date.getMinutes())}:${deux(date.getSeconds())}`
  )
}
