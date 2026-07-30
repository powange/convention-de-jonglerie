import { describe, it, expect } from 'vitest'

import {
  DEFAULT_CURRENCY,
  formatCents,
  fromCents,
  isSupportedCurrency,
  sumCents,
  toCents,
} from '../../../shared/utils/money'

describe('toCents', () => {
  it('convertit une unité courante en centimes', () => {
    expect(toCents(150)).toBe(15000)
    expect(toCents(150.5)).toBe(15050)
    expect(toCents(0)).toBe(0)
  })

  // `150.55 * 100` vaut 15054.999999999998 : une troncature donnerait 150,54 €. C'est l'erreur
  // d'un centime qui ne se voit qu'en recomptant un total à la main.
  it('arrondit au lieu de tronquer les imprécisions du flottant', () => {
    expect(toCents(150.55)).toBe(15055)
    expect(toCents(1.005)).toBe(101)
    expect(toCents(0.07)).toBe(7)
    expect(toCents(1e-3)).toBe(0)
  })

  it('laisse passer l’absence de montant', () => {
    expect(toCents(null)).toBeNull()
    expect(toCents(undefined)).toBeNull()
  })

  it('refuse une valeur non finie plutôt que de produire NaN en base', () => {
    expect(toCents(Number.NaN)).toBeNull()
    expect(toCents(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('fromCents', () => {
  it('reconvertit sans perte', () => {
    expect(fromCents(15050)).toBe(150.5)
    expect(fromCents(0)).toBe(0)
    expect(fromCents(null)).toBeNull()
  })

  it('fait l’aller-retour à l’identique', () => {
    for (const amount of [0, 1, 12.34, 150.55, 99999.99]) {
      expect(fromCents(toCents(amount))).toBeCloseTo(amount, 10)
    }
  })
})

describe('sumCents', () => {
  it('additionne en ignorant les valeurs absentes', () => {
    expect(sumCents([15050, null, 2500, undefined])).toBe(17550)
    expect(sumCents([])).toBe(0)
  })

  // Le même total en flottant donnerait 0.30000000000000004.
  it('reste exact là où les flottants dérivent', () => {
    expect(sumCents([10, 20])).toBe(30)
    expect(sumCents(Array.from({ length: 10 }, () => 7))).toBe(70)
  })
})

describe('formatCents', () => {
  it('met en forme selon la devise', () => {
    // Espaces insécables selon la locale : on compare sur le contenu, pas sur l'espacement.
    expect(formatCents(15050, 'EUR', 'fr-FR').replace(/\s/g, ' ')).toBe('150,50 €')
    expect(formatCents(15050, 'CHF', 'fr-CH').replace(/\s/g, ' ')).toContain('150.50')
  })

  it('retombe sur la devise par défaut si le code est inconnu', () => {
    expect(formatCents(100, 'XXX', 'fr-FR')).toBe(formatCents(100, DEFAULT_CURRENCY, 'fr-FR'))
  })

  it('affiche zéro plutôt que rien quand le montant est absent', () => {
    expect(formatCents(null, 'EUR', 'fr-FR').replace(/\s/g, ' ')).toBe('0,00 €')
  })
})

describe('isSupportedCurrency', () => {
  it('reconnaît les devises proposées', () => {
    expect(isSupportedCurrency('EUR')).toBe(true)
    expect(isSupportedCurrency('CHF')).toBe(true)
  })

  it('refuse le reste, y compris le « 1 / 2 » interne à Infomaniak', () => {
    expect(isSupportedCurrency('2')).toBe(false)
    expect(isSupportedCurrency('eur')).toBe(false)
    expect(isSupportedCurrency('')).toBe(false)
  })
})
