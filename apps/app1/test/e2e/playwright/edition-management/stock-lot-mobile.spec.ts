import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname

/**
 * L'édition par lot du stock, sur un téléphone.
 *
 * Défaut signalé : la barre de sélection est posée en `fixed` tout en bas de l'écran, par-dessus
 * le reste. Sur mobile, elle recouvrait le bas de la modale « Modifier les objets sélectionnés »
 * — donc son bouton d'enregistrement. On remplissait le formulaire sans pouvoir le valider, et
 * rien n'indiquait pourquoi.
 *
 * Le test se joue à 390 pixels de large, la taille d'un téléphone courant : sur un écran
 * d'ordinateur, la modale est assez haute pour que son bouton passe au-dessus de la barre, et le
 * défaut ne se voit pas.
 */
test.describe.serial('Stock : édition par lot sur mobile', () => {
  let groupeId: number | null = null
  let objetId: number | null = null

  test.beforeAll(async ({ browser }) => {
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()

    await updateEdition(page, String(editionId), { stockEnabled: true })

    const groupe = await apiPost(page, `${BASE}/api/editions/${editionId}/stock-groups`, {
      data: { name: 'Lot mobile E2E' },
    })
    groupeId = (await groupe.json())?.data?.group?.id

    const objet = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/stock-groups/${groupeId}/items`,
      {
        data: { name: 'Objet lot mobile', quantity: 2 },
      }
    )
    objetId = (await objet.json())?.data?.item?.id

    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()

    if (objetId) await apiDelete(page, `${BASE}/api/editions/${editionId}/stock-items/${objetId}`)
    if (groupeId) {
      await apiDelete(page, `${BASE}/api/editions/${editionId}/stock-groups/${groupeId}`)
    }
    await updateEdition(page, String(editionId), { stockEnabled: false })

    await context.close()
  })

  test('le bouton d’enregistrement de la modale reste atteignable', async ({ browser }) => {
    const { editionId } = loadState()
    if (!groupeId) throw new Error('groupeId manquant')

    const context = await browser.newContext({
      storageState: AUTH,
      viewport: { width: 390, height: 844 },
      locale: 'fr-FR',
    })
    const page = await context.newPage()

    try {
      await page.goto(`${BASE}/editions/${editionId}/gestion/stock/${groupeId}`, {
        waitUntil: 'domcontentloaded',
      })
      await expect(page.getByText('Objet lot mobile').first()).toBeVisible({ timeout: 30000 })

      // Cocher l'objet fait apparaître la barre de sélection. Désignée par son texte et non par
      // sa position : la page en porte une seconde, celle du comptage.
      await page.getByRole('checkbox').nth(1).check()
      const barre = page.getByText(/sélectionné/i).first()
      await expect(barre).toBeVisible({ timeout: 10000 })

      await page
        .getByRole('button', { name: /^Modifier$/ })
        .first()
        .click()

      // Le cœur du test : la barre s'efface, et le bouton de la modale est réellement cliquable.
      // `toBeVisible` ne suffirait pas — un élément recouvert reste « visible » pour Playwright.
      await expect(barre).toBeHidden({ timeout: 10000 })

      const enregistrer = page.getByRole('button', { name: /enregistrer/i }).last()
      await expect(enregistrer).toBeVisible({ timeout: 10000 })
      await expect(enregistrer).toBeEnabled()
    } finally {
      await context.close()
    }
  })
})
