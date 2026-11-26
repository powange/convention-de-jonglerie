/**
 * Qui peut quoi sur un événement Flowvent — la règle écrite une fois.
 *
 * - le PROPRIÉTAIRE (créateur) peut tout, et lui seul (avec un administrateur) supprime ;
 * - un ORGANISATEUR déclaré (`EditionOrganizer`) voit la gestion, et a les droits par domaine
 *   qu'on lui a donnés (la liste : `DROITS_PAR_DOMAINE`, shared/modules-evenement.ts) ;
 * - un ADMINISTRATEUR global peut tout.
 *
 * Abonnement (décisions de l'utilisateur) : c'est celui du PROPRIÉTAIRE qui ouvre la gestion de
 * l'événement, à lui comme à ses organisateurs ; un organisateur n'a pas besoin du sien. Depuis les
 * formules par module (shared/formules.ts), un droit de module ne s'exerce EN ÉCRITURE que si la
 * formule du propriétaire couvre ce module ; les droits sur l'événement lui-même (modifier, la
 * carte, les organisateurs) demandent seulement un abonnement actif. Ce qui n'est pas couvert reste
 * consultable : une fin d'abonnement ne supprime rien, la gestion passe en LECTURE SEULE.
 */

import { useEvent } from 'nitropack/runtime'

import { estModulePayant } from '../../shared/formules'
import { DROITS_PAR_DOMAINE, MODULES_EVENEMENT } from '../../shared/modules-evenement'

import { couvertureDe, selectionCouverture } from './subscription'

import type { Couverture } from './subscription'
import type {
  CleDroit,
  ColonneDroit,
  ColonneModule,
  Droits,
  Modules,
} from '../../shared/modules-evenement'

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

/** Le droit `cle` est-il couvert par l'abonnement du propriétaire ? */
export function droitCouvert(cle: CleDroit, couverture: Couverture) {
  if (!couverture.actif) return false
  const module = DROITS_PAR_DOMAINE.find((d) => d.cle === cle)?.module
  return !estModulePayant(module) || couverture.modules.includes(module)
}

/** La couverture de l'abonnement du propriétaire de l'événement (rien si l'événement n'existe pas). */
export async function couvertureDeLEvenement(eventId: number): Promise<Couverture> {
  const evenement = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      owner: { select: { subscription: { select: selectionCouverture } } },
    },
  })
  return couvertureDe(evenement?.owner.subscription)
}

export async function droitsSurEvenement(
  eventId: number,
  userId: number
): Promise<DroitsEvenement> {
  const [evenement, utilisateur, organisateur] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        ownerId: true,
        owner: { select: { subscription: { select: selectionCouverture } } },
      },
    }),
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
  const couverture = couvertureDe(evenement.owner.subscription)
  const lecture = requeteEnLecture()
  const parDomaine = Object.fromEntries(
    DROITS_PAR_DOMAINE.map((d) => {
      const accorde = tout || !!organisateur?.[d.colonne]
      // Un administrateur n'est pas tenu par l'abonnement d'autrui ; les autres, si.
      const ouvert = administrateur || lecture || droitCouvert(d.cle, couverture)
      return [d.cle, accorde && ouvert]
    })
  ) as Droits
  return {
    ...parDomaine,
    voir: tout || !!organisateur,
    supprimer: tout,
    estProprietaire,
  }
}

/**
 * La gestion de l'événement est-elle ouverte en écriture ? Oui si le propriétaire a un abonnement
 * actif (quelle que soit la formule) — ou si la personne est administrateur. Sinon, elle reste
 * consultable en lecture seule.
 */
export async function gestionOuverte(eventId: number, userId: number): Promise<boolean> {
  const [couverture, utilisateur] = await Promise.all([
    couvertureDeLEvenement(eventId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { isGlobalAdmin: true },
    }),
  ])
  return !!utilisateur?.isGlobalAdmin || couverture.actif
}
