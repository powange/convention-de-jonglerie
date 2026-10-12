import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

import type { ConfigOptions } from '@nuxt/test-utils/playwright'

const testResultsAuth = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'test-results',
  '.auth'
)

const authFile = path.join(testResultsAuth, 'user.json')
/*
 * La session d'un SECOND compte, pour la seule spec qui change la langue du profil — constat CI·4.
 *
 * ⚠️ `PUT /api/profile/update` remplace le profil entier : partagé avec `profile.spec.ts`, un
 * unique compte voyait ses allergies effacées par le réglage de la langue, et inversement. Une
 * mise à jour perdue, que seul un `workers: 1` sur tout le projet tenait à distance.
 */
const authFileLangue = path.join(testResultsAuth, 'user-langue.json')
const credentialsFile = path.join(testResultsAuth, 'credentials.json')
const conventionStateFile = path.join(testResultsAuth, 'convention-state.json')

export default defineConfig<ConfigOptions>({
  testDir: './test/e2e/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  /*
   * ⚠️ `workers` ÉTAIT À 1 SANS CONDITION, trois lignes sous `fullyParallel: true` — constat CI·5.
   * Les deux projets du lot `publics` étaient donc sérialisés alors que rien ne l'exigeait, et la
   * déclaration de parallélisme au-dessus ne voulait rien dire.
   *
   * `'50%'` plutôt qu'un nombre : c'est le défaut de Playwright, il s'adapte au runner, et il n'y
   * a donc rien à réviser le jour où GitHub change de gabarit. Sur un runner public à 4 cœurs cela
   * fait 2 travailleurs ; sur 2 cœurs, 1 — soit exactement le comportement d'avant, sans
   * régression possible.
   *
   * ⚠️⚠️ LA LIMITE PAR PROJET EST CE QUI REND CECI SÛR, et c'est elle qu'il faut lire en premier :
   * `authenticated` et `edition-management` restent à **un** travailleur, parce qu'ils partagent un
   * compte et une édition. Sans ces deux limites, ce changement ferait deux spécifications écrire
   * le MÊME profil en même temps (mesuré : `profile.spec.ts` et `langue-du-profil.spec.ts` appellent
   * tous deux `PUT /api/profile/update`, qui exige un profil COMPLET — la seconde écriture écraserait
   * donc les champs de la première).
   *
   * `testProject.workers` existe depuis Playwright 1.52 ; le dépôt est en 1.60.
   */
  workers: process.env.CI ? '50%' : 1,
  /*
   * ⚠️ TROIS RAPPORTEURS, ET CHACUN A SA RAISON.
   *
   * `retries: 2` ci-dessus laisse un test instable passer vert à la troisième tentative, et rien
   * ne le signalait : le rapport HTML est un artefact qu'il faut télécharger et ouvrir pour le
   * voir. Un test qui échoue une fois sur trois se cachait donc derrière les reprises jusqu'au
   * jour où il échoue trois fois de suite.
   *
   * 📍 MESURÉ AVANT D'AGIR, sur quatre runs consécutifs : **547 tests passés, zéro instable** à
   * chaque fois. Rien ne se cachait donc derrière les reprises — mais rien ne le mesurait, et une
   * instabilité apparue demain serait restée invisible. L'état de référence étant zéro, la CI peut
   * exiger zéro : c'est ce que fait l'étape « Refuser un test instable » du job `playwright`.
   *
   * - `list` écrit le résumé dans le journal du job, où il se lit sans rien télécharger ;
   * - `json` produit le fichier que la CI compte pour remonter les noms dans le résumé de la PR ;
   * - `html` reste l'artefact qu'on ouvre pour comprendre un échec, avec sa trace et ses captures.
   */
  reporter: process.env.CI
    ? [['list'], ['json', { outputFile: 'playwright-resultats.json' }], ['html']]
    : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    nuxt: {
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
      host: 'http://localhost:3000',
    },
  },
  projects: [
    // Setup : crée un compte E2E et sauvegarde la session
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      // 2 minutes : en local, la première visite d'une page compile le serveur de développement
      // — 48 s mesurées sur /login, contre 0 s ensuite. Avec 60 s il ne restait qu'une douzaine
      // de secondes pour la création de compte, et l'étape échouait une fois sur deux. En CI
      // l'application est pré-construite, ce délai n'y change rien.
      timeout: 120000,
      use: { ...devices['Desktop Chrome'], locale: 'fr-FR' },
    },
    // Setup du second compte, celui de la spec de la langue — cf. `authFileLangue`.
    {
      name: 'setup-langue',
      testMatch: /auth-langue\.setup\.ts/,
      /*
       * ⚠️⚠️ APRÈS LE SETUP PRINCIPAL, ET CE N'EST PAS UN DÉTAIL D'ORDONNANCEMENT.
       *
       * Les deux inscriptions lisent le code de vérification dans LE MÊME JOURNAL, et
       * `getVerificationCodeFromLogs` y prend « le DERNIER code » — ce qui n'est juste que si une
       * seule inscription tourne à la fois. Lancés en parallèle, les deux setups pouvaient saisir
       * le code de l'autre.
       *
       * 📍 Ce n'est pas une hypothèse : la première version de ce lot a fait tomber la CI, et la
       * garde d'instabilité a nommé le coupable — « 1 test instable : create account and
       * authenticate ». Il avait échoué puis réussi à la reprise, ce qui est exactement la
       * signature d'une course.
       *
       * 📍 LE CORRECTIF DE FOND SERAIT AILLEURS : la ligne de journal ne porte que le code, pas
       * l'adresse (`generateVerificationCode` ne connaît pas le destinataire). La faire porter
       * l'adresse rendrait l'aide juste au lieu de chanceuse, et permettrait n'importe quel nombre
       * d'inscriptions simultanées. C'est un changement côté serveur, hors du périmètre de ce
       * constat — noté, pas fait.
       */
      dependencies: ['setup'],
      // Même délai que le setup principal, et pour la même raison : en local, la première visite
      // d'une page compile le serveur de développement.
      timeout: 120000,
      use: { ...devices['Desktop Chrome'], locale: 'fr-FR' },
    },
    // Data setup : crée convention + édition via API
    {
      name: 'data-setup',
      testMatch: /data\.setup\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-FR',
        storageState: authFile,
      },
    },
    // Tests publics (sans authentification)
    {
      name: 'public',
      testMatch: /public\//,
      use: { ...devices['Desktop Chrome'], locale: 'fr-FR' },
    },
    // Tests authentifiés (profil, login, convention UI)
    {
      name: 'authenticated',
      testMatch: /authenticated\//,
      // ⚠️ La spec de la langue est EXCLUE : elle a son propre compte et son propre projet, parce
      // qu'elle écrivait le même profil que `profile.spec.ts` — cf. `authFileLangue`. Sans cette
      // exclusion, `testMatch` l'attraperait ici aussi et elle tournerait deux fois, sur les deux
      // comptes, ce qui ramènerait exactement le conflit qu'on vient de supprimer.
      testIgnore: /langue-du-profil\.spec\.ts/,
      dependencies: ['setup'],
      /*
       * ⚠️ PLUS DE `workers: 1` ICI, et c'est tout l'objet du constat CI·4.
       *
       * Il tenait à distance une mise à jour perdue entre `profile.spec.ts` et
       * `langue-du-profil.spec.ts` : `PUT /api/profile/update` attend un profil COMPLET et écrase
       * ce qu'on ne lui envoie pas, si bien qu'en parallèle la seconde écriture effaçait les champs
       * de la première. Les deux specs ont désormais DEUX COMPTES distincts, et plus un seul
       * fichier de ce projet n'écrit le profil.
       *
       * 📍 Lire le profil avant d'écrire n'aurait PAS suffi — la spec de la langue le faisait déjà,
       * et deux lectures-modifications-écritures entrelacées perdent toujours l'une des deux.
       *
       * 📍 ET LE GAIN DE TEMPS EST NUL, mesuré : ce projet tourne dans le lot `publics`, à 105 s,
       * le plus court des huit, quand le chemin critique de la CI est le job des tests Nuxt à
       * 7 min 56. Ce qui est gagné est la disparition d'un piège, pas des secondes.
       */
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-FR',
        storageState: authFile,
      },
    },
    // La spec de la langue, sur SON compte — cf. `authFileLangue`.
    {
      name: 'authenticated-langue',
      testMatch: /authenticated\/langue-du-profil\.spec\.ts/,
      dependencies: ['setup-langue'],
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-FR',
        storageState: authFileLangue,
      },
    },
    // Tests de gestion d'édition (dépend du data setup, séquentiel car état partagé)
    {
      name: 'edition-management',
      testMatch: /edition-management\//,
      dependencies: ['data-setup'],
      fullyParallel: false,
      // Et un seul travailleur, explicitement : `fullyParallel: false` n'ordonne que les tests
      // d'un même fichier, alors que tout ce projet se partage UNE édition. La sérialisation
      // tenait jusqu'ici par le `workers: 1` global, qui vient de tomber.
      workers: 1,
      // 2 minutes par test : certains tests font expect.poll(30s) + toPass(60s)
      // pour rendre déterministes les assertions sur la page publique des
      // bénévoles (cf. volunteers.spec.ts). Le défaut 30s coupe avant.
      timeout: 120000,
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-FR',
        storageState: authFile,
      },
    },
  ],
})

export { authFile, authFileLangue, credentialsFile, conventionStateFile }
