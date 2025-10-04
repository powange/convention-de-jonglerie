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
}

export async function fetchOrders(editionId: number): Promise<Order[]> {
  const response = await $fetch(`/api/editions/${editionId}/ticketing/orders`)
  return response.orders || []
}
