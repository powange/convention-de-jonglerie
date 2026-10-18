import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

/**
 * Tout type passé à `validateResourceId` est déclaré ET porte un message.
 *
 * ## Pourquoi cette garde existe
 *
 * `validateResourceId(event, 'itemId', 'billet')` était écrit dans **quatre** points d'API de la
 * billetterie — annulation, remboursement, remise, remise rendue — alors que `'billet'` n'était pas
 * dans `ResourceType`. Conséquence à l'exécution :
 *
 *     message: RESOURCE_MESSAGES[resourceType]   // RESOURCE_MESSAGES['billet'] === undefined
 *
 * Les quatre répondaient donc **400 sans message** sur un identifiant manquant ou invalide. Un
 * appelant voyait un refus sans explication, et rien dans le code ne le signalait : l'erreur de
 * typage existait, mais la porte qui l'aurait montrée était éteinte (voir #859).
 *
 * ## Ce qu'elle vérifie, et pourquoi deux sens
 *
 * 1. **Tout type EMPLOYÉ est déclaré.** C'est le défaut ci-dessus : le type manque, le message
 *    vaut `undefined`, et seul le compilateur pouvait le dire.
 * 2. **Tout type DÉCLARÉ porte un message.** L'inverse : ajouter une valeur à l'union sans sa
 *    ligne dans `RESOURCE_MESSAGES` produirait exactement le même `undefined`, sans qu'aucune
 *    erreur de typage n'apparaisse — `Record<ResourceType, string>` l'attraperait, mais seulement
 *    si quelqu'un lit le journal.
 *
 * 📍 Elle lit le SOURCE plutôt que d'importer les deux valeurs, parce que `ResourceType` est un
 * type : il n'existe plus à l'exécution, et son contenu n'est vérifiable que textuellement.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const MONOREPO = join(RACINE, '..', '..')
const HELPERS = join(RACINE, 'server/utils/validation-helpers.ts')

const source = readFileSync(HELPERS, 'utf8')

/** Les valeurs de l'union `ResourceType`. */
const declares = (): Set<string> => {
  const debut = source.indexOf('export type ResourceType =')
  expect(debut, 'union `ResourceType` introuvable').toBeGreaterThan(-1)
  const fin = source.indexOf('\n\n', debut)
  return new Set([...source.slice(debut, fin).matchAll(/'([^']+)'/g)].map((m) => m[1]!))
}

/** Les clés de `RESOURCE_MESSAGES`. */
const avecMessage = (): Set<string> => {
  const debut = source.indexOf('const RESOURCE_MESSAGES')
  expect(debut, '`RESOURCE_MESSAGES` introuvable').toBeGreaterThan(-1)
  const corps = source.slice(debut, source.indexOf('\n}', debut))
  return new Set([
    ...[...corps.matchAll(/^\s+([\p{L}\d_]+):/gmu)].map((m) => m[1]!),
    ...[...corps.matchAll(/^\s+'([^']+)':/gm)].map((m) => m[1]!),
  ])
}

/** Les arborescences serveur : l'application, et chaque layer. */
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

const listerTs = (dossier: string): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) return listerTs(chemin)
    return entree.name.endsWith('.ts') ? [chemin] : []
  })

/** Le dernier argument littéral de chaque appel à `validateResourceId`. */
const employes = (): Map<string, number> => {
  const compte = new Map<string, number>()
  for (const chemin of ARBRES.flatMap(listerTs)) {
    const contenu = readFileSync(chemin, 'utf8')
    for (const appel of contenu.matchAll(/validateResourceId\(([^)]*)\)/g)) {
      const litteraux = [...appel[1]!.matchAll(/'([^']*)'/g)].map((m) => m[1]!)
      if (litteraux.length < 2) continue // appel à argument calculé : hors de portée d'un balayage
      const type = litteraux[litteraux.length - 1]!
      compte.set(type, (compte.get(type) ?? 0) + 1)
    }
  }
  return compte
}

describe('`ResourceType` couvre ce qu’on lui passe', () => {
  const union = declares()
  const messages = avecMessage()
  const appels = employes()

  it('le témoin : les trois relevés sont bien LUS, et non vides', () => {
    /*
     * Sans ce cas, toutes les comparaisons seraient vertes sur des ensembles vides — le défaut
     * classique d'une garde dont un chemin a glissé. Les seuils sont bas et stables.
     */
    expect(union.size, 'union `ResourceType` vide').toBeGreaterThan(20)
    expect(messages.size, '`RESOURCE_MESSAGES` vide').toBeGreaterThan(20)
    expect(appels.size, `aucun appel trouvé — arbres : ${ARBRES.join(', ')}`).toBeGreaterThan(20)
  })

  it('tout type EMPLOYÉ dans un appel est déclaré', () => {
    const inconnus = [...appels.entries()]
      .filter(([type]) => !union.has(type))
      .map(([type, n]) => `'${type}' — ${n} appel(s)`)

    expect(
      inconnus,
      `ces types sont passés à \`validateResourceId\` sans être dans \`ResourceType\`.\n` +
        `\`RESOURCE_MESSAGES[type]\` vaut alors \`undefined\` : le refus part en 400 SANS MESSAGE.\n` +
        inconnus.join('\n')
    ).toEqual([])
  })

  it('tout type DÉCLARÉ porte un message', () => {
    const sansMessage = [...union].filter((type) => !messages.has(type)).sort()

    expect(
      sansMessage,
      `ces valeurs de \`ResourceType\` n'ont pas de ligne dans \`RESOURCE_MESSAGES\` :\n` +
        sansMessage.join(', ')
    ).toEqual([])
  })

  it('📍 et aucun message n’est déclaré pour un type qui n’existe plus', () => {
    // L'autre sens : une clé orpheline signale un renommage à moitié fait.
    const orphelins = [...messages].filter((cle) => !union.has(cle)).sort()

    expect(orphelins, `clés de message sans type correspondant : ${orphelins.join(', ')}`).toEqual(
      []
    )
  })
})
