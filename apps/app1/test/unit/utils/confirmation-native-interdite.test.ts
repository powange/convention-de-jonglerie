import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Plus aucune boîte de confirmation NATIVE dans du code neuf.
 *
 * ## Pourquoi le dépôt a abandonné `confirm()`
 *
 * Le raisonnement est déjà écrit sur cinq écrans, mot pour mot : la boîte native **bloque la
 * page**, **ne suit pas la langue choisie** — elle affiche « OK » et « Annuler » dans celle du
 * navigateur —, ne dit jamais sur quoi porte l'action, et **certains navigateurs laissent
 * l'utilisateur la désactiver**. Dans ce dernier cas `confirm()` rend `true` sans rien demander :
 * la suppression part toute seule.
 *
 * `useConfirmation()` + `UiConfirmationDemandee` la remplacent partout où la migration a eu lieu.
 *
 * ## ⚠️ POURQUOI CE TEST EXISTE : LA FICHE EN COMPTAIT TROIS, IL Y EN AVAIT VINGT-SIX
 *
 * Le constat d'audit annonçait « trois `window.confirm` » — il n'avait cherché que cette forme.
 * Mais la plupart des appels s'écrivent **sans le préfixe** (`confirm(…)`, la fonction étant
 * globale). Mesuré le 09/10/2026 : **26 appels dans 19 fichiers**.
 *
 * Corriger la seule cible de la fiche en laissant les autres aurait refermé un constat en laissant
 * le problème **huit fois plus grand** derrière lui — et surtout, rien n'aurait empêché le
 * vingt-septième. Ce test fige la dette, nommée fichier par fichier, et refuse toute addition.
 *
 * ## Ce que ce test NE fait pas
 *
 * Il ne migre rien. La dette restante est présentée à l'utilisateur avec son décompte pour qu'il
 * décide de l'ordre : les suppressions définitives — un compte d'utilisateur, une convention, un
 * jeton d'API, une sauvegarde — ne pèsent pas comme un avertissement de saisie non enregistrée.
 *
 * 📍 Un cas se distingue des autres et ne se migre PAS mécaniquement :
 * `layers/stock/…/[groupId].vue` fait `return window.confirm(…)` dans une garde de sortie, qui
 * attend un booléen **synchrone**. C'est exactement le problème que `useGardeDeSortie` a résolu
 * ailleurs en attendant la réponse d'une modale ; ce fichier devra passer par elle.
 */

/**
 * La dette au 09/10/2026, après la migration de la suppression d'un spectacle enregistré.
 *
 * ⚠️ Ces nombres ne doivent que DESCENDRE. Un fichier migré sort de la liste ; un fichier qui en
 * ajoute fait tomber le test. Ne jamais monter un nombre pour faire passer la suite.
 */
const DETTE: Record<string, number> = {
  'apps/app1/app/components/organizers/MealsModal.vue': 1,
  'layers/artists/app/components/artists/MealsModal.vue': 1,
  'layers/stock/app/pages/editions/[id]/gestion/stock/[groupId].vue': 1,
  'layers/volunteers/app/components/volunteers/MealsModal.vue': 1,
}

/** `confirm(` ou `window.confirm(`, jamais une propriété (`.confirm(`). */
const APPEL_NATIF = /(?<![\w.])(?:window\.)?confirm\s*\(/g

/**
 * Le code, débarrassé de ses commentaires.
 *
 * ⚠️ Indispensable : cinq écrans EXPLIQUENT en commentaire pourquoi ils n'emploient plus
 * `confirm()`. Les compter ferait de ces explications des infractions, et le test accuserait
 * précisément les fichiers qui ont fait le travail.
 */
function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

function appelsParFichier(): Record<string, number> {
  const racineDepot = path.resolve(__dirname, '../../../../..')
  const racines = [
    path.resolve(racineDepot, 'apps/app1/app'),
    ...fs
      .readdirSync(path.resolve(racineDepot, 'layers'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.resolve(racineDepot, 'layers', e.name, 'app')),
  ]

  const trouves: Record<string, number> = {}
  const parcours = (dossier: string) => {
    if (!fs.existsSync(dossier)) return
    for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, entree.name)
      if (entree.isDirectory()) {
        if (entree.name === 'node_modules' || entree.name === '.nuxt') continue
        parcours(complet)
      } else if (/\.(vue|ts)$/.test(entree.name)) {
        const n = (sansCommentaires(fs.readFileSync(complet, 'utf8')).match(APPEL_NATIF) ?? [])
          .length
        if (n > 0) {
          trouves[path.relative(racineDepot, complet).split(path.sep).join('/')] = n
        }
      }
    }
  }
  racines.forEach(parcours)
  return trouves
}

describe('confirmation native — la dette ne doit que descendre', () => {
  const reels = appelsParFichier()

  it('le parcours trouve bien du code', () => {
    // La garde de la garde : un parcours qui ne rendrait rien laisserait tout le reste vert en ne
    // vérifiant rien — le piège de la mesure satisfaite par des zéros.
    expect(Object.keys(reels).length).toBeGreaterThan(5)
  })

  it('aucun fichier n’emploie `confirm()` hors de la dette recensée', () => {
    const nouveaux = Object.keys(reels).filter((f) => !(f in DETTE))
    expect(
      nouveaux,
      'employer `useConfirmation()` + `UiConfirmationDemandee` : la boîte native bloque la page, ne suit pas la langue, et le navigateur peut la désactiver'
    ).toEqual([])
  })

  it('aucun fichier n’en ajoute', () => {
    const aggraves = Object.entries(reels)
      .filter(([f, n]) => f in DETTE && n > DETTE[f]!)
      .map(([f, n]) => `${f} : ${n} au lieu de ${DETTE[f]}`)
    expect(aggraves).toEqual([])
  })

  it('la dette recensée existe encore, et son décompte est juste', () => {
    /*
     * ⚠️ LA VÉRIFICATION QUI REND LA LISTE SÛRE. Sans elle, une entrée resterait après migration et
     * exempterait silencieusement un fichier revenu en arrière — le défaut d'une garde par liste
     * qu'on ne relit pas, déjà payé ailleurs dans ce dépôt.
     *
     * Un fichier migré doit donc être RETIRÉ de `DETTE`, et le test le dit.
     */
    const perimes = Object.entries(DETTE)
      .filter(([f, n]) => (reels[f] ?? 0) !== n)
      .map(([f, n]) => `${f} : ${reels[f] ?? 0} réel contre ${n} recensé — mettre à jour DETTE`)
    expect(perimes).toEqual([])
  })

  it('la suppression d’un spectacle enregistré est bien migrée', () => {
    // La cible du constat, nommée explicitement : les tests ci-dessus le diraient déjà, celui-ci
    // dit POURQUOI ce fichier n'est pas dans la dette.
    const cible = 'apps/app1/app/pages/editions/[id]/shows-call/[showCallId]/apply.vue'
    expect(reels[cible] ?? 0).toBe(0)
  })
})
