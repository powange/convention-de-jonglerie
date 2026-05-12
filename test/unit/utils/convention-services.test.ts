import { describe, it, expect } from 'vitest'

import { Prisma } from '../../../server/generated/prisma'

import {
  CONVENTION_SERVICE_KEYS,
  conventionServices,
  getActiveServices,
  getServiceByKey,
  getServicesByCategory,
  SERVICE_CATEGORIES,
  type ConventionService,
  type ConventionServiceKeys,
} from '../../../app/utils/convention-services'

describe('convention-services utils', () => {
  // ──────────────────────────────────────────────────────────────────
  // Filets de sécurité : la liste centrale doit rester en phase avec
  // le schéma Prisma. Si on ajoute une colonne booléenne `has*` /
  // `acceptsPets` sur Edition en oubliant de l'ajouter dans
  // `app/utils/convention-services.ts` (ou inversement), ce test casse.
  // ──────────────────────────────────────────────────────────────────
  describe('cohérence avec le schéma Prisma', () => {
    const editionFields = Object.keys(Prisma.EditionScalarFieldEnum)
    const prismaServiceKeys = editionFields.filter(
      (k) => k.startsWith('has') || k === 'acceptsPets'
    )

    it('chaque clé de la liste centrale existe comme colonne sur Edition', () => {
      const missingInPrisma = CONVENTION_SERVICE_KEYS.filter(
        (k) => !editionFields.includes(k as string)
      )
      expect(missingInPrisma, 'Clés présentes dans la liste mais absentes de Prisma').toEqual([])
    })

    it('chaque colonne Prisma de service est présente dans la liste centrale', () => {
      const missingInList = prismaServiceKeys.filter(
        (k) => !(CONVENTION_SERVICE_KEYS as string[]).includes(k)
      )
      expect(
        missingInList,
        'Colonnes Prisma services oubliées dans la liste (à ajouter dans app/utils/convention-services.ts)'
      ).toEqual([])
    })
  })

  describe('conventionServices array', () => {
    it('contient au moins les services essentiels et reste cohérent', () => {
      // Le compteur exact évolue, on vérifie surtout la structure et la présence des essentiels
      expect(conventionServices.length).toBeGreaterThanOrEqual(20)
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
        expect(service, `Service ${serviceKey} introuvable`).toBeDefined()
      })
    })

    it('chaque service a la structure attendue (key, i18nKey, icon, color, category)', () => {
      conventionServices.forEach((service) => {
        expect(typeof service.key).toBe('string')
        expect(typeof service.i18nKey).toBe('string')
        expect(service.i18nKey, `i18nKey vide pour ${service.key}`).not.toBe('')
        expect(typeof service.icon).toBe('string')
        expect(service.color).toMatch(/^text-\w+-\d+$/)
        // Format icône : i-prefix:suffix, i-prefix-suffix ou prefix:suffix (cbi:mealie)
        expect(service.icon).toMatch(/^(i-)?[\w-]+[:-][\w-]+.*$/)
        expect(SERVICE_CATEGORIES).toContain(service.category)
      })
    })

    it('a des clés uniques', () => {
      const keys = conventionServices.map((s) => s.key)
      const uniqueKeys = new Set(keys)
      expect(keys.length).toBe(uniqueKeys.size)
    })
  })

  describe('getServiceByKey', () => {
    it('retourne le service correct pour une clé valide', () => {
      const service = getServiceByKey('hasFoodTrucks')
      expect(service).toBeDefined()
      expect(service!.key).toBe('hasFoodTrucks')
      expect(service!.i18nKey).toBe('services.food_trucks')
      expect(service!.icon).toBe('i-mdi:food-outline')
      expect(service!.color).toBe('text-orange-500')
      expect(service!.category).toBe('food')
    })

    it('retourne undefined pour une clé inexistante', () => {
      expect(getServiceByKey('nonExistentService' as any)).toBeUndefined()
    })
  })

  describe('getActiveServices', () => {
    it('retourne une liste vide pour un objet vide', () => {
      expect(getActiveServices({})).toEqual([])
    })

    it('retourne seulement les services actifs', () => {
      const convention: Partial<ConventionServiceKeys> = {
        hasFoodTrucks: true,
        hasKidsZone: false,
        hasTentCamping: true,
      }
      const activeServices = getActiveServices(convention)
      expect(activeServices.map((s) => s.key)).toEqual(
        expect.arrayContaining(['hasFoodTrucks', 'hasTentCamping'])
      )
      expect(activeServices.map((s) => s.key)).not.toContain('hasKidsZone')
    })

    it('gère les valeurs falsy correctement', () => {
      const convention: Partial<ConventionServiceKeys> = {
        hasFoodTrucks: true,
        hasKidsZone: false,
        hasTentCamping: null as any,
        hasGym: undefined as any,
      }
      const activeServices = getActiveServices(convention)
      expect(activeServices).toHaveLength(1)
      expect(activeServices[0].key).toBe('hasFoodTrucks')
    })

    it("préserve l'ordre défini dans conventionServices", () => {
      const convention: Partial<ConventionServiceKeys> = {
        hasATM: true,
        hasFoodTrucks: true,
      }
      const activeServices = getActiveServices(convention)
      const foodTrucksIndex = conventionServices.findIndex((s) => s.key === 'hasFoodTrucks')
      const atmIndex = conventionServices.findIndex((s) => s.key === 'hasATM')
      // Le service avec l'index le plus bas doit apparaître en premier
      expect(activeServices[0].key).toBe(foodTrucksIndex < atmIndex ? 'hasFoodTrucks' : 'hasATM')
    })
  })

  describe('getServicesByCategory', () => {
    it('retourne un tableau de catégories avec services', () => {
      const servicesByCategory = getServicesByCategory()
      expect(Array.isArray(servicesByCategory)).toBe(true)
      expect(servicesByCategory.length).toBe(SERVICE_CATEGORIES.length)
    })

    it("respecte l'ordre défini dans SERVICE_CATEGORIES", () => {
      const servicesByCategory = getServicesByCategory()
      expect(servicesByCategory.map((c) => c.category)).toEqual([...SERVICE_CATEGORIES])
    })

    it('chaque catégorie a au moins un service', () => {
      const servicesByCategory = getServicesByCategory()
      servicesByCategory.forEach((category) => {
        expect(category.services.length).toBeGreaterThan(0)
        category.services.forEach((service: ConventionService) => {
          expect(service.category).toBe(category.category)
        })
      })
    })

    it('couvre tous les services (la somme des catégories == liste totale)', () => {
      const servicesByCategory = getServicesByCategory()
      const allCategorizedServices = servicesByCategory.flatMap((c) => c.services)
      expect(allCategorizedServices).toHaveLength(conventionServices.length)
      conventionServices.forEach((originalService) => {
        expect(allCategorizedServices).toContainEqual(originalService)
      })
    })
  })
})
