import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

/**
 * Rendu mobile des pages de gestion : aucune page ne doit déborder horizontalement.
 *
 * Ce fichier existe parce que plusieurs corrections d'affichage mobile ont été livrées sans
 * mesure objective — seulement une relecture du code et une capture d'écran. Un débordement
 * horizontal se constate pourtant sans ambiguïté : `scrollWidth` dépasse la largeur du
 * viewport, la page glisse de côté et un bouton sort de l'écran.
 *
 * L'assertion porte sur `document.documentElement.scrollWidth`, et non sur la position de
 * chaque élément : un tableau large dans un conteneur `overflow-x: auto` est un défilement
 * voulu, pas un défaut. Seul ce qui pousse *la page entière* compte. Les éléments fautifs
 * ne sont relevés que pour rendre l'échec diagnosticable.
 *
 * Portée : les pages de gestion, seules accessibles au compte E2E. Les pages `/admin/*`
 * — retours utilisateurs, logs d'erreur — ont reçu les mêmes corrections mais exigent un
 * super-administrateur, que l'infrastructure de test ne fabrique pas ; elles restent
 * non couvertes.
 */

const BASE = 'http://localhost:3000'

const LARGEUR_MOBILE = 375
const HAUTEUR_MOBILE = 667

// 1 px de tolérance : les arrondis de sous-pixel du moteur de rendu produisent
// régulièrement un scrollWidth fractionnaire sur une page pourtant bien contenue.
const TOLERANCE_PX = 1

// Le titre long est le cas qui avait cassé la mise en page : c'est lui qu'il faut mesurer,
// pas un intitulé court qui tient de toute façon.
const TITRE_LONG = 'Quota au titre délibérément très long pour éprouver la mise en page mobile'

test.use({ viewport: { width: LARGEUR_MOBILE, height: HAUTEUR_MOBILE } })

type Page = import('@playwright/test').Page

/**
 * Mesure la largeur de défilement de la page et, si elle dépasse, désigne les éléments
 * qui la provoquent — en écartant ceux dont un ancêtre défile volontairement.
 */
async function mesurerDebordement(page: Page) {
  return page.evaluate((largeur) => {
    const scrollWidth = document.documentElement.scrollWidth

    const ancetreDefilant = (el: Element) => {
      let parent = el.parentElement
      while (parent && parent !== document.documentElement) {
        const overflowX = getComputedStyle(parent).overflowX
        if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') return true
        parent = parent.parentElement
      }
      return false
    }

    const coupables: string[] = []
    if (scrollWidth > largeur) {
      for (const el of document.querySelectorAll('body *')) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        if (rect.right <= largeur + 1) continue
        if (ancetreDefilant(el)) continue
        const classes = typeof el.className === 'string' ? el.className.slice(0, 120) : ''
        coupables.push(
          `<${el.tagName.toLowerCase()}${classes ? ` class="${classes}"` : ''}> ` +
            `droite=${Math.round(rect.right)}px`
        )
        if (coupables.length >= 5) break
      }
    }

    return { scrollWidth, coupables }
  }, LARGEUR_MOBILE)
}

async function verifierAbsenceDeDebordement(page: Page, contexte: string) {
  const { scrollWidth, coupables } = await mesurerDebordement(page)
  const detail = coupables.length
    ? `\nÉléments qui dépassent :\n  - ${coupables.join('\n  - ')}`
    : "\nAucun élément isolé identifié : le débordement vient probablement d'une marge " +
      "ou d'une grille sur un conteneur."

  expect(
    scrollWidth,
    `${contexte} déborde horizontalement en ${LARGEUR_MOBILE} px ` +
      `(scrollWidth = ${scrollWidth} px).${detail}`
  ).toBeLessThanOrEqual(LARGEUR_MOBILE + TOLERANCE_PX)
}

/**
 * Attend que le contenu propre à la page soit rendu : mesurer un squelette ne prouverait rien.
 * Tous les écrans de gestion ouvrent sur un `h1` ou, pour l'accueil, une série de `h2`.
 */
async function attendreContenu(page: Page) {
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 })
}

test.describe.serial('Rendu mobile des pages de gestion', () => {
  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test('activer la billetterie pour rendre la page des tarifs atteignable', async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { ticketingEnabled: true })
  })

  const PAGES = [
    'gestion',
    'gestion/organizers',
    'gestion/general-info',
    'gestion/convention',
    'gestion/ticketing/tiers',
  ]

  for (const chemin of PAGES) {
    test(`${chemin} ne déborde pas en ${LARGEUR_MOBILE} px`, async ({ page, goto }) => {
      const { editionId } = loadState()

      await goto(`/editions/${editionId}/${chemin}`, { waitUntil: 'hydration' })
      await attendreContenu(page)

      await verifierAbsenceDeDebordement(page, chemin)
    })
  }

  test('un quota au titre long ne fait pas déborder la liste ni sa fenêtre', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    const reponse = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/quotas`, {
      data: {
        title: TITRE_LONG,
        description: 'Description tout aussi longue, destinée à pousser les bords du conteneur.',
        quantity: 42,
      },
    })
    expect(reponse.ok()).toBe(true)
    // POST quota → `createSuccessResponse(quota)` : le quota est directement dans `data`.
    // Extraction tolérante — sans identifiant, le nettoyage ne se ferait pas et le quota
    // resterait dans l'édition partagée par les autres specs.
    const corps = await reponse.json()
    const quotaId = (corps.data?.quota ?? corps.data ?? corps)?.id
    expect(
      quotaId,
      'identifiant du quota absent de la réponse — le nettoyage serait muet'
    ).toBeTruthy()

    try {
      await goto(`/editions/${editionId}/gestion/ticketing/tiers`, { waitUntil: 'hydration' })
      await attendreContenu(page)

      // La liste des quotas vit dans un onglet de la page des tarifs, pas à l'ouverture.
      await page.getByRole('tab', { name: /quotas/i }).click()

      // `.last()` : le quota vient d'être créé, il est en fin de liste. L'édition est
      // partagée avec les autres specs, qui y laissent leurs propres quotas — viser le
      // premier venu mesurerait un intitulé court et le test passerait sans rien prouver.
      const boutonEdition = page.getByTitle('Modifier le quota').last()
      await expect(boutonEdition).toBeVisible({ timeout: 15000 })
      await expect(page.getByTitle(TITRE_LONG)).toBeVisible()

      await verifierAbsenceDeDebordement(page, 'liste des quotas (titre long)')

      await boutonEdition.click()

      const modale = page.getByRole('dialog')
      await expect(modale).toBeVisible({ timeout: 5000 })

      // Vérifier que c'est bien le quota au titre long qui est ouvert : sans cette
      // assertion, un décalage d'ordre ferait mesurer un autre quota et le test
      // resterait vert en n'ayant rien éprouvé.
      await expect(modale.locator('input').first()).toHaveValue(TITRE_LONG)

      const rect = await modale.boundingBox()
      expect(rect, 'la fenêtre de quota devrait avoir une géométrie mesurable').not.toBeNull()
      const bordDroit = Math.round(rect!.x + rect!.width)
      expect(
        bordDroit,
        `la fenêtre de modification du quota dépasse le bord droit de l'écran (${bordDroit} px)`
      ).toBeLessThanOrEqual(LARGEUR_MOBILE + TOLERANCE_PX)

      await verifierAbsenceDeDebordement(page, 'fenêtre de modification du quota')

      await page.keyboard.press('Escape')
    } finally {
      if (quotaId) {
        await apiDelete(page, `${BASE}/api/editions/${editionId}/ticketing/quotas/${quotaId}`)
      }
    }
  })
})
