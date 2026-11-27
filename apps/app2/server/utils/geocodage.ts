/**
 * Géocodage d'une adresse par Nominatim (OpenStreetMap), comme app1 (apps/app1/server/utils/
 * geocoding.ts) : sert à placer le lieu d'un événement sur la carte de sa page publique.
 *
 * Ne lève jamais : sans réponse exploitable (adresse introuvable, service indisponible, délai
 * dépassé), rend `null`, et l'enregistrement se fait sans coordonnées. Nominatim exige un
 * User-Agent identifiant l'application.
 */
export interface Coordonnees {
  latitude: number
  longitude: number
}

const DELAI_MS = 5000

export async function geocoderAdresse(parties: {
  ligne1?: string | null
  codePostal?: string | null
  ville?: string | null
  pays?: string | null
}): Promise<Coordonnees | null> {
  const requete = [
    parties.ligne1,
    [parties.codePostal, parties.ville].filter(Boolean).join(' '),
    parties.pays,
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ')
  // Sans ville ni code postal, une rue seule tomberait n'importe où.
  if (!requete || (!parties.ville?.trim() && !parties.codePostal?.trim())) return null
  try {
    const reponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(requete)}`,
      {
        headers: { 'User-Agent': 'Flowvent/1.0', 'Accept-Language': 'fr' },
        signal: AbortSignal.timeout(DELAI_MS),
      }
    )
    if (!reponse.ok) return null
    const resultats = (await reponse.json()) as { lat?: string; lon?: string }[]
    const premier = resultats[0]
    const latitude = Number(premier?.lat)
    const longitude = Number(premier?.lon)
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null
  } catch (erreur) {
    console.warn(
      '[géocodage] adresse non placée :',
      erreur instanceof Error ? erreur.message : erreur
    )
    return null
  }
}
