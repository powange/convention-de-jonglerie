export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

export async function geocodeAddress(
  addressLine1: string,
  city: string,
  postalCode: string,
  country: string,
  addressLine2?: string
): Promise<GeocodingResult | null> {
  try {
    // Construire l'adresse complète
    const addressParts = [addressLine1];
    if (addressLine2) {
      addressParts.push(addressLine2);
    }
    addressParts.push(city, postalCode, country);
    const fullAddress = addressParts.join(', ');

    // Pour le développement, on utilise l'API de géocodage gratuite de Nominatim (OpenStreetMap)
    // En production, il serait mieux d'utiliser Google Maps Geocoding API ou Mapbox
    const encodedAddress = encodeURIComponent(fullAddress);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodedAddress}`,
      {
        headers: {
          'User-Agent': 'Convention-de-Jonglerie-App/1.0' // Nominatim demande un User-Agent
        }
      }
    );

    if (!response.ok) {
      console.error('Erreur lors du géocodage:', response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.log('Aucun résultat de géocodage pour:', fullAddress);
      return null;
    }

    const result = data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formattedAddress: result.display_name
    };

  } catch (error) {
    console.error('Erreur lors du géocodage:', error);
    return null;
  }
}

// Fonction pour géocoder une édition lors de sa création/modification
export async function geocodeEdition(edition: {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;
}): Promise<{ latitude: number | null; longitude: number | null }> {
  const result = await geocodeAddress(
    edition.addressLine1,
    edition.city,
    edition.postalCode,
    edition.country,
    edition.addressLine2
  );

  return {
    latitude: result?.latitude || null,
    longitude: result?.longitude || null
  };
}