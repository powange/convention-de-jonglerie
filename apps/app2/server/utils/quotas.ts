/**
 * Les quotas de Flowvent : ce que la formule du PROPRIÉTAIRE d'un événement permet d'y ajouter.
 *
 * La grille, les seuils et la tolérance sont dans shared/formules.ts ; ici, on COMPTE et on
 * REFUSE. Quatre compteurs :
 * - `evenements` : les événements non archivés dont la personne est propriétaire ;
 * - `benevoles` : les candidatures ACCEPTÉES de l'événement (ajouts manuels compris), pas les
 *   candidatures en attente ou refusées ;
 * - `artistes` : les fiches d'artistes de l'événement, pas les candidatures d'appel à spectacles ;
 * - `organisateurs` : les co-organisateurs de l'événement, invitations en attente comprises (le
 *   propriétaire n'en est pas un).
 *
 * Un plafond ne retire et ne bloque jamais ce qui existe : il refuse seulement un AJOUT au-delà de
 * la marge tolérée. Un administrateur global n'est pas soumis aux quotas.
 */
import { createError } from 'h3'

import {
  COMPTEURS,
  etatQuota,
  formule,
  formuleQuiReleve,
  peutAjouter,
  plafondTolere,
} from '../../shared/formules'

import prisma from './prisma'
import { couvertureDe, couvertureDuCompte, selectionCouverture } from './subscription'

import type { Couverture } from './subscription'
import type { Compteur, EtatQuota } from '../../shared/formules'

export type CompteurParEvenement = Exclude<Compteur, 'evenements'>

/** L'usage d'un compteur PAR ÉVÉNEMENT. */
export async function usageDeLEvenement(
  eventId: number,
  compteur: CompteurParEvenement
): Promise<number> {
  switch (compteur) {
    case 'benevoles':
      return prisma.editionVolunteerApplication.count({ where: { eventId, status: 'ACCEPTED' } })
    case 'artistes':
      return prisma.editionArtist.count({ where: { editionId: eventId } })
    case 'organisateurs':
      return prisma.editionOrganizer.count({ where: { editionId: eventId } })
  }
}

/** Les événements EN COURS (non archivés) d'un propriétaire. */
export function evenementsEnCours(ownerId: number): Promise<number> {
  return prisma.event.count({ where: { ownerId, archivedAt: null } })
}

/** Le propriétaire d'un événement et sa couverture. */
async function proprietaireEtCouverture(eventId: number) {
  const evenement = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true, owner: { select: { subscription: { select: selectionCouverture } } } },
  })
  if (!evenement) throw createError({ status: 404, message: 'Événement introuvable' })
  return { ownerId: evenement.ownerId, couverture: couvertureDe(evenement.owner.subscription) }
}

async function estAdministrateur(userId: number | undefined) {
  if (!userId) return false
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } })
  return !!u?.isGlobalAdmin
}

/** Le message d'un refus : ce qui est plein, et quelle formule le permet. */
export function messageDeRefus(compteur: Compteur, couverture: Couverture): string {
  const plafond = couverture.plafonds[compteur] ?? 0
  const nom = formule(couverture.formule)!.libelle
  const unite = COMPTEURS.find((c) => c.cle === compteur)!.unite(plafond)
  // Une marge n'existe qu'au-delà de 10 plafonnés (arrondi à l'inférieur) : n'en parler que là.
  const marge = (plafondTolere(plafond) ?? 0) > plafond ? ', marge de 10 % comprise' : ''
  const releve = formuleQuiReleve(couverture.formule, compteur)
  const definition = releve ? formule(releve)! : null
  const suite = definition
    ? ` La formule ${definition.libelle} en comprend ${definition.plafonds[compteur] ?? 'un nombre illimité'}.`
    : ' Contactez-nous pour une formule sur devis.'
  return `La formule ${nom} comprend ${unite} : la limite est atteinte${marge}.${suite}`
}

/**
 * Garde d'AJOUT par événement : lève une 402 si ajouter `nombre` éléments dépasse la marge tolérée
 * par la formule du propriétaire. `userId` : la personne qui agit (un administrateur passe outre).
 */
export async function verifierAjout(
  eventId: number,
  compteur: CompteurParEvenement,
  options: { nombre?: number; userId?: number } = {}
): Promise<void> {
  if (await estAdministrateur(options.userId)) return
  const { couverture } = await proprietaireEtCouverture(eventId)
  const plafond = couverture.plafonds[compteur]
  if (plafond === null) return
  const usage = await usageDeLEvenement(eventId, compteur)
  if (!peutAjouter(usage, plafond, options.nombre ?? 1)) {
    throw createError({ status: 402, message: messageDeRefus(compteur, couverture) })
  }
}

/** Garde de CRÉATION (ou de désarchivage) d'un événement par `ownerId`. */
export async function verifierNouvelEvenement(ownerId: number): Promise<void> {
  if (await estAdministrateur(ownerId)) return
  const couverture = await couvertureDuCompte(ownerId)
  const plafond = couverture.plafonds.evenements
  if (plafond === null) return
  if (!peutAjouter(await evenementsEnCours(ownerId), plafond)) {
    throw createError({ status: 402, message: messageDeRefus('evenements', couverture) })
  }
}

/**
 * Le propriétaire a-t-il plus d'événements en cours que sa formule n'en tolère ? Cela arrive après
 * une fin d'abonnement ou une descente de formule : la gestion de ses événements en cours passe
 * alors en lecture seule, jusqu'à ce qu'il en archive assez (il choisit lesquels).
 */
export async function evenementsEnSurnombre(ownerId: number, couverture: Couverture) {
  const tolere = plafondTolere(couverture.plafonds.evenements)
  if (tolere === null) return false
  return (await evenementsEnCours(ownerId)) > tolere
}

export interface EtatDesQuotas {
  formule: Couverture['formule']
  payant: boolean
  compteurs: { cle: Compteur; usage: number; plafond: number | null; etat: EtatQuota }[]
}

/** L'état des quatre compteurs d'un événement, pour l'affichage (jauges). */
export async function etatDesQuotas(eventId: number): Promise<EtatDesQuotas> {
  const { ownerId, couverture } = await proprietaireEtCouverture(eventId)
  const usages: Record<Compteur, number> = {
    evenements: await evenementsEnCours(ownerId),
    benevoles: await usageDeLEvenement(eventId, 'benevoles'),
    artistes: await usageDeLEvenement(eventId, 'artistes'),
    organisateurs: await usageDeLEvenement(eventId, 'organisateurs'),
  }
  return {
    formule: couverture.formule,
    payant: couverture.payant,
    compteurs: COMPTEURS.map((c) => ({
      cle: c.cle,
      usage: usages[c.cle],
      plafond: couverture.plafonds[c.cle],
      etat: etatQuota(usages[c.cle], couverture.plafonds[c.cle]),
    })),
  }
}
