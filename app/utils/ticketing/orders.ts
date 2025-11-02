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
    returnableItems: Array<{
      returnableItem: {
        id: number
        name: string
      }
    }>
  } | null
}

export interface Order {
  id: number
  helloAssoOrderId: number
  payerFirstName: string
  payerLastName: string
  payerEmail: string
  amount: number
  status: string
  orderDate: Date
  items?: OrderItem[]
  externalTicketing?: {
    provider: 'HELLOASSO' | 'BILLETWEB' | 'WEEZEVENT' | 'OTHER'
  } | null
}

export interface OrdersResponse {
  orders: Order[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats: {
    totalOrders: number
    totalItems: number
    totalAmount: number
    totalDonations: number
    totalDonationsAmount: number
  } | null
}

export async function fetchOrders(
  editionId: number,
  options?: {
    page?: number
    limit?: number
    search?: string
    tierIds?: number[]
    entryStatus?: 'all' | 'validated' | 'not_validated'
  }
): Promise<OrdersResponse> {
  const params = new URLSearchParams()
  if (options?.page) params.append('page', options.page.toString())
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.search) params.append('search', options.search)
  if (options?.tierIds && options.tierIds.length > 0) {
    params.append('tierIds', options.tierIds.join(','))
  }
  if (options?.entryStatus && options.entryStatus !== 'all') {
    params.append('entryStatus', options.entryStatus)
  }

  const url = `/api/editions/${editionId}/ticketing/orders${params.toString() ? `?${params.toString()}` : ''}`
  const response = await $fetch<OrdersResponse>(url)
  return response
}
