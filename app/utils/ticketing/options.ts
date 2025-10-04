export interface Option {
  id: number
  name: string
  description: string | null
  type: string
  isRequired: boolean
  choices: string[] | null
  helloAssoOptionId: number
}

export async function fetchOptions(editionId: number): Promise<Option[]> {
  return await $fetch(`/api/editions/${editionId}/ticketing/options`)
}
