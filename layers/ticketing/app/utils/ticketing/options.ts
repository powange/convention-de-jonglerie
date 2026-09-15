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
  /**
   * Le fournisseur d'où vient cette option, `null` si elle a été saisie à la main.
   *
   * Distinct de `helloAssoOptionId`, qui est la colonne d'un seul fournisseur : une option
   * importée d'ailleurs l'aurait à `null` et passerait à tort pour saisie à la main.
   */
  provider?: 'HELLOASSO' | 'INFOMANIAK' | 'BILLETWEB' | 'WEEZEVENT' | 'OTHER' | null
  quotas?: Array<{
    quota: {
      id: number
      title: string
      description: string | null
      quantity: number
    }
  }>
  handoutItems?: Array<{
    handoutItem: {
      id: number
      name: string
    }
  }>
  tiers?: Array<{
    tier: {
      id: number
      name: string
    }
  }>
  meals?: Array<{
    meal: {
      id: number
      editionId: number
      date: string
      mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER'
      enabled: boolean
      phases: string[]
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
  handoutItemIds: number[]
  tierIds?: number[]
  mealIds?: number[]
}

export async function fetchOptions(editionId: number): Promise<TicketingOption[]> {
  const response = await $fetch<any>(`/api/editions/${editionId}/ticketing/options`)
  return Array.isArray(response?.data?.options) ? response.data.options : []
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
