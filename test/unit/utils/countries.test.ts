import { describe, it, expect, beforeAll } from 'vitest'
import countries from 'i18n-iso-countries'
import frLocale from 'i18n-iso-countries/langs/fr.json'
import enLocale from 'i18n-iso-countries/langs/en.json'

import {
  countryToCode,
  getCountryCode,
  formatCountriesForSelect,
  translateToFrench,
  translateToEnglish,
  translateCountry,
  getCountryNames,
  getCountrySelectOptions,
} from '../../../app/utils/countries'

// Initialiser les locales avant les tests
beforeAll(() => {
  countries.registerLocale(frLocale)
  countries.registerLocale(enLocale)
})

describe('countries utils (i18n-iso-countries)', () => {
  describe('countryToCode', () => {
    it('devrait contenir les pays principaux français', () => {
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

    it("devrait contenir des pays d'Afrique", () => {
      expect(countryToCode['Maroc']).toBe('ma')
      expect(countryToCode['Tunisie']).toBe('tn')
      expect(countryToCode['Afrique du Sud']).toBe('za')
      expect(countryToCode['Sénégal']).toBe('sn')
      expect(countryToCode["Côte d'Ivoire"]).toBe('ci')
    })

    it("devrait contenir des pays d'Asie", () => {
      expect(countryToCode['Japon']).toBe('jp')
      expect(countryToCode['Chine']).toBe('cn')
      expect(countryToCode['Corée du Sud']).toBe('kr')
      expect(countryToCode['Inde']).toBe('in')
      expect(countryToCode['Thaïlande']).toBe('th')
    })

    it("devrait contenir des pays d'Amérique", () => {
      expect(countryToCode['Brésil']).toBe('br')
      expect(countryToCode['Argentine']).toBe('ar')
      expect(countryToCode['Mexique']).toBe('mx')
      expect(countryToCode['Chili']).toBe('cl')
    })

    it("devrait contenir des pays d'Océanie", () => {
      expect(countryToCode['Australie']).toBe('au')
      expect(countryToCode['Nouvelle-Zélande']).toBe('nz')
    })

    it('devrait utiliser des codes ISO 3166-1 alpha-2 valides', () => {
      // Vérifier quelques codes spécifiques
      expect(countryToCode['France']).toMatch(/^[a-z]{2}$/)
      expect(countryToCode['Allemagne']).toMatch(/^[a-z]{2}$/)
      expect(countryToCode['Japon']).toMatch(/^[a-z]{2}$/)
    })

    it('devrait avoir plus de 200 pays (i18n-iso-countries)', () => {
      const keys = Object.keys(countryToCode)
      expect(keys.length).toBeGreaterThanOrEqual(200)
    })

    it('devrait contenir les noms anglais aussi', () => {
      expect(countryToCode['Germany']).toBe('de')
      expect(countryToCode['Belgium']).toBe('be')
      expect(countryToCode['Switzerland']).toBe('ch')
      expect(countryToCode['United States']).toBe('us')
    })
  })

  describe('getCountryCode', () => {
    it('devrait retourner le code correct pour un pays français', () => {
      expect(getCountryCode('France')).toBe('fr')
      expect(getCountryCode('Belgique')).toBe('be')
      expect(getCountryCode('Canada')).toBe('ca')
    })

    it('devrait retourner le code correct pour un pays anglais', () => {
      expect(getCountryCode('Belgium')).toBe('be')
      expect(getCountryCode('Switzerland')).toBe('ch')
      expect(getCountryCode('Germany')).toBe('de')
    })

    it('devrait retourner "xx" pour un pays inexistant', () => {
      expect(getCountryCode('Pays Inexistant')).toBe('xx')
      expect(getCountryCode('Atlantide')).toBe('xx')
      expect(getCountryCode('')).toBe('xx')
    })

    it('devrait gérer les caractères spéciaux', () => {
      expect(getCountryCode("Côte d'Ivoire")).toBe('ci')
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

  describe('translateToFrench', () => {
    it("devrait traduire de l'anglais vers le français", () => {
      expect(translateToFrench('Germany')).toBe('Allemagne')
      expect(translateToFrench('Switzerland')).toBe('Suisse')
      expect(translateToFrench('Belgium')).toBe('Belgique')
    })

    it('devrait garder le français intact', () => {
      expect(translateToFrench('France')).toBe('France')
      expect(translateToFrench('Allemagne')).toBe('Allemagne')
    })

    it('devrait retourner le nom original si non trouvé', () => {
      expect(translateToFrench('Atlantide')).toBe('Atlantide')
    })
  })

  describe('translateToEnglish', () => {
    it("devrait traduire du français vers l'anglais", () => {
      expect(translateToEnglish('Allemagne')).toBe('Germany')
      expect(translateToEnglish('Suisse')).toBe('Switzerland')
      expect(translateToEnglish('Belgique')).toBe('Belgium')
    })

    it("devrait garder l'anglais intact", () => {
      expect(translateToEnglish('France')).toBe('France')
      expect(translateToEnglish('Germany')).toBe('Germany')
    })
  })

  describe('translateCountry', () => {
    it('devrait traduire vers le français', () => {
      expect(translateCountry('Germany', 'fr')).toBe('Allemagne')
      expect(translateCountry('Switzerland', 'fr')).toBe('Suisse')
    })

    it("devrait traduire vers l'anglais", () => {
      expect(translateCountry('Allemagne', 'en')).toBe('Germany')
      expect(translateCountry('Suisse', 'en')).toBe('Switzerland')
    })
  })

  describe('getCountryNames', () => {
    it('devrait retourner une liste de noms de pays', () => {
      const names = getCountryNames('fr')
      expect(names.length).toBeGreaterThan(200)
      expect(names).toContain('France')
      expect(names).toContain('Allemagne')
    })

    it('devrait être trié alphabétiquement', () => {
      const names = getCountryNames('fr')
      for (let i = 1; i < Math.min(names.length, 50); i++) {
        expect(names[i - 1].localeCompare(names[i], 'fr')).toBeLessThanOrEqual(0)
      }
    })
  })

  describe('getCountrySelectOptions', () => {
    it('devrait retourner des options avec label, value et icon', () => {
      const options = getCountrySelectOptions('fr')
      expect(options.length).toBeGreaterThan(200)

      const france = options.find((o) => o.value === 'France')
      expect(france).toBeDefined()
      expect(france?.label).toBe('France')
      expect(france?.icon).toBe('flag:fr-4x3')
    })

    it('devrait inclure les principaux pays européens', () => {
      const options = getCountrySelectOptions('fr')
      const countryValues = options.map((o) => o.value)

      expect(countryValues).toContain('France')
      expect(countryValues).toContain('Allemagne')
      expect(countryValues).toContain('Belgique')
      expect(countryValues).toContain('Suisse')
    })
  })

  describe('formatCountriesForSelect', () => {
    it('devrait formater une liste de pays pour le select', () => {
      const countriesList = ['France', 'Belgique', 'Suisse']
      const result = formatCountriesForSelect(countriesList)

      expect(result).toEqual([
        { label: 'France', value: 'France', flag: 'fr' },
        { label: 'Belgique', value: 'Belgique', flag: 'be' },
        { label: 'Suisse', value: 'Suisse', flag: 'ch' },
      ])
    })

    it('devrait gérer une liste vide', () => {
      const result = formatCountriesForSelect([])
      expect(result).toEqual([])
    })

    it('devrait gérer des pays inexistants', () => {
      const countriesList = ['France', 'Pays Inexistant']
      const result = formatCountriesForSelect(countriesList)

      expect(result).toEqual([
        { label: 'France', value: 'France', flag: 'fr' },
        { label: 'Pays Inexistant', value: 'Pays Inexistant', flag: 'xx' },
      ])
    })

    it("devrait préserver l'ordre des pays", () => {
      const countriesList = ['Suisse', 'France', 'Belgique']
      const result = formatCountriesForSelect(countriesList)

      expect(result[0].label).toBe('Suisse')
      expect(result[1].label).toBe('France')
      expect(result[2].label).toBe('Belgique')
    })

    it('devrait avoir la bonne structure pour chaque élément', () => {
      const countriesList = ['France']
      const result = formatCountriesForSelect(countriesList)

      expect(result[0]).toHaveProperty('label')
      expect(result[0]).toHaveProperty('value')
      expect(result[0]).toHaveProperty('flag')
      expect(result[0].label).toBe(result[0].value)
    })

    it('devrait gérer les doublons', () => {
      const countriesList = ['France', 'France', 'Belgique']
      const result = formatCountriesForSelect(countriesList)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(result[1])
    })

    it('devrait supporter les pays avec caractères spéciaux', () => {
      const testCountries = [
        'France',
        'États-Unis',
        "Côte d'Ivoire",
        'Corée du Sud',
        'Nouvelle-Zélande',
      ]

      const result = formatCountriesForSelect(testCountries)

      expect(result).toEqual([
        { label: 'France', value: 'France', flag: 'fr' },
        { label: 'États-Unis', value: 'États-Unis', flag: 'us' },
        { label: "Côte d'Ivoire", value: "Côte d'Ivoire", flag: 'ci' },
        { label: 'Corée du Sud', value: 'Corée du Sud', flag: 'kr' },
        { label: 'Nouvelle-Zélande', value: 'Nouvelle-Zélande', flag: 'nz' },
      ])
    })
  })
})
