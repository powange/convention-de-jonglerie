import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/*
 * ⚠️ Lu COMME DU TEXTE puis transpilé, et non importé : un fichier TypeScript d'app2 ne se
 * transforme qu'avec le tsconfig que Nuxt génère dans `apps/app2/.nuxt`, absent de la CI d'app1.
 * Même raison que flowvent-formules.test.ts.
 */
const APP2 = resolve(__dirname, '../../../../app2')
const lire = (chemin: string) => readFileSync(resolve(APP2, chemin), 'utf8')
const { outputText } = ts.transpileModule(lire('shared/alerte-quota.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const a: Record<string, any> = {}
new Function('exports', outputText)(a)

const base = {
  nom: 'Camille',
  evenement: 'Festival des Balles',
  quoi: 'bénévoles acceptés',
  usage: 60,
  plafond: 75,
  marge: 22,
  formule: 'Association',
  formuleSuivante: { libelle: 'Festival', plafond: 250 },
  palier: 'alerte',
  lienTarifs: 'https://flowvent.org/pricing',
  lienEvenement: 'https://flowvent.org/events/abc/gestion',
}

/**
 * L'alerte de plafond de Flowvent (`apps/app2/shared/alerte-quota.ts`) : un courriel au
 * propriétaire à 80 %, un autre à la limite, jamais deux fois le même (décision du 26/11/2026).
 */
describe('Flowvent — alerte de plafond', () => {
  it('franchit 80 % puis la limite', () => {
    expect(a.palierAlerte(59, 75)).toBeNull()
    expect(a.palierAlerte(60, 75)).toBe('alerte')
    expect(a.palierAlerte(75, 75)).toBe('plein')
    expect(a.palierAlerte(80, 75)).toBe('plein')
    expect(a.palierAlerte(1, 1)).toBe('plein')
    expect(a.palierAlerte(1000, null)).toBeNull()
  })

  it("n'écrit qu'en montant d'un palier", () => {
    expect(a.doitAlerter('alerte', undefined)).toBe(true)
    expect(a.doitAlerter('alerte', 'alerte')).toBe(false)
    expect(a.doitAlerter('plein', 'alerte')).toBe(true)
    expect(a.doitAlerter('plein', 'plein')).toBe(false)
    expect(a.doitAlerter('alerte', 'plein')).toBe(false)
    expect(a.doitAlerter(null, undefined)).toBe(false)
  })

  it('annonce l’approche, la formule suivante, et que rien n’est bloqué', () => {
    const { subject, text, html } = a.contenuAlerte(base)
    expect(subject).toBe(
      'Festival des Balles : la limite de bénévoles acceptés de votre formule approche'
    )
    expect(text).toContain(
      'Festival des Balles compte 60 bénévoles acceptés sur les 75 de votre formule Association.'
    )
    expect(text).toContain('La formule Festival en comprend 250.')
    expect(text).toContain("Rien de ce qui existe n'est retiré ni bloqué.")
    expect(html).toContain('href="https://flowvent.org/pricing"')
  })

  it('à la limite, dit ce que la marge laisse encore', () => {
    const { subject, text } = a.contenuAlerte({ ...base, usage: 75, marge: 7, palier: 'plein' })
    expect(subject).toContain('est atteinte')
    expect(text).toContain("Une marge vous permet d'en ajouter encore 7.")
    const sansMarge = a.contenuAlerte({ ...base, usage: 3, plafond: 3, marge: 0, palier: 'plein' })
    expect(sansMarge.text).toContain('il faudra une formule plus grande')
    expect(sansMarge.text).not.toContain('marge')
  })

  it('échappe le nom de l’événement dans le HTML', () => {
    const { html } = a.contenuAlerte({ ...base, evenement: '<b>Fête</b>' })
    expect(html).toContain('&lt;b&gt;Fête&lt;/b&gt;')
    expect(html).not.toContain('<b>Fête</b>')
  })

  it("l'alerte est branchée sur la garde d'ajout", () => {
    const quotas = lire('server/utils/quotas.ts')
    expect(quotas).toMatch(/signalerSeuil\(eventId, compteur, usage \+ nombre, couverture\)/)
    expect(quotas).toMatch(/alertesQuota/)
  })
})
