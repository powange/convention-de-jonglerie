import { describe, it, expect } from 'vitest'

import {
  ALLERGY_SEVERITY_LEVELS,
  getAllergySeverityOptions,
  getAllergySeverityInfo,
  getAllergySeveritySelectOptions,
  requiresEmergencyContact,
  getAllergySeverityBadgeColor,
  getAllergySeverityIcon,
  getAllergySeverityDescriptionKey,
  isValidAllergySeverityLevel,
  getAllergySeverityBadgeClasses,
} from '../../../app/utils/allergy-severity'
import type { AllergySeverityLevel } from '../../../app/utils/allergy-severity'

const LEVELS: AllergySeverityLevel[] = ['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']

describe('allergy-severity utils', () => {
  describe('ALLERGY_SEVERITY_LEVELS', () => {
    it('contient les quatre niveaux de sévérité', () => {
      expect(Object.keys(ALLERGY_SEVERITY_LEVELS)).toEqual([
        'LIGHT',
        'MODERATE',
        'SEVERE',
        'CRITICAL',
      ])
    })

    it('expose les bonnes priorités croissantes', () => {
      expect(ALLERGY_SEVERITY_LEVELS.LIGHT.priority).toBe(1)
      expect(ALLERGY_SEVERITY_LEVELS.MODERATE.priority).toBe(2)
      expect(ALLERGY_SEVERITY_LEVELS.SEVERE.priority).toBe(3)
      expect(ALLERGY_SEVERITY_LEVELS.CRITICAL.priority).toBe(4)
    })

    it('associe la bonne couleur à chaque niveau', () => {
      expect(ALLERGY_SEVERITY_LEVELS.LIGHT.color).toBe('neutral')
      expect(ALLERGY_SEVERITY_LEVELS.MODERATE.color).toBe('info')
      expect(ALLERGY_SEVERITY_LEVELS.SEVERE.color).toBe('warning')
      expect(ALLERGY_SEVERITY_LEVELS.CRITICAL.color).toBe('error')
    })

    it('associe la bonne icône à chaque niveau', () => {
      expect(ALLERGY_SEVERITY_LEVELS.LIGHT.icon).toBe('i-heroicons-exclamation-triangle')
      expect(ALLERGY_SEVERITY_LEVELS.MODERATE.icon).toBe('i-heroicons-exclamation-triangle')
      expect(ALLERGY_SEVERITY_LEVELS.SEVERE.icon).toBe('i-heroicons-exclamation-circle')
      expect(ALLERGY_SEVERITY_LEVELS.CRITICAL.icon).toBe('i-heroicons-shield-exclamation')
    })

    it('utilise des clés i18n cohérentes pour les libellés et descriptions', () => {
      for (const level of LEVELS) {
        const option = ALLERGY_SEVERITY_LEVELS[level]
        expect(option.value).toBe(level)
        expect(option.label).toMatch(/^edition\.volunteers\.allergy_severity_/)
        expect(option.description).toMatch(/^edition\.volunteers\.allergy_severity_/)
      }
    })
  })

  describe('getAllergySeverityOptions', () => {
    it('retourne les quatre options', () => {
      expect(getAllergySeverityOptions()).toHaveLength(4)
    })

    it('trie les options par priorité croissante', () => {
      const options = getAllergySeverityOptions()
      expect(options.map((o) => o.value)).toEqual(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL'])
      expect(options.map((o) => o.priority)).toEqual([1, 2, 3, 4])
    })

    it('retourne des objets complets avec toutes les métadonnées', () => {
      const first = getAllergySeverityOptions()[0]
      expect(first).toMatchObject({
        value: 'LIGHT',
        color: 'neutral',
        icon: 'i-heroicons-exclamation-triangle',
        priority: 1,
      })
      expect(first).toHaveProperty('label')
      expect(first).toHaveProperty('description')
    })
  })

  describe('getAllergySeverityInfo', () => {
    it('retourne les métadonnées du niveau demandé', () => {
      expect(getAllergySeverityInfo('SEVERE')).toBe(ALLERGY_SEVERITY_LEVELS.SEVERE)
      expect(getAllergySeverityInfo('CRITICAL').priority).toBe(4)
    })

    it('fonctionne pour chaque niveau', () => {
      for (const level of LEVELS) {
        expect(getAllergySeverityInfo(level).value).toBe(level)
      }
    })
  })

  describe('getAllergySeveritySelectOptions', () => {
    it('retourne uniquement value et label, triés par priorité', () => {
      const options = getAllergySeveritySelectOptions()
      expect(options).toHaveLength(4)
      expect(options.map((o) => o.value)).toEqual(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL'])
      for (const option of options) {
        expect(Object.keys(option).sort()).toEqual(['label', 'value'])
      }
    })

    it('utilise la clé i18n du libellé court comme label', () => {
      const options = getAllergySeveritySelectOptions()
      const light = options.find((o) => o.value === 'LIGHT')
      expect(light?.label).toBe('edition.volunteers.allergy_severity_light_short')
    })
  })

  describe('requiresEmergencyContact', () => {
    it('exige un contact pour SEVERE et CRITICAL', () => {
      expect(requiresEmergencyContact('SEVERE')).toBe(true)
      expect(requiresEmergencyContact('CRITICAL')).toBe(true)
    })

    it("n'exige pas de contact pour LIGHT et MODERATE", () => {
      expect(requiresEmergencyContact('LIGHT')).toBe(false)
      expect(requiresEmergencyContact('MODERATE')).toBe(false)
    })
  })

  describe('getAllergySeverityBadgeColor', () => {
    it('retourne la couleur correspondant à chaque niveau', () => {
      expect(getAllergySeverityBadgeColor('LIGHT')).toBe('neutral')
      expect(getAllergySeverityBadgeColor('MODERATE')).toBe('info')
      expect(getAllergySeverityBadgeColor('SEVERE')).toBe('warning')
      expect(getAllergySeverityBadgeColor('CRITICAL')).toBe('error')
    })
  })

  describe('getAllergySeverityIcon', () => {
    it("retourne l'icône correspondant à chaque niveau", () => {
      expect(getAllergySeverityIcon('LIGHT')).toBe('i-heroicons-exclamation-triangle')
      expect(getAllergySeverityIcon('MODERATE')).toBe('i-heroicons-exclamation-triangle')
      expect(getAllergySeverityIcon('SEVERE')).toBe('i-heroicons-exclamation-circle')
      expect(getAllergySeverityIcon('CRITICAL')).toBe('i-heroicons-shield-exclamation')
    })
  })

  describe('getAllergySeverityDescriptionKey', () => {
    it('retourne la clé i18n de description de chaque niveau', () => {
      expect(getAllergySeverityDescriptionKey('LIGHT')).toBe(
        'edition.volunteers.allergy_severity_light_description'
      )
      expect(getAllergySeverityDescriptionKey('CRITICAL')).toBe(
        'edition.volunteers.allergy_severity_critical_description'
      )
    })
  })

  describe('isValidAllergySeverityLevel', () => {
    it('accepte les niveaux valides', () => {
      for (const level of LEVELS) {
        expect(isValidAllergySeverityLevel(level)).toBe(true)
      }
    })

    it('refuse les valeurs inconnues', () => {
      expect(isValidAllergySeverityLevel('UNKNOWN')).toBe(false)
      expect(isValidAllergySeverityLevel('light')).toBe(false)
      expect(isValidAllergySeverityLevel('')).toBe(false)
      expect(isValidAllergySeverityLevel('MEDIUM')).toBe(false)
    })
  })

  describe('getAllergySeverityBadgeClasses', () => {
    it('mappe chaque niveau vers les classes Tailwind attendues', () => {
      expect(getAllergySeverityBadgeClasses('LIGHT')).toBe(
        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      )
      expect(getAllergySeverityBadgeClasses('MODERATE')).toBe(
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      )
      expect(getAllergySeverityBadgeClasses('SEVERE')).toBe(
        'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      )
      expect(getAllergySeverityBadgeClasses('CRITICAL')).toBe(
        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      )
    })

    it('lève une erreur pour un niveau inconnu (pas de garde défensive en amont)', () => {
      // getAllergySeverityInfo retourne undefined pour un niveau invalide,
      // donc l'accès à .color échoue avant d'atteindre le fallback colorMap.neutral.
      expect(() => getAllergySeverityBadgeClasses('INVALID' as AllergySeverityLevel)).toThrow(
        TypeError
      )
    })
  })
})
