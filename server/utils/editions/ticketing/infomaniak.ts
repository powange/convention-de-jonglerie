/**
 * Utilitaire pour gérer les interactions avec l'API Infomaniak eTickets (SHOP API)
 * Documentation : https://etickets.infomaniak.com/docs/app/index.html
 */

const INFOMANIAK_API_URL = 'https://etickets.infomaniak.com/api/shop'

export interface InfomaniakEvent {
  event_id: number
  name: string
  description: string
  date: string
  category: string
  status: string // 'visible' | 'full'
  capacity: number | null
  total?: number // Disponible si withQuota=true
  reserved?: number
  warning_low?: number
  address: {
    title: string
    street: string
    number: string | null
    zipcode: string
    city: string
    country: string | null
    google: {
      title: string | null
      place_id: string | null
      latitude: number
      longitude: number
    }
  }
  properties?: { name: string; value: string; status: string }[]
}

export interface InfomaniakPassCategory {
  category_id: number
  name: string
  status: string // 'visible' | 'full'
  amount: number // Prix en centimes
  max_tickets: number
  min_tickets: number
  max_tickets_performance: number
  max_tickets_per_day: number
  fixed_seat: boolean
  choose_event: boolean
  form: Record<string, string | string[]>
  freefield_name: string | null
}

interface InfomaniakHeaders {
  'Accept-Language': string
  key: string
  currency: string
}

function buildHeaders(apiKey: string, currency: string = '2'): InfomaniakHeaders {
  return {
    'Accept-Language': 'fr_FR',
    key: apiKey,
    currency,
  }
}

/**
 * Récupérer la liste des événements
 */
export async function getInfomaniakEvents(
  apiKey: string,
  currency: string = '2'
): Promise<InfomaniakEvent[]> {
  const response = await $fetch<InfomaniakEvent[]>(`${INFOMANIAK_API_URL}/events`, {
    method: 'GET',
    headers: buildHeaders(apiKey, currency),
    params: { withQuota: true },
  })
  return response
}

/**
 * Récupérer les détails d'un événement
 */
export async function getInfomaniakEvent(
  apiKey: string,
  eventId: number,
  currency: string = '2'
): Promise<InfomaniakEvent> {
  const response = await $fetch<InfomaniakEvent>(`${INFOMANIAK_API_URL}/event/${eventId}`, {
    method: 'GET',
    headers: buildHeaders(apiKey, currency),
  })
  return response
}

/**
 * Récupérer les catégories de pass (= tarifs)
 */
export async function getInfomaniakPassCategories(
  apiKey: string,
  currency: string = '2'
): Promise<InfomaniakPassCategory[]> {
  const response = await $fetch<InfomaniakPassCategory[]>(`${INFOMANIAK_API_URL}/categorypasses`, {
    method: 'GET',
    headers: buildHeaders(apiKey, currency),
  })
  return Array.isArray(response) ? response : []
}

export interface InfomaniakZoneCategory {
  category_id: number
  name: string
  status: string
  amount: number
  free_seats: number
  limit?: number
}

export interface InfomaniakZone {
  zone_id: number
  name: string
  status: string
  bg_color: string
  numbered: number
  free_seats: number
  categories: InfomaniakZoneCategory[]
}

/**
 * Récupérer les zones et tarifs d'un événement
 */
export async function getInfomaniakEventZones(
  apiKey: string,
  eventId: number,
  currency: string = '2'
): Promise<InfomaniakZone[]> {
  const response = await $fetch<InfomaniakZone[]>(`${INFOMANIAK_API_URL}/event/${eventId}/zones`, {
    method: 'GET',
    headers: buildHeaders(apiKey, currency),
  })
  return Array.isArray(response) ? response : []
}

/**
 * Tester la connexion à l'API Infomaniak
 * Retourne la liste des événements si la connexion est réussie
 */
export async function testInfomaniakConnection(
  apiKey: string,
  currency: string = '2'
): Promise<{ success: boolean; events: InfomaniakEvent[]; error?: string }> {
  try {
    const events = await getInfomaniakEvents(apiKey, currency)
    return { success: true, events }
  } catch (error: any) {
    const message =
      error?.response?.status === 401
        ? 'Clé API invalide'
        : error?.response?.status === 403
          ? 'Accès refusé — vérifiez les permissions de la clé API'
          : error?.message || 'Erreur de connexion'
    return { success: false, events: [], error: message }
  }
}
