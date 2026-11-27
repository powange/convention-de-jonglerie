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

/** Une adresse proposée par la recherche du formulaire de l'événement, prête à remplir ses champs. */
export interface AdresseTrouvee {
  /** L'adresse en clair (« Place Bellecour, 69002 Lyon, France »), telle que la liste l'affiche. */
  libelle: string
  /** Le nom du lieu quand Nominatim en connaît un (« Gymnase Jean Moulin »), sinon vide. */
  nomDuLieu: string
  addressLine1: string
  postalCode: string
  city: string
  country: string
  latitude: number
  longitude: number
}

interface ResultatNominatim {
  display_name?: string
  name?: string
  lat?: string
  lon?: string
  address?: Record<string, string | undefined>
}

/**
 * Un résultat Nominatim (`addressdetails=1`) ramené aux champs du formulaire. Les clés d'adresse
 * varient selon le pays et le type de lieu : la ville peut être `city`, `town`, `village` ou
 * `municipality`, la voie `road`, `pedestrian` ou `square`. Sans coordonnées, rien.
 *
 * Le complément d'adresse n'est pas rempli : il sert au bâtiment ou à l'étage, que Nominatim ne
 * connaît pas — y mettre le quartier écraserait ce que l'organisateur y a écrit.
 */
export function versAdresseTrouvee(r: ResultatNominatim): AdresseTrouvee | null {
  const latitude = Number(r.lat)
  const longitude = Number(r.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !r.display_name) return null
  const a = r.address ?? {}
  const voie = a.road || a.pedestrian || a.square || a.footway || a.place || ''
  const ligne1 = [a.house_number, voie].filter(Boolean).join(' ').trim()
  // Un nom qui n'est que la voie ou le numéro n'est pas le nom d'un lieu.
  const nom = r.name?.trim() ?? ''
  const nomDuLieu = nom && nom !== voie && nom !== ligne1 ? nom : ''
  const addressLine1 = ligne1 || nom || r.display_name.split(',')[0]!.trim()
  const postalCode = a.postcode || ''
  const city = a.city || a.town || a.village || a.municipality || ''
  const country = a.country || ''
  // Le `display_name` de Nominatim traîne région, département et métropole : illisible dans une
  // liste. On compose l'adresse comme on l'écrirait sur une enveloppe.
  const libelle = [nomDuLieu, addressLine1, [postalCode, city].filter(Boolean).join(' '), country]
    .filter(Boolean)
    .join(', ')
  return { libelle, nomDuLieu, addressLine1, postalCode, city, country, latitude, longitude }
}

/**
 * Propositions d'adresses pour un texte saisi (cinq au plus). Comme `geocoderAdresse`, ne lève
 * jamais : une panne du service rend une liste vide.
 */
export async function rechercherAdresses(texte: string): Promise<AdresseTrouvee[]> {
  const q = texte.trim()
  if (q.length < 3) return []
  try {
    const reponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`,
      {
        headers: { 'User-Agent': 'Flowvent/1.0', 'Accept-Language': 'fr' },
        signal: AbortSignal.timeout(DELAI_MS),
      }
    )
    if (!reponse.ok) return []
    const resultats = (await reponse.json()) as ResultatNominatim[]
    // Une même place revient sous plusieurs objets OpenStreetMap (la place, son contour, un arrêt…) :
    // une seule ligne par adresse affichée.
    const vues = new Set<string>()
    return resultats
      .map(versAdresseTrouvee)
      .filter(
        (a): a is AdresseTrouvee => a !== null && !vues.has(a.libelle) && !!vues.add(a.libelle)
      )
  } catch (erreur) {
    console.warn(
      '[géocodage] recherche d’adresse impossible :',
      erreur instanceof Error ? erreur.message : erreur
    )
    return []
  }
}
