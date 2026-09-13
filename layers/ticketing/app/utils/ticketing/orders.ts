import type { MoyenDePaiement, StatutCommande } from '../filtres-commandes'

export interface OrderItem {
  id: number
  helloAssoItemId: number
  name: string | null
  type: string | null
  amount: number
  state: string
  qrCode: string | null
  firstName: string
  lastName: string
  email: string
  customFields: any
  entryValidated: boolean
  entryValidatedAt: Date | null
  tier?: {
    id: number
    name: string
    handoutItems: Array<{
      handoutItem: {
        id: number
        name: string
      }
    }>
  } | null
  selectedOptions?: Array<{
    id: number
    optionId: number
    amount: number
    option: {
      id: number
      name: string
      price: number
    }
  }>
}

export interface Order {
  id: number
  helloAssoOrderId: number
  payerFirstName: string
  payerLastName: string
  payerEmail: string
  amount: number
  status: string
  paymentMethod?: string | null
  checkNumber?: string | null
  orderDate: Date
  items?: OrderItem[]
  externalTicketing?: {
    provider: 'HELLOASSO' | 'BILLETWEB' | 'WEEZEVENT' | 'OTHER'
  } | null
}

export interface OrdersResponse {
  success: boolean
  data: Order[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  stats?: {
    totalOrders: number
    totalItems: number
    totalAmount: number
    totalDonations: number
    totalDonationsAmount: number
    amountsByPaymentMethod: {
      cardHelloAsso: number
      cardOnsite: number
      cash: number
      check: number
      online: number
      pending: number
      refunded: number
    }
  } | null
}

export interface CustomFieldFilter {
  name: string
  value: string
}

export type ItemType = 'Registration' | 'Donation' | 'Membership' | 'Payment'

export async function fetchOrders(
  editionId: number,
  options?: {
    page?: number
    limit?: number
    search?: string
    tierIds?: number[]
    optionIds?: number[]
    entryStatus?: 'all' | 'validated' | 'not_validated'
    statuses?: StatutCommande[]
    paymentMethods?: MoyenDePaiement[]
    itemTypes?: ItemType[]
    customFieldFilters?: CustomFieldFilter[]
    customFieldFilterMode?: 'and' | 'or'
  }
): Promise<OrdersResponse> {
  const params = new URLSearchParams()

  /*
   * Sérialisation GÉNÉRIQUE, et c'est tout l'intérêt de ce code.
   *
   * Cette fonction énumérait ses paramètres un par un — `if (options?.tierIds) …`, quinze fois.
   * C'était la cinquième liste de filtres tenue à la main, celle que le regroupement de
   * `filtres-commandes.ts` n'avait pas atteinte, et de loin la plus traître : un filtre absent
   * d'ici est simplement JETÉ. La requête part sans lui, le serveur rend TOUT, et l'écran a l'air
   * de fonctionner — pas d'erreur, pas de message, juste un filtre qui ne filtre rien.
   *
   * C'est exactement ce qui est arrivé au filtre par statut de commande, ajouté partout ailleurs
   * et oublié ici. Déduire les paramètres des options reçues fait disparaître le cas.
   */
  for (const [cle, valeur] of Object.entries(options ?? {})) {
    if (valeur === undefined || valeur === null || valeur === '') continue

    // `all` n'est pas un filtre : c'est l'absence de filtre sur ce critère.
    if (cle === 'entryStatus' && valeur === 'all') continue

    // Le mode de combinaison ne veut rien dire sans champ à combiner.
    if (cle === 'customFieldFilterMode' && !options?.customFieldFilters?.length) continue

    if (Array.isArray(valeur)) {
      if (valeur.length === 0) continue

      // Les listes d'OBJETS — les champs personnalisés — voyagent en JSON ; les listes de valeurs
      // simples en énumération séparée par des virgules, comme le serveur les relit.
      params.append(cle, typeof valeur[0] === 'object' ? JSON.stringify(valeur) : valeur.join(','))
      continue
    }

    params.append(cle, String(valeur))
  }

  const url = `/api/editions/${editionId}/ticketing/orders${params.toString() ? `?${params.toString()}` : ''}`
  const response = await $fetch<OrdersResponse>(url)
  return response
}
