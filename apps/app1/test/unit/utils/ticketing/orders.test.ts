import { describe, it, expect, vi, beforeEach } from 'vitest'

import { fetchOrders } from '../../../../layers/ticketing/app/utils/ticketing/orders'

describe('utils billetterie - orders', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn())
  })

  /**
   * Récupère l'URL passée au mock $fetch lors du dernier appel.
   */
  function lastCalledUrl(): string {
    return ($fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
  }

  describe('fetchOrders', () => {
    it('appelle la bonne URL sans query string quand aucune option n’est fournie', async () => {
      const response = { success: true, data: [], pagination: {} }
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(response))

      const result = await fetchOrders(42)

      expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/orders')
      expect(result).toBe(response)
    })

    it('retourne la réponse telle quelle (pas d’extraction)', async () => {
      const response = { success: true, data: [{ id: 1 }], pagination: { page: 1 } }
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(response))

      const result = await fetchOrders(1)

      expect(result).toEqual(response)
    })

    it('ajoute les paramètres page et limit', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      await fetchOrders(42, { page: 2, limit: 50 })

      const url = lastCalledUrl()
      expect(url.startsWith('/api/editions/42/ticketing/orders?')).toBe(true)
      const params = new URLSearchParams(url.split('?')[1])
      expect(params.get('page')).toBe('2')
      expect(params.get('limit')).toBe('50')
    })

    it('ajoute le paramètre search', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      await fetchOrders(42, { search: 'dupont' })

      const params = new URLSearchParams(lastCalledUrl().split('?')[1])
      expect(params.get('search')).toBe('dupont')
    })

    it('joint les tierIds et optionIds par des virgules', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      await fetchOrders(42, { tierIds: [1, 2, 3], optionIds: [4, 5] })

      const params = new URLSearchParams(lastCalledUrl().split('?')[1])
      expect(params.get('tierIds')).toBe('1,2,3')
      expect(params.get('optionIds')).toBe('4,5')
    })

    it('ignore tierIds et optionIds vides', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      await fetchOrders(42, { tierIds: [], optionIds: [] })

      expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/orders')
    })

    it('ajoute entryStatus quand il n’est pas "all"', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      await fetchOrders(42, { entryStatus: 'validated' })

      const params = new URLSearchParams(lastCalledUrl().split('?')[1])
      expect(params.get('entryStatus')).toBe('validated')
    })

    it('n’ajoute pas entryStatus quand il vaut "all"', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      await fetchOrders(42, { entryStatus: 'all' })

      expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/orders')
    })

    it('joint les paymentMethods par des virgules', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      await fetchOrders(42, { paymentMethods: ['cash', 'card'] })

      const params = new URLSearchParams(lastCalledUrl().split('?')[1])
      expect(params.get('paymentMethods')).toBe('cash,card')
    })

    it('joint les itemTypes par des virgules', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      await fetchOrders(42, { itemTypes: ['Registration', 'Donation'] })

      const params = new URLSearchParams(lastCalledUrl().split('?')[1])
      expect(params.get('itemTypes')).toBe('Registration,Donation')
    })

    it('sérialise customFieldFilters en JSON et ajoute le mode', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      const filters = [{ name: 'taille', value: 'M' }]
      await fetchOrders(42, { customFieldFilters: filters, customFieldFilterMode: 'and' })

      const params = new URLSearchParams(lastCalledUrl().split('?')[1])
      expect(params.get('customFieldFilters')).toBe(JSON.stringify(filters))
      expect(params.get('customFieldFilterMode')).toBe('and')
    })

    it('n’ajoute pas le mode si customFieldFilterMode est absent', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      const filters = [{ name: 'taille', value: 'M' }]
      await fetchOrders(42, { customFieldFilters: filters })

      const params = new URLSearchParams(lastCalledUrl().split('?')[1])
      expect(params.get('customFieldFilters')).toBe(JSON.stringify(filters))
      expect(params.has('customFieldFilterMode')).toBe(false)
    })

    it('combine plusieurs filtres dans la même query string', async () => {
      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

      await fetchOrders(42, {
        page: 3,
        search: 'test',
        tierIds: [1],
        paymentMethods: ['check'],
      })

      const params = new URLSearchParams(lastCalledUrl().split('?')[1])
      expect(params.get('page')).toBe('3')
      expect(params.get('search')).toBe('test')
      expect(params.get('tierIds')).toBe('1')
      expect(params.get('paymentMethods')).toBe('check')
    })
  })
})
