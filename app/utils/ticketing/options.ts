export interface TicketingOption {
  id: number
  name: string
  description: string | null
  type: string
  isRequired: boolean
  choices: string[] | null
  price: number | null
  position: number
  helloAssoOptionId: number | null
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

export interface OptionFormData {
  name: string
  description: string | null
  type: string
  isRequired: boolean
  choices: string[] | null
  price: number | null
  position: number
  quotaIds: number[]
  returnableItemIds: number[]
}

export async function fetchOptions(editionId: number): Promise<TicketingOption[]> {
  return await $fetch(`/api/editions/${editionId}/ticketing/options`)
}

export async function createOption(editionId: number, data: OptionFormData): Promise<void> {
  await $fetch(`/api/editions/${editionId}/ticketing/options`, {
    method: 'POST',
    body: data,
  })
}

export async function updateOption(
  editionId: number,
  optionId: number,
  data: OptionFormData
): Promise<void> {
  await $fetch(`/api/editions/${editionId}/ticketing/options/${optionId}`, {
    method: 'PUT',
    body: data,
  })
}

export async function deleteOption(editionId: number, optionId: number): Promise<void> {
  await $fetch(`/api/editions/${editionId}/ticketing/options/${optionId}`, {
    method: 'DELETE',
  })
}
