export interface TicketingTier {
  id: number
  name: string
  customName?: string | null
  originalName?: string // Nom original HelloAsso si applicable (retourné par l'API avec includeOriginalName)
  description: string | null
  price: number
  minAmount: number | null
  maxAmount: number | null
  isActive: boolean
  helloAssoTierId: number | null
  quotas?: Array<{
    quota: {
      id: number
      title: string
      description: string | null
      quantity: number
    }
  }>
  returnableItems?: Array<{
    returnableItem: {
      id: number
      name: string
    }
  }>
}

export interface TierFormData {
  name: string
  customName?: string | null
  description: string | null
  price: number
  minAmount: number | null
  maxAmount: number | null
  isActive: boolean
  quotaIds: number[]
  returnableItemIds: number[]
}

export async function fetchTiers(editionId: number): Promise<TicketingTier[]> {
  return await $fetch(`/api/editions/${editionId}/ticketing/tiers/`)
}

export async function createTier(editionId: number, data: TierFormData): Promise<void> {
  await $fetch(`/api/editions/${editionId}/ticketing/tiers`, {
    method: 'POST',
    body: data,
  })
}

export async function updateTier(
  editionId: number,
  tierId: number,
  data: TierFormData
): Promise<void> {
  await $fetch(`/api/editions/${editionId}/ticketing/tiers/${tierId}`, {
    method: 'PUT',
    body: data,
  })
}

export async function deleteTier(editionId: number, tierId: number): Promise<void> {
  await $fetch(`/api/editions/${editionId}/ticketing/tiers/${tierId}`, {
    method: 'DELETE',
  })
}
