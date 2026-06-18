import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  fetchOptions,
  createOption,
  updateOption,
  deleteOption,
  type OptionFormData,
} from '../../../../layers/ticketing/app/utils/ticketing/options'

describe('utils billetterie - options', () => {
  const optionFormData: OptionFormData = {
    name: 'T-shirt',
    description: null,
    type: 'CHOICE',
    isRequired: false,
    choices: ['S', 'M', 'L'],
    price: 15,
    position: 0,
    quotaIds: [],
    handoutItemIds: [],
  }

  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn())
  })

  describe('fetchOptions', () => {
    it('appelle la bonne URL et extrait response.data.options', async () => {
      const options = [{ id: 1, name: 'T-shirt' }]
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: { options } }))

      const result = await fetchOptions(42)

      expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/options')
      expect(result).toEqual(options)
    })

    it('retourne un tableau vide si data.options est absent', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: {} }))

      const result = await fetchOptions(42)

      expect(result).toEqual([])
    })

    it('retourne un tableau vide si la réponse est null', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(null))

      const result = await fetchOptions(42)

      expect(result).toEqual([])
    })

    it('retourne un tableau vide si data.options n’est pas un tableau', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: { options: {} } }))

      const result = await fetchOptions(7)

      expect(result).toEqual([])
    })
  })

  describe('createOption', () => {
    it('appelle POST sur la bonne URL avec le body', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(undefined))

      await createOption(42, optionFormData)

      expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/options', {
        method: 'POST',
        body: optionFormData,
      })
    })
  })

  describe('updateOption', () => {
    it('appelle PUT sur la bonne URL (avec optionId) avec le body', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(undefined))

      await updateOption(42, 99, optionFormData)

      expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/options/99', {
        method: 'PUT',
        body: optionFormData,
      })
    })
  })

  describe('deleteOption', () => {
    it('appelle DELETE sur la bonne URL (avec optionId)', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(undefined))

      await deleteOption(42, 99)

      expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/options/99', {
        method: 'DELETE',
      })
    })
  })
})
