/**
 * Le retard qu'on peut appliquer à un créneau de bénévoles, et ses bornes.
 *
 * Un créneau peut être décalé après coup — « on commence une demi-heure plus tard, le camion est en
 * retard » — sans toucher au planning lui-même. Le décalage peut aussi être NÉGATIF : on avance le
 * créneau. C'est pourquoi la borne basse n'est pas zéro.
 *
 * ⚠️ POURQUOI CES BORNES SONT PARTAGÉES, et non recopiées à trois endroits. Elles servent à trois
 * choses qui doivent s'accorder, faute de quoi le désaccord est SILENCIEUX :
 *
 * 1. le point d'API qui enregistre le retard le refuse au-delà ;
 * 2. la modale de saisie ne laisse pas le dépasser ;
 * 3. la tâche de rappel élargit sa requête de cette même marge — et c'est le point subtil. Elle
 *    cherche les créneaux qui commencent dans 28 à 32 minutes, mais le retard décale ce début. Si
 *    la marge de la requête était plus étroite que le retard autorisé, les créneaux les plus
 *    décalés ne seraient jamais chargés : leurs bénévoles ne recevraient AUCUN rappel, et rien
 *    n'apparaîtrait dans les journaux — la tâche aurait tourné, sans rien trouver.
 *
 * Douze heures de part et d'autre : au-delà, ce n'est plus un retard, c'est un autre créneau.
 *
 * (Le nom porte « bornes » parce que `layers/volunteers/app/utils/retard-creneau.ts` existe déjà et
 * s'occupe, lui, de l'AFFICHAGE d'un décalage. Deux fichiers homonymes dans des dossiers tous deux
 * auto-importés se lisent mal, même sans collision de symboles.)
 */
export const RETARD_MINUTES_MIN = -720
export const RETARD_MINUTES_MAX = 720

/**
 * De combien la tâche de rappel doit élargir sa fenêtre, en millisecondes.
 *
 * DÉRIVÉ des bornes, jamais écrit en dur : c'est le lien entre « ce qu'on accepte d'enregistrer » et
 * « ce qu'on pense à relire ». Le plus grand écart possible dans un sens ou dans l'autre.
 */
export const MARGE_RETARD_MS =
  Math.max(Math.abs(RETARD_MINUTES_MIN), Math.abs(RETARD_MINUTES_MAX)) * 60 * 1000

/**
 * Ce retard est-il dans les bornes ?
 *
 * `null` est accepté : c'est l'absence de retard, et la colonne est nullable. Un non-entier est
 * refusé — les minutes ne se comptent pas par fractions, et un `0.5` traverserait ensuite tous les
 * calculs de millisecondes sans qu'on le remarque.
 */
export function retardAccepte(minutes: number | null | undefined): boolean {
  if (minutes === null || minutes === undefined) return true
  if (!Number.isInteger(minutes)) return false
  return minutes >= RETARD_MINUTES_MIN && minutes <= RETARD_MINUTES_MAX
}
