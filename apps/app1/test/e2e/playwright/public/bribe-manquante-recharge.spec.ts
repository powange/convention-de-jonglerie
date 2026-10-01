import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

const BASE = 'http://localhost:3000'

/**
 * Une bribe JavaScript qui ne se charge pas doit faire RECHARGER la page, pas afficher un 500.
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
 * `router.onError` — vérifié dans `nuxt/dist/app/plugins/chunk-reload.client.js`. Une bribe qui
 * échoue HORS navigation de route n'était donc rattrapée par personne : l'erreur était relancée
 * par `__vitePreload`, remontait jusqu'au gestionnaire d'erreur de Vue, et donnait la page 500 de
 * la capture. `'automatic-immediate'` branche `app:chunkError` directement et recharge la route
 * courante, quelle que soit l'origine de l'échec.
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
   * ⚠️⚠️ POURQUOI PAS « LA PREMIÈRE BRIBE DEMANDÉE », comme le faisait la version précédente de ce
   * fichier : la première est le script d'ENTRÉE. La couper empêche l'application de démarrer —
   * aucun greffon ne tourne, aucun `app:chunkError` n'est émis, et le HTML rendu par le serveur
   * reste affiché. La page paraît alors parfaitement saine : le cas « pas de 500 » passait au vert
   * sans rien éprouver, et seul le témoin de rechargement a révélé qu'il ne se passait rien.
   *
   * 📍 ON COUPE DONC APRÈS LE DÉMARRAGE, sur un `import()` qui n'est pas une navigation de route :
   * c'est précisément ce que `'automatic'` laissait passer, et c'est le cas de la production.
   *
   * 📍 ET ON REND LA MAIN DÈS QUE LE NAVIGATEUR REDEMANDE LE DOCUMENT : c'est le rechargement, et
   * il lui faut ses bribes pour aboutir. Ce signal-là, et pas `framenavigated`, parce qu'un
   * `router.replace` — ce que fait le changement de `?view=` — est une navigation sans requête de
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
      // `durable` garde la MÊME bribe inaccessible d'un chargement à l'autre : c'est ce qu'il faut
      // pour éprouver la garde anti-boucle, et il ne faut surtout pas de cela ailleurs.
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
     * Les préchargements de route de `NuxtLink` partent juste après l'hydratation. Les laisser
     * finir évite que la coupure ne tombe sur l'un d'eux plutôt que sur la bribe de la carte.
     * Ce n'est que de l'hygiène : un préchargement coupé produirait lui aussi un `app:chunkError`
     * hors navigation, donc le même point. D'où le `catch` plutôt qu'un échec.
     */
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  }

  test('🔬 recharge la page au lieu d’afficher « Internal Server Error »', async ({ page }) => {
    const { armer, coupees } = await armerLaCoupure(page)
    await ouvrirLAccueilHydrate(page)

    await page.evaluate(() => {
      ;(window as unknown as { __temoinAvantRechargement?: boolean }).__temoinAvantRechargement =
        true
    })

    /*
     * La vue « carte » de l'accueil est un `defineAsyncComponent(() => import('~/components/
     * HomeMap.vue'))` : le clic déclenche un `import()` qui n'est PAS une navigation de route.
     * C'est le cas que `'automatic'` ne rattrapait pas, et donc le seul qui discrimine ce lot.
     */
    armer()
    await page.locator('[data-vue-carte]').click()

    /*
     * 🔬 L'ASSERTION QUI PORTE LE POINT, et elle est en attente plutôt qu'après une temporisation :
     * le témoin posé dans la fenêtre ne survit pas à un nouveau document. S'il est encore là au
     * bout de vingt secondes, c'est qu'aucun rechargement n'a eu lieu — ce que disait la CI avant
     * cette réécriture.
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
     * Le pendant négatif : avant le correctif, c'est ici que se trouvait le 500 de la capture.
     * Il ne suffit pas à lui seul — une page blanche ne le contient pas davantage —, d'où
     * l'assertion de contenu qui suit.
     */
    const texte = (await page.textContent('body')) ?? ''
    expect(texte).not.toContain('Internal Server Error')
    expect(texte).not.toContain('Failed to fetch dynamically imported module')

    // Et la page est de nouveau utilisable : la coupure a été rendue avant le rechargement, donc
    // la bribe de la carte est arrivée cette fois.
    await expect(page.locator('[data-vue-carte]')).toBeVisible({ timeout: 20000 })
  })

  test('ne recharge pas en BOUCLE quand la bribe reste inaccessible', async ({ page }) => {
    /*
     * ⚠️ LA SEULE OBJECTION SÉRIEUSE à ce réglage, et la raison pour laquelle il est sûr : si une
     * bribe est bloquée durablement — une extension de navigateur, par exemple —, le rechargement
     * ne doit pas se répéter sans fin. `reloadNuxtApp` pose `nuxt:reload` en `sessionStorage` et
     * refuse de recharger deux fois le même chemin en moins de dix secondes.
     *
     * 📍 CE CAS A BESOIN QUE L'APPLICATION REDÉMARRE pour éprouver la garde : on bloque donc la
     * seule bribe de la carte, durablement, et l'on laisse passer tout le reste. Couper tout
     * laisserait l'application morte au deuxième chargement, et le compteur resterait bas sans que
     * la garde y soit pour rien.
     *
     * 📍 CE QUE CELA CONCÈDE : au second échec, l'erreur n'est plus rattrapée et la page d'erreur
     * peut apparaître. C'est le comportement voulu — mieux vaut une erreur visible qu'une boucle —,
     * et c'est pourquoi ce cas ne vérifie PAS l'absence du 500, contrairement au précédent.
     */
    let documents = 0
    page.on('request', (requete) => {
      if (requete.resourceType() === 'document') documents++
    })

    const { armer, coupees } = await armerLaCoupure(page, { durable: true })
    await ouvrirLAccueilHydrate(page)

    armer()
    await page.locator('[data-vue-carte]').click()
    await page.waitForTimeout(12000)

    expect(coupees.size, 'une bribe doit bien avoir été coupée').toBeGreaterThan(0)
    // Le chargement initial, plus UN rechargement. La marge laisse passer une requête de document
    // supplémentaire sans laisser passer une boucle, qui en produirait des dizaines.
    expect(documents, `requêtes de document observées : ${documents}`).toBeLessThanOrEqual(3)
  })
})
