/**
 * Combien de temps on garde une erreur, et à partir de quelle date on compte.
 *
 * La règle était écrite deux fois à l'identique — dans le bouton de l'écran d'administration et
 * dans la tâche planifiée —, avec la même fenêtre de trente jours recopiée quatre fois en tout.
 * Deux copies ne divergent pas tant que personne n'y touche ; c'est la modification suivante,
 * faite d'un seul côté, qui coûte : l'autre continuerait tranquillement à trente jours sans que
 * rien ne le signale.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Les deux durées de conservation, en jours. */
export interface FenetresDeRetention {
  /** Une erreur qu'un administrateur a examinée puis refermée. */
  resolues: number
  /** Une erreur que personne n'a encore regardée. */
  nonResolues: number
}

/**
 * Les durées retenues.
 *
 * Elles sont volontairement **différentes**, alors que le code n'en connaissait qu'une seule.
 * Une erreur résolue a fait son travail : elle a été lue, comprise, corrigée, et la garder plus
 * longtemps n'apprend rien. Une erreur que personne n'a ouverte est exactement l'inverse — c'est
 * celle qu'on voudra retrouver le jour où la panne revient, et la détruire au bout d'un mois
 * efface la seule trace de ce qui s'est passé.
 */
export const RETENTION_PAR_DEFAUT: FenetresDeRetention = {
  resolues: 30,
  nonResolues: 90,
}

/** Les deux sélections à passer à `deleteMany`, ou à `count` pour les annoncer avant. */
export interface CriteresDePurge {
  resolues: { resolved: true; resolvedAt: { lt: Date } }
  nonResolues: { resolved: false; createdAt: { lt: Date } }
}

/** Le même instant, reculé d'un nombre de jours. */
function ilYA(maintenant: Date, jours: number): Date {
  return new Date(maintenant.getTime() - jours * 24 * 60 * 60 * 1000)
}

/**
 * Ce qui doit disparaître, à l'instant donné.
 *
 * L'instant est passé en paramètre plutôt que lu ici : un test qui dépend de l'heure courante ne
 * prouve rien, et finit par échouer un jour sans que personne ne comprenne pourquoi.
 *
 * Les deux familles ne comptent pas depuis la même date, et c'est voulu :
 *
 * - une erreur **résolue** compte depuis sa résolution (`resolvedAt`) — ce qui la date est le
 *   moment où quelqu'un s'en est occupé, pas celui où elle est survenue ;
 * - une erreur **non résolue** n'a pas de résolution à dater : elle compte depuis son apparition.
 *
 * Effet de bord à connaître : une entrée marquée résolue dont `resolvedAt` serait nul échappe à
 * la purge, `lt` ne retenant jamais `NULL`. Le cas ne devrait pas exister — `resolve.patch.ts`
 * écrit toujours les deux champs ensemble — et le laisser échapper vaut mieux que de supprimer
 * sur une date absente.
 */
export function criteresDePurge(
  maintenant: Date,
  fenetres: FenetresDeRetention = RETENTION_PAR_DEFAUT
): CriteresDePurge {
  return {
    resolues: {
      resolved: true,
      resolvedAt: { lt: ilYA(maintenant, fenetres.resolues) },
    },
    nonResolues: {
      resolved: false,
      createdAt: { lt: ilYA(maintenant, fenetres.nonResolues) },
    },
  }
}
