import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const DEPOT = join(process.cwd(), '..', '..')

/**
 * Un `catch` ne transforme pas un refus en panne — constat D6.
 *
 * ## Le défaut
 *
 * Plusieurs handlers levaient des `createError` **4xx** à l'intérieur de leur `try`, dont le
 * `catch` final les réécrivait en **500 générique**. Le refus est écrit, la phrase est juste, et
 * personne ne la lit jamais : scanner un billet remboursé affichait « Erreur lors de la
 * validation des entrées » au lieu de « Ce billet a été remboursé ». **Au comptoir, la différence
 * est entre comprendre et appeler quelqu'un.**
 *
 * ⚠️ Et le refus n'a pas besoin d'être écrit DANS le fichier : il suffit qu'une fonction appelée
 * dans le `try` en lève un. C'est le cas de `updateUserInfo`, dont le 403 « cette adresse est déjà
 * vérifiée » et le 409 « adresse déjà utilisée » étaient avalés par `validate-entry`.
 *
 * ## 📍 CE QUE LA MESURE A CORRIGÉ DANS LA FICHE
 *
 * Elle annonçait « les 2 seuls fichiers sur 102 », en invitant à le vérifier. Mesuré sur les
 * **601 fichiers serveur** : **23** `catch` réécrivaient en 500 sans relais. Tous ont reçu la
 * convention, donc la dette est à **zéro** et ce test est une **interdiction**, pas un plafond.
 *
 * ⚠️ La fiche se trompait aussi sur `verify.post.ts` : ses deux revérifications constataient
 * « zéro occurrence de `isHttpError` », ce qui est vrai mais ne prouve **aucun défaut**. Son 403,
 * son `parse` zod et le seul util qui lève sont **avant** le `try` — il n'avalait rien. Le relais
 * y est posé comme assurance pour le prochain 4xx qu'on ajoutera dedans, pas comme correctif.
 */
async function fichiersServeur(): Promise<string[]> {
  const trouves: string[] = []
  async function parcourir(dossier: string) {
    for (const entree of await readdir(dossier, { withFileTypes: true })) {
      const complet = join(dossier, entree.name)
      if (entree.isDirectory()) {
        if (entree.name === 'node_modules') continue
        await parcourir(complet)
      } else if (entree.name.endsWith('.ts') && complet.includes(`${'/'}server${'/'}`)) {
        trouves.push(complet)
      }
    }
  }
  await parcourir(join(DEPOT, 'apps', 'app1', 'server', 'api'))
  await parcourir(join(DEPOT, 'layers'))
  return trouves
}

/** Les corps de `catch`, découpés par appariement d'accolades. */
function corpsDesCatch(source: string): string[] {
  const blocs: string[] = []
  for (const m of source.matchAll(/\}\s*catch\s*\([^)]*\)\s*\{/g)) {
    const debut = m.index! + m[0].length
    let profondeur = 1
    for (let j = debut; j < source.length; j++) {
      if (source[j] === '{') profondeur++
      else if (source[j] === '}') {
        profondeur--
        if (profondeur === 0) {
          blocs.push(source.slice(debut, j))
          break
        }
      }
    }
  }
  return blocs
}

describe('les refus 4xx ne deviennent pas des 500', () => {
  it('⚠️ AUCUN `catch` NE RÉÉCRIT EN 500 SANS RELAYER LES ERREURS HTTP', async () => {
    const fautifs: string[] = []
    for (const chemin of await fichiersServeur()) {
      const source = await readFile(chemin, 'utf8')
      for (const bloc of corpsDesCatch(source)) {
        if (/status(?:Code)?:\s*500/.test(bloc) && !bloc.includes('isHttpError')) {
          fautifs.push(chemin.slice(DEPOT.length + 1))
          break
        }
      }
    }

    expect(
      fautifs,
      `Ces \`catch\` transforment en 500 générique des refus 4xx déjà écrits — y compris ceux ` +
        `levés par les fonctions qu'ils appellent. Poser le relais en TÊTE du bloc :\n` +
        `  if (isHttpError(error)) throw error\n` +
        `avec \`import { isHttpError } from '#server/types/api'\`.\n${fautifs.join('\n')}`
    ).toEqual([])
  })

  it('le balayage lit bien des fichiers — il ne conclut pas sur le vide', async () => {
    /*
     * LA GARDE DE LA GARDE : le cas ci-dessus est une interdiction, donc **vert sur une liste
     * vide**. Une erreur de chemin, un dossier renommé, et il ne vérifierait plus rien tout en
     * restant au vert — défaut déjà payé plusieurs fois dans ce dépôt.
     *
     * ⚠️ On mesure les fichiers LUS, jamais la taille de la dette : un garde-fou calé sur ce
     * qu'on veut faire disparaître se saborde en réussissant.
     */
    const fichiers = await fichiersServeur()
    expect(fichiers.length, 'aucun fichier serveur trouvé : le balayage est cassé').toBeGreaterThan(
      400
    )

    const avecCatch = (
      await Promise.all(
        fichiers.map(async (c) => corpsDesCatch(await readFile(c, 'utf8')).length > 0)
      )
    ).filter(Boolean).length
    expect(avecCatch, 'aucun `catch` trouvé : le découpage est cassé').toBeGreaterThan(30)
  })

  it('⚠️ LE RELAIS EST EN TÊTE DU BLOC, avant toute autre décision', async () => {
    /*
     * Posé APRÈS un `console.error`, il fonctionne encore — mais posé après une réécriture, il ne
     * sert plus à rien. Le vérifier sur le fichier du guichet, celui que le constat nomme : son
     * `catch` doit relayer avant de journaliser et avant de lever son 500.
     */
    const source = await readFile(
      join(DEPOT, 'apps/app1/server/api/editions/[id]/ticketing/validate-entry.post.ts'),
      'utf8'
    )
    const bloc = corpsDesCatch(source).find((b) => /status(?:Code)?:\s*500/.test(b))!

    expect(bloc.indexOf('isHttpError')).toBeLessThan(bloc.indexOf('status: 500'))
  })
})
