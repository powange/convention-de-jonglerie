/**
 * La décision « ce changement de créneau mérite-t-il de prévenir ? » — constat B4.
 *
 * Séparée de l'envoi (`notification-creneau.ts`, qui touche la base et le port de notification)
 * parce qu'elle est **pure** : c'est le même partage que `publication-plannings.ts` face à
 * `planning-publie.ts`, et il permet de l'éprouver hors Nuxt, où les alias `#server` n'existent
 * pas.
 */

/** Ce qu'il faut connaître d'un créneau pour décider s'il a bougé. */
export interface EtatDuCreneau {
  startDateTime: Date
  endDateTime: Date
  teamId: string | null
  delayMinutes: number | null
}

/**
 * Le créneau a-t-il bougé d'une façon qui se voit sur le terrain ?
 *
 * ⚠️ LES DATES SE COMPARENT PAR LEUR INSTANT, jamais par l'objet. Enregistrer le formulaire sans
 * toucher aux dates renvoie le même instant sous la forme d'une AUTRE instance de `Date` :
 * comparer les objets enverrait une notification à chaque enregistrement, et le jour où l'horaire
 * change vraiment plus personne ne les lirait. Ce défaut a déjà été payé sur le covoiturage.
 *
 * `delayMinutes` compte, même si la « note de retard » est un geste conscient côté écran : c'est
 * l'heure à laquelle on doit se présenter qui change.
 *
 * ⚠️ Ce qui n'y figure PAS est une décision : le titre, la description et le nombre de places ne
 * déplacent personne, et notifier là-dessus ferait partir un message à chaque correction de faute
 * de frappe — sur un écran qu'on corrige beaucoup.
 */
export function changementNotable(avant: EtatDuCreneau, apres: EtatDuCreneau): boolean {
  return (
    avant.startDateTime.getTime() !== apres.startDateTime.getTime() ||
    avant.endDateTime.getTime() !== apres.endDateTime.getTime() ||
    avant.teamId !== apres.teamId ||
    (avant.delayMinutes ?? null) !== (apres.delayMinutes ?? null)
  )
}
