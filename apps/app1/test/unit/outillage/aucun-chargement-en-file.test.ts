import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Aucun écran n'enchaîne ses chargements à la file — garde à l'échelle du dépôt.
 *
 * ## Le défaut, et pourquoi il revenait
 *
 * Attendre `await chargerA()` puis `await chargerB()` quand B n'a pas besoin du résultat de A
 * fait du temps d'affichage leur **somme** au lieu de celui du plus lent. Le défaut est apparu
 * **trois fois** : sept chargeurs sur l'écran des quotas (constat F5), **onze** sur les articles
 * à remettre, puis dix emplacements répartis sur six écrans.
 *
 * Les corriger un par un ne l'empêchait pas de revenir — rien ne le signalait. D'où cette garde
 * **globale** : elle balaie tout `app/` et tous les layers, et refuse le motif partout.
 *
 * ## 📍 Pourquoi un compte à ZÉRO et non une dette qui ne grandit pas
 *
 * Une garde qui mesure une dette tombe le jour où la dette atteint zéro, et elle autorise
 * l'existant sans jamais le nommer. Les dix emplacements ayant été corrigés, le compte est à
 * zéro : la garde n'a donc **pas de liste d'exceptions**, qui est l'autre façon de se tromper en
 * silence — ce dépôt a déjà eu une garde qui exemptait deux vrais cas sans le dire.
 *
 * ## ⚠️ CE QU'ELLE N'INTERDIT PAS
 *
 * Un `await chargeur()` **seul** reste parfaitement légitime : c'est le rechargement ciblé d'une
 * liste après une action, et il y en a partout. Seule la mise en FILE de deux appels ou plus est
 * refusée.
 *
 * Et si une file devient un jour légitime — B ayant réellement besoin de A —, ce cas tombera. La
 * bonne réponse sera alors d'écrire la dépendance en clair (`const a = await chargerA()` puis
 * l'utiliser), ce que le motif ci-dessous n'attrape pas, et non d'ajouter une exception ici.
 */
const RACINE = join(import.meta.dirname, '../../../../..')
const DOSSIERS = [join(RACINE, 'apps/app1/app'), join(RACINE, 'layers')]

/** Deux appels de chargement ou plus, à la file, chacun seul sur sa ligne. */
const FILE = /(?:^[ \t]*await (?:load|fetch|charger|recharger|refresh|get)\w*\(\)[ \t]*\n){2,}/gm

function fichiers(dossier: string): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(dossier)) {
    if (entree === 'node_modules' || entree.startsWith('.')) continue
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin))
    else if (/\.(vue|ts)$/.test(entree)) trouves.push(chemin)
  }
  return trouves
}

describe('aucun écran n’enchaîne ses chargements à la file', () => {
  const balayes = DOSSIERS.flatMap(fichiers)

  it('⚠️ AUCUNE FILE DE CHARGEMENTS, NULLE PART', () => {
    const coupables: string[] = []

    for (const chemin of balayes) {
      /*
       * Les commentaires sont retirés : plusieurs fichiers EXPLIQUENT l'ancien défaut en citant
       * les `await` d'avant, et les compter ferait de l'explication une infraction. Piège déjà
       * payé huit fois dans ce dépôt.
       */
      const code = readFileSync(chemin, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/<!--[\s\S]*?-->/g, '')

      for (const file of code.match(FILE) ?? []) {
        const appels = file
          .trim()
          .split('\n')
          .map((l) => l.trim())
        coupables.push(`${chemin.slice(RACINE.length + 1)} : ${appels.join(' puis ')}`)
      }
    }

    expect(
      coupables,
      'ces chargements partent à la file ; les grouper dans un `Promise.all([…])`'
    ).toEqual([])
  })

  it('le balayage voit bien le dépôt — il ne conclut pas sur le vide', () => {
    /*
     * Le témoin, et il est indispensable : si la résolution des chemins se trompait d'un niveau,
     * le cas ci-dessus serait vert en ne lisant AUCUN fichier. Déjà arrivé sur la garde des
     * quotas, où un `../` manquant rendait deux interdictions creuses.
     */
    expect(balayes.length, 'aucun fichier balayé : chemin faux ?').toBeGreaterThan(400)

    const avecChargement = balayes.filter((c) =>
      /await (?:load|fetch|charger|recharger|refresh|get)\w*\(\)/.test(readFileSync(c, 'utf8'))
    )
    expect(
      avecChargement.length,
      'aucun appel de chargement vu : le motif ne correspond plus au code'
    ).toBeGreaterThan(30)
  })
})
