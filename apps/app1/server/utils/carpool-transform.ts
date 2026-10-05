/**
 * Fonctions de transformation des données covoiturage.
 * Partagées entre les endpoints de liste et de détail.
 */

/**
 * Transforme un utilisateur Prisma en objet sérialisable (sans email).
 */
function transformUser(user: any) {
  if (!user) return undefined
  return {
    id: user.id,
    pseudo: user.pseudo,
    emailHash: user.emailHash,
    profilePicture: user.profilePicture ?? null,
    updatedAt: user.updatedAt,
  }
}

/**
 * Indique si un téléphone doit être exposé.
 * Retourne true si un numéro existe ET que le viewer est authentifié.
 */
function shouldExposePhone(phoneNumber: string | null | undefined, viewerId?: number): boolean {
  return !!phoneNumber && !!viewerId
}

/**
 * Le nombre de commentaires, et les commentaires eux-mêmes quand ils ont été chargés.
 *
 * Les listes d'une édition ne demandent plus que `_count`, le détail charge tout. Deux choses
 * comptent ici :
 *
 * - `commentsCount` vient de `_count` s'il est là, sinon de la liste chargée. Le client a donc
 *   toujours un nombre, quel que soit le point d'API qui lui répond ;
 * - `comments` est ABSENT quand il n'a pas été chargé, et non pas `[]`. Un tableau vide se lirait
 *   « aucun commentaire » alors que le compte en annonce trois — le genre de contradiction qui ne
 *   lève aucune erreur et se remarque des mois plus tard.
 */
function partieCommentaires(entite: any) {
  const charges: any[] | undefined = entite.comments
  const compte: number = entite._count?.comments ?? charges?.length ?? 0

  return {
    commentsCount: compte,
    ...(charges
      ? {
          comments: charges.map((comment: any) => ({
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            user: transformUser(comment.user),
          })),
        }
      : {}),
  }
}

/**
 * Transforme une offre de covoiturage pour l'API.
 * - Masque le téléphone pour les utilisateurs non authentifiés
 * - Calcule les places restantes
 * - Anonymise les utilisateurs
 */
export function transformCarpoolOffer(offer: any, viewerId?: number) {
  const bookings = offer.bookings ?? []
  const availableSeats = typeof offer.availableSeats === 'number' ? offer.availableSeats : 0

  // Pour les offres : téléphone visible uniquement au propriétaire ou passager accepté
  const viewerIsOwner = !!viewerId && viewerId === offer.userId
  const viewerHasAccepted =
    !!viewerId && bookings.some((b: any) => b.status === 'ACCEPTED' && b.requesterId === viewerId)
  const canSeeOfferPhone = viewerIsOwner || viewerHasAccepted

  /*
   * Les réservations exposées : tout pour le conducteur, les ACCEPTED seules pour les autres.
   *
   * Ces deux points d'API sont PUBLICS — la liste des offres d'une édition et le détail d'une
   * offre. Ils rendaient jusqu'ici TOUTES les réservations de chaque offre, avec leur message et
   * leur demandeur, à n'importe quel visiteur. Un message de réservation est adressé au conducteur
   * seul, et le fait qu'une demande soit en attente ou refusée ne regarde pas les tiers.
   *
   * `GET /carpool-offers/:id/bookings` appliquait déjà la bonne règle de son côté : le conducteur
   * voit tout, un tiers authentifié ne voit que ses propres réservations, un anonyme aucune. Le
   * présent filtre est plus permissif sur un point, et délibérément : les ACCEPTED restent
   * visibles, parce que les deux composants du client en ont besoin pour afficher qui est à bord —
   * et parce que `passengers`, juste au-dessus, expose déjà ces mêmes personnes publiquement.
   *
   * ⚠️ `remainingSeats` se calcule sur la liste COMPLÈTE, plus bas : il compte des places prises,
   * pas des réservations montrées. Le brancher sur la liste filtrée donnerait le bon chiffre par
   * accident aujourd'hui — les ACCEPTED étant justement celles qu'on garde — et un chiffre faux au
   * premier resserrement de ce filtre.
   */
  const bookingsVisibles = viewerIsOwner
    ? bookings
    : bookings.filter((b: any) => b.status === 'ACCEPTED')

  return {
    id: offer.id,
    editionId: offer.editionId,
    userId: offer.userId,
    tripDate: offer.tripDate,
    locationCity: offer.locationCity,
    locationAddress: offer.locationAddress,
    // La coordonnée de la ville, pour la vue carte. `null` est une valeur ordinaire : la ville
    // se saisit librement et toutes n'ont pas de point — l'écran les nomme au lieu de les perdre.
    latitude: offer.latitude ?? null,
    longitude: offer.longitude ?? null,
    availableSeats,
    description: offer.description,
    hasPhoneNumber: !!offer.phoneNumber,
    phoneNumber: canSeeOfferPhone ? offer.phoneNumber : null,
    smokingAllowed: offer.smokingAllowed,
    petsAllowed: offer.petsAllowed,
    musicAllowed: offer.musicAllowed,
    direction: offer.direction,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    remainingSeats: Math.max(
      0,
      availableSeats -
        bookings
          .filter((b: any) => b.status === 'ACCEPTED')
          .reduce((s: number, b: any) => s + (b.seats || 0), 0)
    ),
    user: transformUser(offer.user),
    bookings: bookingsVisibles.map((b: any) => ({
      id: b.id,
      carpoolOfferId: b.carpoolOfferId,
      requestId: b.requestId,
      seats: b.seats,
      // Le message n'accompagne la réservation que pour le conducteur : c'est à lui qu'il est
      // adressé. Un tiers n'en reçoit pas, même s'il s'agit du sien — il le relit par
      // `GET /carpool-offers/:id/bookings`, qui le lui rend.
      ...(viewerIsOwner ? { message: b.message } : {}),
      status: b.status,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      requester: transformUser(b.requester),
    })),
    ...partieCommentaires(offer),
  }
}

/**
 * Transforme une demande de covoiturage pour l'API.
 * - Masque le téléphone pour les utilisateurs non authentifiés
 * - Anonymise les utilisateurs
 */
export function transformCarpoolRequest(request: any, viewerId?: number) {
  return {
    id: request.id,
    editionId: request.editionId,
    userId: request.userId,
    tripDate: request.tripDate,
    locationCity: request.locationCity,
    latitude: request.latitude ?? null,
    longitude: request.longitude ?? null,
    seatsNeeded: request.seatsNeeded,
    direction: request.direction,
    description: request.description,
    hasPhoneNumber: !!request.phoneNumber,
    phoneNumber: shouldExposePhone(request.phoneNumber, viewerId) ? request.phoneNumber : null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    user: transformUser(request.user),
    ...partieCommentaires(request),
  }
}
