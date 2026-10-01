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
 * `vite:preloadError` déclenché hors navigation — c'est exactement le mécanisme que le réglage
 * change. Il ne reproduit PAS l'écran 500 de la capture : sur les pages publiques, les seuls
 * imports dynamiques dont l'échec remonte sans être attrapé sont les deux `defineAsyncComponent`
 * de l'accueil, et la mesure ci-dessous montre que leurs bribes sont déjà en mémoire au moment du
 * clic. Dire que ce lot reproduit le 500 serait faux.
 */
test.describe('Une bribe manquante ne doit pas afficher de 500', () => {
  /*
   * ⚠️ CE LOT N'A DE SENS QUE SUR UNE APPLICATION CONSTRUITE, et il le dit plutôt que de passer à
   * vide. En développement, Vite sert des modules ESM natifs : les `import()` ne sont pas
   * enveloppés dans `__vitePreload`, donc aucun `vite:preloadError` n'est émis, donc Nuxt n'émet
   * aucun `app:chunkError` et aucun rechargement n'a lieu.
   *
   * En CI, l'application est pré-construite (voir le commentaire du projet `setup` dans
   * `playwright.config.ts`) : les bribes y sont hachées et le chemin de préchargement est celui de
   * la production. C'est là que ces cas mordent.
   */
  test.skip(
    !process.env.CI,
    'Le serveur de développement ne passe pas par vite:preloadError : ce lot exige une application construite.'
  )

  /**
   * Arme une coupure des bribes `/_nuxt/*.js`, à déclencher au moment voulu.
   *
   * ⚠️⚠️ LES DEUX ERREURS DÉJÀ PAYÉES ICI, en deux passages de CI, parce qu'on ne mesurait pas.
   *
   * 1. Couper « la première bribe demandée » coupe le script d'ENTRÉE. L'application ne démarre
   *    alors pas du tout : aucun greffon, aucun `app:chunkError`, et le HTML rendu par le serveur
   *    reste à l'écran. La page paraît saine et le cas « pas de 500 » passait au vert sans rien
   *    éprouver. Seul un témoin de rechargement l'a révélé.
   * 2. Couper au clic sur la vue CARTE ne coupait rien : la trace Playwright de l'échec montre
   *    zéro requête après le clic, alors que la carte s'affichait. L'accueil précharge 396 bribes
   *    sur les 768 du build — celle de `HomeMap` comprise. Un `defineAsyncComponent` ne garantit
   *    donc pas une bribe à récupérer.
   *
   * 📍 D'OÙ LA VUE AGENDA, choisie sur mesure dans la sortie de build : `LazyFullCalendar` est
   * préchargé mais importe `@fullcalendar/vue3` dans sa propre bribe, absente du chargement
   * initial, et le chargeur de greffons de l'agenda en importe quatre autres, toutes absentes.
   * Cinq bribes à récupérer, toutes enveloppées dans `__vitePreload`.
   *
   * 📍 ON REND LA MAIN DÈS QUE LE NAVIGATEUR REDEMANDE LE DOCUMENT : c'est le rechargement, et il
   * lui faut ses bribes pour aboutir. Ce signal-là, et pas `framenavigated`, parce qu'un
   * `router.push` — ce que fait le changement de `?view=` — est une navigation sans requête de
   * document : elle ne doit pas désarmer la coupure.
   */
  const armerLaCoupure = async (page: Page, { durable = false } = {}) => {
    let couper = false
    const coupees = new Set<string>()
    page.on('request', (requete) => {
      if (requete.resourceType() === 'document') couper = false
    })
    await page.route(/\/_nuxt\/.*\.js(\?.*)?$/, async (route) => {
      const url = route.request().url()
      // `durable` garde les MÊMES bribes inaccessibles d'un chargement à l'autre : c'est ce qu'il
      // faut pour éprouver la garde anti-boucle, et il ne faut surtout pas de cela ailleurs.
      if (couper || (durable && coupees.has(url))) {
        coupees.add(url)
        await route.abort('failed')
        return
      }
      await route.continue()
    })
    return { armer: () => (couper = true), coupees }
  }

  /** Ouvre l'accueil et attend que l'application ait réellement démarré côté client. */
  const ouvrirLAccueilHydrate = async (page: Page) => {
    await page.goto(`${BASE}/`)
    // Nuxt pose `window.useNuxtApp` au démarrage du client (`nuxt/dist/app/nuxt.js`) : c'est le
    // témoin d'hydratation le moins coûteux, et le seul qui distingue la page rendue par le
    // serveur de l'application vivante.
    await page.waitForFunction(() => 'useNuxtApp' in window, null, { timeout: 60000 })
    /*
     * L'accueil récupère des centaines de bribes au démarrage. Les laisser finir est indispensable
     * ici : sans cela la coupure tomberait sur l'une d'elles, et l'on éprouverait un échec au
     * chargement initial au lieu d'un échec après démarrage — les deux ne passent pas par le même
     * greffon, et c'est tout l'objet de ce lot.
     */
    await page.waitForLoadState('networkidle', { timeout: 30000 })
  }

  test('🔬 recharge la page quand une bribe échoue hors navigation', async ({ page }) => {
    const { armer, coupees } = await armerLaCoupure(page)
    await ouvrirLAccueilHydrate(page)

    await page.evaluate(() => {
      ;(window as unknown as { __temoinAvantRechargement?: boolean }).__temoinAvantRechargement =
        true
    })

    armer()
    await page.locator('[data-vue-agenda]').click()

    /*
     * 🔬 L'ASSERTION QUI PORTE LE POINT, et elle est en attente plutôt qu'après une temporisation :
     * le témoin posé dans la fenêtre ne survit pas à un nouveau document. S'il est encore là au
     * bout de vingt secondes, c'est qu'aucun rechargement n'a eu lieu — ce que disait la CI sur
     * les deux versions précédentes de ce fichier.
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
     * précédente. Après le rechargement, la coupure est rendue, donc l'agenda doit cette fois
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
     * 📍 CE CAS A BESOIN QUE L'APPLICATION REDÉMARRE pour éprouver la garde : on bloque donc
     * durablement les seules bribes de l'agenda et l'on laisse passer tout le reste. Couper tout
     * laisserait l'application morte au deuxième chargement, et le compteur resterait bas sans que
     * la garde y soit pour rien.
     *
     * 📍 CE QUE CELA CONCÈDE : au second échec, l'erreur n'est plus rattrapée. L'agenda reste alors
     * sur son message d'erreur, ce qui est le comportement voulu — mieux vaut une page dégradée
     * qu'une boucle de rechargements.
     */
    let documents = 0
    page.on('request', (requete) => {
      if (requete.resourceType() === 'document') documents++
    })

    const { armer, coupees } = await armerLaCoupure(page, { durable: true })
    await ouvrirLAccueilHydrate(page)

    armer()
    await page.locator('[data-vue-agenda]').click()
    await page.waitForTimeout(15000)

    expect(coupees.size, 'une bribe doit bien avoir été coupée').toBeGreaterThan(0)
    // Le chargement initial, plus UN rechargement. La marge laisse passer une requête de document
    // supplémentaire sans laisser passer une boucle, qui en produirait des dizaines.
    expect(documents, `requêtes de document observées : ${documents}`).toBeLessThanOrEqual(3)
  })
})
