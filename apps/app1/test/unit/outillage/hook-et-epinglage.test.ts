import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const DEPOT = join(process.cwd(), '..', '..')
const PACKAGE_RACINE = join(DEPOT, 'package.json')
const PACKAGE_APP1 = join(process.cwd(), 'package.json')
const WORKFLOWS = join(DEPOT, '.github', 'workflows')

/**
 * Le hook pré-commit et l'épinglage des actions — constats A7 et A6 (seconde moitié).
 *
 * ## A7 : le formatage n'était vérifié qu'en CI
 *
 * Ni `.husky/`, ni `lint-staged`, ni `simple-git-hooks` n'existaient. La règle « Prettier après
 * eslint --fix » et le job `format:check` ne se jouaient qu'une fois la PR poussée, et la mémoire
 * du projet note **deux CI rouges** pour un formatage oublié — chaque échec coûtant un aller-retour
 * complet.
 *
 * Choix retenu : `simple-git-hooks` + `lint-staged`, Prettier sur les **fichiers indexés
 * seulement**. C'est ce qui a fait rougir la CI, et c'est le moins intrusif.
 *
 * ## ⚠️⚠️ LE PIÈGE, MESURÉ AVANT D'ÉCRIRE LE HOOK
 *
 * La configuration Prettier du projet vit dans `apps/app1/package.json` (`singleQuote`,
 * `semi: false`, `printWidth: 100`). **Sans `--config` explicite, Prettier applique ses défauts** :
 * mesuré, il déclare « mal formaté » un fichier de `layers/` pourtant conforme. Un hook naïf
 * l'aurait donc reformaté à chaque commit, en cassant le style — c'est un défaut déjà consigné
 * dans la mémoire du projet.
 *
 * Éprouvé pour de vrai : un fichier de `layers/` écrit avec des guillemets doubles et un
 * point-virgule ressort en guillemets simples et sans point-virgule. Une première épreuve n'avait
 * rien prouvé — « could not find any staged files », parce que le fichier n'était pas modifié.
 *
 * ## ⚠️ ET `prettier` N'EST PAS À LA RACINE
 *
 * Le premier hook échouait sur `Task failed to spawn: prettier … ENOENT` : l'exécutable vit dans
 * `apps/app1/node_modules`, pas à la racine où `lint-staged` le cherche. **Un hook qui échoue
 * BLOQUE le commit** : il est donc appelé par son chemin, plutôt que de dupliquer Prettier.
 *
 * ## A6, seconde moitié : une seule action épinglée
 *
 * Sur les 43 usages d'actions, 37 sont officielles GitHub, 8 une action locale, 3 de Docker Inc. —
 * et **une seule est tierce**. C'est elle qui est épinglée par empreinte ; épingler les officielles
 * rendrait chaque mise à jour manuelle pour un risque que GitHub ne recommande pas de couvrir
 * ainsi.
 */
describe('hook pré-commit et épinglage des actions', () => {
  it('⚠️ LE HOOK APPELLE PRETTIER AVEC LE `--config` DU PROJET', async () => {
    const racine = JSON.parse(await readFile(PACKAGE_RACINE, 'utf8'))
    const app1 = JSON.parse(await readFile(PACKAGE_APP1, 'utf8'))

    // Le témoin : la configuration est bien dans apps/app1, donc le `--config` est nécessaire.
    expect(app1.prettier, 'la config Prettier a quitté apps/app1/package.json').toBeDefined()
    expect(app1.prettier.singleQuote).toBe(true)

    const taches: Record<string, string> = racine['lint-staged'] ?? {}
    expect(Object.keys(taches).length, 'aucune tâche lint-staged déclarée').toBeGreaterThan(0)

    for (const [motif, commande] of Object.entries(taches)) {
      expect(
        commande,
        `La tâche « ${motif} » doit passer --config apps/app1/package.json : sans lui, Prettier ` +
          `applique ses défauts et reformate les fichiers de layers/ à chaque commit.`
      ).toContain('--config apps/app1/package.json')
    }
  })

  it('⚠️ LE HOOK EST DÉCLARÉ, ET S’INSTALLE TOUT SEUL', async () => {
    /*
     * `simple-git-hooks` écrit dans `.git/hooks/`, qui n'est pas versionné : sans le script
     * `prepare`, le hook n'existerait que chez qui a lancé la commande à la main. Un `npm install`
     * à la racine le pose.
     */
    const racine = JSON.parse(await readFile(PACKAGE_RACINE, 'utf8'))

    expect(racine['simple-git-hooks']?.['pre-commit']).toBeDefined()
    expect(racine.scripts?.prepare).toContain('simple-git-hooks')
    expect(racine.devDependencies?.['simple-git-hooks']).toBeDefined()
    expect(racine.devDependencies?.['lint-staged']).toBeDefined()
  })

  it('⚠️ TOUTE ACTION TIERCE EST ÉPINGLÉE PAR EMPREINTE', async () => {
    /*
     * Un tag de majeure peut être déplacé par son éditeur : c'est le vecteur exploité contre
     * `tj-actions` en 2025. Les actions d'`actions/*` (GitHub), de `docker/*` et les actions
     * locales (`./…`) restent sur leur tag, délibérément.
     *
     * ⚠️ Ce cas garde une DÉCISION autant qu'un défaut : si une action tierce est ajoutée demain
     * sur un tag, il tombera — et c'est le but, parce que ce choix doit être conscient.
     */
    const fichiers = (await readdir(WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f))
    const nonEpinglees: string[] = []

    for (const nom of fichiers) {
      const src = await readFile(join(WORKFLOWS, nom), 'utf8')
      for (const m of src.matchAll(/^\s*uses:\s*(\S+)/gm)) {
        const ref = m[1]!
        // Actions locales du dépôt, et éditeurs considérés de confiance pour le tag.
        if (ref.startsWith('./') || /^(actions|docker)\//.test(ref)) continue
        // Une empreinte de commit fait 40 caractères hexadécimaux.
        if (!/@[0-9a-f]{40}$/.test(ref)) nonEpinglees.push(`${nom} → ${ref}`)
      }
    }

    expect(
      nonEpinglees,
      `Ces actions tierces suivent un tag que leur éditeur peut déplacer. Relever l'empreinte :\n` +
        `  gh api repos/<org>/<action>/git/ref/tags/<tag> --jq .object.sha\n${nonEpinglees.join('\n')}`
    ).toEqual([])
  })

  it('le balayage voit bien des actions — il ne conclut pas sur le vide', async () => {
    /*
     * LA GARDE DE LA GARDE : le cas ci-dessus est une interdiction, donc vert sur une liste vide.
     * Une erreur de chemin, et il ne vérifierait plus rien.
     */
    const fichiers = (await readdir(WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f))
    let usages = 0
    for (const nom of fichiers) {
      const src = await readFile(join(WORKFLOWS, nom), 'utf8')
      usages += [...src.matchAll(/^\s*uses:/gm)].length
    }
    expect(usages, 'aucun `uses:` trouvé : le balayage est cassé').toBeGreaterThan(20)
  })
})
