import { expect, test } from '@nuxt/test-utils/playwright'

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
 * LE DÉFAUT : `emitRouteChunkError` valait `'automatic'`, dont le greffon n'agit que depuis
 * `router.onError`. Une bribe qui échoue AILLEURS — au chargement initial, sur un composant
 * paresseux, sur un `import()` d'une page déjà ouverte — n'était rattrapée par personne, et
 * l'erreur remontait jusqu'à la page d'erreur. `'automatic-immediate'` recharge la route courante
 * dès qu'une bribe échoue, quelle qu'en soit l'origine.
 *
 * 📍 UN SEUL RECHARGEMENT, PAS UNE BOUCLE : `reloadNuxtApp` pose un marqueur `nuxt:reload` en
 * `sessionStorage` et refuse de recharger deux fois le même chemin en moins de dix secondes.
 * C'est ce qui rend ce réglage sûr même quand la bribe est durablement inaccessible, et c'est
 * vérifié ici.
 */
test.describe('Une bribe manquante ne doit pas afficher de 500', () => {
  /*
   * ⚠️ CE LOT N'A DE SENS QUE SUR UNE APPLICATION CONSTRUITE, et il le dit plutôt que de passer à
   * vide. En développement, Vite sert des modules ESM natifs : un `import()` qui échoue ne passe
   * PAS par `vite:preloadError`, donc Nuxt n'émet aucun `app:chunkError` et aucun rechargement
   * n'a lieu. Mesuré : sur le serveur de développement, le cas du rechargement échoue tandis que
   * les deux autres passent — dont l'un pour une mauvaise raison, une page blanche ne contenant
   * pas davantage « Internal Server Error ».
   *
   * En CI, l'application est pré-construite (voir le commentaire du projet `setup` dans
   * `playwright.config.ts`) : les bribes y sont hachées et le chemin de préchargement est celui de
   * la production. C'est là que ces trois cas mordent.
   */
  test.skip(
    !process.env.CI,
    'Le serveur de développement ne passe pas par vite:preloadError : ce lot exige une application construite.'
  )

  /**
   * Coupe la PREMIÈRE bribe demandée après le document, puis laisse tout passer.
   *
   * On ne coupe qu'une fois : le rechargement qui suit doit pouvoir aboutir, sinon on éprouverait
   * la garde anti-boucle au lieu du rechargement lui-même.
   */
  const couperUneBribe = async (page: import('@playwright/test').Page) => {
    let coupees = 0
    await page.route(/\/_nuxt\/.*\.js(\?.*)?$/, async (route) => {
      if (coupees === 0) {
        coupees++
        await route.abort('failed')
        return
      }
      await route.continue()
    })
    return () => coupees
  }

  test('🔬 recharge au lieu de montrer « Internal Server Error »', async ({ page }) => {
    const compteur = await couperUneBribe(page)

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    // Laisser au greffon le temps de voir l'échec et de relancer la page.
    await page.waitForTimeout(6000)

    expect(compteur(), 'une bribe doit bien avoir été coupée').toBeGreaterThan(0)

    /*
     * L'assertion qui porte le point. Avant le correctif, cette page portait le 500 de la capture ;
     * après, le rechargement l'a remplacée par la page d'accueil.
     */
    const texte = (await page.textContent('body')) ?? ''
    expect(texte).not.toContain('Internal Server Error')
    expect(texte).not.toContain('Failed to fetch dynamically imported module')
  })

  test('🔬 le rechargement a bien eu lieu, et la page est utilisable', async ({ page }) => {
    /*
     * Le pendant positif, et il est nécessaire : une page BLANCHE ne contient pas non plus
     * « Internal Server Error ». On vérifie donc qu'un rechargement a eu lieu — le témoin posé
     * dans la fenêtre ne survit pas à une navigation — et que le contenu est revenu.
     */
    const compteur = await couperUneBribe(page)

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      ;(window as unknown as { __temoinAvantRechargement?: boolean }).__temoinAvantRechargement =
        true
    })

    await page.waitForTimeout(6000)

    const temoin = await page.evaluate(
      () => (window as unknown as { __temoinAvantRechargement?: boolean }).__temoinAvantRechargement
    )
    expect(compteur(), 'une bribe doit bien avoir été coupée').toBeGreaterThan(0)
    expect(
      temoin,
      'le témoin doit avoir disparu, signe que la page a été rechargée'
    ).toBeUndefined()

    // Et la page rend quelque chose : l'en-tête du site suffit à le dire.
    await expect(page.locator('body')).toContainText(/\p{L}/u, { timeout: 15000 })
  })

  test('ne recharge pas en BOUCLE quand la bribe reste inaccessible', async ({ page }) => {
    /*
     * ⚠️ LA SEULE OBJECTION SÉRIEUSE à ce réglage, et la raison pour laquelle il est sûr : si une
     * bribe est bloquée durablement — une extension de navigateur, par exemple —, le rechargement
     * ne doit pas se répéter sans fin. `reloadNuxtApp` pose un marqueur en `sessionStorage` valable
     * dix secondes par chemin.
     *
     * On coupe donc TOUTES les bribes, et l'on compte les chargements du document.
     */
    let documents = 0
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) documents++
    })
    await page.route(/\/_nuxt\/.*\.js(\?.*)?$/, (route) => route.abort('failed'))

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(8000)

    // Le chargement initial, plus UN rechargement au plus. Sans la garde, ce compteur s'emballerait.
    expect(documents, `navigations observées : ${documents}`).toBeLessThanOrEqual(3)
  })
})
