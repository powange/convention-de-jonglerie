/**
 * Qui peut quoi sur un événement Flowvent — la règle écrite une fois.
 *
 * - le PROPRIÉTAIRE (créateur) peut tout, et lui seul (avec un administrateur) supprime ;
 * - un ORGANISATEUR déclaré (`EditionOrganizer`) voit la gestion, et a les droits par domaine
 *   qu'on lui a donnés (la liste : `DROITS_PAR_DOMAINE`, shared/modules-evenement.ts) ;
 * - un ADMINISTRATEUR global peut tout.
 *
 * Abonnement (décisions de l'utilisateur, 26/11/2026) : tous les modules sont compris dans toutes
 * les formules, et tout compte a au moins la formule gratuite. La gestion ne passe donc en LECTURE
 * SEULE que dans deux cas, sans jamais rien supprimer :
 * - l'événement est ARCHIVÉ ;
 * - son propriétaire a plus d'événements en cours que sa formule n'en tolère (fin d'abonnement,
 *   descente de formule) : il en archive pour reprendre la main.
 * Les plafonds de bénévoles, d'artistes et d'organisateurs, eux, ne bloquent que les AJOUTS
 * (server/utils/quotas.ts).
 */

import { useEvent } from 'nitropack/runtime'

import { DROITS_PAR_DOMAINE, MODULES_EVENEMENT } from '../../shared/modules-evenement'

import { etatDesQuotas, evenementsEnSurnombre } from './quotas'
import { couvertureDe, selectionCouverture } from './subscription'

import type { ColonneDroit, ColonneModule, Droits, Modules } from '../../shared/modules-evenement'

export type DroitsEvenement = Droits & {
  /** Voir l'événement et sa gestion. */
  voir: boolean
  /** Le supprimer, avec toutes ses données. */
  supprimer: boolean
  estProprietaire: boolean
}

/** Les colonnes d'activation de tous les modules, pour un `select` Prisma. */
export const selectionModules = Object.fromEntries(
  MODULES_EVENEMENT.map((m) => [m.colonne, true])
) as Record<ColonneModule, true>

/** Les modules actifs, dans le vocabulaire de l'API (`{ benevoles: true, stock: false… }`). */
export function modulesAffiches(e: Record<ColonneModule, boolean>): Modules {
  return Object.fromEntries(MODULES_EVENEMENT.map((m) => [m.cle, e[m.colonne]])) as Modules
}

/** Les colonnes de tous les droits par domaine, pour un `select` Prisma. */
export const selectionDroits = Object.fromEntries(
  DROITS_PAR_DOMAINE.map((d) => [d.colonne, true])
) as Record<ColonneDroit, true>

const AUCUN = {
  ...(Object.fromEntries(DROITS_PAR_DOMAINE.map((d) => [d.cle, false])) as Droits),
  voir: false,
  supprimer: false,
  estProprietaire: false,
} satisfies DroitsEvenement

/**
 * La requête en cours est-elle une lecture ? Lu par le contexte asynchrone de Nitro
 * (`nitro.experimental.asyncContext`, nuxt.config.ts). Hors requête (tâche planifiée) ou si le
 * contexte manque : non — on retient la règle la plus stricte.
 */
function requeteEnLecture(): boolean {
  try {
    const methode = useEvent().method
    return methode === 'GET' || methode === 'HEAD'
  } catch {
    return false
  }
}

export type RaisonLectureSeule = 'archive' | 'surnombre'

/**
 * Pourquoi la gestion de l'événement est en lecture seule, ou `null` si elle est ouverte. Hors
 * administrateur.
 */
export async function lectureSeuleDeLEvenement(
  eventId: number
): Promise<RaisonLectureSeule | null> {
  const evenement = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      archivedAt: true,
      ownerId: true,
      owner: { select: { subscription: { select: selectionCouverture } } },
    },
  })
  if (!evenement) return null
  if (evenement.archivedAt) return 'archive'
  const couverture = couvertureDe(evenement.owner.subscription)
  return (await evenementsEnSurnombre(evenement.ownerId, couverture)) ? 'surnombre' : null
}

export async function droitsSurEvenement(
  eventId: number,
  userId: number
): Promise<DroitsEvenement> {
  const [evenement, utilisateur, organisateur] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { isGlobalAdmin: true },
    }),
    prisma.editionOrganizer.findFirst({
      where: { editionId: eventId, organizer: { userId } },
      select: selectionDroits,
    }),
  ])
  if (!evenement) return AUCUN
  const estProprietaire = evenement.ownerId === userId
  const administrateur = !!utilisateur?.isGlobalAdmin
  const tout = estProprietaire || administrateur
  // Un administrateur n'est tenu ni par l'archivage ni par l'abonnement d'autrui ; les autres, si.
  // Une lecture reste toujours permise : rien n'est jamais caché.
  const ouvert =
    administrateur || requeteEnLecture() || (await lectureSeuleDeLEvenement(eventId)) === null
  const parDomaine = Object.fromEntries(
    DROITS_PAR_DOMAINE.map((d) => [d.cle, (tout || !!organisateur?.[d.colonne]) && ouvert])
  ) as Droits
  return {
    ...parDomaine,
    voir: tout || !!organisateur,
    supprimer: tout,
    estProprietaire,
  }
}

/**
 * La gestion de l'événement est-elle ouverte en écriture pour cette personne ? Oui sauf archivage
 * ou surnombre d'événements (`lectureSeuleDeLEvenement`) — et toujours pour un administrateur.
 */
export async function gestionOuverte(eventId: number, userId: number): Promise<boolean> {
  const utilisateur = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGlobalAdmin: true },
  })
  return !!utilisateur?.isGlobalAdmin || (await lectureSeuleDeLEvenement(eventId)) === null
}

/**
 * Ce que la gestion dit de son état, à l'accueil et dans la barre latérale : pourquoi elle est en
 * lecture seule (ou `null`), et les quotas de la formule du propriétaire.
 */
export async function etatDeLaGestion(eventId: number, userId: number) {
  const [utilisateur, quotas] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } }),
    etatDesQuotas(eventId),
  ])
  const lectureSeule = utilisateur?.isGlobalAdmin ? null : await lectureSeuleDeLEvenement(eventId)
  return {
    lectureSeule,
    quotas,
    // ⚠️ Compatibilité, à retirer au lot suivant : les pages ouvertes AVANT le passage aux formules
    // à la taille lisent encore ces deux champs (un module « hors formule » y passait en lecture
    // seule). Tous les modules sont désormais couverts.
    abonnementActif: lectureSeule === null,
    abonnement: {
      actif: lectureSeule === null,
      formule: quotas.formule,
      modules: MODULES_EVENEMENT.map((m) => m.cle),
    },
  }
}
