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
   * fonctionne et les bribes partent bien au clic, mais aucun événement n'est émis. Et ce fichier
   * lit `.output/`, qui n'existe qu'après un build.
   */
  test.skip(
    !process.env.CI,
    'Le serveur de développement ne passe pas par vite:preloadError : ce lot exige une application construite.'
  )

  /**
   * Les bribes qui portent le CODE de FullCalendar, lues dans le build.
   *
   * ⚠️⚠️ L'ERREUR QUI A COÛTÉ QUATRE PASSAGES DE CI : ne lire que les cibles des expressions
   * `import()`. Vite compile un import dynamique en
   * `T(() => import("./ChiZJdYx.js"), __vite__mapDeps([0, 1, 2]), import.meta.url)`, et ce sont les
   * entrées de `__vite__mapDeps` qui désignent les VRAIES dépendances — dont la bibliothèque
   * elle-même. Mesuré sur un build de la CI : la cible de l'`import()` fait 1,8 Ko (une simple
   * réexportation) tandis que `ITMh5RWB.js`, absente de l'expression et présente dans `mapDeps`,
   * en fait 177 Ko. Bloquer la première ne retire rien d'utile.
   *
   * ⚠️⚠️ ET LE PIÈGE SYMÉTRIQUE : `mapDeps` contient aussi `2-ABNrvs.js`, qui est le runtime de
   * Vue — référencé par 299 des 768 bribes du build. Le bloquer casserait la page entière au lieu
   * d'éprouver quoi que ce soit. D'où le filtre sur un marqueur de classe propre à FullCalendar :
   * il garde la bibliothèque et ses greffons, il écarte le runtime par construction.
   *
   * 📍 ET POURQUOI DÉDUIRE PLUTÔT QU'ÉCRIRE EN DUR : les bribes sont hachées par leur contenu, donc
   * tout nom figé devient faux au premier changement — et un `page.route` qui ne correspond plus ne
   * coupe rien, ce qui rendrait ce lot VERT À VIDE. L'assertion d'appel échoue bruyamment si la
   * déduction ne trouve rien.
   */
  const MARQUEURS_FULLCALENDAR = ['fc-daygrid', 'fc-toolbar', 'fc-scrollgrid', 'fc-list']

  const bribesDeFullCalendar = (): string[] => {
    const dossier = resolve(process.cwd(), '.output/public/_nuxt')
    const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.js'))
    const lire = (f: string) => readFileSync(join(dossier, f), 'utf8')

    // 1. les bribes qui IMPORTENT FullCalendar : elles portent leur message d'erreur, que la
    //    minification conserve puisque c'est une chaîne.
    const candidates = new Set<string>()
    for (const fichier of fichiers) {
      const source = lire(fichier)
      if (!source.includes('Error loading FullCalendar')) continue
      // la cible de l'import…
      for (const m of source.matchAll(/import\(`\.\/([A-Za-z0-9_$-]+\.js)`\)/g))
        candidates.add(m[1]!)
      // …et surtout sa table de dépendances, où vit la bibliothèque.
      for (const m of source.matchAll(/__vite__mapDeps[^[]*\[([^\]]*)\]/g))
        for (const d of m[1]!.matchAll(/\.\/([A-Za-z0-9_$-]+\.js)/g)) candidates.add(d[1]!)
    }

    // 2. ne garder que celles qui portent réellement du code FullCalendar : écarte le runtime Vue.
    return [...candidates].filter((f) => {
      if (!fichiers.includes(f)) return false
      const source = lire(f)
      return MARQUEURS_FULLCALENDAR.some((marque) => source.includes(marque))
    })
  }

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
    // Nuxt pose `window.useNuxtApp` au démarrage du client (`nuxt/dist/app/nuxt.js`) : le témoin
    // d'hydratation le moins coûteux, et le seul qui distingue la page rendue par le serveur de
    // l'application vivante.
    await page.waitForFunction(() => 'useNuxtApp' in window, null, { timeout: 60000 })
    // Près de 400 bribes partent au démarrage : les laisser finir, pour que le clic soit bien la
    // seule chose qui déclenche encore une requête.
    await page.waitForLoadState('networkidle', { timeout: 30000 })
  }

  test('🔬 recharge la page quand une bribe échoue hors navigation', async ({ page }) => {
    const bribes = bribesDeFullCalendar()
    expect(
      bribes.length,
      'aucune bribe de FullCalendar déduite du build : la déduction a cessé de fonctionner, et ce lot ne prouverait plus rien'
    ).toBeGreaterThan(0)

    const coupees = await rendreInaccessible(page, bribes)
    await ouvrirLAccueilHydrate(page)

    await page.evaluate(() => {
      ;(window as unknown as { __temoinAvantRechargement?: boolean }).__temoinAvantRechargement =
        true
    })

    // La vue agenda monte `UiLazyFullCalendar`, qui importe la bibliothèque : un `import()` SANS
    // navigation de route, donc le cas que `'automatic'` ne rattrapait pas.
    await page.locator('[data-vue-agenda]').click()

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

    expect(coupees.size, `bribes coupées : ${[...coupees].join(', ')}`).toBeGreaterThan(0)

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
    const bribes = bribesDeFullCalendar()
    expect(bribes.length, 'aucune bribe de FullCalendar déduite du build').toBeGreaterThan(0)

    let documents = 0
    page.on('request', (requete) => {
      if (requete.resourceType() === 'document') documents++
    })

    const coupees = await rendreInaccessible(page, bribes, { durable: true })
    await ouvrirLAccueilHydrate(page)

    await page.locator('[data-vue-agenda]').click()
    // La garde vaut dix secondes : attendre un peu au-delà, sinon on ne verrait pas une boucle
    // qu'elle n'aurait pas retenue.
    await page.waitForTimeout(13000)

    expect(coupees.size, 'une bribe doit bien avoir été coupée').toBeGreaterThan(0)
    // Le chargement initial, plus UN rechargement. La marge laisse passer une requête de document
    // supplémentaire sans laisser passer une boucle, qui en produirait des dizaines.
    expect(documents, `requêtes de document observées : ${documents}`).toBeLessThanOrEqual(3)
  })
})
