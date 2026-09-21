#!/usr/bin/env node
/**
 * Les fichiers d'un lot Playwright de `edition-management`, et le contrôle qui va avec.
 *
 * POURQUOI DES LISTES EXPLICITES plutôt que `--shard`. Playwright équilibre le NOMBRE de tests :
 * mesuré le 20/09/2026, un lot tenait 235 s de tests quand un autre en tenait 134, et toujours le
 * même en tête. Les fichiers coûtent de 2 s à 30 s, et aucun découpage par comptage ne le voit.
 *
 * POURQUOI CE DÉCOUPAGE-LÀ ET PAS UN AUTRE, et c'est le point à ne pas défaire. Une première
 * tentative a réparti les 54 fichiers par durée, sans égard pour les lots d'origine : la CI l'a
 * refusée. `acces-benevole-en-creneau.spec.ts` et `volunteers.spec.ts` se sont retrouvés ensemble
 * alors qu'ils n'avaient JAMAIS partagé une base, et ils se contredisent sur les réglages de
 * l'unique édition que tout le projet se partage (`fullyParallel: false`).
 *
 * Le découpage ci-dessous est donc une SUBDIVISION de celui d'avant, en deux temps : `gestion-1` —
 * qui portait 27 fichiers sur 54 et 235 s de tests — a été coupé en deux le 20/09, puis
 * `gestion-2` et `gestion-3` le 21/09, à 78/78 s et 69/68 s. Subdiviser ne peut que défaire des
 * cohabitations, jamais en créer : toute paire de fichiers d'un nouveau lot cohabitait déjà.
 *
 * `gestion-2` a été coupé AVEC `gestion-3` et non seul, parce qu'il n'avait que 14 s d'avance sur
 * lui : seul, il n'aurait rapporté que 22 s avant que `gestion-3` ne devienne le mur à son tour.
 *
 * ⚠️ Cette propriété est la seule raison pour laquelle ce changement est sûr. Un futur
 * rééquilibrage qui déplacerait un fichier d'un lot vers un autre la perdrait, et retomberait sur
 * l'échec de la première tentative. Rendre les fichiers indépendants d'abord.
 *
 * Usage : node scripts/lot-playwright.mjs <clé-du-lot>
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..', 'test', 'e2e', 'playwright')
const DOSSIER = join(RACINE, 'edition-management')
const LOTS = join(RACINE, 'lots-edition-management.json')

/**
 * Ce que la couverture doit garantir, et pourquoi elle échoue bruyamment.
 *
 * Avec des listes explicites, un fichier de test ajouté plus tard n'appartient à AUCUN lot : il ne
 * s'exécute nulle part, et tous les lots restent verts. C'est le pire des échecs — silencieux.
 *
 * L'affecter d'office au lot le moins chargé serait plus commode, mais créerait précisément la
 * cohabitation inédite qui a fait échouer la première tentative. On préfère donc arrêter la CI et
 * demander qu'on tranche : c'est une ligne à ajouter au fichier de lots, en connaissance de cause.
 */
export function verifierCouverture(surDisque, lots) {
  const assignes = Object.values(lots).flat()
  const ensemble = new Set(assignes)

  const oublies = surDisque.filter((f) => !ensemble.has(f))
  const fantomes = assignes.filter((f) => !surDisque.includes(f))
  const doublons = assignes.filter((f, i) => assignes.indexOf(f) !== i)

  return { oublies, fantomes, doublons: [...new Set(doublons)] }
}

function main() {
  const cle = process.argv[2]
  const lots = JSON.parse(readFileSync(LOTS, 'utf8'))

  if (!cle || !lots[cle]) {
    throw new Error(`lot inconnu : « ${cle} » — attendu l'un de ${Object.keys(lots).join(', ')}`)
  }

  const surDisque = readdirSync(DOSSIER).filter((n) => n.endsWith('.spec.ts'))
  const { oublies, fantomes, doublons } = verifierCouverture(surDisque, lots)

  if (oublies.length > 0) {
    console.error(
      `::error::${oublies.length} fichier(s) de test ne sont dans AUCUN lot et ne s'exécuteraient ` +
        `nulle part : ${oublies.join(', ')}. Ajoutez-les à ${LOTS} — en choisissant le lot, car ` +
        `réunir deux fichiers qui ne se sont jamais côtoyés a déjà cassé la CI.`
    )
  }
  if (fantomes.length > 0) {
    console.error(`::error::lot(s) citant un fichier absent du disque : ${fantomes.join(', ')}`)
  }
  if (doublons.length > 0) {
    console.error(`::error::fichier(s) présents dans deux lots : ${doublons.join(', ')}`)
  }
  if (oublies.length + fantomes.length + doublons.length > 0) process.exit(1)

  console.error(`lot ${cle} — ${lots[cle].length} fichiers`)
  console.log(lots[cle].map((f) => `test/e2e/playwright/edition-management/${f}`).join(' '))
}

// Exécuté en ligne de commande, mais pas quand un test importe `verifierCouverture`.
if (process.argv[1] && process.argv[1].endsWith('lot-playwright.mjs')) main()
