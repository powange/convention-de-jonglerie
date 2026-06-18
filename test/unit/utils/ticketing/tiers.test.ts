import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  isFreePrice,
  isFixedPrice,
  fetchTiers,
  createTier,
  updateTier,
  deleteTier,
  type TierFormData,
} from '../../../../layers/ticketing/app/utils/ticketing/tiers'

describe('utils billetterie - tiers', () => {
  describe('isFreePrice (fonction pure)', () => {
    it('retourne true quand minAmount est défini (> 0)', () => {
      expect(isFreePrice({ minAmount: 5, maxAmount: null })).toBe(true)
    })

    it('retourne true quand minAmount vaut 0 (0 est défini, non null)', () => {
      expect(isFreePrice({ minAmount: 0, maxAmount: null })).toBe(true)
    })

    it('retourne true quand maxAmount est défini', () => {
      expect(isFreePrice({ minAmount: null, maxAmount: 50 })).toBe(true)
    })

    it('retourne true quand maxAmount vaut 0', () => {
      expect(isFreePrice({ minAmount: null, maxAmount: 0 })).toBe(true)
    })

    it('retourne true quand minAmount et maxAmount sont tous deux définis', () => {
      expect(isFreePrice({ minAmount: 5, maxAmount: 50 })).toBe(true)
    })

    it('retourne false quand minAmount et maxAmount sont null', () => {
      expect(isFreePrice({ minAmount: null, maxAmount: null })).toBe(false)
    })

    it('retourne false quand minAmount et maxAmount sont undefined', () => {
      expect(isFreePrice({ minAmount: undefined, maxAmount: undefined })).toBe(false)
    })

    it('retourne false pour un objet vide (champs absents)', () => {
      expect(isFreePrice({})).toBe(false)
    })

    it('retourne true si minAmount est défini mais maxAmount null', () => {
      expect(isFreePrice({ minAmount: 10 })).toBe(true)
    })
  })

  describe('isFixedPrice (fonction pure)', () => {
    it('retourne true quand minAmount et maxAmount sont null', () => {
      expect(isFixedPrice({ minAmount: null, maxAmount: null })).toBe(true)
    })

    it('retourne true quand minAmount et maxAmount sont undefined', () => {
      expect(isFixedPrice({ minAmount: undefined, maxAmount: undefined })).toBe(true)
    })

    it('retourne true pour un objet vide (champs absents)', () => {
      expect(isFixedPrice({})).toBe(true)
    })

    it('retourne false quand minAmount est défini (> 0)', () => {
      expect(isFixedPrice({ minAmount: 5, maxAmount: null })).toBe(false)
    })

    it('retourne false quand minAmount vaut 0', () => {
      expect(isFixedPrice({ minAmount: 0, maxAmount: null })).toBe(false)
    })

    it('retourne false quand maxAmount est défini', () => {
      expect(isFixedPrice({ minAmount: null, maxAmount: 50 })).toBe(false)
    })

    it('retourne false quand maxAmount vaut 0', () => {
      expect(isFixedPrice({ minAmount: null, maxAmount: 0 })).toBe(false)
    })

    it('est la négation logique de isFreePrice pour les mêmes entrées', () => {
      const cases = [
        { minAmount: null, maxAmount: null },
        { minAmount: 5, maxAmount: null },
        { minAmount: null, maxAmount: 10 },
        { minAmount: 0, maxAmount: 0 },
        {},
      ]
      for (const c of cases) {
        expect(isFixedPrice(c)).toBe(!isFreePrice(c))
      }
    })
  })

  describe('wrappers $fetch', () => {
    const tierFormData: TierFormData = {
      name: 'Tarif standard',
      description: null,
      price: 20,
      minAmount: null,
      maxAmount: null,
      position: 0,
      isActive: true,
      quotaIds: [],
      handoutItemIds: [],
    }

    beforeEach(() => {
      vi.stubGlobal('$fetch', vi.fn())
    })

    describe('fetchTiers', () => {
      it('appelle la bonne URL et extrait response.data.tiers', async () => {
        const tiers = [{ id: 1, name: 'A' }]
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: { tiers } }))

        const result = await fetchTiers(42)

        expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/tiers')
        expect(result).toEqual(tiers)
      })

      it('retourne un tableau vide si data.tiers est absent', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: {} }))

        const result = await fetchTiers(42)

        expect(result).toEqual([])
      })

      it('retourne un tableau vide si la réponse est null', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(null))

        const result = await fetchTiers(42)

        expect(result).toEqual([])
      })

      it('retourne un tableau vide si data.tiers n’est pas un tableau', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: { tiers: 'pas-un-tableau' } }))

        const result = await fetchTiers(7)

        expect(result).toEqual([])
      })
    })

    describe('createTier', () => {
      it('appelle POST sur la bonne URL avec le body', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(undefined))

        await createTier(42, tierFormData)

        expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/tiers', {
          method: 'POST',
          body: tierFormData,
        })
      })
    })

    describe('updateTier', () => {
      it('appelle PUT sur la bonne URL (avec tierId) avec le body', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(undefined))

        await updateTier(42, 99, tierFormData)

        expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/tiers/99', {
          method: 'PUT',
          body: tierFormData,
        })
      })
    })

    describe('deleteTier', () => {
      it('appelle DELETE sur la bonne URL (avec tierId)', async () => {
        vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(undefined))

        await deleteTier(42, 99)

        expect($fetch).toHaveBeenCalledWith('/api/editions/42/ticketing/tiers/99', {
          method: 'DELETE',
        })
      })
    })
  })
})
