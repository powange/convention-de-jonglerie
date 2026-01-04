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

export async function fetchOrders(
  editionId: number,
  options?: {
    page?: number
    limit?: number
    search?: string
    tierIds?: number[]
    optionIds?: number[]
    entryStatus?: 'all' | 'validated' | 'not_validated'
    customFieldFilters?: CustomFieldFilter[]
    customFieldFilterMode?: 'and' | 'or'
  }
): Promise<OrdersResponse> {
  const params = new URLSearchParams()
  if (options?.page) params.append('page', options.page.toString())
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.search) params.append('search', options.search)
  if (options?.tierIds && options.tierIds.length > 0) {
    params.append('tierIds', options.tierIds.join(','))
  }
  if (options?.optionIds && options.optionIds.length > 0) {
    params.append('optionIds', options.optionIds.join(','))
  }
  if (options?.entryStatus && options.entryStatus !== 'all') {
    params.append('entryStatus', options.entryStatus)
  }
  if (options?.customFieldFilters && options.customFieldFilters.length > 0) {
    params.append('customFieldFilters', JSON.stringify(options.customFieldFilters))
    if (options.customFieldFilterMode) {
      params.append('customFieldFilterMode', options.customFieldFilterMode)
    }
  }

  const url = `/api/editions/${editionId}/ticketing/orders${params.toString() ? `?${params.toString()}` : ''}`
  const response = await $fetch<OrdersResponse>(url)
  return response
}
