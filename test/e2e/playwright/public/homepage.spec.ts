import { expect, test } from '@nuxt/test-utils/playwright'

test.describe("Page d'accueil", () => {
  test('affiche les éditions ou un message vide', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    // Attendre que du contenu apparaisse (éditions ou message vide)
    await page.waitForSelector('a[href*="/editions/"], :text("aucune convention")', {
      timeout: 10000,
    })

    const editionLinks = page.locator('a[href*="/editions/"]')
    const noResults = page.getByText(/aucune convention/i)

    const hasEditions = (await editionLinks.count()) > 0
    const hasNoResults = await noResults.isVisible().catch(() => false)

    expect(hasEditions || hasNoResults).toBe(true)
  })

  test('affiche les onglets de vue (Grille, Agenda, Carte)', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    await expect(page.getByText('Grille')).toBeVisible()
    await expect(page.getByText('Agenda')).toBeVisible()
    await expect(page.getByText('Carte')).toBeVisible()
  })

  test('peut changer de mode de vue', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    // Cliquer sur Agenda
    await page.getByText('Agenda').click()
    await expect(page).toHaveURL(/view=agenda/)

    // Cliquer sur Carte
    await page.getByText('Carte').click()
    await expect(page).toHaveURL(/view=map/)

    // Revenir en Grille
    await page.getByText('Grille').click()
    await expect(page).not.toHaveURL(/view=/)
  })
})

test.describe('Navigation', () => {
  test('le header et le footer sont visibles', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
  })

  test('la page de connexion est accessible', async ({ page, goto }) => {
    await goto('/login', { waitUntil: 'hydration' })

    // Le formulaire de connexion doit contenir un champ email
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]')).toBeVisible()
  })
})
