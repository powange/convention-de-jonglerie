import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

/**
 * Aucun courriel ne salue quelqu'un avec un prénom brut.
 *
 * ## Pourquoi cette garde existe
 *
 * `User.prenom` est `String?` — **31 comptes sur 454 n'en ont pas**, mesuré le 18/10/2026. Six
 * gabarits de courriel déclarent pourtant `prenom: string` et rendent `Bonjour {{ prenom }},`.
 * Le défaut sortait **différemment selon le corps du message**, ce qui explique qu'il ait survécu :
 *
 * | corps | ce que l'absence produit |
 * | --- | --- |
 * | HTML (interpolation Vue) | `Bonjour ,` — Vue rend `null` comme une chaîne vide |
 * | texte (gabarit littéral) | `Bonjour null,` — un littéral écrit le mot « null » |
 *
 * Trois points d'API étaient atteints : la réinitialisation de mot de passe (les deux corps), la
 * suppression de compte, et le renvoi de code — ce dernier **calculait** le repli puis ne
 * l'employait pas dans sa version texte, une ligne plus bas.
 *
 * 📍 Et le typage ne protégeait pas : `admin/users/[id].delete.ts` écrivait `prenom || ''`, ce qui
 * **fait taire l'erreur en produisant le défaut**. Un seul des huit sites portait une erreur
 * `TS2345` ; les sept autres étaient invisibles au compilateur. C'est un balayage textuel qui les
 * a trouvés, pas le typage — d'où cette garde plutôt qu'une confiance dans la porte de typage.
 *
 * ## Ce qu'elle attrape, et ce qu'elle ne prétend pas couvrir
 *
 * Elle attrape **la forme du défaut** : une salutation interpolant directement un champ `prenom`,
 * et le passage d'un `prenom` brut (ou de `prenom || ''`) à un générateur de courriel. Le remède
 * est `nomDeSalutation()`, qui est la seule définition du repli dans le dépôt.
 *
 * Elle ne dit rien de la composition d'un **nom complet** pour un affichage ou un tri
 * (`${prenom} ${nom}`), qui est un autre sujet : là, une chaîne vide est le bon comportement et
 * le repli sur `pseudo` se fait après `.trim()`. Une vingtaine d'occurrences de ce motif existent
 * et sont correctes — les confondre avec celui-ci rendrait la garde inexploitable.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const MONOREPO = join(RACINE, '..', '..')

const ARBRES = [
  join(RACINE, 'server'),
  ...readdirSync(join(MONOREPO, 'layers'))
    .map((layer) => join(MONOREPO, 'layers', layer, 'server'))
    .filter((chemin) => {
      try {
        return statSync(chemin).isDirectory()
      } catch {
        return false
      }
    }),
]

const BANNIS: { motif: RegExp; quoi: string }[] = [
  {
    // `Bonjour ${user.prenom}` — mais pas `Bonjour ${prenom}`, où la variable locale vient de l'util.
    motif: /Bonjour \$\{[A-Za-z_$][\w.$?]*\.prenom[\w.$?]*\}/,
    quoi: 'une salutation interpolant directement un champ `prenom`',
  },
  {
    // `generateXEmailHtml(…, user.prenom …)` et `…, prenom || '' …`
    motif: /EmailHtml\([^)]*?(?:\.prenom\b(?!\s*[?|]{1,2}\s*[A-Za-z_$])|prenom\s*\|\|\s*'')/s,
    quoi: 'un `prenom` brut passé à un générateur de courriel',
  },
]

const listerTs = (dossier: string): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) return listerTs(chemin)
    return entree.name.endsWith('.ts') ? [chemin] : []
  })

const SOURCES = ARBRES.flatMap(listerTs)

describe('Salutation des courriels', () => {
  it('le témoin : la garde balaie bien un vrai corpus', () => {
    /*
     * Sans ce cas, les suivants passeraient sur une liste VIDE — un chemin trop court d'un niveau
     * suffit, et c'est déjà arrivé deux fois dans ce dépôt.
     */
    expect(
      SOURCES.length,
      `aucun .ts serveur balayé — chemins cherchés : ${ARBRES.join(', ')}`
    ).toBeGreaterThan(300)
  })

  it.each(BANNIS)('aucun fichier ne porte $quoi', ({ motif, quoi }) => {
    const coupables: string[] = []

    for (const chemin of SOURCES) {
      const contenu = readFileSync(chemin, 'utf8')
      // L'util lui-même et ses commentaires citent forcément le motif.
      if (chemin.endsWith('nom-de-salutation.ts')) continue
      const sansCommentaires = contenu.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      /*
       * ⚠️ On repère les occurrences par leur POSITION dans le fichier entier, pas ligne par
       * ligne. Une première version testait le fichier puis bouclait sur ses lignes : un appel
       * étalé sur plusieurs lignes — exactement la forme de `generateAccountDeletionEmailHtml(\n
       * deletedUser.prenom || '',\n …)` — correspondait au fichier mais à AUCUNE ligne. La liste
       * restait vide et le test passait. C'est le sabotage qui l'a montré, pas la relecture.
       */
      const global = new RegExp(motif.source, `${motif.flags.replace('g', '')}g`)
      for (const trouve of sansCommentaires.matchAll(global)) {
        const ligne = sansCommentaires.slice(0, trouve.index).split('\n').length
        coupables.push(`${relative(MONOREPO, chemin)}:${ligne}`)
      }
    }

    expect(
      coupables,
      `${quoi} — 31 comptes sur 454 n'ont pas de prénom, la salutation serait « Bonjour , » ou « Bonjour null, ».\nEmployer \`nomDeSalutation()\`, qui se replie sur le pseudo.\nOccurrences :\n${coupables.join('\n')}`
    ).toEqual([])
  })
})
