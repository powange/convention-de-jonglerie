export interface GeocodingResult {
  latitude: number
  longitude: number
  formattedAddress?: string
}

export interface ReverseGeocodingResult {
  addressLine1: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
}

/**
 * Géocodage inverse : à partir de coordonnées GPS, retrouve les composants d'adresse
 * (code postal, ville, région...) via Nominatim. Utile quand une source ne fournit
 * que les coordonnées (ex: événements Facebook).
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodingResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&accept-language=fr&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'User-Agent': 'Convention-de-Jonglerie-App/1.0', // Nominatim demande un User-Agent
        },
      }
    )

    if (!response.ok) {
      console.error('Erreur lors du géocodage inverse:', response.statusText)
      return null
    }

    const data = await response.json()
    const addr = data?.address
    if (!addr) {
      return null
    }

    return {
      addressLine1: addr.road
        ? addr.house_number
          ? `${addr.house_number} ${addr.road}`
          : addr.road
        : null,
      city: addr.city || addr.town || addr.village || addr.municipality || null,
      region: addr.state || addr.region || addr.county || null,
      postalCode: addr.postcode || null,
      country: addr.country || null,
    }
  } catch (error) {
    console.error('Erreur lors de la requête de géocodage inverse:', error)
    return null
  }
}

export async function geocodeAddress(
  addressLine1: string,
  city: string,
  postalCode: string,
  country: string,
  addressLine2?: string
): Promise<GeocodingResult | null> {
  try {
    // Première tentative avec l'adresse complète
    const addressParts = [addressLine1]
    if (addressLine2) {
      addressParts.push(addressLine2)
    }
    addressParts.push(city, postalCode, country)
    const fullAddress = addressParts.join(', ')

    let result = await makeGeocodingRequest(fullAddress)

    if (result) {
      console.log('Géocodage réussi avec adresse complète:', fullAddress)
      return result
    }

    // Fallback avec seulement ville, code postal et pays
    console.log('Tentative fallback pour:', city, postalCode, country)
    const simpleAddress = [city, postalCode, country].join(', ')
    result = await makeGeocodingRequest(simpleAddress)

    if (result) {
      console.log('Géocodage réussi avec adresse simplifiée:', simpleAddress)
      return result
    }

    console.log('Aucun résultat de géocodage pour:', fullAddress)
    return null
  } catch (error) {
    console.error('Erreur lors du géocodage:', error)
    return null
  }
}

// Fonction commune pour faire les requêtes de géocodage
async function makeGeocodingRequest(address: string): Promise<GeocodingResult | null> {
  try {
    const encodedAddress = encodeURIComponent(address)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodedAddress}`,
      {
        headers: {
          'User-Agent': 'Convention-de-Jonglerie-App/1.0', // Nominatim demande un User-Agent
        },
      }
    )

    if (!response.ok) {
      console.error('Erreur lors du géocodage:', response.statusText)
      return null
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      return null
    }

    const result = data[0]
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formattedAddress: result.display_name,
    }
  } catch (error) {
    console.error('Erreur lors de la requête de géocodage:', error)
    return null
  }
}

// Fonction pour géocoder une édition lors de sa création/modification
export async function geocodeEdition(edition: {
  addressLine1: string
  addressLine2?: string
  city: string
  postalCode: string
  country: string
}): Promise<{ latitude: number | null; longitude: number | null }> {
  const result = await geocodeAddress(
    edition.addressLine1,
    edition.city,
    edition.postalCode,
    edition.country,
    edition.addressLine2
  )

  return {
    latitude: result?.latitude || null,
    longitude: result?.longitude || null,
  }
}
