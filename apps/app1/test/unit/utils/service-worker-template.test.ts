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

/** Le fichier porte deux gabarits : le corps du worker, et le bloc de cache qu'il inclut. */
const ANCHORS = [
  { nom: 'corps du worker', debut: 'const swContent = `' },
  { nom: 'bloc de cache', debut: '  return `' },
]

function literalAfter(source: string, anchor: string): string {
  const start = source.indexOf(anchor)
  expect(start, `gabarit introuvable : ${anchor}`).toBeGreaterThan(-1)
  const body = source.slice(start + anchor.length)
  // La fin est l'accent grave en début de ligne : le corps du worker le fait suivre d'un saut,
  // le bloc de cache d'une accolade fermante.
  const end = body.indexOf('\n`')
  expect(end, `fin de gabarit introuvable : ${anchor}`).toBeGreaterThan(-1)
  return body.slice(0, end)
}

describe('gabarits du service worker', () => {
  const source = fs.readFileSync(SOURCE, 'utf8')

  it.each(ANCHORS)('$nom : aucun accent grave égaré', ({ debut }) => {
    const stray = literalAfter(source, debut)
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
  it.each(ANCHORS)('$nom : produit du JavaScript analysable', ({ debut }) => {
    // Les interpolations sont remplacées par une valeur neutre : on vérifie la structure du
    // gabarit, pas les valeurs injectées à l'exécution.
    const neutral = literalAfter(source, debut).replace(/\$\{[^}]*\}/g, 'null')
    expect(() => new Function(neutral)).not.toThrow()
  })
})
