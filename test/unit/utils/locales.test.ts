import { describe, it, expect } from 'vitest'

import {
  SUPPORTED_LOCALE_CODES,
  LOCALES_CONFIG,
  DEFAULT_LOCALE,
  getSupportedLocalesCodes,
  isSupportedLocale,
  getLocaleName,
  languageCodeToFlag,
} from '../../../app/utils/locales'

describe('locales utils', () => {
  describe('SUPPORTED_LOCALE_CODES', () => {
    it('contient les 13 langues supportées', () => {
      expect(SUPPORTED_LOCALE_CODES).toHaveLength(13)
    })

    it('contient les principaux codes attendus', () => {
      expect(SUPPORTED_LOCALE_CODES).toContain('fr')
      expect(SUPPORTED_LOCALE_CODES).toContain('en')
      expect(SUPPORTED_LOCALE_CODES).toContain('de')
      expect(SUPPORTED_LOCALE_CODES).toContain('uk')
    })

    it('est trié par ordre alphabétique', () => {
      const sorted = [...SUPPORTED_LOCALE_CODES].sort()
      expect([...SUPPORTED_LOCALE_CODES]).toEqual(sorted)
    })

    it('ne contient aucun doublon', () => {
      const unique = new Set(SUPPORTED_LOCALE_CODES)
      expect(unique.size).toBe(SUPPORTED_LOCALE_CODES.length)
    })
  })

  describe('LOCALES_CONFIG', () => {
    it('a une entrée par code supporté', () => {
      expect(LOCALES_CONFIG).toHaveLength(SUPPORTED_LOCALE_CODES.length)
    })

    it('a des codes cohérents avec SUPPORTED_LOCALE_CODES', () => {
      const configCodes = LOCALES_CONFIG.map((l) => l.code).sort()
      const supportedCodes = [...SUPPORTED_LOCALE_CODES].sort()
      expect(configCodes).toEqual(supportedCodes)
    })

    it('a un nom et une liste de fichiers pour chaque locale', () => {
      for (const locale of LOCALES_CONFIG) {
        expect(typeof locale.name).toBe('string')
        expect(locale.name.length).toBeGreaterThan(0)
        expect(Array.isArray(locale.files)).toBe(true)
        expect(locale.files!.length).toBeGreaterThan(0)
      }
    })

    it('a des fichiers préfixés par le code de la locale', () => {
      for (const locale of LOCALES_CONFIG) {
        for (const file of locale.files!) {
          expect(file.startsWith(`${locale.code}/`)).toBe(true)
        }
      }
    })

    it('a les noms natifs attendus', () => {
      expect(getLocaleName('fr')).toBe('Français')
      expect(getLocaleName('en')).toBe('English')
      expect(getLocaleName('de')).toBe('Deutsch')
      expect(getLocaleName('cs')).toBe('Čeština')
      expect(getLocaleName('uk')).toBe('Українська')
    })
  })

  describe('DEFAULT_LOCALE', () => {
    it('vaut "en"', () => {
      expect(DEFAULT_LOCALE).toBe('en')
    })

    it('fait partie des locales supportées', () => {
      expect(SUPPORTED_LOCALE_CODES).toContain(DEFAULT_LOCALE)
    })
  })

  describe('getSupportedLocalesCodes', () => {
    it('retourne la liste des codes supportés', () => {
      expect(getSupportedLocalesCodes()).toBe(SUPPORTED_LOCALE_CODES)
    })

    it('retourne 13 codes', () => {
      expect(getSupportedLocalesCodes()).toHaveLength(13)
    })
  })

  describe('isSupportedLocale', () => {
    it('retourne true pour un code supporté', () => {
      expect(isSupportedLocale('fr')).toBe(true)
      expect(isSupportedLocale('en')).toBe(true)
      expect(isSupportedLocale('uk')).toBe(true)
    })

    it('retourne false pour un code inconnu', () => {
      expect(isSupportedLocale('xx')).toBe(false)
      expect(isSupportedLocale('jp')).toBe(false)
      expect(isSupportedLocale('zh')).toBe(false)
    })

    it('retourne false pour une chaîne vide', () => {
      expect(isSupportedLocale('')).toBe(false)
    })

    it('est sensible à la casse', () => {
      expect(isSupportedLocale('FR')).toBe(false)
      expect(isSupportedLocale('En')).toBe(false)
    })
  })

  describe('getLocaleName', () => {
    it('retourne le nom natif pour un code connu', () => {
      expect(getLocaleName('fr')).toBe('Français')
      expect(getLocaleName('es')).toBe('Español')
      expect(getLocaleName('ru')).toBe('Русский')
    })

    it('retourne undefined pour un code inconnu', () => {
      expect(getLocaleName('xx')).toBeUndefined()
      expect(getLocaleName('')).toBeUndefined()
    })
  })

  describe('languageCodeToFlag', () => {
    it('retourne la classe drapeau pour les codes connus', () => {
      expect(languageCodeToFlag('fr')).toBe('fi fi-fr')
      expect(languageCodeToFlag('de')).toBe('fi fi-de')
      expect(languageCodeToFlag('es')).toBe('fi fi-es')
    })

    it('mappe les codes vers le bon pays quand ils diffèrent', () => {
      // anglais -> drapeau Royaume-Uni
      expect(languageCodeToFlag('en')).toBe('fi fi-gb')
      // danois -> Danemark
      expect(languageCodeToFlag('da')).toBe('fi fi-dk')
      // ukrainien -> Ukraine (ua)
      expect(languageCodeToFlag('uk')).toBe('fi fi-ua')
      // tchèque -> République tchèque (cz)
      expect(languageCodeToFlag('cs')).toBe('fi fi-cz')
      // suédois -> Suède (se)
      expect(languageCodeToFlag('sv')).toBe('fi fi-se')
    })

    it('retourne undefined pour un code inconnu', () => {
      expect(languageCodeToFlag('xx')).toBeUndefined()
      expect(languageCodeToFlag('')).toBeUndefined()
    })

    it('fournit un drapeau pour chaque locale supportée', () => {
      for (const code of SUPPORTED_LOCALE_CODES) {
        const flag = languageCodeToFlag(code)
        expect(flag).toBeDefined()
        expect(flag).toMatch(/^fi fi-[a-z]{2}$/)
      }
    })
  })
})
