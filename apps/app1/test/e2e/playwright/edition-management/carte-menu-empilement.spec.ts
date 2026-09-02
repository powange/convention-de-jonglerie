import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Les menus de navigation doivent être dessinés au-dessus du panneau des zones de la carte.
 *
 * Signalé sur téléphone, sur les DEUX cartes : celle de la gestion, dont le menu est la barre
 * latérale du tableau de bord, et la carte publique, dont le menu est le panneau des onglets de
 * l'édition. Le menu ouvert passait sous le panneau. Nuxt UI ne pose aucun
 * `z-index` — ses surcouches s'empilent par ordre du DOM — et le tiroir des zones, qui reste
 * monté en permanence, s'insère après le menu.
 *
 * Ce test mesure le DESSIN, pas le survol, et c'est tout l'enjeu : le tiroir est en
 * `pointer-events: none`, si bien que `elementFromPoint` répond le menu alors que le tiroir est
 * peint par-dessus. Une première version de ce test concluait donc à tort que tout allait bien.
 * On rend le tiroir sensible au pointeur le temps de la mesure : ce qui répond alors est ce qui
 * est effectivement au-dessus.
 */
test.use({ viewport: { width: 390, height: 844 } })

const POINT_MESURE = { x: 195, y: 800 } as const

type Page = import('@playwright/test').Page

/** Rend le tiroir sensible au pointeur le temps de la mesure : voir l'en-tête. */
const mesurerEmpilement = (page: Page) =>
  page.evaluate(({ x, y }) => {
      const dialogues = [...document.querySelectorAll('[role="dialog"]')]
      const tiroir = dialogues.find((d) => /zones|repère/i.test(d.textContent || '')) as
        | HTMLElement
        | undefined
      const menu = dialogues.find((d) => !/zones|repère/i.test(d.textContent || ''))
      if (!tiroir || !menu) return { trouves: false, tiroirAuDessus: true, zMenu: '-' }

      const ancien = tiroir.style.pointerEvents
      tiroir.style.pointerEvents = 'auto'
      const el = document.elementFromPoint(x, y)
      const tiroirAuDessus = !!(el && tiroir.contains(el))
      tiroir.style.pointerEvents = ancien

      return { trouves: true, tiroirAuDessus, zMenu: getComputedStyle(menu).zIndex }
  }, POINT_MESURE)

const verifier = (mesure: { trouves: boolean; tiroirAuDessus: boolean; zMenu: string }) => {
  expect(mesure.trouves, 'le menu et le panneau doivent tous deux être ouverts').toBe(true)
  expect(
    mesure.tiroirAuDessus,
    `le panneau des zones est dessiné par-dessus le menu (z-index du menu : ${mesure.zMenu})`
  ).toBe(false)
}

test.describe.serial('Carte du site — empilement des menus', () => {
  test.describe.configure({ timeout: 120000 })

  /** La page publique ne dessine son panneau que si la carte a du contenu (`hasSiteMap`). */
  let zoneId: number | null = null

  test('gestion : la barre latérale recouvre le panneau des zones', async ({ page, goto }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { siteMapEnabled: true })

    const r = await apiPost(page, `${BASE}/api/editions/${editionId}/zones`, {
      data: {
        name: 'Zone de mesure',
        color: '#FF8800',
        coordinates: [
          [43.92, 5.11],
          [43.93, 5.11],
          [43.93, 5.12],
        ],
      },
    })
    expect(r.ok(), await r.text()).toBe(true)
    zoneId = ((await r.json())?.data ?? (await r.json()))?.id ?? null

    await goto(`/editions/${editionId}/gestion/map`, { waitUntil: 'hydration' })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 })

    // `dispatchEvent` plutôt qu'un clic : en développement, la barre d'outils Vite recouvre la
    // page et intercepte le pointeur — même avec `force`.
    await page.locator('button[aria-label="Open sidebar"]:visible').first().dispatchEvent('click')
    await page.waitForTimeout(1500)

    verifier(await mesurerEmpilement(page))
  })

  test('page publique : les onglets de l’édition recouvrent le panneau', async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/map`, { waitUntil: 'hydration' })
    await page.waitForTimeout(2000)

    await page
      .locator('button[aria-label="Onglets de navigation"]:visible')
      .first()
      .dispatchEvent('click')
    await page.waitForTimeout(1500)

    verifier(await mesurerEmpilement(page))
  })

  test('nettoyer : rendre l’édition telle qu’on l’a trouvée', async ({ page }) => {
    const { editionId } = loadState()
    if (zoneId) {
      await apiDelete(page, `${BASE}/api/editions/${editionId}/zones/${zoneId}`).catch(() => {})
    }
    await updateEdition(page, String(editionId), { siteMapEnabled: false })
  })
})
