import { describe, it, expect } from 'vitest'

import {
  useParticipantTypes,
  type ParticipantType,
  type ManagementSectionType,
} from '../../../app/composables/useParticipantTypes'

describe('useParticipantTypes', () => {
  const {
    getParticipantTypeConfig,
    getManagementSectionConfig,
    getParticipantIcon,
    getParticipantColor,
    getParticipantIconColorClass,
    getParticipantLabel,
    participantTypes,
    managementSections,
  } = useParticipantTypes()

  const allParticipantTypes: ParticipantType[] = ['organizer', 'volunteer', 'artist', 'ticket']
  const allSections: ManagementSectionType[] = [
    'organizers',
    'volunteers',
    'artists',
    'ticketing',
    'meals',
    'workshops',
    'lostFound',
  ]

  describe('getParticipantTypeConfig', () => {
    it("retourne la configuration complète de l'organisateur", () => {
      const config = getParticipantTypeConfig('organizer')
      expect(config).toMatchObject({
        icon: 'i-heroicons-user-group',
        color: 'purple',
        iconColorClass: 'text-purple-500',
        labelKey: 'common.organizer',
        bgClass: 'bg-purple-50',
        textClass: 'text-purple-600',
        chartBgColor: 'rgba(168, 85, 247, 0.8)',
        chartBorderColor: 'rgba(168, 85, 247, 1)',
      })
    })

    it('retourne la configuration complète du bénévole', () => {
      const config = getParticipantTypeConfig('volunteer')
      expect(config).toMatchObject({
        icon: 'i-heroicons-user-group',
        color: 'primary',
        iconColorClass: 'text-primary-500',
        labelKey: 'common.volunteer',
        chartBgColor: 'rgba(34, 197, 94, 0.8)',
        chartBorderColor: 'rgba(34, 197, 94, 1)',
      })
    })

    it("retourne la configuration complète de l'artiste", () => {
      const config = getParticipantTypeConfig('artist')
      expect(config).toMatchObject({
        icon: 'i-heroicons-star',
        color: 'yellow',
        iconColorClass: 'text-yellow-500',
        labelKey: 'common.artist',
        chartBgColor: 'rgba(234, 179, 8, 0.8)',
        chartBorderColor: 'rgba(234, 179, 8, 1)',
      })
    })

    it('retourne la configuration complète du billet (ticket)', () => {
      const config = getParticipantTypeConfig('ticket')
      expect(config).toMatchObject({
        icon: 'i-heroicons-ticket',
        color: 'blue',
        iconColorClass: 'text-blue-500',
        labelKey: 'common.ticket',
        chartBgColor: 'rgba(59, 130, 246, 0.8)',
        chartBorderColor: 'rgba(59, 130, 246, 1)',
      })
    })

    it('chaque type de participant expose toutes les propriétés attendues', () => {
      const expectedKeys = [
        'icon',
        'color',
        'iconColorClass',
        'labelKey',
        'bgClass',
        'textClass',
        'darkBgClass',
        'darkTextClass',
        'hoverBgClass',
        'darkHoverBgClass',
        'chartBgColor',
        'chartBorderColor',
      ]
      allParticipantTypes.forEach((type) => {
        const config = getParticipantTypeConfig(type)
        expectedKeys.forEach((key) => {
          expect(config).toHaveProperty(key)
          expect(typeof (config as Record<string, unknown>)[key]).toBe('string')
        })
      })
    })

    it('retourne undefined pour un type de participant inconnu', () => {
      // Cast volontaire pour simuler une valeur hors énumération
      const config = getParticipantTypeConfig('inconnu' as ParticipantType)
      expect(config).toBeUndefined()
    })
  })

  describe('getParticipantIcon', () => {
    it("retourne l'icône de chaque type de participant", () => {
      expect(getParticipantIcon('organizer')).toBe('i-heroicons-user-group')
      expect(getParticipantIcon('volunteer')).toBe('i-heroicons-user-group')
      expect(getParticipantIcon('artist')).toBe('i-heroicons-star')
      expect(getParticipantIcon('ticket')).toBe('i-heroicons-ticket')
    })
  })

  describe('getParticipantColor', () => {
    it('retourne la couleur de chaque type de participant', () => {
      expect(getParticipantColor('organizer')).toBe('purple')
      expect(getParticipantColor('volunteer')).toBe('primary')
      expect(getParticipantColor('artist')).toBe('yellow')
      expect(getParticipantColor('ticket')).toBe('blue')
    })
  })

  describe('getParticipantIconColorClass', () => {
    it("retourne la classe CSS de couleur d'icône de chaque type", () => {
      expect(getParticipantIconColorClass('organizer')).toBe('text-purple-500')
      expect(getParticipantIconColorClass('volunteer')).toBe('text-primary-500')
      expect(getParticipantIconColorClass('artist')).toBe('text-yellow-500')
      expect(getParticipantIconColorClass('ticket')).toBe('text-blue-500')
    })
  })

  describe('getParticipantLabel', () => {
    it('retourne la clé i18n de chaque type de participant', () => {
      expect(getParticipantLabel('organizer')).toBe('common.organizer')
      expect(getParticipantLabel('volunteer')).toBe('common.volunteer')
      expect(getParticipantLabel('artist')).toBe('common.artist')
      expect(getParticipantLabel('ticket')).toBe('common.ticket')
    })
  })

  describe('getManagementSectionConfig', () => {
    it('retourne la configuration de la section organisateurs', () => {
      const config = getManagementSectionConfig('organizers')
      expect(config).toMatchObject({
        icon: 'i-heroicons-user-group',
        color: 'purple',
        labelKey: 'organizers.title',
      })
    })

    it('retourne la configuration de la section bénévoles', () => {
      expect(getManagementSectionConfig('volunteers')).toMatchObject({
        color: 'primary',
        labelKey: 'edition.ticketing.volunteer_management',
      })
    })

    it('retourne la configuration de la section artistes', () => {
      expect(getManagementSectionConfig('artists')).toMatchObject({
        icon: 'i-heroicons-star',
        color: 'yellow',
        labelKey: 'gestion.artists.title',
      })
    })

    it('retourne la configuration de la section billetterie', () => {
      expect(getManagementSectionConfig('ticketing')).toMatchObject({
        icon: 'i-heroicons-ticket',
        color: 'blue',
        labelKey: 'gestion.ticketing.title',
      })
    })

    it('retourne la configuration de la section repas (icône personnalisée)', () => {
      expect(getManagementSectionConfig('meals')).toMatchObject({
        icon: 'cbi:mealie',
        color: 'orange',
        labelKey: 'gestion.meals.title',
      })
    })

    it('retourne la configuration de la section ateliers', () => {
      expect(getManagementSectionConfig('workshops')).toMatchObject({
        icon: 'i-heroicons-academic-cap',
        color: 'indigo',
        labelKey: 'gestion.workshops.title',
      })
    })

    it('retourne la configuration de la section objets trouvés', () => {
      expect(getManagementSectionConfig('lostFound')).toMatchObject({
        icon: 'i-heroicons-magnifying-glass',
        color: 'amber',
        labelKey: 'edition.lost_found',
      })
    })

    it('chaque section de gestion expose toutes les propriétés attendues', () => {
      const expectedKeys = [
        'icon',
        'color',
        'iconColorClass',
        'labelKey',
        'bgClass',
        'textClass',
        'darkBgClass',
        'darkTextClass',
        'hoverBgClass',
        'darkHoverBgClass',
      ]
      allSections.forEach((section) => {
        const config = getManagementSectionConfig(section)
        expectedKeys.forEach((key) => {
          expect(config).toHaveProperty(key)
          expect(typeof (config as Record<string, unknown>)[key]).toBe('string')
        })
      })
    })

    it('retourne undefined pour une section inconnue', () => {
      const config = getManagementSectionConfig('inexistant' as ManagementSectionType)
      expect(config).toBeUndefined()
    })
  })

  describe('objets de configuration exportés', () => {
    it('expose la configuration brute des types de participants', () => {
      expect(Object.keys(participantTypes).sort()).toEqual(
        ['artist', 'organizer', 'ticket', 'volunteer'].sort()
      )
    })

    it('expose la configuration brute des sections de gestion', () => {
      expect(Object.keys(managementSections).sort()).toEqual([...allSections].sort())
    })

    it('iconColorClass est cohérent avec la couleur pour chaque participant', () => {
      // primary est un cas particulier dont la classe utilise bien le nom de couleur
      allParticipantTypes.forEach((type) => {
        const config = getParticipantTypeConfig(type)
        expect(config.iconColorClass).toBe(`text-${config.color}-500`)
      })
    })
  })
})
