import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const WORKFLOWS = join(process.cwd(), '..', '..', '.github', 'workflows')

/**
 * Chaque workflow déclare-t-il les droits de son jeton ? — constat A6.
 *
 * ## Le défaut, et sa gravité réelle
 *
 * Sept des neuf jobs de `tests.yml` n'avaient aucun `permissions:` et héritaient du défaut du
 * dépôt. `publier-android.yml` non plus. Seuls `playwright` et le job qui publie l'image
 * déclaraient le leur.
 *
 * ⚠️ **LA FICHE SE TROMPE SUR LA GRAVITÉ.** Elle écrit qu'un job de PR « obtient alors un jeton
 * capable d'écrire ». Mesuré via l'API GitHub, le défaut de ce dépôt est
 * `default_workflow_permissions = read` : aucun job n'avait ce pouvoir. Et elle ajoute que « le
 * workflow qui publie l'image de production est concerné » — faux : son job déclarait déjà
 * `contents: read, packages: write`.
 *
 * Le travail garde pourtant son sens, pour une autre raison : **ce réglage vit dans l'interface de
 * GitHub, hors du code.** Quiconque le passe en lecture-écriture, un jour, donne ce pouvoir à huit
 * jobs de PR d'un coup, sans qu'aucune revue le voie. Déclarer le plancher dans le fichier rend la
 * contrainte indépendante d'un bouton.
 *
 * ## ⚠️ CE QUE CE TEST NE FAIT PAS : épingler les actions
 *
 * La seconde moitié du constat demande de remplacer les tags de majeure (`actions/checkout@v4`) par
 * des empreintes de commit, au motif de l'attaque contre `tj-actions` en 2025. Mesuré : sur les
 * **43 usages**, **37 sont des actions officielles GitHub** (`actions/*`), 3 de Docker Inc., 8 une
 * action locale du dépôt — et **une seule est tierce**, `android-actions/setup-android@v3`. Épingler
 * les officielles rendrait chaque mise à jour manuelle pour un risque que GitHub lui-même ne
 * recommande pas de couvrir ainsi. La décision revient à l'utilisateur ; ce test ne la prend pas.
 */
describe('permissions des workflows de CI', () => {
  it('⚠️ CHAQUE WORKFLOW DÉCLARE UN PLANCHER DE PERMISSIONS', async () => {
    const fichiers = (await readdir(WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f))
    expect(fichiers.length, 'aucun workflow trouvé : le balayage est cassé').toBeGreaterThan(2)

    const sansPlancher: string[] = []
    for (const nom of fichiers) {
      const src = await readFile(join(WORKFLOWS, nom), 'utf8')
      /*
       * On cherche un `permissions:` en COLONNE 0, c'est-à-dire au niveau du workflow. Celui d'un
       * job est indenté : le confondre ferait passer `tests.yml` pour couvert alors que seuls deux
       * de ses neuf jobs déclaraient le leur — exactement l'état d'avant ce lot.
       */
      if (!/^permissions:$/m.test(src)) sansPlancher.push(nom)
    }

    expect(
      sansPlancher,
      `Sans \`permissions:\` au niveau du workflow, ses jobs héritent du réglage du dépôt — qui ` +
        `vit dans l'interface de GitHub et peut changer sans revue :\n${sansPlancher.join('\n')}`
    ).toEqual([])
  })

  it('⚠️ LE PLANCHER EST LA LECTURE SEULE', async () => {
    /*
     * Déclarer `permissions:` ne suffit pas : `contents: write` au niveau du workflow serait pire
     * que rien, puisqu'il donnerait ce droit à tous les jobs tout en ayant l'air d'une précaution.
     *
     * Un job qui a besoin de plus l'étend pour lui seul — c'est ce que fait `publier-image` avec
     * `packages: write`, et une déclaration de job l'emporte sur celle du workflow.
     */
    const fichiers = (await readdir(WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f))

    const tropLarges: string[] = []
    for (const nom of fichiers) {
      const src = await readFile(join(WORKFLOWS, nom), 'utf8')
      // Le bloc du workflow : depuis `permissions:` en colonne 0 jusqu'à la prochaine clé racine.
      const bloc = src.match(/^permissions:$\n((?:[ \t]+.*\n|\n)*)/m)?.[1] ?? ''
      for (const ligne of bloc.split('\n')) {
        const m = ligne.match(/^\s+([\w-]+):\s*(\S+)/)
        if (m && m[2] !== 'read' && m[2] !== 'none') tropLarges.push(`${nom} → ${m[1]}: ${m[2]}`)
      }
    }

    expect(
      tropLarges,
      `Un droit d'écriture au niveau du workflow le donne à TOUS ses jobs. Le déclarer sur le seul ` +
        `job qui en a besoin :\n${tropLarges.join('\n')}`
    ).toEqual([])
  })
})
