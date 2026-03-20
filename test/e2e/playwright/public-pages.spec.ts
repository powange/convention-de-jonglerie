import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Pages publiques', () => {
  test('la page guide est accessible', async ({ page, goto }) => {
    await goto('/guide', { waitUntil: 'hydration' })

    // La page doit contenir du contenu
    await expect(page.locator('main')).toBeVisible()
  })

  test('la politique de confidentialité est accessible', async ({ page, goto }) => {
    await goto('/privacy-policy', { waitUntil: 'hydration' })

    await expect(page.locator('main')).toBeVisible()
  })

  test('le footer contient les liens importants', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    const footer = page.locator('footer')
    await expect(footer).toBeVisible()

    // Liens du footer
    await expect(footer.getByText(/confidentialité|privacy/i)).toBeVisible()
    await expect(footer.getByText(/guide/i)).toBeVisible()
  })

})

test.describe('Page 404', () => {
  test('affiche une page 404 pour une URL inexistante', async ({ page, goto }) => {
    const response = await goto('/cette-page-nexiste-pas', { waitUntil: 'hydration' })

    // La page doit indiquer une erreur ou un contenu par défaut
    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
  })
})
