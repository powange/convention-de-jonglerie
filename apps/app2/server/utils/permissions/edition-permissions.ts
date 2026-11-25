/**
 * Contrat d'hôte des layers partagés (stock, artistes, repas, billetterie…) : les fonctions de
 * droits qu'ils importent par `#server/utils/permissions/edition-permissions`, sous les noms et
 * signatures d'app1. App1 y applique ses règles (conventions, droits par édition) ; Flowvent les
 * ramène toutes à `droitsSurEvenement` (droits-evenement.ts), la règle écrite une fois.
 *
 * Les formes synchrones d'app1 (`canManageStock(edition, user)`) lisent une édition chargée par
 * `getEditionWithPermissions` : ici, celle-ci porte les droits DÉJÀ calculés pour la personne qui
 * l'a demandée. Pour une autre personne, la réponse est non — on ne prête pas les droits de l'un
 * à l'autre.
 */
import type { CleDroit } from '../../../shared/modules-evenement'
import type { DroitsEvenement } from '../droits-evenement'

import { DROITS_PAR_DOMAINE, MODULES_EVENEMENT } from '../../../shared/modules-evenement'
import { droitsSurEvenement } from '../droits-evenement'

interface UtilisateurPourDroits {
  id: number
  isGlobalAdmin?: boolean | null
}

export interface EditionWithPermissions {
  id: number
  name: string
  ownerId: number
  /** Vocabulaire d'app1 : le propriétaire tient lieu de créateur et d'auteur de la convention. */
  creatorId: number
  convention: { id: number; name: string; authorId: number; organizers: never[] }
  /** Les droits de `pourUtilisateur`, calculés au chargement. */
  droits: DroitsEvenement
  pourUtilisateur: number
  [cle: string]: unknown
}

export async function getEditionWithPermissions(
  eventId: number,
  options: { userId: number; requiredRights?: string[] }
): Promise<EditionWithPermissions | null> {
  const evenement = await prisma.event.findUnique({ where: { id: eventId } })
  if (!evenement) return null
  const droits = await droitsSurEvenement(eventId, options.userId)
  return {
    ...evenement,
    creatorId: evenement.ownerId,
    // Pas de convention dans Flowvent : l'événement en tient lieu (même id, même nom).
    convention: {
      id: evenement.id,
      name: evenement.name,
      authorId: evenement.ownerId,
      organizers: [],
    },
    droits,
    pourUtilisateur: options.userId,
  }
}

/**
 * Aucun droit sur un module pas encore porté (`disponible: false`) : ses points d'API, s'il en
 * existe dans un layer déjà chargé (les repas du layer bénévoles), visent des tables que Flowvent
 * n'a pas encore. Fermés, ils répondent 403 plutôt que 500.
 */
function modulePorte(cle: CleDroit | 'voir' | 'supprimer'): boolean {
  const module = DROITS_PAR_DOMAINE.find((d) => d.cle === cle)?.module
  return !module || !!MODULES_EVENEMENT.find((m) => m.cle === module)?.disponible
}

function droitSurEdition(cle: CleDroit | 'voir' | 'supprimer') {
  return (edition: EditionWithPermissions | null | undefined, user: UtilisateurPourDroits) =>
    modulePorte(cle) && !!edition && edition.pourUtilisateur === user.id && edition.droits[cle]
}

function droitParId(cle: CleDroit | 'voir') {
  return async (eventId: number, userId: number, _event?: unknown): Promise<boolean> =>
    modulePorte(cle) && (await droitsSurEvenement(eventId, userId))[cle]
}

// Formes synchrones, sur une édition chargée par `getEditionWithPermissions`.
export const canViewEdition = droitSurEdition('voir')
export const canEditEdition = droitSurEdition('modifier')
export const canDeleteEdition = droitSurEdition('supprimer')
export const canManageEditionOrganizers = droitSurEdition('organisateurs')
export const canManageStock = droitSurEdition('stock')
export const canManageArtists = droitSurEdition('artistes')
export const canManageMeals = droitSurEdition('repas')
export const canManageTicketing = droitSurEdition('billetterie')

/**
 * L'événement, à condition que la personne puisse le modifier : 404 s'il n'existe pas ou qu'elle
 * ne le voit pas, 403 sinon. Même contrat qu'app1 (la carte du site l'emploie).
 */
export async function getEditionForEdit(
  eventId: number,
  user: UtilisateurPourDroits
): Promise<EditionWithPermissions> {
  const edition = await getEditionWithPermissions(eventId, { userId: user.id })
  if (!edition || !edition.droits.voir) {
    throw createError({ status: 404, message: 'Événement introuvable' })
  }
  if (!edition.droits.modifier) {
    throw createError({
      status: 403,
      message: "Vous n'avez pas les droits pour modifier cet événement",
    })
  }
  return edition
}

// Formes par identifiant.
export const canEditEditionById = droitParId('modifier')
export const canManageArtistsById = droitParId('artistes')
export const canManageMealsById = droitParId('repas')
export const canManageTicketingById = droitParId('billetterie')
export const canManageTreasuryById = droitParId('tresorerie')

/** Les données de gestion d'un événement : quiconque en voit la gestion (organisateur déclaré). */
export const canAccessEditionData = droitParId('voir')

/**
 * Gestion OU bénévole en créneau actif de contrôle d'accès (le scan des billets) — même règle
 * qu'app1, la seconde moitié venant du layer bénévoles.
 */
export async function canAccessEditionDataOrAccessControl(
  eventId: number,
  userId: number,
  event?: unknown
): Promise<boolean> {
  if (await canAccessEditionData(eventId, userId, event)) return true
  const { isActiveAccessControlVolunteer } =
    await import('#volunteers/server/utils/permissions/access-control-permissions')
  return await isActiveAccessControlVolunteer(userId, eventId)
}

/**
 * Gestion des repas OU validation des repas. La validation (bénévoles de l'équipe qui valide)
 * arrivera avec le module repas ; d'ici là, seule la gestion ouvre ces points.
 */
export async function canManageMealsOrValidation(
  eventId: number,
  userId: number,
  event?: unknown
): Promise<boolean> {
  return await canManageMealsById(eventId, userId, event)
}
