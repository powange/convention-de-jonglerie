#!/usr/bin/env node
/**
 * Rend les dépendances visibles depuis `layers/`.
 *
 * Les layers sont des dossiers de sources sans `package.json` : Node et TypeScript y cherchent
 * les paquets en remontant l'arborescence — `layers/<x>/node_modules`, puis `layers/node_modules`,
 * puis la racine du dépôt. Or tout est installé dans `apps/app1/node_modules`, et la racine ne
 * déclare aucune dépendance. Résultat, `zod` était introuvable depuis un layer : 97 modules non
 * résolus au typage, et surtout des types dégradés en `any` sur tout un pan du code — bénévoles,
 * billetterie, repas, tâches.
 *
 * Un lien à `layers/node_modules` rétablit la chaîne sans toucher à l'installation. Le
 * fonctionnement de l'application n'en dépend pas : Vite et Nitro résolvent depuis le contexte de
 * l'app, ce qui marchait déjà. Seul le typage y gagne — et il y gagne beaucoup.
 */
import { existsSync, lstatSync, readlinkSync, symlinkSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @returns {'absent'|'deja-lie'|'lien-etranger'|'dossier-reel'|'cree'|'echec'} ce qui a été fait */
export function lierLayers(dossierLayers, cible, journal = console) {
  if (!existsSync(dossierLayers)) return 'absent' // app installée seule, rien à relier

  const lien = join(dossierLayers, 'node_modules')
  const infos = lstatSansErreur(lien)

  if (infos?.isSymbolicLink()) {
    const actuel = resolve(dossierLayers, readlinkSync(lien))
    if (actuel === resolve(cible)) return 'deja-lie'
    journal.warn(`[layers] lien existant vers ${actuel}, laissé en place`)
    return 'lien-etranger'
  }

  if (infos) {
    // Un vrai dossier : quelqu'un y a installé des dépendances propres. On n'y touche pas.
    journal.warn('[layers] node_modules réel présent, aucun lien créé')
    return 'dossier-reel'
  }

  try {
    // Chemin relatif : le lien reste valable si le dépôt est déplacé ou monté ailleurs.
    symlinkSync(relative(dossierLayers, cible), lien, 'junction')
    journal.log('[layers] node_modules relié à apps/app1/node_modules')
    return 'cree'
  } catch (erreur) {
    // Un échec ne doit pas casser l'installation : seul le typage en pâtit.
    journal.warn(`[layers] lien impossible (${erreur.code ?? erreur.message}) — typage dégradé`)
    return 'echec'
  }
}

function lstatSansErreur(chemin) {
  try {
    return lstatSync(chemin)
  } catch {
    return null
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const racineApp = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  lierLayers(resolve(racineApp, '../../layers'), join(racineApp, 'node_modules'))
}
