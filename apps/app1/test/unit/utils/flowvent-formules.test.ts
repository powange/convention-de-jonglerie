import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/*
 * ⚠️ Lu COMME DU TEXTE puis transpilé, et non importé : un fichier TypeScript d'app2 ne se
 * transforme qu'avec le tsconfig que Nuxt génère dans `apps/app2/.nuxt`, absent de la CI d'app1
 * (« Tsconfig not found »). Même raison que offline-cache-flowvent.test.ts.
 */
const APP2 = resolve(__dirname, '../../../../app2')
const lire = (chemin: string) => readFileSync(resolve(APP2, chemin), 'utf8')

const { outputText } = ts.transpileModule(lire('shared/formules.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const f: Record<string, any> = {}
new Function('exports', outputText)(f)

/**
 * Les formules d'abonnement de Flowvent (`apps/app2/shared/formules.ts`) : la grille décidée par
 * l'utilisateur (Solo, Duo, Intégral), ce que chaque formule couvre, et la validation du choix de
 * modules au paiement.
 */
describe('Flowvent — formules par module', () => {
  it('tient la grille décidée (centimes TTC)', () => {
    const prix = Object.fromEntries(f.FORMULES.map((x: any) => [x.cle, x.prix]))
    expect(prix).toEqual({
      solo: { monthly: 900, annual: 8400 },
      duo: { monthly: 1500, annual: 14400 },
      integral: { monthly: 2500, annual: 24000 },
    })
    expect(f.prixMensuel('solo', 'annual')).toBe(700)
    expect(f.prixMensuel('duo', 'annual')).toBe(1200)
    expect(f.prixMensuel('integral', 'annual')).toBe(2000)
    expect(f.prixMensuel('duo', 'monthly')).toBe(1500)
  })

  it('Intégral couvre les six modules payants, quels que soient les modules enregistrés', () => {
    expect(f.modulesCouverts('integral', null)).toEqual([
      'benevoles',
      'artistes',
      'repas',
      'billetterie',
      'tresorerie',
      'stock',
    ])
    expect(f.modulesCouverts('integral', ['stock'])).toHaveLength(6)
  })

  it('Solo et Duo couvrent les modules choisis, jamais plus que la formule', () => {
    expect(f.modulesCouverts('solo', ['stock'])).toEqual(['stock'])
    expect(f.modulesCouverts('duo', ['benevoles', 'repas'])).toEqual(['benevoles', 'repas'])
    // Une valeur en base trafiquée ne donne pas plus que la formule.
    expect(f.modulesCouverts('solo', ['stock', 'billetterie'])).toEqual(['stock'])
    expect(f.modulesCouverts('duo', ['carte', 'inconnu', 'repas'])).toEqual(['repas'])
  })

  it('une formule inconnue ou absente ne couvre rien', () => {
    expect(f.modulesCouverts('gold', ['stock'])).toEqual([])
    expect(f.modulesCouverts(null, null)).toEqual([])
  })

  it('la carte du site n’est pas un module payant', () => {
    expect(f.estModulePayant('carte')).toBe(false)
    expect(f.estModulePayant('benevoles')).toBe(true)
  })

  it('valide le choix de modules au paiement', () => {
    expect(f.erreurChoixModules('solo', ['stock'])).toBeNull()
    expect(f.erreurChoixModules('duo', ['benevoles', 'repas'])).toBeNull()
    expect(f.erreurChoixModules('integral', [])).toBeNull()
    expect(f.erreurChoixModules('solo', [])).toMatch(/1 module/)
    expect(f.erreurChoixModules('duo', ['stock'])).toMatch(/2 modules/)
    expect(f.erreurChoixModules('duo', ['stock', 'stock'])).toMatch(/deux fois/)
    expect(f.erreurChoixModules('solo', ['carte'])).toMatch(/inconnu/)
    expect(f.erreurChoixModules('platine', [])).toMatch(/inconnue/)
  })

  it('désigne la plus petite formule pour un nombre de modules', () => {
    expect([0, 1, 2, 3, 6].map(f.formulePourNombreDeModules)).toEqual([
      null,
      'solo',
      'duo',
      'integral',
      'integral',
    ])
  })

  it('calcule la fin d’une période facturée', () => {
    const debut = new Date('2026-11-27T10:00:00Z')
    expect(f.finDePeriode(debut, 'monthly').toISOString()).toBe('2026-12-27T10:00:00.000Z')
    expect(f.finDePeriode(debut, 'annual').toISOString()).toBe('2027-11-27T10:00:00.000Z')
  })

  it('écrit les prix à la française', () => {
    expect(f.euros(700)).toBe('7 €')
    expect(f.euros(1250)).toBe('12,50 €')
  })

  it('chaque module payant existe dans le catalogue des modules', () => {
    const catalogue = lire('shared/modules-evenement.ts')
    const cles = [
      ...catalogue
        .slice(catalogue.indexOf('MODULES_EVENEMENT:'), catalogue.indexOf('DROITS_PAR_DOMAINE:'))
        .matchAll(/cle: '(\w+)'/g),
    ].map((m) => m[1])
    expect(f.MODULES_PAYANTS.filter((m: string) => !cles.includes(m))).toEqual([])
    // Tout module du catalogue, hors la carte, est payant : un module ajouté sans y penser serait
    // offert à tous.
    expect(cles.filter((c) => c !== 'carte' && !f.MODULES_PAYANTS.includes(c))).toEqual([])
  })

  it('la lecture seule repose sur le contexte asynchrone de Nitro', () => {
    // Sans lui, `useEvent()` lève : toute LECTURE d'un module hors formule serait refusée.
    expect(lire('nuxt.config.ts')).toMatch(/asyncContext:\s*true/)
    expect(lire('server/utils/droits-evenement.ts')).toMatch(/useEvent\(\)\.method/)
  })
})
