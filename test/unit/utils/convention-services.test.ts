import { describe, it, expect } from 'vitest'

import {
  conventionServices,
  getServiceByKey,
  getActiveServices,
  getServicesGrouped,
  getServicesByCategory,
  type ConventionServiceKeys,
  type ConventionService,
} from '../../../app/utils/convention-services'

describe('convention-services utils', () => {
  describe('conventionServices array', () => {
    it('devrait contenir tous les services définis', () => {
      expect(conventionServices).toHaveLength(24)
    })

    it('chaque service devrait avoir la structure correcte', () => {
      conventionServices.forEach((service) => {
        expect(service).toHaveProperty('key')
        expect(service).toHaveProperty('label')
        expect(service).toHaveProperty('icon')
        expect(service).toHaveProperty('color')

        expect(typeof service.key).toBe('string')
        expect(typeof service.label).toBe('string')
        expect(typeof service.icon).toBe('string')
        expect(typeof service.color).toBe('string')
      })
    })

    it('devrait avoir des clés uniques', () => {
      const keys = conventionServices.map((s) => s.key)
      const uniqueKeys = new Set(keys)
      expect(keys.length).toBe(uniqueKeys.size)
    })

    it('devrait contenir les services essentiels', () => {
      const essentialServices = [
        'hasFoodTrucks',
        'hasKidsZone',
        'acceptsPets',
        'hasTentCamping',
        'hasGym',
        'hasToilets',
        'hasAccessibility',
        'hasCashPayment',
      ]

      essentialServices.forEach((serviceKey) => {
        const service = conventionServices.find((s) => s.key === serviceKey)
        expect(service).toBeDefined()
      })
    })

    it('devrait avoir des couleurs Tailwind CSS valides', () => {
      conventionServices.forEach((service) => {
        expect(service.color).toMatch(/^text-\w+-\d+$/)
      })
    })

    it('devrait avoir des icônes avec préfixes valides', () => {
      conventionServices.forEach((service) => {
        // Accepter les formats i-prefix:suffix, i-prefix-suffix et prefix:suffix (pour cbi:mealie)
        expect(service.icon).toMatch(/^(i-)?[\w-]+[:-][\w-]+.*$/)
      })
    })
  })

  describe('getServiceByKey', () => {
    it('devrait retourner le service correct pour une clé valide', () => {
      const service = getServiceByKey('hasFoodTrucks')

      expect(service).toBeDefined()
      expect(service!.key).toBe('hasFoodTrucks')
      expect(service!.label).toBe('Food trucks')
      expect(service!.icon).toBe('i-mdi:food-outline')
      expect(service!.color).toBe('text-orange-500')
    })

    it('devrait retourner le service de paiement liquide', () => {
      const service = getServiceByKey('hasCashPayment')

      expect(service).toBeDefined()
      expect(service!.key).toBe('hasCashPayment')
      expect(service!.label).toBe('Paiement liquide')
      expect(service!.icon).toBe('i-heroicons-banknotes')
      expect(service!.color).toBe('text-green-700')
    })

    it('devrait retourner undefined pour une clé inexistante', () => {
      const service = getServiceByKey('nonExistentService' as any)

      expect(service).toBeUndefined()
    })

    it('devrait fonctionner pour tous les services définis', () => {
      conventionServices.forEach((expectedService) => {
        const service = getServiceByKey(expectedService.key)

        expect(service).toEqual(expectedService)
      })
    })
  })

  describe('getActiveServices', () => {
    it('devrait retourner une liste vide pour un objet vide', () => {
      const activeServices = getActiveServices({})

      expect(activeServices).toEqual([])
    })

    it('devrait retourner seulement les services actifs', () => {
      const convention: Partial<ConventionServiceKeys> = {
        hasFoodTrucks: true,
        hasKidsZone: false,
        hasTentCamping: true,
        hasGym: undefined as any,
      }

      const activeServices = getActiveServices(convention)

      expect(activeServices).toHaveLength(2)
      expect(activeServices.map((s) => s.key)).toContain('hasFoodTrucks')
      expect(activeServices.map((s) => s.key)).toContain('hasTentCamping')
      expect(activeServices.map((s) => s.key)).not.toContain('hasKidsZone')
      expect(activeServices.map((s) => s.key)).not.toContain('hasGym')
    })

    it('devrait retourner tous les services si tous sont actifs', () => {
      const convention: Partial<ConventionServiceKeys> = {}
      conventionServices.forEach((service) => {
        convention[service.key] = true
      })

      const activeServices = getActiveServices(convention)

      expect(activeServices).toHaveLength(conventionServices.length)
    })

    it('devrait gérer les valeurs falsy correctement', () => {
      const convention: Partial<ConventionServiceKeys> = {
        hasFoodTrucks: true,
        hasKidsZone: false,
        hasTentCamping: null as any,
        hasGym: undefined as any,
        hasFireSpace: 0 as any,
        hasGala: '' as any,
      }

      const activeServices = getActiveServices(convention)

      expect(activeServices).toHaveLength(1)
      expect(activeServices[0].key).toBe('hasFoodTrucks')
    })

    it("devrait préserver l'ordre des services", () => {
      const convention: Partial<ConventionServiceKeys> = {
        hasATM: true,
        hasFoodTrucks: true,
        hasAccessibility: true,
      }

      const activeServices = getActiveServices(convention)

      // L'ordre devrait suivre l'ordre de conventionServices
      const foodTrucksIndex = conventionServices.findIndex((s) => s.key === 'hasFoodTrucks')
      const accessibilityIndex = conventionServices.findIndex((s) => s.key === 'hasAccessibility')
      const atmIndex = conventionServices.findIndex((s) => s.key === 'hasATM')

      expect(activeServices[0].key).toBe('hasFoodTrucks')
      expect(activeServices[1].key).toBe('hasAccessibility')
      expect(activeServices[2].key).toBe('hasATM')
    })
  })

  describe('getServicesGrouped', () => {
    it('devrait retourner les groupes de services définis', () => {
      const grouped = getServicesGrouped()

      expect(grouped).toHaveProperty('accommodation')
      expect(grouped).toHaveProperty('food')
      expect(grouped).toHaveProperty('activities')
      expect(grouped).toHaveProperty('amenities')
      expect(grouped).toHaveProperty('payment')
    })

    it('chaque groupe devrait avoir un label et des services', () => {
      const grouped = getServicesGrouped()

      Object.values(grouped).forEach((group) => {
        expect(group).toHaveProperty('label')
        expect(group).toHaveProperty('services')
        expect(typeof group.label).toBe('string')
        expect(Array.isArray(group.services)).toBe(true)
        expect(group.services.length).toBeGreaterThan(0)
      })
    })

    it('devrait avoir les bons services dans le groupe accommodation', () => {
      const grouped = getServicesGrouped()

      expect(grouped.accommodation.label).toBe('Hébergement')
      expect(grouped.accommodation.services).toEqual([
        'hasTentCamping',
        'hasTruckCamping',
        'hasFamilyCamping',
        'hasSleepingRoom',
      ])
    })

    it('devrait avoir les bons services dans le groupe food', () => {
      const grouped = getServicesGrouped()

      expect(grouped.food.label).toBe('Restauration')
      expect(grouped.food.services).toEqual(['hasFoodTrucks', 'hasCantine'])
    })

    it('devrait avoir les bons services dans le groupe activities', () => {
      const grouped = getServicesGrouped()

      expect(grouped.activities.label).toBe('Activités')
      expect(grouped.activities.services).toEqual([
        'hasGym',
        'hasFireSpace',
        'hasGala',
        'hasOpenStage',
        'hasLongShow',
        'hasConcert',
        'hasWorkshops',
        'hasAerialSpace',
        'hasSlacklineSpace',
      ])
    })

    it('tous les services groupés devraient exister dans conventionServices', () => {
      const grouped = getServicesGrouped()
      const allGroupedServices: string[] = []

      Object.values(grouped).forEach((group) => {
        allGroupedServices.push(...group.services)
      })

      allGroupedServices.forEach((serviceKey) => {
        const service = conventionServices.find((s) => s.key === serviceKey)
        expect(service, `Service ${serviceKey} not found`).toBeDefined()
      })
    })

    it('devrait couvrir tous les services disponibles', () => {
      const grouped = getServicesGrouped()
      const allGroupedServices: string[] = []

      Object.values(grouped).forEach((group) => {
        allGroupedServices.push(...group.services)
      })

      expect(allGroupedServices.length).toBe(conventionServices.length)

      conventionServices.forEach((service) => {
        expect(allGroupedServices).toContain(service.key)
      })
    })
  })

  describe('getServicesByCategory', () => {
    it('devrait retourner un tableau de catégories avec services', () => {
      const servicesByCategory = getServicesByCategory()

      expect(Array.isArray(servicesByCategory)).toBe(true)
      expect(servicesByCategory.length).toBe(5) // 5 catégories
    })

    it('chaque catégorie devrait avoir la structure correcte', () => {
      const servicesByCategory = getServicesByCategory()

      servicesByCategory.forEach((category) => {
        expect(category).toHaveProperty('category')
        expect(category).toHaveProperty('label')
        expect(category).toHaveProperty('services')

        expect(typeof category.category).toBe('string')
        expect(typeof category.label).toBe('string')
        expect(Array.isArray(category.services)).toBe(true)
        expect(category.services.length).toBeGreaterThan(0)

        // Chaque service devrait être un ConventionService complet
        category.services.forEach((service) => {
          expect(service).toHaveProperty('key')
          expect(service).toHaveProperty('label')
          expect(service).toHaveProperty('icon')
          expect(service).toHaveProperty('color')
        })
      })
    })

    it('devrait contenir toutes les catégories attendues', () => {
      const servicesByCategory = getServicesByCategory()
      const categoryNames = servicesByCategory.map((c) => c.category)

      expect(categoryNames).toContain('accommodation')
      expect(categoryNames).toContain('food')
      expect(categoryNames).toContain('activities')
      expect(categoryNames).toContain('amenities')
      expect(categoryNames).toContain('payment')
    })

    it('devrait avoir des services complets pour chaque catégorie', () => {
      const servicesByCategory = getServicesByCategory()

      const accommodationCategory = servicesByCategory.find((c) => c.category === 'accommodation')
      expect(accommodationCategory!.label).toBe('Hébergement')
      expect(accommodationCategory!.services).toHaveLength(4)

      const tentCampingService = accommodationCategory!.services.find(
        (s) => s.key === 'hasTentCamping'
      )
      expect(tentCampingService).toBeDefined()
      expect(tentCampingService!.label).toBe('Camping tente')
      expect(tentCampingService!.icon).toBe('i-mdi:tent')
      expect(tentCampingService!.color).toBe('text-green-600')
    })

    it('devrait retourner tous les services dans les catégories', () => {
      const servicesByCategory = getServicesByCategory()
      const allCategorizedServices: ConventionService[] = []

      servicesByCategory.forEach((category) => {
        allCategorizedServices.push(...category.services)
      })

      expect(allCategorizedServices).toHaveLength(conventionServices.length)

      conventionServices.forEach((originalService) => {
        const categorizedService = allCategorizedServices.find((s) => s.key === originalService.key)
        expect(categorizedService).toEqual(originalService)
      })
    })

    it("devrait maintenir l'ordre des catégories", () => {
      const servicesByCategory = getServicesByCategory()
      const categoryOrder = servicesByCategory.map((c) => c.category)

      expect(categoryOrder).toEqual(['accommodation', 'food', 'activities', 'amenities', 'payment'])
    })
  })
})
