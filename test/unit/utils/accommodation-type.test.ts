import { describe, it, expect } from 'vitest'

import {
  ACCOMMODATION_TYPES,
  getAccommodationTypeLabel,
  getAccommodationTypeSelectOptions,
} from '../../../app/utils/accommodation-type'

// Fausse fonction de traduction : renvoie un libellé connu ou la clé brute.
const t = (key: string) => {
  const labels: Record<string, string> = {
    'artists.accommodation_type_tent': 'Tente',
    'artists.accommodation_type_vehicle': 'Véhicule',
    'artists.accommodation_type_hosted': 'Hébergé',
    'artists.accommodation_type_other': 'Autre',
  }
  return labels[key] ?? key
}

describe('accommodation-type utils', () => {
  describe('ACCOMMODATION_TYPES', () => {
    it('contient les quatre types attendus avec leurs clés i18n', () => {
      expect(ACCOMMODATION_TYPES).toEqual({
        TENT: 'artists.accommodation_type_tent',
        VEHICLE: 'artists.accommodation_type_vehicle',
        HOSTED: 'artists.accommodation_type_hosted',
        OTHER: 'artists.accommodation_type_other',
      })
    })
  })

  describe('getAccommodationTypeLabel', () => {
    it('traduit chaque type connu', () => {
      expect(getAccommodationTypeLabel('TENT', t)).toBe('Tente')
      expect(getAccommodationTypeLabel('VEHICLE', t)).toBe('Véhicule')
      expect(getAccommodationTypeLabel('HOSTED', t)).toBe('Hébergé')
      expect(getAccommodationTypeLabel('OTHER', t)).toBe('Autre')
    })

    it('retourne la valeur brute pour un type inconnu', () => {
      expect(getAccommodationTypeLabel('UNKNOWN', t)).toBe('UNKNOWN')
      expect(getAccommodationTypeLabel('tent', t)).toBe('tent')
      expect(getAccommodationTypeLabel('', t)).toBe('')
    })

    it('appelle bien la fonction de traduction avec la clé mappée', () => {
      const calls: string[] = []
      const spyT = (key: string) => {
        calls.push(key)
        return key
      }
      getAccommodationTypeLabel('HOSTED', spyT)
      expect(calls).toEqual(['artists.accommodation_type_hosted'])
    })

    it("n'appelle pas la traduction pour un type inconnu", () => {
      const calls: string[] = []
      const spyT = (key: string) => {
        calls.push(key)
        return key
      }
      const result = getAccommodationTypeLabel('FOO', spyT)
      expect(result).toBe('FOO')
      expect(calls).toEqual([])
    })
  })

  describe('getAccommodationTypeSelectOptions', () => {
    it('retourne une option par type, dans l’ordre de définition', () => {
      const options = getAccommodationTypeSelectOptions(t)
      expect(options).toEqual([
        { value: 'TENT', label: 'Tente' },
        { value: 'VEHICLE', label: 'Véhicule' },
        { value: 'HOSTED', label: 'Hébergé' },
        { value: 'OTHER', label: 'Autre' },
      ])
    })

    it('chaque option ne contient que value et label', () => {
      const options = getAccommodationTypeSelectOptions(t)
      for (const option of options) {
        expect(Object.keys(option).sort()).toEqual(['label', 'value'])
      }
    })

    it('utilise la clé brute comme label si la traduction est absente', () => {
      const passthrough = (key: string) => key
      const options = getAccommodationTypeSelectOptions(passthrough)
      expect(options[0]).toEqual({
        value: 'TENT',
        label: 'artists.accommodation_type_tent',
      })
    })
  })
})
