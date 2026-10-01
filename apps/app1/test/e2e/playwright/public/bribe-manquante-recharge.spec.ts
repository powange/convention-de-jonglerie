import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

const BASE = 'http://localhost:3000'

/**
 * Une bribe JavaScript qui ne se charge pas doit faire RECHARGER la page.
 *
 * ⚠️ SIGNALÉ EN PRODUCTION par capture d'écran : « 500 — Internal Server Error — Failed to fetch
 * dynamically imported module: https://juggling-convention.com/_nuxt/….js », sur mobile, chez
 * certains visiteurs seulement.
 *
 * LA CAUSE DE FOND : un déploiement retire les anciennes bribes du serveur. Un onglet resté ouvert
 * — cas courant sur mobile — en demande une qui n'existe plus. Le cache de Cloudflare la sert
 * encore là où il l'a gardée, pas ailleurs : d'où des visiteurs touchés et d'autres non, sans
 * logique apparente. S'y ajoutent les coupures réseau et les extensions qui bloquent des requêtes.
 *
 * LE DÉFAUT : `emitRouteChunkError` valait `'automatic'`, dont le greffon ne recharge que depuis
 * `router.onError` — lu dans `nuxt/dist/app/plugins/chunk-reload.client.js`. Une bribe qui échoue
 * HORS navigation de route n'était rattrapée par personne. `'automatic-immediate'` branche
 * `app:chunkError` directement et recharge la route courante, quelle que soit l'origine.
 *
 * 📍 CE QUE CE LOT MESURE, ET CE QU'IL NE MESURE PAS. Il éprouve le RECHARGEMENT sur un vrai
 * `vite:preloadError` déclenché hors navigation — le mécanisme même que le réglage change. Il ne
 * reproduit PAS l'écran 500 de la capture : sur les pages publiques, les seuls imports dynamiques
 * dont l'échec remonte sans être attrapé sont les deux `defineAsyncComponent` de l'accueil, et
 * leurs bribes sont déjà en mémoire au moment du clic. Dire que ce lot reproduit le 500 serait faux.
 */
