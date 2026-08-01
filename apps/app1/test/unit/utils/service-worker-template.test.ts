import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Le service worker est produit par un littéral de gabarit dans une route Nitro.
 *
 * Un accent grave écrit dans un commentaire — pour citer un identifiant, réflexe naturel — y
 * referme le gabarit : le reste du fichier devient du code, et la route renvoie une 500. Le
 * worker cesse alors d'être servi, donc les notifications push **et** le cache hors ligne
 * s'arrêtent, sans que rien ne l'annonce ailleurs que dans les logs.
 *
 * C'est arrivé deux fois en écrivant ce cache, chaque fois pour la même raison. D'où ce test.
 */

const SOURCE = path.resolve(__dirname, '../../../server/routes/firebase-messaging-sw.js.ts')

describe('gabarit du service worker', () => {
  const source = fs.readFileSync(SOURCE, 'utf8')

  it('ne contient aucun accent grave égaré dans le corps du worker', () => {
    const start = source.indexOf('const swContent = `')
    expect(start, 'le littéral du worker est introuvable').toBeGreaterThan(-1)

    const body = source.slice(start + 'const swContent = `'.length)
    const end = body.indexOf('\n`\n')
    expect(end, 'la fin du littéral est introuvable').toBeGreaterThan(-1)

    const inside = body.slice(0, end)
    const stray = inside
      .split('\n')
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes('`'))

    expect(
      stray.map(({ line, index }) => `ligne ${index + 1} : ${line.trim()}`),
      'un accent grave referme le gabarit — écrire le nom sans le citer'
    ).toEqual([])
  })

  // Le worker est servi tel quel au navigateur : une erreur de syntaxe ne se verrait qu'à
  // l'exécution, et seulement chez les visiteurs.
  it('produit du JavaScript analysable', () => {
    const start = source.indexOf('const swContent = `')
    const body = source.slice(start + 'const swContent = `'.length)
    const inside = body.slice(0, body.indexOf('\n`\n'))

    // Les interpolations sont remplacées par une valeur neutre : on vérifie la structure du
    // gabarit, pas les valeurs injectées à l'exécution.
    const neutral = inside.replace(/\$\{[^}]*\}/g, 'null')
    expect(() => new Function(neutral)).not.toThrow()
  })
})
