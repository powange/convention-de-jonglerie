import { expect, test } from '@nuxt/test-utils/playwright'

import { apiPost, loadState } from '../helpers'

/**
 * Consultation hors ligne, le seul endroit où elle est observable automatiquement.
 *
 * Le cache est inactif en développement — le dossier des fichiers de build y sert des modules
 * qui changent à chaque édition du code — si bien que ce comportement ne s'exerce nulle part
 * ailleurs que sur un build de production, celui que ce parcours utilise.
 *
 * Faute de ce parcours, cinq défauts sont partis en release avant d'être découverts à la main :
 * la page jamais mise en cache, ses scripts absents, la liste des éditions non conservée, la
 * même liste introuvable à cause de ses paramètres de requête, puis les traductions manquantes.
 * Chacun se serait vu ici.
 *
 * Il vit parmi les parcours de gestion, et non les parcours publics, uniquement pour disposer
 * d'une édition : sa première version s'ignorait faute de zone à afficher, et un test vert qui
 * ne vérifie rien vaut moins qu'un test absent.
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
    /*
     * ⚠️ ATTENTE FIXE ASSUMÉE — ne pas la « corriger » en sondage.
     *
     * Il s'agit de laisser les requêtes de la page atteindre le cache avant de couper le réseau.
     * Il n'y a pas de condition observable depuis la page : le worker remplit son cache en
     * arrière-plan, et sonder une entrée précise rendrait ce harnais solidaire du nom des caches
     * et de la liste des URL pré-chargées — c'est-à-dire du détail même que ces cas ne doivent pas
     * connaître. La durée est donc un budget, pas une devinette sur une horloge.
     */
    await page.waitForTimeout(3000)
  }

  test('la carte du site revient sans réseau', async ({ page, context }) => {
    const { editionId } = loadState()

    // La zone est créée ici plutôt qu'espérée : sans elle, la première version de ce parcours
    // se déclarait ignorée et ne vérifiait rien du tout.
    const creation = await apiPost(page, `http://localhost:3000/api/editions/${editionId}/zones`, {
      data: {
        name: 'Zone hors ligne E2E',
        color: '#3B82F6',
        zoneTypes: ['OTHER'],
        coordinates: [
          [46.4, 15.8],
          [46.5, 15.9],
          [46.6, 15.7],
        ],
      },
    })
    expect(creation.ok(), `création de zone échouée : ${await creation.text()}`).toBe(true)

    await visitUntilControlled(page, `/editions/${editionId}/map`)

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
    /*
     * ⚠️ ON ATTEND LE REMPLISSAGE, PAS UNE DURÉE. Ce cas portait un `waitForTimeout(4000)` : sous
     * charge en CI, un service worker plus lent rendait la page encore vide au moment du relevé,
     * et le cas accusait alors le cache d'un défaut qui n'était que de la lenteur.
     *
     * Le sondage porte exactement l'assertion « l'accueil n'est pas revenu vide » : elle n'est
     * donc pas affaiblie, elle est seulement patiente. Les deux autres — pas d'erreur réseau, pas
     * de clé brute — s'appliquent ensuite à un état dont on SAIT qu'il est rendu.
     */
    const lireLeCorps = async () => (await page.locator('body').innerText()).toLowerCase()
    await expect
      .poll(async () => (await lireLeCorps()).length, {
        timeout: 30000,
        message: 'l’accueil est revenu vide',
      })
      .toBeGreaterThan(200)

    // Le symptôme signalé : la page revenait, mais vide, sur une erreur réseau. Une page
    // conservée sans ce qu'elle affiche vaut moins qu'une absence de cache — elle a l'air cassée.
    const texte = await lireLeCorps()
    expect(texte, 'l’accueil est revenu sur une erreur réseau').not.toContain('failed to fetch')

    // Les traductions sont chargées par imports dynamiques. Demandées avant que le worker ne
    // contrôle la page, elles lui échappaient : l'interface affichait ses clés à la place des
    // libellés — visible d'un coup d'œil, mais qu'aucune assertion ne relevait.
    const cles = texte.match(/\b[a-z][a-z_]+\.[a-z][a-z_]+(\.[a-z_]+)*\b/g) ?? []
    const suspectes = cles.filter((cle) => !/\.(com|fr|org|net|io)$/.test(cle))
    expect(suspectes, 'des clés de traduction s’affichent au lieu des libellés').toEqual([])
  })
})
