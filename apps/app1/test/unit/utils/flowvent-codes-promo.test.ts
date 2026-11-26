import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/*
 * ⚠️ Lu COMME DU TEXTE puis transpilé, et non importé : un fichier TypeScript d'app2 ne se
 * transforme qu'avec le tsconfig que Nuxt génère dans `apps/app2/.nuxt`, absent de la CI d'app1.
 * Même raison que flowvent-formules.test.ts.
 */
const { outputText } = ts.transpileModule(
  readFileSync(resolve(__dirname, '../../../../app2/shared/codes-promo.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
)
const c: Record<string, any> = {}
new Function('exports', outputText)(c)

const base = {
  code: 'ASSO-JONGLE',
  advantage: 'percent',
  value: 50,
  formules: null,
  periods: null,
  duration: 'once',
  durationMonths: null,
  startsAt: null,
  expiresAt: null,
  maxRedemptions: null,
  reservedEmail: null,
  active: true,
}
const contexte = {
  formule: 'duo',
  periode: 'annual',
  maintenant: new Date('2026-12-01T12:00:00Z'),
  email: 'orga@festival.fr',
  utilisations: 0,
  dejaUtiliseParLeCompte: false,
}

/**
 * Les codes promo de Flowvent (`apps/app2/shared/codes-promo.ts`) : quand un code s'applique, ce
 * qu'il retire, combien de temps dure l'avantage, et jusqu'où va la période qu'il ouvre.
 */
describe('Flowvent — codes promo', () => {
  it('normalise la saisie', () => {
    expect(c.normaliserCode('  asso-jongle ')).toBe('ASSO-JONGLE')
    expect(c.normaliserCode('fête 2027!')).toBe('FTE2027')
    expect(c.normaliserCode(undefined)).toBe('')
  })

  it('s’applique quand tout concorde', () => {
    expect(c.raisonRefus(base, contexte)).toBeNull()
  })

  it('refuse un code désactivé, pas encore ouvert, expiré, épuisé ou déjà utilisé', () => {
    expect(c.raisonRefus({ ...base, active: false }, contexte)).toMatch(/introuvable/)
    expect(c.raisonRefus({ ...base, startsAt: '2027-01-01' }, contexte)).toMatch(/introuvable/)
    expect(c.raisonRefus({ ...base, expiresAt: '2026-11-30' }, contexte)).toMatch(/expiré/)
    expect(c.raisonRefus({ ...base, maxRedemptions: 3 }, { ...contexte, utilisations: 3 })).toMatch(
      /maximal/
    )
    expect(c.raisonRefus(base, { ...contexte, dejaUtiliseParLeCompte: true })).toMatch(/déjà/)
  })

  it('un code réservé ne s’annonce pas à une autre adresse', () => {
    const reserve = { ...base, reservedEmail: 'Orga@Festival.fr' }
    expect(c.raisonRefus(reserve, contexte)).toBeNull()
    expect(c.raisonRefus(reserve, { ...contexte, email: 'autre@exemple.fr' })).toMatch(
      /introuvable/
    )
    expect(c.raisonRefus(reserve, { ...contexte, email: null })).toMatch(/introuvable/)
  })

  it('ne vaut que pour les formules et périodes visées (liste vide : toutes)', () => {
    const cible = { ...base, formules: ['duo', 'integral'], periods: ['annual'] }
    expect(c.couvre(cible, 'duo', 'annual')).toBe(true)
    expect(c.couvre(cible, 'solo', 'annual')).toBe(false)
    expect(c.couvre(cible, 'duo', 'monthly')).toBe(false)
    expect(c.couvre({ ...base, formules: [], periods: [] }, 'solo', 'monthly')).toBe(true)
    expect(c.raisonRefus(cible, { ...contexte, formule: 'solo' })).toMatch(/formule/)
  })

  it('calcule le prix remisé, jamais négatif', () => {
    expect(c.prixRemise(14400, base)).toBe(7200)
    expect(c.prixRemise(900, { ...base, value: 30 })).toBe(630)
    expect(c.prixRemise(8400, { ...base, advantage: 'amount', value: 2000 })).toBe(6400)
    expect(c.prixRemise(900, { ...base, advantage: 'amount', value: 2000 })).toBe(0)
    expect(c.prixRemise(24000, { ...base, advantage: 'free' })).toBe(0)
  })

  it('fait durer l’avantage le premier paiement, N mois, ou à vie', () => {
    const debut = new Date('2026-12-01T12:00:00Z')
    const finMois = new Date('2027-01-01T12:00:00Z')
    expect(c.finAvantage(base, debut, finMois)).toEqual(finMois)
    expect(
      c
        .finAvantage({ ...base, duration: 'months', durationMonths: 3 }, debut, finMois)
        .toISOString()
    ).toBe('2027-03-01T12:00:00.000Z')
    // Un mois de remise sur l'annuel couvre l'année payée d'avance (comme chez Stripe).
    const finAn = new Date('2027-12-01T12:00:00Z')
    expect(c.finAvantage({ ...base, duration: 'months', durationMonths: 1 }, debut, finAn)).toEqual(
      finAn
    )
    expect(c.finAvantage({ ...base, duration: 'forever' }, debut, finMois)).toBeNull()
  })

  it('une gratuité de N mois ouvre exactement N mois, sans paiement entre-temps', () => {
    const debut = new Date('2026-12-01T12:00:00Z')
    const finMois = new Date('2027-01-01T12:00:00Z')
    const gratuit = { ...base, advantage: 'free', duration: 'months', durationMonths: 12 }
    expect(c.finPeriodeAvecCode(gratuit, debut, finMois).toISOString()).toBe(
      '2027-12-01T12:00:00.000Z'
    )
    // Une remise ne change pas la période facturée.
    expect(c.finPeriodeAvecCode(base, debut, finMois)).toEqual(finMois)
    expect(c.finPeriodeAvecCode(null, debut, finMois)).toEqual(finMois)
    // À vie : un siècle.
    expect(
      c.finPeriodeAvecCode({ ...gratuit, duration: 'forever' }, debut, finMois).getFullYear()
    ).toBe(2126)
  })

  it('résume l’avantage en clair', () => {
    expect(c.resumeAvantage({ ...base, value: 30, duration: 'forever' })).toBe('−30 % à vie')
    expect(c.resumeAvantage({ ...base, advantage: 'amount', value: 2000 })).toBe(
      '−20 € le premier paiement'
    )
    expect(
      c.resumeAvantage({ ...base, advantage: 'free', duration: 'months', durationMonths: 12 })
    ).toBe('Offert pendant 12 mois')
  })
})
