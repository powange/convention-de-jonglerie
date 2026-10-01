/**
 * Quand une candidature à un appel à spectacles peut-elle encore être modifiée ?
 *
 * La règle est posée par le serveur, dans
 * `editions/[id]/shows-call/[showCallId]/my-application.put.ts` : la candidature doit être en
 * attente, l'appel ouvert (`PUBLIC` ou `PRIVATE`), et sa date limite ne pas être passée. Trois
 * écrans proposent le bouton « Modifier » — la liste des appels d'une édition, et les deux vues
 * de « Mes candidatures », détaillée et compacte. Chacun l'avait réécrite à sa façon, et chacune
 * des trois copies était fausse différemment :
 *
 * • la liste d'une édition cherchait l'appel dans la liste PUBLIQUE, qui exclut volontairement
 *   les appels `PRIVATE` : pour une candidature en attente à un appel privé encore ouvert, la
 *   recherche échouait et le bouton ne s'affichait JAMAIS ;
 * • les deux vues de « Mes candidatures » posaient
 *   `(statut === 'PENDING' && visibilité === 'PUBLIC') || visibilité === 'PRIVATE'` — la
 *   parenthèse laisse `PRIVATE` seul, sans aucune exigence de statut. Une candidature acceptée ou
 *   refusée sur un appel privé affichait « Modifier », et le clic menait sur une page qui répond
 *   « vous avez déjà candidaté » ;
 * • aucune des deux ne regardait la date limite, que le serveur refuse pourtant.
 *
 * D'où ce fichier : une seule réponse à une seule question. C'est exactement le motif que ce
 * dépôt a déjà payé sur « qui gère les bénévoles ? » et sur « qui peut voir cette édition ? ».
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Les visibilités d'un appel, telles que l'enum Prisma `ShowCallVisibility` les définit. */
export type VisibiliteAppel = 'OFFLINE' | 'CLOSED' | 'PRIVATE' | 'PUBLIC'

/**
 * Les visibilités sous lesquelles un appel accueille des candidatures.
 *
 * Écrites en clair plutôt que déduites en creux : une visibilité ajoutée plus tard à l'enum
 * n'ouvrira pas les candidatures sans que personne l'ait décidé.
 */
export const VISIBILITES_D_APPEL_OUVERT = ['PUBLIC', 'PRIVATE'] as const

/** Cet appel accueille-t-il des candidatures ? */
export function appelOuvertAuxCandidatures(visibilite: unknown): boolean {
  return (VISIBILITES_D_APPEL_OUVERT as readonly unknown[]).includes(visibilite)
}

/**
 * Les statuts d'édition sous lesquels une candidature est recevable.
 *
 * ⚠️ `OFFLINE` EN FAIT PARTIE, et ce n'est pas un oubli : toute édition NAÎT `OFFLINE`
 * (`editions/index.post.ts`, et le défaut du schéma), si bien que ce statut veut surtout dire
 * « pas encore publiée ». Or ouvrir un appel à spectacles avant de publier son édition est le
 * parcours normal — on réserve ses artistes des mois à l'avance. Refuser là a cassé trois
 * spécifications de bout en bout, et c'est ainsi qu'on l'a appris (#651).
 *
 * Seule l'ANNULATION ferme la porte : l'événement n'aura pas lieu. La liste est écrite en clair
 * pour que la question « ce statut accueille-t-il des candidatures ? » n'ait qu'une réponse, et
 * non une par point d'API.
 */
export const STATUTS_D_EDITION_QUI_ACCUEILLENT_DES_CANDIDATURES = [
  'PUBLISHED',
  'PLANNED',
  'OFFLINE',
] as const

/** Cette édition accueille-t-elle des candidatures, de par son seul statut ? */
export function editionAccueilleDesCandidatures(statut: unknown): boolean {
  return (STATUTS_D_EDITION_QUI_ACCUEILLENT_DES_CANDIDATURES as readonly unknown[]).includes(statut)
}

/** Ce que les écrans connaissent d'une candidature au moment de décider. */
export interface CandidatureAJuger {
  statut: unknown
  visibiliteAppel: unknown
  /** Absente quand l'appel n'impose aucune échéance : c'est un cas courant, pas une donnée manquante. */
  dateLimiteAppel?: string | Date | null
}

/**
 * Cette candidature est-elle encore modifiable par son auteur ?
 *
 * `maintenant` est un paramètre et non un `new Date()` enfoui : une règle qui se compare à
 * l'instant présent ne se teste pas autrement qu'en le fournissant, et ce dépôt a déjà perdu sept
 * tests sur des dates figées dans un cas voisin.
 */
export function candidatureModifiable(
  candidature: CandidatureAJuger,
  maintenant: Date = new Date()
): boolean {
  if (candidature.statut !== 'PENDING') return false
  if (!appelOuvertAuxCandidatures(candidature.visibiliteAppel)) return false

  const limite = candidature.dateLimiteAppel
  if (!limite) return true

  const instant = limite instanceof Date ? limite : new Date(limite)
  // Une date illisible ferme la porte : le serveur, lui, la comparera à ce qu'il a en base, et
  // proposer une action qu'il refusera est précisément le défaut qu'on répare.
  if (Number.isNaN(instant.getTime())) return false

  return maintenant <= instant
}
