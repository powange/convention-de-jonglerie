import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE = process.cwd()
const RACINE_TESTS = join(RACINE, 'test')
const RACINE_LAYERS = join(RACINE, '..', '..', 'layers')
const CONFIG_VITEST = join(RACINE, 'vitest.config.ts')
const WORKFLOW = join(RACINE, '..', '..', '.github', 'workflows', 'tests.yml')

/**
 * Un contrôle de CI vert qui n'exécute aucune assertion — constat B2.
 *
 * ## ⚠️ Le défaut
 *
 * Le projet Vitest `e2e` incluait `test/e2e/**` hors `playwright/`, ce qui ne laissait qu'un
 * fichier : `test/e2e/api/auth.test.ts`, dont le `describe` racine était `.skip`. Le contrôle
 * `test (e2e)` — l'un des dix-sept exigés — installait l'environnement, préparait Nuxt, et passait
 * au vert **sans exécuter une seule assertion**. `test/e2e/setup.ts`, qui démarrait un serveur sur
 * le port 3001, n'était référencé par aucun `setupFiles` : mort lui aussi.
 *
 * ⚠️ **Un contrôle vert vide est pire qu'un contrôle absent** : il laisse croire que l'API
 * d'authentification est exercée en boîte noire, alors qu'elle ne l'était que par Playwright.
 *
 * ## Ce qui a été vérifié avant de supprimer
 *
 * Les trois cas du fichier désactivé sont couverts ailleurs, et mieux :
 * `test/nuxt/server/api/auth/login.test.ts` (mot de passe incorrect, compte Google, compte sans
 * fournisseur), `register.test.ts` (format de l'email) et `request-password-reset.test.ts` — qui
 * vérifie en plus que le message est **identique pour un email inexistant**, ce que le test
 * désactivé ne faisait pas. Supprimer n'a donc retiré aucune couverture.
 *
 * ## Un second cas, trouvé par le même balayage
 *
 * `test/integration/migrate-organizers.db.test.ts` portait aussi un `describe.skip`
 * inconditionnel : 111 lignes testant la migration de l'ancien champ `role` de
 * `ConventionOrganizer`. Le champ n'est plus au schéma, et le script `migrate-organizer-rights.ts`
 * que son commentaire renvoyait exécuter n'existe plus. Supprimé.
 *
 * ## ⚠️ CE QUE CE TEST N'INTERDIT PAS
 *
 * `describe.skipIf(!process.env.TEST_WITH_DB)` est **légitime** et reste autorisé : les quatorze
 * suites d'intégration s'écartent ainsi quand aucune base n'est fournie. Vérifié : le job CI
 * `test (database)` passe par `npm run test:db:run`, et `scripts/test-db-run.js` pose bien
 * `TEST_WITH_DB=true` — ces suites ne sont donc pas, elles, un second contrôle vide.
 */

