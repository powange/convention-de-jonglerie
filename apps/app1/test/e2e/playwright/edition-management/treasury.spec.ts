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

  test('crée un code d’imputation', async ({ page }, testInfo) => {
    const { editionId } = loadState()
    // Le code est unique par convention. Un `describe.serial` rejoue tout le bloc à chaque
    // nouvelle tentative : avec un code figé, la 2ᵉ tentative se heurtait au code créé par la
    // 1ʳᵉ et échouait sur un conflit, masquant l'échec qui avait déclenché la reprise.
    const response = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/treasury/codes`,
      { data: { code: `E2E-6257-${testInfo.retry}`, label: 'Rémunérations E2E' } }
    )
    expect(response.ok(), `Création du code échouée : ${await response.text()}`).toBe(true)
  })

  test('saisit une charge et un produit, et voit le solde', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    // Les lignes calculées sont toujours là, quel que soit leur montant. Leur nombre suit les
    // origines et change quand on en ajoute une — le compter en dur ferait échouer ce parcours
    // à chaque enrichissement de la trésorerie, sans qu'aucune régression n'ait eu lieu.
    const baseLines = await page.getByTestId('treasury-line').count()
    expect(baseLines, 'aucune ligne calculée : la trésorerie ne charge pas').toBeGreaterThan(0)

    // L'édition est partagée avec les autres parcours, qui y ajoutent des artistes : son solde
    // de départ n'est pas nul et dépend de l'ordre d'exécution. C'est l'écart qui prouve
    // l'arithmétique, pas la valeur absolue — l'ancienne attente d'un « 250,00 » figé tenait
    // d'une édition supposée vierge.
    const before = await readBalance(page)

    await addEntry(page, { kind: 'Charge', title: 'Location salle E2E', amount: 150 })
    await expect(page.getByTestId('treasury-line')).toHaveCount(baseLines + 1)

    await addEntry(page, { kind: 'Produit', title: 'Subvention E2E', amount: 400 })
    await expect(page.getByTestId('treasury-line')).toHaveCount(baseLines + 2)

    // 400 encaissés moins 150 dépensés : le solde doit progresser de 250, et lui seul le prouve.
    await expect.poll(() => readBalance(page), { timeout: 15000 }).toBeCloseTo(before + 250, 2)
  })

  test('retire les lignes saisies', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByTestId('treasury-line').first()).toBeVisible({ timeout: 20000 })

    const before = await page.getByTestId('treasury-line').count()

    // Les lignes calculées n'ont pas de bouton de suppression : seules les saisies en portent un.
    for (const title of ['Location salle E2E', 'Subvention E2E']) {
      const row = page.getByTestId('treasury-line').filter({ hasText: title })
      await row.getByRole('button').last().click()
      await expect(row).toHaveCount(0, { timeout: 15000 })
    }

    // Les deux saisies partent, les lignes calculées restent.
    await expect(page.getByTestId('treasury-line')).toHaveCount(before - 2)
  })
})

/**
 * Lit le solde affiché et le rend en nombre.
 *
 * Le montant est formaté en français — séparateur de milliers insécable, virgule décimale —
 * et suivi du symbole de la devise de l'édition, qui n'est pas toujours l'euro.
 */
async function readBalance(page: import('@playwright/test').Page): Promise<number> {
  const text = await page
    .locator('div')
    .filter({ hasText: /^Solde/ })
    .last()
    .innerText()
  // Espaces possibles entre milliers : ordinaire, insécable (U+00A0), insécable étroite (U+202F).
  const SEP = '[ \\u00a0\\u202f]'
  const match = text.match(new RegExp(`-?(?:\\d|${SEP})*\\d(?:,\\d+)?`))
  if (!match) throw new Error(`Solde illisible : ${JSON.stringify(text)}`)
  return Number(match[0].replace(new RegExp(SEP, 'g'), '').replace(',', '.'))
}

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
