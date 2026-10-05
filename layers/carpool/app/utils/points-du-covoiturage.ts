/**
 * Les points à poser sur la carte du covoiturage, et ce qui n'en a pas.
 *
 * Partie PURE, sans Leaflet ni Vue : c'est ici que vit tout ce qui se raisonne, et donc tout ce qui
 * se teste. Le composant ne fait plus que dessiner ce que cette fonction décide.
 */

/** Le minimum qu'une annonce doit porter pour être placée. Les deux modèles s'y conforment. */
export interface AnnonceLocalisable {
  id: number
  locationCity: string
  latitude?: number | null
  longitude?: number | null
  direction?: string | null
  tripDate?: string | Date | null
}

/** Un point de la carte : une VILLE, et les annonces qui en partent ou y arrivent. */
export interface PointDuCovoiturage {
  /** Stable d'un rendu à l'autre : la ville et sa coordonnée arrondie. */
  cle: string
  ville: string
  position: [number, number]
  offres: AnnonceLocalisable[]
  demandes: AnnonceLocalisable[]
  /** Le total, pour dimensionner la pastille sans recompter dans le gabarit. */
  total: number
}

export interface AnnonceSansPoint {
  annonce: AnnonceLocalisable
  genre: 'offre' | 'demande'
}

export interface PointsDuCovoiturage {
  points: PointDuCovoiturage[]
  sansPoint: AnnonceSansPoint[]
}

/** Un couple exploitable ? Une seule des deux valeurs ne décrit aucun lieu. */
function placee(a: AnnonceLocalisable): boolean {
  return (
    typeof a.latitude === 'number' &&
    typeof a.longitude === 'number' &&
    Number.isFinite(a.latitude) &&
    Number.isFinite(a.longitude)
  )
}

/**
 * Regroupe les annonces par ville plutôt que par annonce.
 *
 * ⚠️ POURQUOI REGROUPER. Treize offres au départ de Lyon poseraient treize épingles exactement
 * superposées : on n'en verrait qu'une, et les douze autres seraient invisibles sans qu'on puisse
 * le soupçonner. Un point par ville, dont la popup énumère ce qui s'y trouve.
 *
 * La clé inclut la coordonnée ARRONDIE : deux saisies de la même ville peuvent différer au
 * cent-millième de degré — un mètre — et cela suffirait à les séparer en deux points voisins
 * illisibles. Quatre décimales valent une dizaine de mètres, ce qui regroupe sans jamais confondre
 * deux villes distinctes.
 *
 * 📍 Les annonces SANS coordonnée ne sont pas écartées : elles sortent dans `sansPoint`, pour que
 * l'écran les NOMME. La ville se saisissant librement, il y en aura toujours — les perdre
 * silencieusement serait le défaut le plus facile à commettre ici.
 */
export function pointsDuCovoiturage(entree: {
  offres?: AnnonceLocalisable[] | null
  demandes?: AnnonceLocalisable[] | null
}): PointsDuCovoiturage {
  const offres = entree.offres ?? []
  const demandes = entree.demandes ?? []

  const parCle = new Map<string, PointDuCovoiturage>()
  const sansPoint: AnnonceSansPoint[] = []

  const ranger = (annonce: AnnonceLocalisable, genre: 'offre' | 'demande') => {
    if (!placee(annonce)) {
      sansPoint.push({ annonce, genre })
      return
    }

    const lat = annonce.latitude as number
    const lon = annonce.longitude as number
    const cle = `${annonce.locationCity.trim().toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`

    let point = parCle.get(cle)
    if (!point) {
      point = {
        cle,
        ville: annonce.locationCity.trim(),
        position: [lat, lon],
        offres: [],
        demandes: [],
        total: 0,
      }
      parCle.set(cle, point)
    }

    if (genre === 'offre') point.offres.push(annonce)
    else point.demandes.push(annonce)
    point.total += 1
  }

  // Les offres d'abord : à ville égale, c'est leur libellé qui nomme le point, et une place
  // proposée est l'information la plus actionnable des deux.
  for (const o of offres) ranger(o, 'offre')
  for (const d of demandes) ranger(d, 'demande')

  // Les plus fournis en dernier : dans Leaflet, le marqueur ajouté le plus tard passe DEVANT.
  const points = [...parCle.values()].sort((a, b) => a.total - b.total)

  return { points, sansPoint }
}

/**
 * Le rectangle qui contient tout ce qu'il faut montrer, ou `null` s'il n'y a rien.
 *
 * ⚠️ LE LIEU DE LA CONVENTION EN FAIT PARTIE, et c'est le point de la demande : une carte du
 * covoiturage sans la destination ne dit pas d'où l'on vient. S'il est le SEUL point connu, on
 * rend quand même son rectangle — dégénéré, mais Leaflet le centre correctement, là où un `null`
 * laisserait la carte sur sa vue par défaut, quelque part au-dessus de la France.
 */
export function cadreDesPoints(
  points: PointDuCovoiturage[],
  convention?: { latitude?: number | null; longitude?: number | null } | null
): [[number, number], [number, number]] | null {
  const positions: [number, number][] = points.map((p) => p.position)

  if (
    convention &&
    typeof convention.latitude === 'number' &&
    typeof convention.longitude === 'number'
  ) {
    positions.push([convention.latitude, convention.longitude])
  }

  if (!positions.length) return null

  const lats = positions.map((p) => p[0])
  const lons = positions.map((p) => p[1])

  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ]
}
