import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Tout appel à `NotificationService.create` doit fournir un titre et un message que le service
 * sait lire : `titleKey` / `messageKey` (traduits) OU `titleText` / `messageText` (texte libre).
 *
 * ## Le défaut que ce garde-fou ferme
 *
 * Deux appels du layer bénévoles passaient `title` et `message` — des clés que le service ne
 * connaît pas. `create` lève alors « Au moins un système doit être utilisé » AVANT toute écriture,
 * et l'appelant l'avale dans un `try/catch` qui journalise :
 *
 * - « Notifier les plannings » : la notification levait avant l'envoi du courriel — les bénévoles
 *   ne recevaient NI l'une NI l'autre ;
 * - le rappel 30 minutes avant un créneau : jamais créé, alors que le créneau était marqué rappelé.
 *
 * Aucun test ne le voyait : les tests de ces handlers bouchonnent `NotificationService.create`, et
 * le bouchon accepte n'importe quel objet. D'où une vérification sur le SOURCE, qui couvre tous les
 * appelants présents et à venir.
 */
const RACINE = join(process.cwd(), '..', '..')
const RACINES = ['apps/app1/server', 'apps/app2/server', 'layers']

async function* fichiers(dossier: string): AsyncGenerator<string> {
  let entrees
  try {
    entrees = await readdir(dossier, { withFileTypes: true })
  } catch {
    return
  }
  for (const entree of entrees) {
    if (entree.name === 'node_modules' || entree.name === 'generated') continue
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) yield* fichiers(chemin)
    else if (/\.(ts|vue)$/.test(entree.name)) yield chemin
  }
}

/** L'objet littéral passé à `NotificationService.create(`, accolades équilibrées. */
function argumentsDesAppels(source: string): string[] {
  const appels: string[] = []
  const motif = /NotificationService\.create\(\s*\{/g
  let m: RegExpExecArray | null
  while ((m = motif.exec(source))) {
    let profondeur = 0
    const debut = m.index + m[0].length - 1
    for (let i = debut; i < source.length; i++) {
      if (source[i] === '{') profondeur++
      else if (source[i] === '}' && --profondeur === 0) {
        appels.push(source.slice(debut, i + 1))
        break
      }
    }
  }
  return appels
}

/** Les clés de PREMIER niveau de l'objet (pas celles des objets imbriqués). */
function clesDePremierNiveau(objet: string): string[] {
  const cles: string[] = []
  let profondeur = 0
  const sansCommentaires = objet.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  for (const ligne of sansCommentaires.split('\n')) {
    if (profondeur === 1) {
      const cle = ligne.match(/^\s*([A-Za-z]+)\s*[:,]/)
      if (cle) cles.push(cle[1]!)
    }
    for (const c of ligne) {
      if (c === '{' || c === '[' || c === '(') profondeur++
      else if (c === '}' || c === ']' || c === ')') profondeur--
    }
  }
  return cles
}

describe('NotificationService.create — titre et message lisibles', () => {
  it('chaque appel fournit titleKey/messageKey OU titleText/messageText, jamais title/message', async () => {
    const fautifs: string[] = []
    let total = 0
    for (const racine of RACINES) {
      for await (const chemin of fichiers(join(RACINE, racine))) {
        const source = await readFile(chemin, 'utf8')
        for (const appel of argumentsDesAppels(source)) {
          total++
          const cles = clesDePremierNiveau(appel)
          const lisible = cles.some((c) =>
            ['titleKey', 'messageKey', 'titleText', 'messageText'].includes(c)
          )
          const nu = cles.includes('title') || cles.includes('message')
          // Un spread (`...donnees`) peut apporter les champs : on ne juge que ce qu'on voit.
          const etale = /\.\.\.\w/.test(appel)
          if ((!lisible && !etale) || nu) fautifs.push(chemin.slice(RACINE.length + 1))
        }
      }
    }
    // Le garde-fou n'a de sens que s'il trouve des appels : un motif cassé le rendrait vert à vide.
    expect(total).toBeGreaterThan(10)
    expect(fautifs).toEqual([])
  })
})
