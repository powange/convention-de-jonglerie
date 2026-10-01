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
 * LE DÉFAUT, corrigé par #661 : `emitRouteChunkError` valait `'automatic'`, dont le greffon ne
 * recharge que depuis `router.onError` — lu dans `nuxt/dist/app/plugins/chunk-reload.client.js`.
 * Une bribe qui échoue HORS navigation de route n'était rattrapée par personne.
 * `'automatic-immediate'` branche `app:chunkError` directement.
 *
 * 📍 CE QUE CE LOT MESURE : le rechargement sur un vrai `vite:preloadError` déclenché hors
 * navigation. Il ne reproduit PAS l'écran 500 lui-même — sur les pages publiques, les seuls
 * imports dont l'échec remonte sans être attrapé sont les `defineAsyncComponent` de l'accueil,
 * dont les bribes sont parfois déjà chargées. Le dire serait faux.
 */
test.describe('Une bribe manquante ne doit pas afficher de 500', () => {
  /*
   * ⚠️ CE LOT N'A DE SENS QUE SUR UNE APPLICATION CONSTRUITE. En développement, Vite sert des
   * modules ESM natifs : les `import()` ne passent pas par `__vitePreload`, donc aucun
   * `vite:preloadError`, donc aucun `app:chunkError`. Mesuré par sonde : en dev l'interception
   * fonctionne et les bribes partent bien au clic, mais aucun événement n'est émis — il n'y a
   * donc rien à rattraper, et rien à éprouver.
   */
  test.skip(
    !process.env.CI,
    'Le serveur de développement ne passe pas par vite:preloadError : ce lot exige une application construite.'
  )

  /*
   * ⚠️ LA LIMITE PAR DÉFAUT DE PLAYWRIGHT EST DE TRENTE SECONDES, et elle ne suffit pas ici : le
   * gestionnaire RÉCUPÈRE chaque bribe pour en lire les octets, et l'accueil en demande près de
   * quatre cents. Mesuré par sonde contre le serveur de développement : 12,7 s de chargement pour
   * 938 bribes récupérées et resservies, la page restant parfaitement fonctionnelle. Sans ce
   * relèvement, le lot échouerait sur le temps et non sur ce qu'il mesure — ce qui est la pire
   * façon d'échouer, puisqu'elle ressemble à un défaut de l'application.
   */
  test.describe.configure({ timeout: 150000 })

  /**
   * Le marqueur qui dit qu'une bribe porte le code de FullCalendar.
   *
   * ⚠️⚠️ ON RECONNAÎT LA BRIBE À SON CONTENU, PLUS À SON NOM, et c'est la troisième façon de s'y
   * prendre après deux échecs mesurés :
   *
   *   1. Lire les cibles des expressions `import()` dans le build ne retenait que des emballages.
   *      Vite compile un import dynamique en
   *      `T(() => import("./X.js"), __vite__mapDeps([0, 1, 2]), import.meta.url)` : la cible fait
   *      1,8 Ko, et c'est `__vite__mapDeps` qui désigne la bibliothèque — 177 Ko.
   *   2. Lire AUSSI `__vite__mapDeps` donnait les bons noms (vérifié hors ligne sur la sortie de
   *      build de la CI), et pourtant aucune requête ne correspondait à l'exécution. Les noms
   *      déduits hors ligne et les noms demandés en vol ne coïncidaient pas, pour une raison que
   *      la trace n'a pas livrée.
   *
   * Le contenu, lui, ne dépend ni d'un hachage, ni d'une table de dépendances, ni du dossier
   * courant du processus : on inspecte les octets servis. Ce sont des noms de CLASSES que
   * FullCalendar écrit dans le DOM, donc présents dans son code quoi qu'en fasse la minification.
   *
   * 📍 ET LE RUNTIME DE VUE EST ÉCARTÉ PAR CONSTRUCTION : il est dans la même table de
   * dépendances, il est référencé par 299 des 768 bribes du build, et le bloquer casserait la page
   * entière. Il ne porte aucun de ces marqueurs.
   */
  const MARQUEURS_FULLCALENDAR = ['fc-daygrid', 'fc-toolbar', 'fc-scrollgrid', 'fc-list']

  /**
   * Rend ces bribes inaccessibles, DÈS LE DÉPART et non dans une fenêtre de temps.
   *
   * 📍 POURQUOI DÈS LE DÉPART : l'accueil précharge près de 400 des 768 bribes du build. Armer la
   * coupure après l'hydratation n'avait donc souvent plus rien à couper — mesuré, zéro requête
   * après le clic sur deux passages. Bloquer dès le départ est sans danger pour le démarrage :
   * vérifié dans le helper de Vite, les dépendances sont préchargées par un `<link>` dont seul le
   * CSS rejette (`.filter((p) => p !== void 0)` écarte les autres), donc un préchargement JS qui
   * échoue est SILENCIEUX. Il laisse en revanche le registre de modules vide, et c'est tout ce
   * qu'on veut : l'`import()` du clic part alors pour de bon et échoue.
   *
   * 📍 L'interception elle-même a été éprouvée par sonde contre le serveur de développement :
   * `page.route` attrape bien un `<link rel="modulepreload">` créé par script, un
   * `<link rel="preload" as="script">`, et un `import()` dynamique — ce dernier rejetant avec le
   * message exact de la production.
   *
   * 📍 ON REND LA MAIN DÈS QUE LE NAVIGATEUR REDEMANDE LE DOCUMENT, pour que le rechargement
   * aboutisse — mais seulement après avoir coupé quelque chose, sans quoi la requête du document
   * initial désarmerait tout avant d'avoir commencé. Ce signal-là, et pas `framenavigated`, parce
   * qu'un `router.push` — ce que fait le changement de `?view=` — n'émet aucune requête de document.
   */
  const rendreInaccessible = async (page: Page, { durable = false } = {}) => {
    let actif = true
    const coupees = new Set<string>()
    const vues: string[] = []
    if (!durable) {
      page.on('request', (requete) => {
        if (requete.resourceType() === 'document' && coupees.size > 0) actif = false
      })
    }
    await page.route(/\/_nuxt\/.*\.js(\?.*)?$/, async (route) => {
      const nom = route.request().url().split('/_nuxt/')[1]?.split('?')[0] ?? '?'
      vues.push(nom)
      if (!actif) {
        await route.continue()
        return
      }
      // On récupère la bribe pour LIRE ses octets. Coûteux en apparence, mais c'est le seul
      // critère qui ne puisse pas se périmer — et les bribes sont servies depuis localhost.
      const reponse = await route.fetch()
      const corps = await reponse.text()
      if (MARQUEURS_FULLCALENDAR.some((marque) => corps.includes(marque))) {
        coupees.add(nom)
        await route.abort('failed')
        return
      }
      await route.fulfill({ response: reponse, body: corps })
    })
    return { coupees, vues }
  }

  /** Ouvre l'accueil et attend que l'application ait réellement démarré côté client. */
  const ouvrirLAccueilHydrate = async (page: Page) => {
    await page.goto(`${BASE}/`)
    // Nuxt pose `window.useNuxtApp` au démarrage du client (`nuxt/dist/app/nuxt.js`) : le témoin
    // d'hydratation le moins coûteux, et le seul qui distingue la page rendue par le serveur de
    // l'application vivante.
    await page.waitForFunction(() => 'useNuxtApp' in window, null, { timeout: 60000 })
    // Près de 400 bribes partent au démarrage : les laisser finir, pour que le clic soit bien la
    // seule chose qui déclenche encore une requête.
    await page.waitForLoadState('networkidle', { timeout: 30000 })
  }

  test('🔬 recharge la page quand une bribe échoue hors navigation', async ({ page }) => {
    const { coupees, vues } = await rendreInaccessible(page)
    await ouvrirLAccueilHydrate(page)

    await page.evaluate(() => {
      ;(window as unknown as { __temoinAvantRechargement?: boolean }).__temoinAvantRechargement =
        true
    })

    // La vue agenda monte `UiLazyFullCalendar`, qui importe la bibliothèque : un `import()` SANS
    // navigation de route, donc le cas que `'automatic'` ne rattrapait pas.
    await page.locator('[data-vue-agenda]').click()

    /*
     * 📍 CONTRÔLE DU DISPOSITIF AVANT LE COMPORTEMENT, et dans cet ordre délibérément : si aucune
     * bribe n'a été coupée, le lot n'éprouve rien, et il doit le dire tout de suite plutôt que de
     * laisser expirer vingt secondes sur un rechargement qui n'avait aucune raison d'arriver.
     * C'est ce renversement qui manquait aux quatre premières tentatives.
     */
    await expect
      .poll(() => coupees.size, { timeout: 15000, message: `bribes vues : ${vues.length}` })
      .toBeGreaterThan(0)

    /*
     * 🔬 L'ASSERTION QUI PORTE LE POINT : le témoin posé dans la fenêtre ne survit pas à un nouveau
     * document. S'il est encore là, aucun rechargement n'a eu lieu.
     */
    await page.waitForFunction(
      () =>
        (window as unknown as { __temoinAvantRechargement?: boolean }).__temoinAvantRechargement ===
        undefined,
      null,
      { timeout: 20000 }
    )

    expect(
      coupees.size,
      `bribes coupées : ${[...coupees].join(', ')} — sur ${vues.length} bribes vues`
    ).toBeGreaterThan(0)

    /*
     * 🔬 LE PENDANT POSITIF, nécessaire : une page blanche satisferait l'assertion précédente.
     * Après le rechargement la coupure est rendue, donc l'agenda doit s'afficher pour de bon —
     * `.fc` est la racine que FullCalendar pose lui-même.
     */
    await expect(page.locator('.fc')).toBeVisible({ timeout: 30000 })
  })

  test('ne recharge pas en BOUCLE quand la bribe reste inaccessible', async ({ page }) => {
    /*
     * ⚠️ LA SEULE OBJECTION SÉRIEUSE à ce réglage : une bribe bloquée durablement — une extension
     * de navigateur — ne doit pas provoquer un rechargement sans fin. `reloadNuxtApp` pose
     * `nuxt:reload` en `sessionStorage` et refuse de recharger deux fois le même chemin en moins
     * de dix secondes.
     *
     * 📍 CE CAS A BESOIN QUE L'APPLICATION REDÉMARRE pour éprouver la garde : on ne bloque que les
     * bribes de FullCalendar, tout le reste passe.
     *
     * 📍 CE QUE CELA CONCÈDE : au second échec, l'erreur n'est plus rattrapée et l'agenda reste sur
     * son message d'erreur. C'est le comportement voulu — mieux vaut une page dégradée qu'une
     * boucle.
     */
    let documents = 0
    page.on('request', (requete) => {
      if (requete.resourceType() === 'document') documents++
    })

    const { coupees, vues } = await rendreInaccessible(page, { durable: true })
    await ouvrirLAccueilHydrate(page)

    await page.locator('[data-vue-agenda]').click()
    // La garde vaut dix secondes : attendre un peu au-delà, sinon on ne verrait pas une boucle
    // qu'elle n'aurait pas retenue.
    await page.waitForTimeout(13000)

    expect(
      coupees.size,
      `une bribe doit bien avoir été coupée — ${vues.length} bribes vues`
    ).toBeGreaterThan(0)
    // Le chargement initial, plus UN rechargement. La marge laisse passer une requête de document
    // supplémentaire sans laisser passer une boucle, qui en produirait des dizaines.
    expect(documents, `requêtes de document observées : ${documents}`).toBeLessThanOrEqual(3)
  })
})
