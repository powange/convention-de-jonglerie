import { expect, test } from '@nuxt/test-utils/playwright'

/**
 * Consultation hors ligne, le seul endroit où elle est observable automatiquement.
 *
 * Le cache est inactif en développement — le dossier des fichiers de build y sert des modules
 * qui changent à chaque édition du code — si bien que ce comportement ne s'exerce nulle part
 * ailleurs que sur un build de production, celui que ce parcours utilise.
 *
 * Faute de ce parcours, quatre défauts sont partis en release avant d'être découverts à la main :
 * la page jamais mise en cache, ses scripts absents, la liste des éditions non conservée, puis
 * la même liste introuvable à cause de ses paramètres de requête. Chacun se serait vu ici.
 */
test.describe('Consultation hors ligne', () => {
  /**
   * Le service worker ne contrôle pas la page qui l'installe. Il faut donc une seconde visite
   * pour que les requêtes lui passent devant — c'est exactement le piège dans lequel sont
   * tombées les corrections précédentes.
   */
  async function visitUntilControlled(page: import('@playwright/test').Page, path: string) {
    await page.goto(path, { waitUntil: 'load', timeout: 90000 })
    await page.waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 60000 })
    await page.reload({ waitUntil: 'load', timeout: 90000 })
    // Laisser les requêtes de la page atteindre le cache avant de couper.
    await page.waitForTimeout(3000)
  }

  test('la carte du site revient sans réseau', async ({ page, context }) => {
    // L'édition est choisie parmi celles qui existent réellement, et parmi elles la première qui
    // porte une carte. Viser un identifiant fixe ferait passer ce parcours en silence le jour où
    // il disparaît — un test qui s'ignore ne vaut pas mieux que pas de test.
    const liste = await page.request.get('/api/editions?limit=20')
    expect(liste.ok(), 'la liste des éditions est injoignable').toBe(true)
    const editions = (await liste.json())?.data ?? []
    expect(editions.length, 'aucune édition en base').toBeGreaterThan(0)

    let cible: number | null = null
    for (const edition of editions) {
      const zones = await page.request.get(`/api/editions/${edition.id}/zones`)
      if (!zones.ok()) continue
      if (((await zones.json())?.data?.zones ?? []).length > 0) {
        cible = edition.id
        break
      }
    }
    test.skip(cible === null, 'aucune édition ne porte de zone : rien à vérifier hors ligne')

    await visitUntilControlled(page, `/editions/${cible}/map`)

    const zonesEnLigne = await page.locator('path.leaflet-interactive').count()
    expect(zonesEnLigne, 'la carte ne s’affiche pas même en ligne').toBeGreaterThan(0)

    await context.setOffline(true)
    await page.reload({ waitUntil: 'load', timeout: 90000 })

    // Les zones sont dessinées par Leaflet après hydratation : leur présence prouve que la page,
    // ses scripts et ses données sont tous revenus du cache.
    await expect
      .poll(() => page.locator('path.leaflet-interactive').count(), { timeout: 30000 })
      .toBeGreaterThan(0)

    // Le visiteur doit savoir que ce qu'il regarde peut avoir changé depuis.
    await expect(page.getByText(/hors ligne/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('la page d’accueil garde ses éditions sans réseau', async ({ page, context }) => {
    await visitUntilControlled(page, '/')

    await context.setOffline(true)
    await page.reload({ waitUntil: 'load', timeout: 90000 })
    await page.waitForTimeout(4000)

    // Le symptôme signalé : la page revenait, mais vide, sur une erreur réseau. Une page
    // conservée sans ce qu'elle affiche vaut moins qu'une absence de cache — elle a l'air cassée.
    const texte = (await page.locator('body').innerText()).toLowerCase()
    expect(texte, 'l’accueil est revenu sur une erreur réseau').not.toContain('failed to fetch')
    expect(texte.length, 'l’accueil est revenu vide').toBeGreaterThan(200)
  })
})
