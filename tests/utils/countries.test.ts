import { describe, it, expect } from 'vitest'
import { countryToCode, getCountryCode, formatCountriesForSelect } from '../../app/utils/countries'

describe('countries utils', () => {
  describe('countryToCode', () => {
    it('devrait contenir les pays principaux', () => {
      expect(countryToCode['France']).toBe('fr')
      expect(countryToCode['Belgique']).toBe('be')
      expect(countryToCode['Suisse']).toBe('ch')
      expect(countryToCode['Canada']).toBe('ca')
      expect(countryToCode['États-Unis']).toBe('us')
    })

    it('devrait contenir des pays européens', () => {
      expect(countryToCode['Allemagne']).toBe('de')
      expect(countryToCode['Italie']).toBe('it')
      expect(countryToCode['Espagne']).toBe('es')
      expect(countryToCode['Royaume-Uni']).toBe('gb')
      expect(countryToCode['Pays-Bas']).toBe('nl')
    })

    it('devrait contenir des pays d\'Afrique', () => {
      expect(countryToCode['Maroc']).toBe('ma')
      expect(countryToCode['Tunisie']).toBe('tn')
      expect(countryToCode['Afrique du Sud']).toBe('za')
      expect(countryToCode['Sénégal']).toBe('sn')
      expect(countryToCode['Côte d\'Ivoire']).toBe('ci')
    })

    it('devrait contenir des pays d\'Asie', () => {
      expect(countryToCode['Japon']).toBe('jp')
      expect(countryToCode['Chine']).toBe('cn')
      expect(countryToCode['Corée du Sud']).toBe('kr')
      expect(countryToCode['Inde']).toBe('in')
      expect(countryToCode['Thaïlande']).toBe('th')
    })

    it('devrait contenir des pays d\'Amérique', () => {
      expect(countryToCode['Brésil']).toBe('br')
      expect(countryToCode['Argentine']).toBe('ar')
      expect(countryToCode['Mexique']).toBe('mx')
      expect(countryToCode['Chili']).toBe('cl')
    })

    it('devrait contenir des pays d\'Océanie', () => {
      expect(countryToCode['Australie']).toBe('au')
      expect(countryToCode['Nouvelle-Zélande']).toBe('nz')
    })

    it('devrait utiliser des codes ISO 3166-1 alpha-2 valides', () => {
      Object.values(countryToCode).forEach(code => {
        expect(code).toMatch(/^[a-z]{2}$/) // 2 lettres minuscules
      })
    })

    it('ne devrait pas avoir de doublons de codes', () => {
      const codes = Object.values(countryToCode)
      const uniqueCodes = new Set(codes)
      expect(codes.length).toBe(uniqueCodes.size)
    })

    it('devrait avoir au moins 70 pays', () => {
      expect(Object.keys(countryToCode).length).toBeGreaterThanOrEqual(70)
    })
  })

  describe('getCountryCode', () => {
    it('devrait retourner le code correct pour un pays existant', () => {
      expect(getCountryCode('France')).toBe('fr')
      expect(getCountryCode('Belgique')).toBe('be')
      expect(getCountryCode('Canada')).toBe('ca')
    })

    it('devrait retourner "xx" pour un pays inexistant', () => {
      expect(getCountryCode('Pays Inexistant')).toBe('xx')
      expect(getCountryCode('Atlantide')).toBe('xx')
      expect(getCountryCode('')).toBe('xx')
    })

    it('devrait être sensible à la casse', () => {
      expect(getCountryCode('france')).toBe('xx') // Minuscule
      expect(getCountryCode('FRANCE')).toBe('xx') // Majuscule
      expect(getCountryCode('France')).toBe('fr') // Correct
    })

    it('devrait gérer les caractères spéciaux', () => {
      expect(getCountryCode('Côte d\'Ivoire')).toBe('ci')
      expect(getCountryCode('États-Unis')).toBe('us')
    })

    it('devrait gérer les espaces', () => {
      expect(getCountryCode('Corée du Sud')).toBe('kr')
      expect(getCountryCode('Afrique du Sud')).toBe('za')
      expect(getCountryCode('Nouvelle-Zélande')).toBe('nz')
    })

    it('devrait retourner une chaîne', () => {
      expect(typeof getCountryCode('France')).toBe('string')
      expect(typeof getCountryCode('Inexistant')).toBe('string')
    })
  })

  describe('formatCountriesForSelect', () => {
    it('devrait formater une liste de pays pour le select', () => {
      const countries = ['France', 'Belgique', 'Suisse']
      const result = formatCountriesForSelect(countries)
      
      expect(result).toEqual([
        { label: 'France', value: 'France', flag: 'fr' },
        { label: 'Belgique', value: 'Belgique', flag: 'be' },
        { label: 'Suisse', value: 'Suisse', flag: 'ch' }
      ])
    })

    it('devrait gérer une liste vide', () => {
      const result = formatCountriesForSelect([])
      expect(result).toEqual([])
    })

    it('devrait gérer des pays inexistants', () => {
      const countries = ['France', 'Pays Inexistant']
      const result = formatCountriesForSelect(countries)
      
      expect(result).toEqual([
        { label: 'France', value: 'France', flag: 'fr' },
        { label: 'Pays Inexistant', value: 'Pays Inexistant', flag: 'xx' }
      ])
    })

    it('devrait préserver l\'ordre des pays', () => {
      const countries = ['Suisse', 'France', 'Belgique']
      const result = formatCountriesForSelect(countries)
      
      expect(result[0].label).toBe('Suisse')
      expect(result[1].label).toBe('France')
      expect(result[2].label).toBe('Belgique')
    })

    it('devrait avoir la bonne structure pour chaque élément', () => {
      const countries = ['France']
      const result = formatCountriesForSelect(countries)
      
      expect(result[0]).toHaveProperty('label')
      expect(result[0]).toHaveProperty('value')
      expect(result[0]).toHaveProperty('flag')
      expect(result[0].label).toBe(result[0].value) // Même valeur
    })

    it('devrait gérer une grande liste de pays', () => {
      const allCountries = Object.keys(countryToCode)
      const result = formatCountriesForSelect(allCountries)
      
      expect(result).toHaveLength(allCountries.length)
      
      result.forEach((item, index) => {
        expect(item.label).toBe(allCountries[index])
        expect(item.value).toBe(allCountries[index])
        expect(item.flag).toBe(countryToCode[allCountries[index]])
      })
    })

    it('devrait gérer les doublons', () => {
      const countries = ['France', 'France', 'Belgique']
      const result = formatCountriesForSelect(countries)
      
      expect(result).toHaveLength(3) // Ne supprime pas les doublons
      expect(result[0]).toEqual(result[1]) // Doublons identiques
    })

    it('devrait supporter tous les pays définis', () => {
      const testCountries = [
        'France', 'États-Unis', 'Côte d\'Ivoire', 
        'Corée du Sud', 'Nouvelle-Zélande'
      ]
      
      const result = formatCountriesForSelect(testCountries)
      
      expect(result).toEqual([
        { label: 'France', value: 'France', flag: 'fr' },
        { label: 'États-Unis', value: 'États-Unis', flag: 'us' },
        { label: 'Côte d\'Ivoire', value: 'Côte d\'Ivoire', flag: 'ci' },
        { label: 'Corée du Sud', value: 'Corée du Sud', flag: 'kr' },
        { label: 'Nouvelle-Zélande', value: 'Nouvelle-Zélande', flag: 'nz' }
      ])
    })
  })
})