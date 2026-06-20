import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'

// hasUnsavedMealChanges utilise `computed` en auto-import Nuxt → on le stub globalement.
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)

import {
  formatMealDate,
  groupMealsByDate,
  hasUnsavedMealChanges,
  formatPhases,
  formatMealType,
  formatMealDisplay,
} from '../../../app/utils/meals'
import type { Meal } from '../../../app/utils/meals'

// --- Helper de construction d'un repas réaliste ---
const meal = (over: Partial<Meal> = {}): Meal => ({
  id: over.id ?? 1,
  date: over.date ?? '2026-06-16',
  mealType: over.mealType ?? 'LUNCH',
  ...over,
})

describe('meals — helpers de gestion des repas', () => {
  describe('formatMealDate', () => {
    it('formate une date string en français complet par défaut', () => {
      const result = formatMealDate('2026-06-16')
      // mardi 16 juin 2026
      expect(result).toContain('2026')
      expect(result).toContain('juin')
      expect(result).toContain('16')
    })

    it('accepte un objet Date', () => {
      const result = formatMealDate(new Date('2026-06-16T00:00:00Z'))
      expect(result).toContain('2026')
      expect(result).toContain('juin')
    })

    it('respecte la locale fournie', () => {
      const result = formatMealDate('2026-06-16', 'en-US')
      expect(result).toContain('June')
      expect(result).toContain('2026')
    })
  })

  describe('groupMealsByDate', () => {
    it('retourne un objet vide pour une liste vide', () => {
      expect(groupMealsByDate([])).toEqual({})
    })

    it('regroupe les repas par jour (clé YYYY-MM-DD)', () => {
      const meals = [
        meal({ id: 1, date: '2026-06-16', mealType: 'BREAKFAST' }),
        meal({ id: 2, date: '2026-06-16', mealType: 'LUNCH' }),
        meal({ id: 3, date: '2026-06-17', mealType: 'DINNER' }),
      ]
      const grouped = groupMealsByDate(meals)
      expect(Object.keys(grouped)).toEqual(['2026-06-16', '2026-06-17'])
      expect(grouped['2026-06-16']).toHaveLength(2)
      expect(grouped['2026-06-17']).toHaveLength(1)
    })

    it('extrait la partie date d’une string ISO avec heure', () => {
      const meals = [meal({ id: 1, date: '2026-06-16T18:30:00Z' })]
      const grouped = groupMealsByDate(meals)
      expect(Object.keys(grouped)).toEqual(['2026-06-16'])
    })

    it('gère les dates fournies comme objets Date', () => {
      const meals = [meal({ id: 1, date: new Date('2026-06-16T12:00:00Z') })]
      const grouped = groupMealsByDate(meals)
      expect(Object.keys(grouped)).toEqual(['2026-06-16'])
    })

    it('préserve l’ordre d’insertion des repas dans chaque groupe', () => {
      const meals = [
        meal({ id: 10, date: '2026-06-16', mealType: 'DINNER' }),
        meal({ id: 11, date: '2026-06-16', mealType: 'BREAKFAST' }),
      ]
      const grouped = groupMealsByDate(meals)
      expect(grouped['2026-06-16'].map((m) => m.id)).toEqual([10, 11])
    })
  })

  describe('hasUnsavedMealChanges', () => {
    it('retourne false si les listes sont identiques', () => {
      const current = ref<Meal[]>([meal({ id: 1, accepted: true, afterShow: false })])
      const initial = ref<Meal[]>([meal({ id: 1, accepted: true, afterShow: false })])
      expect(hasUnsavedMealChanges(current, initial).value).toBe(false)
    })

    it('retourne true si les longueurs diffèrent', () => {
      const current = ref<Meal[]>([meal({ id: 1 }), meal({ id: 2 })])
      const initial = ref<Meal[]>([meal({ id: 1 })])
      expect(hasUnsavedMealChanges(current, initial).value).toBe(true)
    })

    it('détecte un changement sur la propriété accepted', () => {
      const current = ref<Meal[]>([meal({ id: 1, accepted: true })])
      const initial = ref<Meal[]>([meal({ id: 1, accepted: false })])
      expect(hasUnsavedMealChanges(current, initial).value).toBe(true)
    })

    it('détecte un changement sur afterShow quand il est défini', () => {
      const current = ref<Meal[]>([meal({ id: 1, accepted: true, afterShow: true })])
      const initial = ref<Meal[]>([meal({ id: 1, accepted: true, afterShow: false })])
      expect(hasUnsavedMealChanges(current, initial).value).toBe(true)
    })

    it('ignore afterShow quand il est undefined côté courant', () => {
      const current = ref<Meal[]>([meal({ id: 1, accepted: true })])
      const initial = ref<Meal[]>([meal({ id: 1, accepted: true, afterShow: true })])
      // afterShow undefined → non comparé, et accepted identique → pas de changement
      expect(hasUnsavedMealChanges(current, initial).value).toBe(false)
    })

    it('retourne true si un repas initial correspondant est manquant', () => {
      const current = ref<Meal[]>([meal({ id: 1 })])
      const initial = ref<Meal[]>([undefined as any])
      expect(hasUnsavedMealChanges(current, initial).value).toBe(true)
    })

    it('reste réactif au changement des refs', () => {
      const current = ref<Meal[]>([meal({ id: 1, accepted: true })])
      const initial = ref<Meal[]>([meal({ id: 1, accepted: true })])
      const dirty = hasUnsavedMealChanges(current, initial)
      expect(dirty.value).toBe(false)
      current.value = [meal({ id: 1, accepted: false })]
      expect(dirty.value).toBe(true)
    })

    it('retourne false pour deux listes vides', () => {
      const current = ref<Meal[]>([])
      const initial = ref<Meal[]>([])
      expect(hasUnsavedMealChanges(current, initial).value).toBe(false)
    })
  })

  describe('formatPhases', () => {
    it('retourne une chaîne vide pour undefined', () => {
      expect(formatPhases(undefined)).toBe('')
    })

    it('retourne une chaîne vide pour un tableau vide', () => {
      expect(formatPhases([])).toBe('')
    })

    it('traduit une phase unique', () => {
      expect(formatPhases(['SETUP'])).toBe('Montage')
      expect(formatPhases(['EVENT'])).toBe('Édition')
      expect(formatPhases(['TEARDOWN'])).toBe('Démontage')
    })

    it('joint plusieurs phases avec " + "', () => {
      expect(formatPhases(['SETUP', 'EVENT', 'TEARDOWN'])).toBe('Montage + Édition + Démontage')
    })

    it('conserve une valeur inconnue telle quelle', () => {
      expect(formatPhases(['INCONNU'])).toBe('INCONNU')
      expect(formatPhases(['SETUP', 'INCONNU'])).toBe('Montage + INCONNU')
    })
  })

  describe('formatMealType', () => {
    it('traduit chaque type de repas', () => {
      expect(formatMealType('BREAKFAST')).toBe('Petit-déjeuner')
      expect(formatMealType('LUNCH')).toBe('Déjeuner')
      expect(formatMealType('DINNER')).toBe('Dîner')
    })

    it('retourne la valeur brute pour un type inconnu', () => {
      expect(formatMealType('SNACK' as any)).toBe('SNACK')
    })
  })

  describe('formatMealDisplay', () => {
    it('combine le type de repas et une date courte', () => {
      const result = formatMealDisplay(meal({ mealType: 'LUNCH', date: '2026-06-16' }))
      expect(result).toContain('Déjeuner')
      expect(result).toContain('16')
      expect(result).toContain('-')
    })

    it('respecte la locale fournie', () => {
      const result = formatMealDisplay(meal({ mealType: 'DINNER', date: '2026-06-16' }), 'en-US')
      expect(result).toContain('Dîner')
      // mois court en anglais → "Jun"
      expect(result.toLowerCase()).toContain('jun')
    })

    it('accepte un repas avec une date de type Date', () => {
      const result = formatMealDisplay(
        meal({ mealType: 'BREAKFAST', date: new Date('2026-06-16T08:00:00Z') })
      )
      expect(result).toContain('Petit-déjeuner')
    })
  })
})
