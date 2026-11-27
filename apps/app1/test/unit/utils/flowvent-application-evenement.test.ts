import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/*
 * ⚠️ Lu COMME DU TEXTE puis transpilé, et non importé : un fichier TypeScript d'app2 ne se
 * transforme qu'avec le tsconfig que Nuxt génère dans `apps/app2/.nuxt`, absent de la CI d'app1.
 */
const APP2 = resolve(__dirname, '../../../../app2')
const { outputText } = ts.transpileModule(
  readFileSync(resolve(APP2, 'app/utils/application-evenement.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
)
const g: Record<string, any> = {}
new Function('exports', outputText)(g)

/**
 * L'application d'un événement : les pages qui déclarent son manifeste à la place de celui de
 * Flowvent (`evenementDuChemin`, apps/app2/app/utils/application-evenement.ts).
 */
describe('Flowvent — pages de l’application d’un événement', () => {
  it.each([
    ['/events/Az-CoZ7B6H', 'Az-CoZ7B6H'],
    ['/events/Az-CoZ7B6H/', 'Az-CoZ7B6H'],
    ['/events/Az-CoZ7B6H/gestion/evenement', 'Az-CoZ7B6H'],
    ['/events/Az-CoZ7B6H/volunteers?tab=planning', 'Az-CoZ7B6H'],
    ['/events/Az-CoZ7B6H/app', 'Az-CoZ7B6H'],
  ])('%s appartient à l’événement %s', (chemin, attendu) => {
    expect(g.evenementDuChemin(chemin)).toBe(attendu)
  })

  it.each(['/', '/dashboard', '/pricing', '/events/new', '/events', '/eventsXYZ/abc', '/login'])(
    '%s reste dans Flowvent',
    (chemin) => {
      expect(g.evenementDuChemin(chemin)).toBeNull()
    }
  )
})
