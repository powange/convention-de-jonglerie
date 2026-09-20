#!/usr/bin/env node
/**
 * Répartit les fichiers de `edition-management` entre les lots de la CI, par DURÉE.
 *
 * `--shard` de Playwright équilibre le NOMBRE de tests, pas leur durée. Mesuré sur deux runs : un
 * lot mettait 293 s là où un autre en mettait 118, à nombre de tests égal, et toujours le même —
 * le découpage étant déterministe, le déséquilibre l'est aussi. Les fichiers n'ont pas le même
 * coût : de 3 s à 31 s pour les 54 du projet.
 *
 * La liste des fichiers est établie EN LISANT LE DISQUE, jamais écrite à la main. C'est le point
 * qui rend ce script préférable à des listes en dur dans le workflow : un fichier de test ajouté
 * plus tard serait absent de toutes les listes et ne s'exécuterait nulle part — sans que rien ne
 * le signale, puisque les lots resteraient verts.
 *
 * Les durées connues vivent dans `durees-edition-management.json`, relevé le 20/09/2026. Un
 * fichier absent de ce relevé reçoit la durée MÉDIANE : on ne connaît pas son coût, l'ignorer
 * reviendrait à le traiter comme gratuit et à surcharger silencieusement son lot.
 *
 * Pour rafraîchir le relevé : les rapports HTML de Playwright archivés par la CI embarquent leurs
 * données dans un zip base64, dans un `<template id="playwrightReportBase64">`.
 *
 * Usage : node scripts/lots-playwright.mjs <nombre-de-lots> <index-du-lot-à-partir-de-1>
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const DOSSIER = join(ICI, '..', 'test', 'e2e', 'playwright', 'edition-management')
const RELEVE = join(ICI, '..', 'test', 'e2e', 'playwright', 'durees-edition-management.json')

/** La médiane plutôt que la moyenne : quelques fichiers très longs tireraient la seconde. */
export function mediane(valeurs) {
  if (valeurs.length === 0) return 0
  const triees = [...valeurs].sort((a, b) => a - b)
  return triees[Math.floor(triees.length / 2)]
}

/**
 * Répartition gloutonne : le plus long d'abord, toujours dans le lot le moins chargé.
 *
 * Ce n'est pas l'optimum — le problème est NP-difficile — mais l'écart à l'optimum est négligeable
 * devant la variance d'un runner, et le résultat est déterministe, ce qui compte davantage : deux
 * exécutions du même commit doivent répartir à l'identique.
 */
export function repartir(fichiers, durees, nombreDeLots) {
  const parDefaut = mediane(Object.values(durees))
  const lots = Array.from({ length: nombreDeLots }, () => ({ fichiers: [], cout: 0 }))

  const classes = [...fichiers].sort((a, b) => {
    const ecart = (durees[b] ?? parDefaut) - (durees[a] ?? parDefaut)
    // À durée égale, l'ordre alphabétique : sans lui, la répartition dépendrait de l'ordre de
    // lecture du disque et changerait d'une machine à l'autre.
    return ecart !== 0 ? ecart : a.localeCompare(b)
  })

  for (const fichier of classes) {
    const cible = lots.reduce((a, b) => (a.cout <= b.cout ? a : b))
    cible.fichiers.push(fichier)
    cible.cout += durees[fichier] ?? parDefaut
  }

  return lots
}

function main() {
  const nombreDeLots = Number(process.argv[2])
  const index = Number(process.argv[3])

  if (!Number.isInteger(nombreDeLots) || nombreDeLots < 1) {
    throw new Error(`nombre de lots invalide : ${process.argv[2]}`)
  }
  if (!Number.isInteger(index) || index < 1 || index > nombreDeLots) {
    throw new Error(`index de lot invalide : ${process.argv[3]} (attendu 1..${nombreDeLots})`)
  }

  const fichiers = readdirSync(DOSSIER).filter((n) => n.endsWith('.spec.ts'))
  if (fichiers.length === 0) throw new Error(`aucun fichier de test trouvé dans ${DOSSIER}`)

  const durees = JSON.parse(readFileSync(RELEVE, 'utf8'))
  const lot = repartir(fichiers, durees, nombreDeLots)[index - 1]

  // Sur la sortie d'erreur : la sortie standard sert à composer la commande Playwright.
  console.error(
    `lot ${index}/${nombreDeLots} — ${lot.fichiers.length} fichiers, ~${lot.cout} s estimées`
  )
  console.log(lot.fichiers.map((f) => `test/e2e/playwright/edition-management/${f}`).join(' '))
}

// Exécuté en ligne de commande, mais pas quand un test l'importe pour ses fonctions pures.
if (process.argv[1] && process.argv[1].endsWith('lots-playwright.mjs')) main()
