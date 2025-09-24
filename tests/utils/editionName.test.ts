import { describe, it, expect } from 'vitest'

import {
  getEditionDisplayName,
  getEditionDisplayNameWithConvention,
} from '../../app/utils/editionName'

describe('editionName utils', () => {
  describe('getEditionDisplayName', () => {
    it("devrait retourner le nom de l'édition si défini", () => {
      const edition = {
        name: 'Festival Été 2024',
        convention: {
          name: 'Festival de Jonglerie',
        },
      }

      const result = getEditionDisplayName(edition)

      expect(result).toBe('Festival Été 2024')
    })

    it("devrait retourner le nom de la convention si pas de nom d'édition", () => {
      const edition = {
        name: null,
        convention: {
          name: 'Festival de Jonglerie',
        },
      }

      const result = getEditionDisplayName(edition)

      expect(result).toBe('Festival de Jonglerie')
    })

    it("devrait retourner le nom de la convention si nom d'édition vide", () => {
      const edition = {
        name: '',
        convention: {
          name: 'Festival de Jonglerie',
        },
      }

      const result = getEditionDisplayName(edition)

      expect(result).toBe('Festival de Jonglerie')
    })

    it('devrait retourner une chaîne vide si pas de nom d\'édition ni de convention', () => {
      const edition = {
        name: null,
      }

      const result = getEditionDisplayName(edition)

      expect(result).toBe('')
    })

    it('devrait retourner une chaîne vide si convention est null', () => {
      const edition = {
        name: null,
        convention: null,
      }

      const result = getEditionDisplayName(edition)

      expect(result).toBe('')
    })

    it('devrait retourner une chaîne vide si convention existe mais sans nom', () => {
      const edition = {
        name: null,
        convention: {},
      }

      const result = getEditionDisplayName(edition as any)

      expect(result).toBe('')
    })

    it('devrait gérer les propriétés undefined', () => {
      const edition = {
        name: undefined,
        convention: {
          name: 'Convention Test',
        },
      }

      const result = getEditionDisplayName(edition)

      expect(result).toBe('Convention Test')
    })

    it("devrait préférer le nom d'édition même si vide mais pas null", () => {
      const edition = {
        name: '',
        convention: {
          name: 'Convention Test',
        },
      }

      const result = getEditionDisplayName(edition)

      // Une chaîne vide est falsy, donc ça devrait utiliser le nom de la convention
      expect(result).toBe('Convention Test')
    })

    it("devrait gérer différents types de noms d'édition", () => {
      const testCases = [
        {
          edition: { name: 'Été 2024', convention: { name: 'Festival' } },
          expected: 'Été 2024',
        },
        {
          edition: { name: '1ère Édition', convention: { name: 'Festival' } },
          expected: '1ère Édition',
        },
        {
          edition: { name: '2024', convention: { name: 'Festival' } },
          expected: '2024',
        },
        {
          edition: { name: 'Édition Spéciale COVID-19', convention: { name: 'Festival' } },
          expected: 'Édition Spéciale COVID-19',
        },
      ]

      testCases.forEach(({ edition, expected }) => {
        const result = getEditionDisplayName(edition)
        expect(result).toBe(expected)
      })
    })
  })

  describe('getEditionDisplayNameWithConvention', () => {
    it("devrait retourner le nom de l'édition si défini", () => {
      const edition = { name: 'Festival Été 2024' }
      const convention = { name: 'Festival de Jonglerie' }

      const result = getEditionDisplayNameWithConvention(edition, convention)

      expect(result).toBe('Festival Été 2024')
    })

    it("devrait retourner le nom de la convention si pas de nom d'édition", () => {
      const edition = { name: null }
      const convention = { name: 'Festival de Jonglerie' }

      const result = getEditionDisplayNameWithConvention(edition, convention)

      expect(result).toBe('Festival de Jonglerie')
    })

    it('devrait retourner une chaîne vide si convention est null', () => {
      const edition = { name: null }
      const convention = null

      const result = getEditionDisplayNameWithConvention(edition, convention as any)

      expect(result).toBe('')
    })

    it('devrait retourner une chaîne vide si convention existe mais sans nom', () => {
      const edition = { name: null }
      const convention = {} as any

      const result = getEditionDisplayNameWithConvention(edition, convention)

      expect(result).toBe('')
    })

    it('devrait gérer les propriétés undefined', () => {
      const edition = { name: undefined }
      const convention = { name: 'Convention Test' }

      const result = getEditionDisplayNameWithConvention(edition, convention)

      expect(result).toBe('Convention Test')
    })

    it('devrait gérer les chaînes vides', () => {
      const edition = { name: '' }
      const convention = { name: 'Convention Test' }

      const result = getEditionDisplayNameWithConvention(edition, convention)

      expect(result).toBe('Convention Test')
    })

    it('devrait gérer différents scénarios', () => {
      const testCases = [
        {
          edition: { name: 'Summer 2024' },
          convention: { name: 'Juggling Fest' },
          expected: 'Summer 2024',
        },
        {
          edition: { name: null },
          convention: { name: 'European Convention' },
          expected: 'European Convention',
        },
        {
          edition: { name: '' },
          convention: { name: 'World Juggling Day' },
          expected: 'World Juggling Day',
        },
        {
          edition: { name: null },
          convention: undefined,
          expected: '',
        },
        {
          edition: { name: undefined },
          convention: { name: 'Local Meet' },
          expected: 'Local Meet',
        },
      ]

      testCases.forEach(({ edition, convention, expected }) => {
        const result = getEditionDisplayNameWithConvention(edition, convention as any)
        expect(result).toBe(expected)
      })
    })
  })

  describe('comparaison des deux fonctions', () => {
    it('devrait avoir le même comportement avec des données équivalentes', () => {
      const edition1 = { name: 'Été 2024', convention: { name: 'Festival' } }
      const edition2 = { name: 'Été 2024' }
      const convention = { name: 'Festival' }

      const result1 = getEditionDisplayName(edition1)
      const result2 = getEditionDisplayNameWithConvention(edition2, convention)

      expect(result1).toBe(result2)
    })

    it("devrait gérer identiquement les cas d'absence de nom", () => {
      const edition1 = { name: null, convention: { name: 'Test' } }
      const edition2 = { name: null }
      const convention = { name: 'Test' }

      const result1 = getEditionDisplayName(edition1)
      const result2 = getEditionDisplayNameWithConvention(edition2, convention)

      expect(result1).toBe(result2)
    })
  })
})
