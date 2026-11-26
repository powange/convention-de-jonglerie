import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/*
 * ⚠️ Lu COMME DU TEXTE puis transpilé, et non importé : un fichier TypeScript d'app2 ne se
 * transforme qu'avec le tsconfig que Nuxt génère dans `apps/app2/.nuxt`, absent de la CI d'app1.
 */
const { outputText } = ts.transpileModule(
  readFileSync(resolve(__dirname, '../../../../app2/shared/rappel-fin-abonnement.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
)
const r: Record<string, any> = {}
new Function('exports', outputText)(r)

const maintenant = new Date('2026-12-01T09:00:00Z')
const dansJours = (n: number) => new Date(maintenant.getTime() + n * 24 * 60 * 60 * 1000)
const base = {
  nom: 'Camille',
  formule: 'Festival annuel',
  fin: new Date('2026-12-12T10:00:00Z'),
  code: null,
  advantageEndsAt: null,
  lienTarifs: 'https://flowvent.org/pricing',
}

/**
 * Le rappel avant la fin d'un abonnement Flowvent (`apps/app2/shared/rappel-fin-abonnement.ts`) :
 * quand il part (une fois par période, dans les 15 jours), et ce qu'il dit du code promo.
 */
describe('Flowvent — rappel de fin d’abonnement', () => {
  it('part dans les 15 jours qui précèdent la fin, une seule fois par période', () => {
    const actif = { status: 'active', currentPeriodEnd: dansJours(10), endReminderFor: null }
    expect(r.doitRappeler(actif, maintenant)).toBe(true)
    expect(r.doitRappeler({ ...actif, currentPeriodEnd: dansJours(20) }, maintenant)).toBe(false)
    expect(r.doitRappeler({ ...actif, currentPeriodEnd: dansJours(-1) }, maintenant)).toBe(false)
    expect(r.doitRappeler({ ...actif, status: 'inactive' }, maintenant)).toBe(false)
    expect(r.doitRappeler({ ...actif, endReminderFor: actif.currentPeriodEnd }, maintenant)).toBe(
      false
    )
    // Une nouvelle période (renouvellement) appelle un nouveau rappel.
    expect(r.doitRappeler({ ...actif, endReminderFor: dansJours(-355) }, maintenant)).toBe(true)
  })

  it('annonce la date de fin et le retour à la formule gratuite, sans rien supprimer', () => {
    const { subject, text, html } = r.contenuRappel(base)
    expect(subject).toBe('Votre abonnement Flowvent se termine le 12 décembre 2026')
    expect(text).toContain('Bonjour Camille,')
    expect(text).toContain('Votre formule Festival annuel prend fin le 12 décembre 2026.')
    expect(text).toContain('formule gratuite Découverte')
    expect(text).toContain('lecture seule')
    expect(text).toContain('https://flowvent.org/pricing')
    expect(html).toContain('href="https://flowvent.org/pricing"')
  })

  it('parle de la période offerte pour une gratuité', () => {
    const { subject, text } = r.contenuRappel({
      ...base,
      code: { code: 'PARTENAIRE-2027', advantage: 'free', duration: 'months' },
    })
    expect(subject).toMatch(/période offerte/)
    expect(text).toContain('offerte par le code PARTENAIRE-2027')
  })

  it('dit ce que devient la remise du code', () => {
    const remise = { code: 'VIE30', advantage: 'percent', duration: 'forever' }
    expect(r.contenuRappel({ ...base, code: remise }).text).toContain('reste acquis')
    expect(
      r.contenuRappel({
        ...base,
        code: { ...remise, code: 'ASSO50', duration: 'months' },
        advantageEndsAt: new Date('2027-03-01T00:00:00Z'),
      }).text
    ).toContain('court jusqu’au'.replace('’', "'"))
    expect(
      r.contenuRappel({
        ...base,
        code: { ...remise, code: 'ASSO50', duration: 'once' },
        advantageEndsAt: base.fin,
      }).text
    ).toContain('prend fin avec cette période')
  })

  it('échappe le nom dans le HTML', () => {
    const { html } = r.contenuRappel({ ...base, nom: '<b>Léa</b>' })
    expect(html).toContain('&lt;b&gt;Léa&lt;/b&gt;')
    expect(html).not.toContain('<b>Léa')
  })
})
