import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/*
 * ⚠️ Lu COMME DU TEXTE puis transpilé, et non importé : un fichier TypeScript d'app2 ne se
 * transforme qu'avec le tsconfig que Nuxt génère dans `apps/app2/.nuxt`, absent de la CI d'app1.
 */
const APP2 = resolve(__dirname, '../../../../app2')
const lire = (chemin: string) => readFileSync(resolve(APP2, chemin), 'utf8')
const { outputText } = ts.transpileModule(lire('shared/gabarit-courriel.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const g: Record<string, any> = {}
new Function('exports', outputText)(g)

const base = {
  siteUrl: 'https://flowvent.org/',
  titre: 'Vérifiez votre adresse e-mail',
  salutation: 'Bonjour Camille',
  paragraphes: ['Pour activer votre compte, saisissez ce code :'],
}

/**
 * Le gabarit des courriels de Flowvent (`apps/app2/shared/gabarit-courriel.ts`) : un habillage
 * unique pour tous les envois, compatible avec les messageries (tableaux, styles en ligne).
 */
describe('Flowvent — gabarit des courriels', () => {
  it('porte la marque, le titre, la salutation et le pied de page', () => {
    const html = g.gabaritCourriel(base)
    expect(html).toContain('Flow<span style="color:#FF6A00;">vent</span>')
    expect(html).toContain('https://flowvent.org/favicons/favicon-96x96.png')
    expect(html).toContain('Vérifiez votre adresse e-mail</h1>')
    expect(html).toContain('Bonjour Camille,')
    expect(html).toContain("L'équipe Flowvent")
    expect(html).toContain('>flowvent.org</a>')
  })

  it('garde la classe « code », que lit le journal de simulation', () => {
    // layers/core/server/socle/envoi-courriel.ts relève le code par /class="code">(\d{6})</.
    const html = g.gabaritCourriel({ ...base, code: '482915' })
    expect(html).toMatch(/class="code"[^>]*>482915</)
  })

  it('double le bouton du lien en clair', () => {
    const url = 'https://flowvent.org/auth/reset-password?token=abc'
    const html = g.gabaritCourriel({ ...base, bouton: { libelle: 'Choisir', url } })
    expect(html.match(new RegExp(`href="${url.replace(/[?]/g, '\\?')}"`, 'g'))).toHaveLength(2)
  })

  it('échappe tout ce qui vient de l’appelant', () => {
    const html = g.gabaritCourriel({
      ...base,
      salutation: 'Bonjour <script>x</script>',
      liste: ['<b>Bar</b>'],
      bouton: { libelle: 'Voir', url: 'https://flowvent.org/?a="><img>' },
    })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;b&gt;Bar&lt;/b&gt;')
    expect(html).not.toContain('"><img>')
  })

  it('pose les espaces insécables de la typographie française', () => {
    expect(g.typographie('« Festival » : oui ! non ?')).toBe('« Festival » : oui ! non ?')
  })

  it('habille tous les envois de Flowvent', () => {
    // Un courriel resté en HTML nu passerait inaperçu : chaque envoi doit appeler le gabarit.
    for (const fichier of [
      'server/utils/emailService.ts',
      'server/utils/invitation.ts',
      'server/utils/quotas.ts',
      'server/tasks/subscription-end-reminders.ts',
    ]) {
      expect(lire(fichier), fichier).toMatch(/gabaritCourriel\(/)
    }
  })
})
