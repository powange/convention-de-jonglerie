import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Le chemin HelloAsso ne journalise plus avec `console.log` — constat O3.
 *
 * ## Le défaut
 *
 * Trois fichiers portaient **quarante** appels à `console.*`, dont **deux déversements complets
 * indentés** — `JSON.stringify(result, null, 2)` — qui produisaient des centaines de lignes
 * physiques pour un seul appel. Et les journaux de l'import écrivaient **une ligne par billet**,
 * succès compris, en redéversant la liste complète des tarifs à chaque ligne non rapprochée.
 *
 * 📊 Mesuré : ~117 appels pour l'édition 1, ~230 pour la 9. Et ce bruit a eu un **coût réel** —
 * il a fait croire le constat D4 quatre fois plus grave qu'il ne l'est, les « Aucun tarif trouvé »
 * ayant été pris pour des billets orphelins alors qu'ils désignaient des dons.
 *
 * ## Ce que cette garde empêche
 *
 * Le retour d'un `console.log` dans ce chemin. `createLogger` existait déjà et n'y était pas
 * employé : avec lui, `LOG_LEVEL=info` (le défaut en production) fait disparaître tout ce qui est
 * en `debug` — 266 lignes de journal en `debug` contre **1** en `info`, mesuré sur le pire cas.
 *
 * ⚠️ `console.error` est accepté nulle part ici, et c'est délibéré : les quatre échecs passent par
 * `journal.error`, qui les horodate et les préfixe comme le reste.
 */
const RACINE = path.resolve(__dirname, '../../../../..')

const FICHIERS = [
  'apps/app1/server/utils/editions/ticketing/helloasso.ts',
  'layers/ticketing/server/api/editions/[id]/ticketing/helloasso/import.post.ts',
  'layers/ticketing/server/api/editions/[id]/ticketing/helloasso/tiers.post.ts',
]

/**
 * Le code d'un fichier, **commentaires retirés**.
 *
 * ⚠️⚠️ CETTE FONCTION EXISTE PARCE QUE LE PIÈGE A MORDU EN ÉCRIVANT CE FICHIER. Les trois
 * fichiers surveillés EXPLIQUENT en commentaire pourquoi ils n'emploient plus `console.log` et ce
 * qu'était le déversement indenté — en citant `console.log` et `JSON.stringify(…, null, 2)`. Les
 * compter ferait de ces explications des infractions, et la garde accuserait précisément les
 * fichiers qui ont fait le travail.
 *
 * 📍 J'avais appliqué ce retrait au comptage des `console.*` et PAS au cas du JSON indenté : ce
 * dernier est tombé sur mes deux propres commentaires. Les deux cas passent donc par la même
 * fonction, pour qu'ils ne puissent plus diverger. Sixième occurrence de ce motif dans ce dépôt.
 */
function codeSansCommentaires(relatif: string): string {
  return fs
    .readFileSync(path.resolve(RACINE, relatif), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

/** Les appels à `console.*` d'un fichier, commentaires exclus. */
function appelsConsole(relatif: string): string[] {
  return [...codeSansCommentaires(relatif).matchAll(/console\.(log|warn|error|info|debug)\(/g)].map(
    (m) => m[0]
  )
}

describe('journaux du chemin HelloAsso', () => {
  it.each(FICHIERS)('%s n’emploie plus console.*', (relatif) => {
    expect(
      appelsConsole(relatif),
      'passer par `createLogger` : `LOG_LEVEL=info` en production fait disparaître le `debug`, ' +
        'ce qu’un `console.log` ne permet pas'
    ).toEqual([])
  })

  it.each(FICHIERS)('%s passe bien par createLogger', (relatif) => {
    // Le témoin : sans lui, supprimer purement et simplement les journaux satisferait
    // l'interdiction ci-dessus — et on perdrait le diagnostic au lieu de le rendre réglable.
    const src = fs.readFileSync(path.resolve(RACINE, relatif), 'utf8')
    expect(src).toContain('createLogger(')
    expect(src).toMatch(/journal\.(debug|info|warn|error)\(/)
  })

  it('⚠️ AUCUN DÉVERSEMENT INDENTÉ NE REVIENT', () => {
    /*
     * `JSON.stringify(x, null, 2)` était le cœur du constat : l'indentation transforme un objet
     * en centaines de LIGNES physiques. Le journal sérialise lui-même, compact.
     */
    const fautifs = FICHIERS.filter((relatif) =>
      /JSON\.stringify\([^)]*null,\s*2\)/.test(codeSansCommentaires(relatif))
    )

    expect(fautifs, 'un JSON indenté dans un journal : des centaines de lignes par appel').toEqual(
      []
    )
  })

  it('le balayage lit bien les trois fichiers — il ne conclut pas sur le vide', () => {
    // Les deux premiers cas sont des interdictions : une erreur de chemin les laisserait verts.
    for (const relatif of FICHIERS) {
      expect(
        fs.readFileSync(path.resolve(RACINE, relatif), 'utf8').length,
        `${relatif} est vide ou introuvable`
      ).toBeGreaterThan(1000)
    }
  })
})
