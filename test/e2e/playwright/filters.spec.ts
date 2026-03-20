import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Filtres de la page d\'accueil', () => {
  test('le panneau de filtres est visible sur desktop', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    // Le panneau de filtres doit être visible (caché sur mobile, visible sur lg+)
    const filtersPanel = page.getByText(/filtres/i).first()
    await expect(filtersPanel).toBeVisible()
  })

  test('la recherche par nom filtre les résultats', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await page.waitForSelector('a[href*="/editions/"]', { timeout: 10000 })

    // Compter les éditions initiales
    const initialCount = await page.locator('a[href*="/editions/"]').count()

    // Taper un texte de recherche improbable
    const searchInput = page.locator('input[placeholder*="recherch" i], input[placeholder*="search" i]').first()

    if (await searchInput.isVisible()) {
      await searchInput.fill('xyzimpossible123')

      // Attendre que le contenu change (debounce + réponse API)
      await expect(async () => {
        const newCount = await page.locator('a[href*="/editions/"]').count()
        const noResults = await page.getByText(/aucune convention/i).isVisible().catch(() => false)
        expect(newCount < initialCount || noResults).toBe(true)
      }).toPass({ timeout: 5000 })
    }
  })

  test('les filtres temporels sont disponibles', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    // Les checkboxes ou toggles pour les filtres temporels doivent exister
    const pastFilter = page.getByText(/passée|terminée/i).first()
    const currentFilter = page.getByText(/en cours/i).first()
    const futureFilter = page.getByText(/à venir|futur/i).first()

    // Au moins un filtre temporel doit être visible
    const hasPast = await pastFilter.isVisible().catch(() => false)
    const hasCurrent = await currentFilter.isVisible().catch(() => false)
    const hasFuture = await futureFilter.isVisible().catch(() => false)

    expect(hasPast || hasCurrent || hasFuture).toBe(true)
  })
})
