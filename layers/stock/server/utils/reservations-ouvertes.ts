import {
  reservationsOuvertesSur,
  RESERVATIONS_FERMEES,
} from '../../app/utils/reservations-du-groupe'

/**
 * La garde du réglage « ce groupe gère les réservations », côté serveur.
 *
 * Séparée de la décision elle-même (`app/utils/reservations-du-groupe.ts`, pure et testée hors
 * Nuxt) parce qu'elle touche la base et lève une erreur HTTP — exactement le partage que le dépôt
 * applique déjà entre `visibilite-equipes.ts` et `echanges-ouverts.ts`.
 *
 * Les réservations pendent à un OBJET, jamais à un groupe : toutes les gardes remontent donc au
 * groupe par l'objet, et c'est la raison d'être des deux formes ci-dessous.
 */

/** Le groupe d'un objet, avec son réglage. `null` si l'objet n'existe pas dans cette édition. */
export async function groupeDeLObjet(
  stockItemId: number,
  editionId: number
): Promise<{ id: number; reservationsEnabled: boolean } | null> {
  const objet = await prisma.stockItem.findFirst({
    where: { id: stockItemId, group: { editionId } },
    select: { group: { select: { id: true, reservationsEnabled: true } } },
  })

  return objet?.group ?? null
}

/** Lève un 403 si le groupe n'ouvre pas les réservations. */
function refuser(): never {
  throw createError({
    status: 403,
    message: 'Ce groupe de stock ne gère pas les réservations.',
    data: { code: RESERVATIONS_FERMEES },
  })
}

/**
 * Refuse la requête si le groupe de cet OBJET n'ouvre pas les réservations.
 *
 * Un objet introuvable n'est pas traité ici : les endpoints le vérifient déjà pour leurs propres
 * raisons, et rendre un 403 à sa place brouillerait le diagnostic.
 */
export async function exigerReservationsOuvertesPourLObjet(
  stockItemId: number,
  editionId: number
): Promise<void> {
  const groupe = await groupeDeLObjet(stockItemId, editionId)
  if (!groupe) return

  if (!reservationsOuvertesSur(groupe)) refuser()
}

/**
 * Refuse la requête si le groupe d'une RÉSERVATION existante n'ouvre pas les réservations.
 *
 * Le cas ne devrait pas se produire — on refuse de fermer un groupe qui en a encore — mais la
 * garde est posée quand même : une modification par API directe, ou un état laissé par une
 * migration, ne doit pas rouvrir par la bande ce que le réglage ferme.
 */
export async function exigerReservationsOuvertesPourLaReservation(
  reservationId: number,
  editionId: number
): Promise<void> {
  const reservation = await prisma.stockReservation.findFirst({
    where: { id: reservationId, stockItem: { group: { editionId } } },
    select: { stockItem: { select: { group: { select: { reservationsEnabled: true } } } } },
  })
  if (!reservation) return

  if (!reservationsOuvertesSur(reservation.stockItem.group)) refuser()
}

/** Refuse la requête si CE groupe n'ouvre pas les réservations. */
export async function exigerReservationsOuvertesPourLeGroupe(
  groupId: number,
  editionId: number
): Promise<void> {
  const groupe = await prisma.stockGroup.findFirst({
    where: { id: groupId, editionId },
    select: { reservationsEnabled: true },
  })
  if (!groupe) return

  if (!reservationsOuvertesSur(groupe)) refuser()
}

/**
 * Le nombre de réservations encore vivantes sur un groupe.
 *
 * Les ANNULÉES sont exclues : elles ne promettent plus rien à personne, et les compter interdirait
 * de fermer un groupe pour des réservations que tout le monde a oubliées.
 */
export async function reservationsActivesDuGroupe(groupId: number): Promise<number> {
  return prisma.stockReservation.count({
    where: {
      stockItem: { stockGroupId: groupId },
      status: { in: ['RESERVED', 'PICKED_UP', 'RETURNED'] },
    },
  })
}