/** `describe.skip(` / `it.skip(` sans condition — à distinguer de `skipIf`. */
const DESACTIVATION_INCONDITIONNELLE = /\b(describe|it|test)\.skip\s*\(/

async function fichiersDeTest(): Promise<string[]> {
  const sortie: string[] = []
  const parcourir = async (chemin: string) => {
    let entrees
    try {
      entrees = await readdir(chemin, { withFileTypes: true })
    } catch {
      return
    }
    for (const entree of entrees) {
      if (entree.name === 'node_modules') continue
      const complet = join(chemin, entree.name)
      if (entree.isDirectory()) await parcourir(complet)
      /*
       * Les specs Playwright sont hors du balayage : `test.skip(condition, raison)` y est l'API
       * normale pour écarter un cas selon le navigateur ou l'état du décor.
       *
       * ⚠️ ET CE FICHIER-CI AUSSI. Il cite les motifs qu'il interdit — dans son commentaire de
       * tête, dans son message d'échec et dans les trois assertions qui vérifient que son
       * expression régulière reconnaît bien ce qu'elle cherche. Sans cette exclusion, la garde se
       * signale elle-même quatre fois et ne peut jamais passer. Le même piège a mordu deux fois
       * aujourd'hui, sur un `aria-label` puis sur une icône : une assertion qui cherche une chaîne
       * nue attrape le texte qui l'explique.
       */ else if (/\.test\.ts$/.test(entree.name) && complet !== import.meta.filename) {
        sortie.push(complet)
      }
    }
  }
  await parcourir(RACINE_TESTS)
  await parcourir(RACINE_LAYERS)
  return sortie
}

describe('aucune suite de tests n’est désactivée en silence', () => {
  it('⚠️ AUCUN `describe.skip` NI `it.skip` INCONDITIONNEL', async () => {
    const desactivees: string[] = []
    for (const fichier of await fichiersDeTest()) {
      const src = await readFile(fichier, 'utf8')
      for (const [i, ligne] of src.split('\n').entries()) {
        if (DESACTIVATION_INCONDITIONNELLE.test(ligne)) {
          desactivees.push(`${fichier.replace(RACINE, 'apps/app1')}:${i + 1}`)
        }
      }
    }

    expect(
      desactivees,
      `Une suite désactivée sans condition ne dit pas qu'elle ne tourne pas : son fichier compte ` +
        `comme couvert et son job de CI passe au vert. Soit elle est réparée, soit elle est ` +
        `supprimée — `.concat(
          `\`skipIf(!process.env.TEST_WITH_DB)\` reste permis, lui.\n${desactivees.join('\n')}`
        )
    ).toEqual([])
  })

  it('⚠️ LE PROJET VITEST « e2e » N’EST PAS RÉINTRODUIT, NI SON JOB DE CI', async () => {
    /*
     * LA CAUSE, et non le symptôme. Le premier cas serait satisfait par un projet `e2e` recréé
     * avec un fichier vide, ou par un `include` qui ne correspond à rien : Vitest rend alors un
     * projet à zéro test, et le job de CI reste vert.
     *
     * ⚠️ Les deux assertions sont nécessaires. Sans celle du workflow, on pourrait retirer le
     * projet en laissant le job de matrice, qui échouerait alors sur un filtre introuvable — bruit
     * au lieu de silence, mais toujours faux. Sans celle de la configuration, l'inverse.
     */
    const config = await readFile(CONFIG_VITEST, 'utf8')
    expect(config).not.toMatch(/name:\s*'e2e'/)

    const workflow = await readFile(WORKFLOW, 'utf8')
    expect(workflow).not.toMatch(/name:\s*'e2e'/)
    expect(workflow).not.toContain('test:e2e')
  })

  it('⚠️ CHAQUE SUITE D’INTÉGRATION DIT QU’ELLE A BESOIN D’UNE BASE', async () => {
    /*
     * LE SYMÉTRIQUE DU DÉFAUT, trouvé par le même balayage. `organizers.chain.db.test.ts` était le
     * SEUL des onze fichiers `*.db.test.ts` à ne pas porter `skipIf(!process.env.TEST_WITH_DB)`,
     * alors que son propre commentaire disait nécessiter une base. Sans la garde, son `beforeAll`
     * tentait de créer un utilisateur et échouait sur « pool timeout » après vingt secondes.
     *
     * ⚠️ UN ROUGE QUE LA CI NE VOIT JAMAIS : le job `test (database)` fournit MySQL, donc le
     * fichier y passe. Seul `npx vitest run --project integration` lancé sans base le révélait —
     * c'est-à-dire précisément ce que fait quelqu'un qui veut jouer les suites en local.
     */
    const dossier = join(RACINE_TESTS, 'integration')
    const fichiers = (await readdir(dossier)).filter((f) => f.endsWith('.db.test.ts'))
    expect(
      fichiers.length,
      'plus aucune suite d’intégration : ce cas peut être retiré'
    ).toBeGreaterThan(5)

    const sansGarde: string[] = []
    for (const nom of fichiers) {
      const src = await readFile(join(dossier, nom), 'utf8')
      if (!src.includes('skipIf(!process.env.TEST_WITH_DB)')) sansGarde.push(nom)
    }

    expect(
      sansGarde,
      `Ces suites touchent une vraie base : sans \`skipIf(!process.env.TEST_WITH_DB)\`, elles ` +
        `échouent sur un délai de connexion au lieu de se sauter, et seulement hors CI — là où ` +
        `personne ne les attend rouges :\n${sansGarde.join('\n')}`
    ).toEqual([])
  })

  it('le balayage lit bien des fichiers de test — il ne conclut pas sur le vide', async () => {
    /*
     * LA GARDE DE LA GARDE : le premier cas est une interdiction, donc vert sur une liste vide.
     * Une erreur de chemin, un `readdir` muet, et il ne vérifierait plus rien.
     *
     * ⚠️ Le plancher est large (plus de 300 fichiers au moment du lot) : il mesure que le balayage
     * fonctionne, pas la taille de la suite, qui bouge à chaque lot.
     */
    const fichiers = await fichiersDeTest()
    expect(fichiers.length).toBeGreaterThan(300)

    // Et il voit bien le motif qu'il cherche, sur une chaîne fabriquée pour l'occasion.
    expect(DESACTIVATION_INCONDITIONNELLE.test("describe.skip('x', () => {})")).toBe(true)
    expect(DESACTIVATION_INCONDITIONNELLE.test('it.skip("x", () => {})')).toBe(true)
    // `skipIf` ne doit PAS être confondu avec une désactivation inconditionnelle.
    expect(DESACTIVATION_INCONDITIONNELLE.test('describe.skipIf(!process.env.TEST_WITH_DB)(')).toBe(
      false
    )
  })
})
