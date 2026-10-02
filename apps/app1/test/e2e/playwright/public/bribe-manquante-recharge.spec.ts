import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

const BASE = 'http://localhost:3000'

/**
 * Une bribe JavaScript qui ne se charge pas doit faire RECHARGER la page.
 *
 * ⚠️ SIGNALÉ EN PRODUCTION : « 500 — Internal Server Error — Failed to fetch dynamically imported
 * module », sur mobile, chez certains visiteurs seulement. Un déploiement retire les anciennes
 * bribes ; un onglet resté ouvert en demande une qui n'existe plus, et le cache de Cloudflare la
 * sert encore là où il l'a gardée — d'où des visiteurs touchés et d'autres non.
 *
 * LE DÉFAUT, corrigé par #661 : `emitRouteChunkError` valait `'automatic'`, dont le greffon ne
 * recharge que depuis `router.onError`. Une bribe qui échoue HORS navigation n'était rattrapée par
 * personne. `'automatic-immediate'` branche `app:chunkError` directement.
 */
test.describe('Une bribe manquante ne doit pas afficher de 500', () => {
  /*
   * ⚠️ CE LOT N'A DE SENS QUE SUR UNE APPLICATION CONSTRUITE. En développement, Vite sert des
   * modules ESM natifs : les `import()` ne passent pas par `__vitePreload`, donc aucun
   * `vite:preloadError` n'est émis et aucun rechargement n'a lieu. Ce fichier lit d'ailleurs
   * `.output/`, qui n'existe qu'après un build.
   */
  test.skip(
    !process.env.CI,
    'Le serveur de développement ne passe pas par vite:preloadError : ce lot exige une application construite.'
  )

  /*
   * ⚠️ La limite par défaut de Playwright est de trente secondes, et ce lot attend deux fois vingt
   * secondes après un chargement qui en prend six. Échouer sur le temps serait la pire façon
   * d'échouer : cela ressemble à un défaut de l'application.
   */
  test.describe.configure({ timeout: 120000 })

  const MARQUEURS_FULLCALENDAR = ['fc-daygrid', 'fc-toolbar', 'fc-scrollgrid', 'fc-list']

  /**
   * Les bribes qui portent le CODE de FullCalendar, lues dans le build servi.
   *
   * ⚠️ LES DEUX SOURCES COMPTENT. Vite compile un import dynamique en
   * `T(() => import("./X.js"), __vite__mapDeps([0, 1, 2]), import.meta.url)` : la cible de
   * l'`import()` n'est qu'une réexportation de 1,8 Ko, et c'est `__vite__mapDeps` qui désigne la
   * bibliothèque — 177 Ko. Ne lire que la première ne retirait rien d'utile.
   *
   * ⚠️⚠️ ET LE FILTRE PAR CONTENU N'EST PAS UNE COQUETTERIE : `mapDeps` contient aussi le runtime
   * de Vue, référencé par 299 des 768 bribes du build. Le bloquer casserait la page entière au lieu
   * d'éprouver quoi que ce soit. Un marqueur de classe propre à FullCalendar l'écarte par
   * construction.
   */
  const bribesDeFullCalendar = (): string[] => {
    const dossier = resolve(process.cwd(), '.output/public/_nuxt')
    const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.js'))
    const lire = (f: string) => readFileSync(join(dossier, f), 'utf8')

    const candidates = new Set<string>()
    for (const fichier of fichiers) {
      const source = lire(fichier)
      if (!source.includes('Error loading FullCalendar')) continue
      for (const m of source.matchAll(/import\(`\.\/([A-Za-z0-9_$-]+\.js)`\)/g))
        candidates.add(m[1]!)
      for (const m of source.matchAll(/__vite__mapDeps[^[]*\[([^\]]*)\]/g))
        for (const d of m[1]!.matchAll(/\.\/([A-Za-z0-9_$-]+\.js)/g)) candidates.add(d[1]!)
    }

    return [...candidates].filter(
      (f) => fichiers.includes(f) && MARQUEURS_FULLCALENDAR.some((m) => lire(f).includes(m))
    )
  }

  /**
   * Rend ces bribes inaccessibles, DÈS LE DÉPART et par UN MOTIF ÉTROIT CHACUNE.
   *
   * ⚠️⚠️ LE PLAFOND DE 400 INTERCEPTIONS, ET POURQUOI CE FICHIER A ÉCHOUÉ CINQ FOIS. `page.route`
   * cesse d'intercepter au-delà d'environ 400 requêtes PRISES. Mesuré contre la production :
   * l'accueil demande 658 bribes, la route en voit 400, puis plus rien — vingt requêtes neuves
   * déclenchées après le chargement n'étaient plus routées du tout. Ni le cache (désactivé par CDP,
   * même résultat), ni l'encodage, ni le type de requête n'y étaient pour quoi que ce soit.
   *
   * 📍 CE QUI SAUVE LE LOT : le plafond ne compte QUE les requêtes que le motif attrape. Un motif
   * étroit, posé avant le même chargement de 658 bribes, routait encore 20 requêtes sur 20. On
   * n'enregistre donc PAS une RegExp sur tout `/_nuxt/*.js` — elle se ferait dévorer par la page —
   * mais une route par bribe visée, qui ne consomme rien tant que la bribe n'est pas demandée.
   *
   * 📍 BLOQUER DÈS LE DÉPART est sans danger pour le démarrage : dans le helper de Vite, les
   * dépendances sont préchargées par un `<link>` dont seul le CSS rejette — un préchargement JS qui
   * échoue est SILENCIEUX. Il laisse en revanche le registre de modules vide, et c'est tout ce
   * qu'on veut : l'`import()` du clic part alors pour de bon, échoue, et `__vitePreload` émet
   * `vite:preloadError`.
   *
   * 📍 ON REND LA MAIN DÈS QUE LE NAVIGATEUR REDEMANDE LE DOCUMENT, pour que le rechargement
   * aboutisse — mais seulement après avoir coupé quelque chose, sans quoi la requête du document
   * initial désarmerait tout avant d'avoir commencé. Ce signal-là, et pas `framenavigated`, parce
   * qu'un `router.push` n'émet aucune requête de document.
   */
  const rendreInaccessible = async (page: Page, bribes: string[], { durable = false } = {}) => {
    let actif = true
    const coupees = new Set<string>()
    if (!durable) {
      page.on('request', (requete) => {
        if (requete.resourceType() === 'document' && coupees.size > 0) actif = false
      })
    }
    for (const bribe of bribes) {
      await page.route(`**/_nuxt/${bribe}`, async (route) => {
        if (!actif) {
          await route.continue()
          return
        }
        coupees.add(bribe)
        await route.abort('failed')
      })
    }
    return coupees
  }

  /** Ouvre l'accueil et attend que l'application ait réellement démarré côté client. */
  const ouvrirLAccueilHydrate = async (page: Page) => {
    await page.goto(`${BASE}/`)
    // Nuxt pose `window.useNuxtApp` au démarrage du client : le témoin d'hydratation le moins
    // coûteux, et le seul qui distingue la page rendue par le serveur de l'application vivante.
    await page.waitForFunction(() => 'useNuxtApp' in window, null, { timeout: 60000 })
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
     * 📍 LE DISPOSITIF AVANT LE COMPORTEMENT. Si rien n'est coupé, le lot n'éprouve rien et doit le
     * dire tout de suite, au lieu de laisser expirer l'attente d'un rechargement qui n'avait aucune
     * raison d'arriver. C'est ce renversement qui manquait aux premières tentatives : elles
     * signalaient l'absence de RECHARGEMENT là où le défaut était l'absence de COUPURE.
     */
    await expect
      .poll(() => coupees.size, { timeout: 20000, message: 'aucune bribe coupée' })
      .toBeGreaterThan(0)

    // 🔬 L'ASSERTION QUI PORTE LE POINT : le témoin posé dans la fenêtre ne survit pas à un nouveau
    // document.
    await page.waitForFunction(
      () =>
        (window as unknown as { __temoinAvantRechargement?: boolean }).__temoinAvantRechargement ===
        undefined,
      null,
      { timeout: 20000 }
    )

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
     * `nuxt:reload` en `sessionStorage` et refuse de recharger deux fois le même chemin en moins de
     * dix secondes.
     *
     * 📍 CE CAS A BESOIN QUE L'APPLICATION REDÉMARRE pour éprouver la garde : on ne bloque que les
     * bribes de FullCalendar, tout le reste passe. Et il ne vérifie PAS l'absence de 500 : au
     * second échec l'erreur n'est plus rattrapée, et c'est le comportement voulu.
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
    // La garde vaut dix secondes : attendre au-delà, sinon on ne verrait pas une boucle qu'elle
    // n'aurait pas retenue.
    await page.waitForTimeout(13000)

    expect(coupees.size, 'une bribe doit bien avoir été coupée').toBeGreaterThan(0)
    // Le chargement initial, plus UN rechargement. La marge laisse passer une requête de document
    // supplémentaire sans laisser passer une boucle, qui en produirait des dizaines.
    expect(documents, `requêtes de document observées : ${documents}`).toBeLessThanOrEqual(3)
  })
})
