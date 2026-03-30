import { expect, test } from '@nuxt/test-utils/playwright'

const CONVENTION_NAME = `E2E UI Convention ${Date.now()}`

test.describe.serial('Création convention + édition (parcours UI)', () => {
  let conventionId: string

  test('créer une convention via le formulaire', async ({ page, goto }) => {
    await goto('/conventions/add', { waitUntil: 'hydration' })

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Remplir le nom (seul champ obligatoire)
    await page.locator('input').first().fill(CONVENTION_NAME)

    // Soumettre et attendre la réponse API
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/conventions') && res.request().method() === 'POST'
      ),
      page.getByRole('button', { name: /créer la convention/i }).click(),
    ])

    expect(response.ok()).toBe(true)

    const body = await response.json()
    conventionId = (body.data?.id || body.id).toString()
    expect(conventionId).toBeTruthy()

    await page.waitForURL(/profile\/mes-conventions/, { timeout: 10000 })
  })

  test('créer une édition via le formulaire stepper', async ({ page, goto }) => {
    expect(conventionId).toBeTruthy()

    await goto(`/conventions/${conventionId}/editions/add`, { waitUntil: 'hydration' })
    await expect(page.locator('form')).toBeVisible({ timeout: 10000 })

    // --- Step 1 : Informations générales ---

    // Date de début
    const selectButtons = page.getByRole('button', { name: /sélectionner/i })
    await selectButtons.first().click()
    const today = new Date()
    await page
      .locator('table td')
      .getByText(today.getDate().toString(), { exact: true })
      .first()
      .click()

    // Date de fin
    await page
      .getByRole('button', { name: /sélectionner/i })
      .first()
      .click()
    const futureDay = today.getDate() + 2
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    if (futureDay > lastDay) {
      // Naviguer vers le mois suivant si la date dépasse le mois courant
      await page.getByRole('button', { name: /mois suivant|next month/i }).click()
    }
    const displayDay = futureDay > lastDay ? (futureDay - lastDay).toString() : futureDay.toString()
    await page.locator('table td').getByText(displayDay, { exact: true }).first().click()

    // Adresse
    const addressInput = page.locator('input[name="addressLine1"]')
    await addressInput.scrollIntoViewIfNeeded()
    await addressInput.fill('123 Rue du Cirque')
    await page.locator('input[name="postalCode"]').fill('75001')
    await page.locator('input[name="city"]').fill('Paris')

    // Pays
    const countrySelect = page
      .locator('[name="country"]')
      .locator('..')
      .locator('select, [role="combobox"]')
      .first()
    if (await countrySelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await countrySelect.click()
      await page
        .getByRole('option', { name: /france/i })
        .first()
        .click()
    } else {
      const countryButton = page.locator('button:has-text("Sélectionner")').first()
      if (await countryButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await countryButton.click()
        await page
          .getByRole('option', { name: /france/i })
          .first()
          .click()
      }
    }

    // Steps 2-3-4 (optionnels, on passe)
    await page.getByRole('button', { name: /suivant/i }).click()
    await expect(page.getByRole('button', { name: /suivant/i })).toBeVisible({ timeout: 3000 })
    await page.getByRole('button', { name: /suivant/i }).click()
    await expect(page.getByRole('button', { name: /suivant/i })).toBeVisible({ timeout: 3000 })
    await page.getByRole('button', { name: /suivant/i }).click()

    // Soumettre
    const submitButton = page.getByRole('button', { name: /créer l'édition|ajouter l'édition/i })
    await expect(submitButton).toBeVisible({ timeout: 3000 })
    await submitButton.scrollIntoViewIfNeeded()

    const [editionResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/editions') && res.request().method() === 'POST'
      ),
      submitButton.click(),
    ])

    expect(editionResponse.ok()).toBe(true)
    await page.waitForURL(/profile\/mes-conventions/, { timeout: 10000 })
  })

  test('la convention et son édition sont visibles dans mes conventions', async ({
    page,
    goto,
  }) => {
    await goto('/profile/mes-conventions', { waitUntil: 'hydration' })

    await expect(page.getByText(CONVENTION_NAME).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/éditions?\s*\(0\)/i)).not.toBeVisible()
  })
})