test.describe('Une bribe manquante ne doit pas afficher de 500', () => {
  /*
   * ⚠️ CE LOT N'A DE SENS QUE SUR UNE APPLICATION CONSTRUITE, et il le dit plutôt que de passer à
   * vide. En développement, Vite sert des modules ESM natifs : les `import()` ne sont pas
   * enveloppés dans `__vitePreload`, donc aucun `vite:preloadError` n'est émis, donc Nuxt n'émet
   * aucun `app:chunkError` et aucun rechargement n'a lieu. Il lit d'ailleurs `.output/`, qui
   * n'existe qu'après un build.
   */
  test.skip(
    !process.env.CI,
    'Le serveur de développement ne passe pas par vite:preloadError : ce lot exige une application construite.'
  )

  /**
   * Les bribes que `LazyFullCalendar` importe dynamiquement, LUES DANS LE BUILD.
   *
   * ⚠️⚠️ POURQUOI PAS UN NOM ÉCRIT EN DUR : les bribes sont hachées par leur contenu, donc tout nom
   * figé devient faux au premier changement — et un `page.route` qui ne correspond plus ne coupe
   * rien, ce qui rendrait ce lot VERT à vide. Le déduire du build à chaque exécution est la seule
   * forme qui ne peut pas pourrir en silence, et l'assertion ci-dessous échoue bruyamment si la
   * déduction ne trouve rien.
   *
   * La ficelle : le composant porte son propre message d'erreur, que la minification conserve
   * puisque c'est une chaîne. Son import dynamique garde la forme émise par Vite,
   * `T(()=>import("./XXXX.js"), __vite__mapDeps(…))`.
   */
  const bribesDeFullCalendar = (): string[] => {
    const dossier = resolve(process.cwd(), '.output/public/_nuxt')
    const bribes = new Set<string>()
    for (const fichier of readdirSync(dossier).filter((f) => f.endsWith('.js'))) {
      const source = readFileSync(join(dossier, fichier), 'utf8')
      // Sans les deux-points : attrape aussi « Error loading FullCalendar plugins », donc la bribe
      // du composant ET celles des greffons que l'agenda charge à part. Mesuré sur un build réel :
      // quatre bribes porteuses, neuf cibles distinctes. Plusieurs chances indépendantes que le
      // clic en demande une, plutôt qu'une seule qu'un regroupement futur pourrait faire
      // disparaître.
      if (!source.includes('Error loading FullCalendar')) continue
      for (const m of source.matchAll(/import\(`\.\/([A-Za-z0-9_$-]+\.js)`\)/g)) bribes.add(m[1]!)
    }
    return [...bribes]
  }

  /**
   * Rend ces bribes inaccessibles, DÈS LE DÉPART et non dans une fenêtre de temps.
   *
   * ⚠️⚠️ LES TROIS ERREURS DÉJÀ PAYÉES ICI, en trois passages de CI, parce qu'on ne mesurait pas.
   *
   * 1. Couper « la première bribe demandée » coupe le script d'ENTRÉE. L'application ne démarre
   *    alors pas du tout : aucun greffon, aucun `app:chunkError`, et le HTML rendu par le serveur
   *    reste à l'écran. La page paraît saine, et les assertions passaient au vert sans rien
   *    éprouver. Seul un témoin de rechargement l'a révélé.
   * 2. Armer la coupure APRÈS l'hydratation puis cliquer ne coupait rien : la trace Playwright des
   *    échecs montre zéro requête après le clic. L'accueil récupère près de 400 bribes au
   *    démarrage — celles des vues carte et agenda comprises —, si bien que leur `import()` se
   *    résolvait depuis le registre de modules du navigateur. Un import dynamique ne garantit
   *    aucune requête réseau.
   * 3. Changer de composant n'y change rien : c'est le PRÉCHARGEMENT qu'il faut contrer.
   *
   * 📍 D'OÙ LE BLOCAGE DÈS LE DÉPART, et c'est sans danger pour le démarrage — vérifié dans le
   * helper de Vite : les dépendances sont préchargées par un `<link>` dont seul le CSS rejette,
   * `.filter((p) => p !== void 0)` écartant les autres. Un préchargement JS qui échoue est donc
   * SILENCIEUX. Il laisse en revanche le registre de modules vide, et c'est tout ce qu'on veut :
   * l'`import()` du clic part alors pour de bon, échoue, et `__vitePreload` émet l'événement.
   *
   * 📍 ON REND LA MAIN DÈS QUE LE NAVIGATEUR REDEMANDE LE DOCUMENT, pour que le rechargement
   * aboutisse — mais seulement après avoir coupé quelque chose, sans quoi la requête du document
   * initial désarmerait tout avant d'avoir commencé. Ce signal-là, et pas `framenavigated`, parce
   * qu'un `router.push` — ce que fait le changement de `?view=` — n'émet aucune requête de document.
   */
  const rendreInaccessible = async (page: Page, bribes: string[], { durable = false } = {}) => {
    let actif = true
    const coupees = new Set<string>()
    if (!durable) {
      page.on('request', (requete) => {
        if (requete.resourceType() === 'document' && coupees.size > 0) actif = false
      })
    }
    await page.route(/\/_nuxt\/.*\.js(\?.*)?$/, async (route) => {
      const nom = route.request().url().split('/_nuxt/')[1]?.split('?')[0]
      if (actif && nom && bribes.includes(nom)) {
        coupees.add(nom)
        await route.abort('failed')
        return
      }
      await route.continue()
    })
    return coupees
  }

  /** Ouvre l'accueil et attend que l'application ait réellement démarré côté client. */
  const ouvrirLAccueilHydrate = async (page: Page) => {
    await page.goto(`${BASE}/`)
    // Nuxt pose `window.useNuxtApp` au démarrage du client (`nuxt/dist/app/nuxt.js`) : c'est le
    // témoin d'hydratation le moins coûteux, et le seul qui distingue la page rendue par le
    // serveur de l'application vivante.
    await page.waitForFunction(() => 'useNuxtApp' in window, null, { timeout: 60000 })
    // L'accueil récupère près de 400 bribes au démarrage : les laisser finir, pour que le clic
    // soit bien la seule chose qui déclenche encore une requête.
    await page.waitForLoadState('networkidle', { timeout: 30000 })
  }

  test('🔬 recharge la page quand une bribe échoue hors navigation', async ({ page }) => {
    const bribes = bribesDeFullCalendar()
    expect(
      bribes.length,
      'aucune bribe déduite du build : la ficelle de détection a cessé de fonctionner, et ce lot ne prouverait plus rien'
    ).toBeGreaterThan(0)

    const coupees = await rendreInaccessible(page, bribes)
    await ouvrirLAccueilHydrate(page)

    await page.evaluate(() => {
      ;(window as unknown as { __temoinAvantRechargement?: boolean }).__temoinAvantRechargement =
        true
    })

    /*
     * La vue agenda monte `UiLazyFullCalendar`, qui importe FullCalendar dans sa propre bribe —
     * celle qu'on vient de rendre inaccessible. C'est un `import()` SANS navigation de route, donc
     * le cas que `'automatic'` ne rattrapait pas, et le seul qui discrimine ce lot.
     */
    await page.locator('[data-vue-agenda]').click()

    /*
     * 🔬 L'ASSERTION QUI PORTE LE POINT, en attente plutôt qu'après une temporisation : le témoin
     * posé dans la fenêtre ne survit pas à un nouveau document. S'il est encore là au bout de
     * vingt secondes, c'est qu'aucun rechargement n'a eu lieu.
     */
    await page.waitForFunction(
      () =>
        (window as unknown as { __temoinAvantRechargement?: boolean }).__temoinAvantRechargement ===
        undefined,
      null,
      { timeout: 20000 }
    )

    expect(coupees.size, `bribes coupées : ${[...coupees].join(', ')}`).toBeGreaterThan(0)

    /*
     * 🔬 LE PENDANT POSITIF, et il est nécessaire : une page blanche satisferait l'assertion
     * précédente. Après le rechargement la coupure est rendue, donc l'agenda doit cette fois
     * s'afficher pour de bon — `.fc` est la racine que FullCalendar pose lui-même. S'il avait
     * échoué, `LazyFullCalendar` afficherait son message d'erreur à la place.
     */
    await expect(page.locator('.fc')).toBeVisible({ timeout: 30000 })
  })

  test('ne recharge pas en BOUCLE quand la bribe reste inaccessible', async ({ page }) => {
    /*
     * ⚠️ LA SEULE OBJECTION SÉRIEUSE à ce réglage, et la raison pour laquelle il est sûr : si une
     * bribe est bloquée durablement — une extension de navigateur, par exemple —, le rechargement
     * ne doit pas se répéter sans fin. `reloadNuxtApp` pose `nuxt:reload` en `sessionStorage` et
     * refuse de recharger deux fois le même chemin en moins de dix secondes.
     *
     * 📍 CE CAS A BESOIN QUE L'APPLICATION REDÉMARRE pour éprouver la garde : on ne bloque donc que
     * les bribes de FullCalendar, et tout le reste passe. Couper tout laisserait l'application
     * morte au deuxième chargement, et le compteur resterait bas sans que la garde y soit pour rien.
     *
     * 📍 CE QUE CELA CONCÈDE : au second échec, l'erreur n'est plus rattrapée. L'agenda reste alors
     * sur son message d'erreur, ce qui est le comportement voulu — mieux vaut une page dégradée
     * qu'une boucle de rechargements.
     */
    const bribes = bribesDeFullCalendar()
    expect(bribes.length, 'aucune bribe déduite du build').toBeGreaterThan(0)

    let documents = 0
    page.on('request', (requete) => {
      if (requete.resourceType() === 'document') documents++
    })

    const coupees = await rendreInaccessible(page, bribes, { durable: true })
    await ouvrirLAccueilHydrate(page)

    await page.locator('[data-vue-agenda]').click()
    await page.waitForTimeout(15000)

    expect(coupees.size, 'une bribe doit bien avoir été coupée').toBeGreaterThan(0)
    // Le chargement initial, plus UN rechargement. La marge laisse passer une requête de document
    // supplémentaire sans laisser passer une boucle, qui en produirait des dizaines.
    expect(documents, `requêtes de document observées : ${documents}`).toBeLessThanOrEqual(3)
  })
})
