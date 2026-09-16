import { describe, expect, it } from 'vitest'

import {
  repasConnu,
  repasDepuisUrl,
  requeteRepas,
} from '../../../../../layers/meals/app/utils/repas-dans-url'

/**
 * Le repas regardé, conservé dans l'URL de l'écran de validation.
 *
 * Sans ça, un rechargement repartait sur le repas « en cours ou à venir » calculé depuis l'heure,
 * et non sur celui qu'on regardait. Pendant un service, c'est la différence entre reprendre où
 * l'on en était et devoir re-sélectionner.
 */
describe('repasDepuisUrl', () => {
  it('reprend un identifiant valide', () => {
    expect(repasDepuisUrl('42')).toBe(42)
  })

  it('ignore ce qui n’est pas un identifiant', () => {
    // Une valeur fantaisiste laisserait `selectedMeal` introuvable et l'écran vide.
    expect(repasDepuisUrl('déjeuner')).toBeNull()
    expect(repasDepuisUrl('')).toBeNull()
    expect(repasDepuisUrl(undefined)).toBeNull()
    expect(repasDepuisUrl('3.5')).toBeNull()
    expect(repasDepuisUrl('-1')).toBeNull()
    expect(repasDepuisUrl('0')).toBeNull()
  })
})

describe('repasConnu', () => {
  const repas = [{ id: 7 }, { id: 8 }]

  it('garde un repas qui existe', () => {
    expect(repasConnu(7, repas)).toBe(7)
  })

  it('ÉCARTE un repas supprimé ou d’une autre édition', () => {
    // C'est ce `null` qui rend la main à la sélection automatique. Sans lui, un lien devenu
    // caduc laissait l'écran vide sans rien expliquer.
    expect(repasConnu(99, repas)).toBeNull()
  })

  it('garde la sélection tant que les repas ne sont pas chargés', () => {
    // L'écarter ici perdrait le choix de l'URL avant même de pouvoir le valider.
    expect(repasConnu(7, [])).toBe(7)
  })

  it('ne rend rien quand rien n’est sélectionné', () => {
    expect(repasConnu(null, repas)).toBeNull()
  })
})

describe('requeteRepas', () => {
  it('écrit le repas retenu', () => {
    expect(requeteRepas({}, 7)).toEqual({ meal: '7' })
  })

  it('écrit le repas MÊME s’il vient du choix par défaut', () => {
    // Contrairement aux filtres des autres écrans : ce défaut-là dépend de l'heure qu'il est, et
    // le taire rendrait le lien ambigu une heure plus tard.
    expect(requeteRepas({}, 8).meal).toBe('8')
  })

  it('retire le paramètre quand plus rien n’est sélectionné', () => {
    expect(requeteRepas({ meal: '7' }, null)).toEqual({})
  })

  it('préserve les paramètres étrangers', () => {
    expect(requeteRepas({ tab: 'search' }, 7)).toEqual({ tab: 'search', meal: '7' })
  })

  it('fait l’aller-retour sans rien perdre', () => {
    expect(repasDepuisUrl(requeteRepas({}, 42).meal)).toBe(42)
  })
})
