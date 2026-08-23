/**
 * Détection de l'édition sur laquelle se trouve l'utilisateur.
 *
 * Le calcul vit dans le navigateur : la position ne quitte jamais l'appareil, et n'est ni
 * transmise ni conservée. C'est possible parce qu'il n'y a qu'une poignée d'éditions en cours à
 * un instant donné — les comparer toutes localement coûte moins qu'un aller-retour serveur.
 */

/** Rayon autour de l'adresse en deçà duquel on considère être sur place, en kilomètres. */
export const RAYON_SUR_PLACE_KM = 2

/**
 * Tolérance maximale ajoutée au titre de l'imprécision de la position, en kilomètres.
 *
 * Le navigateur annonce l'incertitude de sa mesure : quelques mètres avec un GPS, plusieurs
 * kilomètres quand elle est déduite du réseau — le cas d'un ordinateur de bureau. Comparer une
 * position connue à ±8 km avec un rayon strict de 2 km ne peut que répondre « non », même en
 * étant sur le site. On élargit donc d'autant, sans dépasser ce plafond : au-delà, la mesure ne
 * dit plus rien d'utile et tout deviendrait « à proximité ».
 */
export const TOLERANCE_PRECISION_MAX_KM = 5

/**
 * Au-delà de cette incertitude, la position est jugée inexploitable et rien n'est proposé.
 * Une mesure à ±30 km ne permet pas de distinguer une commune d'un département.
 */
export const PRECISION_INEXPLOITABLE_KM = 20

export interface EditionLocalisee {
  id: number
  latitude: number
  longitude: number
}

const RAYON_TERRE_KM = 6371

const enRadians = (degres: number) => (degres * Math.PI) / 180

/**
 * Distance à vol d'oiseau entre deux points, en kilomètres (formule de haversine).
 *
 * La précision de la formule dépasse de loin celle d'une adresse géocodée : inutile de chercher
 * mieux tant que le point de départ est le centroïde d'une commune.
 */
export function distanceKm(
  depuis: { latitude: number; longitude: number },
  vers: { latitude: number; longitude: number }
): number {
  const dLat = enRadians(vers.latitude - depuis.latitude)
  const dLon = enRadians(vers.longitude - depuis.longitude)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(enRadians(depuis.latitude)) *
      Math.cos(enRadians(vers.latitude)) *
      Math.sin(dLon / 2) ** 2

  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * L'édition la plus proche parmi celles fournies, si elle est dans le rayon.
 *
 * On rend la PLUS PROCHE et non la première trouvée : deux conventions peuvent se tenir la même
 * semaine à quelques kilomètres l'une de l'autre, et proposer la mauvaise serait pire que de ne
 * rien proposer.
 */
export function editionSurPlace<T extends EditionLocalisee>(
  position: { latitude: number; longitude: number; precisionM?: number | null } | null | undefined,
  editions: readonly T[],
  rayonKm: number = RAYON_SUR_PLACE_KM
): T | null {
  if (!position || !Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) {
    return null
  }

  // L'incertitude annoncée par le navigateur élargit le rayon, dans la limite du plafond. Une
  // mesure trop grossière ne permet plus de conclure : mieux vaut ne rien proposer que de
  // désigner une convention à cinquante kilomètres.
  const precisionKm =
    typeof position.precisionM === 'number' && Number.isFinite(position.precisionM)
      ? Math.max(0, position.precisionM) / 1000
      : 0
  if (precisionKm > PRECISION_INEXPLOITABLE_KM) return null

  const tolerance = rayonKm + Math.min(precisionKm, TOLERANCE_PRECISION_MAX_KM)

  let meilleure: T | null = null
  let meilleureDistance = Number.POSITIVE_INFINITY

  for (const edition of editions) {
    if (!Number.isFinite(edition.latitude) || !Number.isFinite(edition.longitude)) continue

    const distance = distanceKm(position, edition)
    if (distance <= tolerance && distance < meilleureDistance) {
      meilleure = edition
      meilleureDistance = distance
    }
  }

  return meilleure
}
