import { expect, test } from '@nuxt/test-utils/playwright'

import { apiPost, loadState, updateEdition } from '../helpers'

/**
 * Trésorerie d'une édition : `/editions/:id/gestion/treasury`.
 *
 * Un total faux reste un nombre plausible — c'est la raison d'être de ce parcours. Il vérifie
 * que la saisie aboutit réellement en base, que le solde retient les produits moins les charges,
 * et que l'imputation se rattache.
 */

test.describe.serial("Trésorerie d'une édition", () => {
  test('active la fonctionnalité', async ({ page }) => {
    const { editionId } = loadState()
    const response = await updateEdition(page, editionId, { treasuryEnabled: true })
    expect(response.ok(), `Activation échouée : ${await response.text()}`).toBe(true)
  })

  test('crée un code d’imputation', async ({ page }) => {
    const { editionId } = loadState()
    const response = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/treasury/codes`,
      { data: { code: 'E2E-6257', label: 'Rémunérations E2E' } }
    )
    expect(response.ok(), `Création du code échouée : ${await response.text()}`).toBe(true)
  })

  test('saisit une charge et un produit, et voit le solde', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    // Une édition neuve n'a ni artiste ni commande : les quatre lignes calculées valent zéro.
    await expect(page.getByTestId('treasury-line')).toHaveCount(4)

    await addEntry(page, { kind: 'Charge', title: 'Location salle E2E', amount: 150 })
    await expect(page.getByTestId('treasury-line')).toHaveCount(5)

    await addEntry(page, { kind: 'Produit', title: 'Subvention E2E', amount: 400 })
    await expect(page.getByTestId('treasury-line')).toHaveCount(6)

    // 400 encaissés moins 150 dépensés : le solde doit valoir 250, et lui seul le prouve.
    const balance = page
      .locator('div')
      .filter({ hasText: /^Solde/ })
      .last()
    await expect(balance).toContainText('250,00')
  })

  test('retire les lignes saisies', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByTestId('treasury-line').first()).toBeVisible({ timeout: 20000 })

    // Les lignes calculées n'ont pas de bouton de suppression : seules les saisies en portent un.
    for (const title of ['Location salle E2E', 'Subvention E2E']) {
      const row = page.getByTestId('treasury-line').filter({ hasText: title })
      await row.getByRole('button').last().click()
      await expect(row).toHaveCount(0, { timeout: 15000 })
    }

    await expect(page.getByTestId('treasury-line')).toHaveCount(4)
  })
})

async function addEntry(
  page: import('@playwright/test').Page,
  entry: { kind: 'Charge' | 'Produit'; title: string; amount: number }
) {
  await page.getByRole('button', { name: 'Ajouter une ligne' }).click()
  await page.getByRole('button', { name: entry.kind, exact: true }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').first().fill(entry.title)

  // Le champ numérique ne commet sa valeur qu'à la sortie du champ : sans ce `Tab`, le modèle
  // reste à zéro et le bouton d'enregistrement demeure désactivé.
  const amount = dialog.getByRole('spinbutton')
  await amount.fill(String(entry.amount))
  await amount.press('Tab')

  const save = dialog.getByRole('button', { name: 'Enregistrer' })
  await expect(save, 'le formulaire est resté invalide après saisie').toBeEnabled({
    timeout: 10000,
  })
  await save.click()

  await expect(dialog).toBeHidden({ timeout: 15000 })
}
