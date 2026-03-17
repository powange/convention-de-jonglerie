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
 * Transforme une offre de covoiturage pour l'API.
 * - Masque le téléphone pour les utilisateurs non authentifiés
 * - Calcule les places restantes
 * - Anonymise les utilisateurs
 */
export function transformCarpoolOffer(offer: any, viewerId?: number) {
  const bookings = offer.bookings ?? []
  const passengers = offer.passengers ?? []
  const comments = offer.comments ?? []
  const availableSeats = typeof offer.availableSeats === 'number' ? offer.availableSeats : 0

  // Pour les offres : téléphone visible uniquement au propriétaire ou passager accepté
  const viewerIsOwner = !!viewerId && viewerId === offer.userId
  const viewerHasAccepted =
    !!viewerId && bookings.some((b: any) => b.status === 'ACCEPTED' && b.requesterId === viewerId)
  const canSeeOfferPhone = viewerIsOwner || viewerHasAccepted

  return {
    id: offer.id,
    editionId: offer.editionId,
    userId: offer.userId,
    tripDate: offer.tripDate,
    locationCity: offer.locationCity,
    locationAddress: offer.locationAddress,
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
    passengers: passengers.map((passenger: any) => ({
      id: passenger.id,
      addedAt: passenger.addedAt,
      user: transformUser(passenger.user),
    })),
    bookings: bookings.map((b: any) => ({
      id: b.id,
      carpoolOfferId: b.carpoolOfferId,
      requestId: b.requestId,
      seats: b.seats,
      message: b.message,
      status: b.status,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      requester: transformUser(b.requester),
    })),
    comments: comments.map((comment: any) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: transformUser(comment.user),
    })),
  }
}

/**
 * Transforme une demande de covoiturage pour l'API.
 * - Masque le téléphone pour les utilisateurs non authentifiés
 * - Anonymise les utilisateurs
 */
export function transformCarpoolRequest(request: any, viewerId?: number) {
  const comments = request.comments ?? []

  return {
    id: request.id,
    editionId: request.editionId,
    userId: request.userId,
    tripDate: request.tripDate,
    locationCity: request.locationCity,
    seatsNeeded: request.seatsNeeded,
    direction: request.direction,
    description: request.description,
    hasPhoneNumber: !!request.phoneNumber,
    phoneNumber: shouldExposePhone(request.phoneNumber, viewerId) ? request.phoneNumber : null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    user: transformUser(request.user),
    comments: comments.map((comment: any) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: transformUser(comment.user),
    })),
  }
}
