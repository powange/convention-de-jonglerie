import { describe, it, expect } from 'vitest'

import {
  SUPPORTED_LOCALE_CODES,
  LOCALES_CONFIG,
  DEFAULT_LOCALE,
  getSupportedLocalesCodes,
  isSupportedLocale,
  getLocaleName,
  languageCodeToFlag,
  toIntlLocale,
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
    it("retourne le nom d'icône du drapeau pour les codes connus", () => {
      expect(languageCodeToFlag('fr')).toBe('i-flag:fr-4x3')
      expect(languageCodeToFlag('de')).toBe('i-flag:de-4x3')
      expect(languageCodeToFlag('es')).toBe('i-flag:es-4x3')
    })

    it('mappe les codes vers le bon pays quand ils diffèrent', () => {
      // anglais -> drapeau Royaume-Uni
      expect(languageCodeToFlag('en')).toBe('i-flag:gb-4x3')
      // danois -> Danemark
      expect(languageCodeToFlag('da')).toBe('i-flag:dk-4x3')
      // ukrainien -> Ukraine (ua)
      expect(languageCodeToFlag('uk')).toBe('i-flag:ua-4x3')
      // tchèque -> République tchèque (cz)
      expect(languageCodeToFlag('cs')).toBe('i-flag:cz-4x3')
      // suédois -> Suède (se)
      expect(languageCodeToFlag('sv')).toBe('i-flag:se-4x3')
    })

    it('retourne undefined pour un code inconnu', () => {
      expect(languageCodeToFlag('xx')).toBeUndefined()
      expect(languageCodeToFlag('')).toBeUndefined()
    })

    it('fournit un drapeau pour chaque locale supportée', () => {
      for (const code of SUPPORTED_LOCALE_CODES) {
        const flag = languageCodeToFlag(code)
        expect(flag).toBeDefined()
        expect(flag).toMatch(/^i-flag:[a-z]{2}-4x3$/)
      }
    })
  })

  describe('toIntlLocale', () => {
    it("régionalise l'anglais en britannique", () => {
      expect(toIntlLocale('en')).toBe('en-GB')
    })

    it('renvoie les autres codes tels quels', () => {
      expect(toIntlLocale('fr')).toBe('fr')
      expect(toIntlLocale('de')).toBe('de')
      expect(toIntlLocale('')).toBe('')
    })

    it('donne un ordre jour/mois/année en anglais', () => {
      const date = new Date('2026-08-17T12:00:00Z')
      const formatted = date.toLocaleDateString(toIntlLocale('en'), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Europe/Paris',
      })
      expect(formatted).toBe('17/08/2026')
    })
  })
})
