import { describe, it, expect } from 'vitest'

import { summarizeRights } from '../../../app/utils/organizerRights'

const GLOBAL_KEYS = [
  'editConvention',
  'deleteConvention',
  'manageOrganizers',
  'addEdition',
  'editAllEditions',
  'deleteAllEditions',
] as const

const allRights = () =>
  GLOBAL_KEYS.reduce<Record<string, boolean>>((acc, k) => {
    acc[k] = true
    return acc
  }, {})

describe('organizerRights utils', () => {
  describe('summarizeRights — niveau viewer', () => {
    it('retourne viewer pour null', () => {
      expect(summarizeRights(null)).toEqual({
        level: 'viewer',
        labelKey: 'permissions.viewer',
        color: 'neutral',
      })
    })

    it('retourne viewer pour undefined', () => {
      expect(summarizeRights(undefined)).toEqual({
        level: 'viewer',
        labelKey: 'permissions.viewer',
        color: 'neutral',
      })
    })

    it('retourne viewer pour un objet vide', () => {
      expect(summarizeRights({})).toEqual({
        level: 'viewer',
        labelKey: 'permissions.viewer',
        color: 'neutral',
      })
    })

    it('retourne viewer quand tous les droits sont à false', () => {
      const rights = GLOBAL_KEYS.reduce<Record<string, boolean>>((acc, k) => {
        acc[k] = false
        return acc
      }, {})
      expect(summarizeRights(rights).level).toBe('viewer')
    })

    it('ignore les droits non reconnus', () => {
      expect(summarizeRights({ somethingElse: true, randomFlag: true }).level).toBe('viewer')
    })
  })

  describe('summarizeRights — niveau admin', () => {
    it('retourne admin quand tous les droits globaux sont vrais', () => {
      expect(summarizeRights(allRights())).toEqual({
        level: 'admin',
        labelKey: 'permissions.admin',
        color: 'warning',
      })
    })

    it('retourne admin même avec des droits supplémentaires inconnus présents', () => {
      expect(summarizeRights({ ...allRights(), extra: true }).level).toBe('admin')
    })

    it('ne retombe pas en admin si un seul droit manque', () => {
      for (const missing of GLOBAL_KEYS) {
        const rights = allRights()
        rights[missing] = false
        expect(summarizeRights(rights).level).not.toBe('admin')
        expect(summarizeRights(rights).level).toBe('moderator')
      }
    })
  })

  describe('summarizeRights — niveau moderator', () => {
    it('retourne moderator si au moins un droit clé est vrai', () => {
      for (const key of GLOBAL_KEYS) {
        const rights = { [key]: true }
        expect(summarizeRights(rights)).toEqual({
          level: 'moderator',
          labelKey: 'permissions.moderator',
          color: 'info',
        })
      }
    })

    it('retourne moderator pour une combinaison partielle de droits', () => {
      expect(
        summarizeRights({ editConvention: true, deleteConvention: true, addEdition: true }).level
      ).toBe('moderator')
    })
  })

  describe('summarizeRights — robustesse des valeurs', () => {
    it("ne considère qu'une valeur strictement true (pas truthy)", () => {
      // 1 est truthy mais pas === true → ne compte pas comme droit accordé
      expect(summarizeRights({ editConvention: 1 as unknown as boolean }).level).toBe('viewer')
      expect(summarizeRights({ editConvention: 'true' as unknown as boolean }).level).toBe('viewer')
    })

    it('un mélange true / non-true reste cohérent', () => {
      const rights = {
        editConvention: true,
        deleteConvention: 'oui',
        manageOrganizers: 0,
      } as unknown as Record<string, boolean>
      // Un seul droit strictement true → moderator
      expect(summarizeRights(rights).level).toBe('moderator')
    })

    it('tous les droits à true sauf un en valeur truthy non-true → moderator', () => {
      const rights = { ...allRights(), deleteAllEditions: 1 } as unknown as Record<string, boolean>
      expect(summarizeRights(rights).level).toBe('moderator')
    })
  })
})
